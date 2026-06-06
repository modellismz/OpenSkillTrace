from __future__ import annotations

import hashlib
import hmac
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import Body, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


ROOT = Path(__file__).resolve().parents[1]
ASSETS_DIR = ROOT / "assets"
INDEX_HTML = ROOT / "index.html"
LOCAL_ENV = ROOT / ".env.local"
COLLECTIONS = {
    "workflows": "/api/workflows",
    "mcp_servers": "/api/mcp/servers",
    "providers": "/api/providers",
    "provider_keys": "/api/provider-keys",
    "fallback_policies": "/api/fallback-policies",
    "rag_sources": "/api/rag/sources",
    "replay_scenarios": "/api/replay/scenarios",
    "approvals": "/api/approvals",
    "audit_events": "/api/audit-events",
}


def load_local_env(path: Path = LOCAL_ENV) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class JsonRepository:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.data = self._load()

    def _empty(self) -> dict[str, Any]:
        return {
            **{name: [] for name in COLLECTIONS},
            "settings": {},
        }

    def _load(self) -> dict[str, Any]:
        if not self.path.exists():
            return self._empty()
        try:
            loaded = json.loads(self.path.read_text())
        except json.JSONDecodeError:
            return self._empty()
        base = self._empty()
        base.update({k: v for k, v in loaded.items() if k in base})
        return base

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.data, indent=2, sort_keys=True))

    def list(self, collection: str) -> list[dict[str, Any]]:
        return list(self.data[collection])

    def get(self, collection: str, item_id: str) -> dict[str, Any]:
        for item in self.data[collection]:
            if item["id"] == item_id:
                return item
        raise HTTPException(status_code=404, detail=f"{collection} item not found")

    def upsert(self, collection: str, payload: dict[str, Any]) -> dict[str, Any]:
        item = sanitize_payload(collection, payload)
        now = utc_now()
        item.setdefault("id", str(uuid.uuid4()))
        item.setdefault("created_at", now)
        item["updated_at"] = now
        for idx, existing in enumerate(self.data[collection]):
            if existing["id"] == item["id"]:
                merged = {**existing, **item, "created_at": existing.get("created_at", item["created_at"])}
                self.data[collection][idx] = merged
                self.save()
                return merged
        self.data[collection].append(item)
        self.save()
        return item

    def patch(self, collection: str, item_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        existing = self.get(collection, item_id)
        merged = {**existing, **sanitize_payload(collection, payload), "id": item_id, "updated_at": utc_now()}
        self.data[collection][self.data[collection].index(existing)] = merged
        self.save()
        return merged

    def delete(self, collection: str, item_id: str) -> dict[str, Any]:
        item = self.get(collection, item_id)
        self.data[collection].remove(item)
        self.save()
        return {"deleted": True, "id": item_id}


def sanitize_payload(collection: str, payload: dict[str, Any]) -> dict[str, Any]:
    item = dict(payload)
    if collection == "provider_keys":
        raw_key = str(item.pop("key", item.pop("api_key", "")))
        if raw_key:
            item["key_fingerprint"] = hashlib.sha256(raw_key.encode()).hexdigest()[:16]
            item["key_masked"] = f"{raw_key[:7]}...{raw_key[-4:]}" if len(raw_key) > 12 else "masked"
        item.pop("secret", None)
        item.pop("plaintext", None)
    return item


def get_repo() -> JsonRepository:
    db_path = Path(os.getenv("OST_DATABASE_PATH", str(ROOT / "data" / "openskilltrace.json")))
    if not db_path.is_absolute():
        db_path = ROOT / db_path
    return JsonRepository(db_path)


def sign_audit_packet(packet: dict[str, Any]) -> str:
    secret = os.getenv("OST_AUDIT_SIGNING_SECRET", "local-dev-secret")
    body = json.dumps(packet, sort_keys=True).encode()
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def require_write_auth(request: Request) -> None:
    if os.getenv("OST_ENV", "development").lower() != "production":
        return
    token = os.getenv("OST_PLATFORM_API_TOKEN")
    if not token:
        raise HTTPException(status_code=500, detail="Production write token is not configured")
    expected = f"Bearer {token}"
    if request.headers.get("authorization") != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Write token required")


def install_collection_routes(app: FastAPI, collection: str, base_path: str) -> None:
    @app.get(base_path, name=f"list_{collection}")
    def list_items(collection_name: str = collection):
        return {"items": get_repo().list(collection_name)}

    @app.post(base_path, name=f"create_{collection}", status_code=201)
    def create_item(request: Request, payload: dict[str, Any] = Body(...), collection_name: str = collection):
        require_write_auth(request)
        return get_repo().upsert(collection_name, payload)

    @app.get(f"{base_path}/{{item_id}}", name=f"get_{collection}")
    def get_item(item_id: str, collection_name: str = collection):
        return get_repo().get(collection_name, item_id)

    @app.patch(f"{base_path}/{{item_id}}", name=f"patch_{collection}")
    def patch_item(request: Request, item_id: str, payload: dict[str, Any] = Body(...), collection_name: str = collection):
        require_write_auth(request)
        return get_repo().patch(collection_name, item_id, payload)

    @app.delete(f"{base_path}/{{item_id}}", name=f"delete_{collection}")
    def delete_item(request: Request, item_id: str, collection_name: str = collection):
        require_write_auth(request)
        return get_repo().delete(collection_name, item_id)


def create_app() -> FastAPI:
    load_local_env()

    app = FastAPI(
        title="OpenSkillTrace",
        description="AgentOps Workflow Platform backend",
        version="0.1.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=os.getenv("OST_CORS_ORIGINS", "http://localhost:8000").split(","),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
        response: Response = await call_next(request)
        response.headers["x-request-id"] = request_id
        return response

    @app.get("/api/health")
    def health():
        return {
            "status": "ok",
            "service": "openskilltrace",
            "live_llm_enabled": os.getenv("OST_ENABLE_LIVE_LLM", "false").lower() == "true",
            "model": os.getenv("OST_OPENAI_MODEL", "gpt-4.1-mini"),
        }

    for collection, base_path in COLLECTIONS.items():
        install_collection_routes(app, collection, base_path)

    @app.get("/api/settings")
    def get_settings():
        return get_repo().data["settings"]

    @app.post("/api/settings")
    def save_settings(request: Request, payload: dict[str, Any] = Body(...)):
        require_write_auth(request)
        repo = get_repo()
        repo.data["settings"] = {**repo.data["settings"], **payload, "updated_at": utc_now()}
        repo.save()
        return repo.data["settings"]

    @app.post("/api/investigations/scam-response")
    def run_scam_response(request: Request, payload: dict[str, Any] = Body(...)):
        require_write_auth(request)
        amount = payload.get("amount", "฿50,000")
        claim = payload.get("claim", "Customer reports a scam transfer")
        packet = {
            "claim": claim,
            "trace": [
                {"step": "normalize_claim", "status": "ok"},
                {"step": "collect_evidence", "status": "ok", "sources": ["ledger", "device_risk", "mule_graph", "fraud_sop_rag"]},
                {"step": "policy_gate", "status": "blocked_write_actions"},
                {"step": "human_approval", "status": "required"},
            ],
            "evidence": {
                "amount": amount,
                "risk_class": "likely_scam",
                "confidence": 0.76,
                "citations": ["fraud_sop:refund_freeze_policy", "aml:escalation_rule"],
            },
            "decision": {
                "mode": "evidence_only",
                "blocked_actions": ["freeze", "refund", "reversal"],
                "next_step": "senior_fraud_analyst_approval",
            },
            "generated_at": utc_now(),
        }
        packet["audit_signature"] = sign_audit_packet(packet)
        repo = get_repo()
        repo.upsert("audit_events", {"type": "investigation", "packet": packet})
        return packet

    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str):
        if path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        return FileResponse(INDEX_HTML)

    return app


app = create_app()
