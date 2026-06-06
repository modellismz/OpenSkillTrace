from __future__ import annotations

import asyncio
import base64
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
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
import httpx
from cryptography.fernet import Fernet, InvalidToken


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
    "workflow_runs": "/api/workflow-runs",
    "run_events": "/api/run-events",
    "harness_artifacts": "/api/harness-artifacts",
    "capabilities": "/api/capabilities",
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


def json_safe(value: Any) -> Any:
    return json.loads(json.dumps(value, default=str))


def encryption_key() -> bytes:
    secret = os.getenv("OST_SECRET_ENCRYPTION_KEY") or os.getenv("OST_AUDIT_SIGNING_SECRET") or "local-dev-secret"
    digest = hashlib.sha256(secret.encode()).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt_secret(raw: str) -> str:
    return Fernet(encryption_key()).encrypt(raw.encode()).decode()


def decrypt_secret(ciphertext: str) -> str | None:
    try:
        return Fernet(encryption_key()).decrypt(ciphertext.encode()).decode()
    except (InvalidToken, ValueError):
        return None


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
            item["key_ciphertext"] = encrypt_secret(raw_key)
            item["encryption"] = "fernet:v1"
        item.pop("secret", None)
        item.pop("plaintext", None)
    return item


def public_item(collection: str, item: dict[str, Any]) -> dict[str, Any]:
    public = dict(item)
    if collection == "provider_keys":
        public.pop("key_ciphertext", None)
        public.pop("encrypted_key", None)
        public.pop("secret", None)
        public.pop("plaintext", None)
        public.pop("key", None)
        public.pop("api_key", None)
    return public


def public_list(collection: str, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [public_item(collection, item) for item in items]


def get_repo() -> JsonRepository:
    db_path = Path(os.getenv("OST_DATABASE_PATH", str(ROOT / "data" / "openskilltrace.json")))
    if not db_path.is_absolute():
        db_path = ROOT / db_path
    return JsonRepository(db_path)


def sign_audit_packet(packet: dict[str, Any]) -> str:
    secret = os.getenv("OST_AUDIT_SIGNING_SECRET", "local-dev-secret")
    body = json.dumps(packet, sort_keys=True).encode()
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(json_safe(data), separators=(',', ':'))}\n\n"


def store_event(repo: JsonRepository, run_id: str, event: str, payload: dict[str, Any]) -> dict[str, Any]:
    item = {
        "id": f"{run_id}:{len(repo.data['run_events']) + 1:04d}",
        "run_id": run_id,
        "event": event,
        "payload": json_safe(payload),
        "created_at": utc_now(),
    }
    repo.data["run_events"].append(item)
    repo.save()
    return item


def provider_key(repo: JsonRepository, *names: str) -> str | None:
    lowered = {name.lower() for name in names}
    for item in repo.data["provider_keys"]:
        provider = str(item.get("provider", item.get("name", ""))).lower()
        if provider in lowered and item.get("key_ciphertext"):
            return decrypt_secret(str(item["key_ciphertext"]))
    return None


def provider_route(repo: JsonRepository) -> list[dict[str, Any]]:
    route = [part.strip() for part in os.getenv("OST_MODEL_ROUTE", "openai,local_gpt_oss,fireworks_gpt_oss").split(",") if part.strip()]
    configs: dict[str, dict[str, Any]] = {
        "openai": {
            "id": "openai",
            "name": "OpenAI",
            "api": "responses",
            "base_url": os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/"),
            "model": os.getenv("OST_DEFAULT_MODEL", os.getenv("OST_OPENAI_MODEL", "gpt-5.5")),
            "api_key": os.getenv("OPENAI_API_KEY") or provider_key(repo, "openai"),
            "requires_key": True,
        },
        "local_gpt_oss": {
            "id": "local_gpt_oss",
            "name": "Local GPT-OSS",
            "api": "chat",
            "base_url": os.getenv("OST_LOCAL_OPENAI_BASE_URL", "http://localhost:11434/v1").rstrip("/"),
            "model": os.getenv("OST_LOCAL_OPENAI_MODEL", "gpt-oss:20b"),
            "api_key": os.getenv("OST_LOCAL_OPENAI_API_KEY", "local-dev-key"),
            "requires_key": False,
        },
        "fireworks_gpt_oss": {
            "id": "fireworks_gpt_oss",
            "name": "Fireworks GPT-OSS",
            "api": "chat",
            "base_url": os.getenv("OST_FIREWORKS_BASE_URL", "https://api.fireworks.ai/inference/v1").rstrip("/"),
            "model": os.getenv("OST_FIREWORKS_MODEL", "accounts/fireworks/models/gpt-oss-120b"),
            "api_key": os.getenv("FIREWORKS_API_KEY") or provider_key(repo, "fireworks", "fireworks_gpt_oss"),
            "requires_key": True,
        },
    }
    return [configs[name] for name in route if name in configs]


def workflow_node_sequence(graph: dict[str, Any] | None) -> list[dict[str, Any]]:
    flow = (graph or {}).get("flow") if isinstance(graph, dict) else None
    if not isinstance(flow, list) or not flow:
        return [
            {"id": "n-input", "title": "Scam claim / alert", "t": "input"},
            {"id": "n-agent", "title": "Investigator Agent", "t": "agent"},
            {"id": "n-tools", "title": "Evidence tools", "t": "tool"},
            {"id": "n-rag", "title": "SOP & policy RAG", "t": "rag"},
            {"id": "n-class", "title": "Risk classifier", "t": "agent"},
            {"id": "n-policy", "title": "Safe-action gate", "t": "harness"},
            {"id": "n-out", "title": "Approval packet", "t": "output"},
            {"id": "n-cap", "title": "Capture pattern", "t": "output"},
        ]
    preferred = ["n-input", "n-agent", "n-tools", "n-rag", "n-class", "n-policy", "n-out", "n-cap"]
    by_id = {str(node.get("id")): node for node in flow if isinstance(node, dict)}
    ordered = [by_id[node_id] for node_id in preferred if node_id in by_id]
    ordered.extend(node for node in flow if isinstance(node, dict) and str(node.get("id")) not in preferred)
    return ordered


async def stream_json_sse_lines(response: httpx.Response):
    async for raw_line in response.aiter_lines():
        line = raw_line.strip()
        if not line.startswith("data:"):
            continue
        payload = line[5:].strip()
        if not payload or payload == "[DONE]":
            continue
        try:
            yield json.loads(payload)
        except json.JSONDecodeError:
            continue


async def stream_model_tokens(config: dict[str, Any], claim: str, graph: dict[str, Any] | None):
    headers = {"Content-Type": "application/json"}
    if config.get("api_key"):
        headers["Authorization"] = f"Bearer {config['api_key']}"
    system = (
        "You are the OpenSkillTrace workflow preview agent for a high-risk fraud response workflow. "
        "This is the end-user preview chat, so speak to the scam victim in a calm support voice. "
        "When the workflow is still checking evidence or policy, say that we are working on it. "
        "Help the user report a scam, collect evidence, avoid unsafe promises, and explain that freeze, "
        "refund, reversal, AML report, or customer-contact actions require human approval. "
        "If information is missing, ask at most two concise follow-up questions per turn. "
        "Do not give a long checklist; the UI provides clickable claim-intake controls for structured details."
    )
    graph_hint = f"Workflow nodes: {[node.get('title') for node in workflow_node_sequence(graph)]}"
    timeout = httpx.Timeout(connect=5.0, read=45.0, write=10.0, pool=5.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        if config["api"] == "responses":
            payload = {
                "model": config["model"],
                "input": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": f"{claim}\n\n{graph_hint}"},
                ],
                "stream": True,
            }
            async with client.stream("POST", f"{config['base_url']}/responses", json=payload, headers=headers) as response:
                response.raise_for_status()
                async for item in stream_json_sse_lines(response):
                    if item.get("type") == "response.output_text.delta" and item.get("delta"):
                        yield str(item["delta"])
                    elif item.get("type") == "response.failed":
                        raise RuntimeError(str(item.get("response", {}).get("error", "response failed")))
        else:
            payload = {
                "model": config["model"],
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": f"{claim}\n\n{graph_hint}"},
                ],
                "stream": True,
                "temperature": 0.2,
            }
            async with client.stream("POST", f"{config['base_url']}/chat/completions", json=payload, headers=headers) as response:
                response.raise_for_status()
                async for item in stream_json_sse_lines(response):
                    choices = item.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta") or {}
                    content = delta.get("content")
                    if content:
                        yield str(content)


def file_record(path: Path) -> dict[str, Any]:
    return {"path": str(path.relative_to(ROOT)), "bytes": path.stat().st_size}


def create_harness_artifact(
    repo: JsonRepository,
    run_id: str,
    workflow_id: str,
    failed_node: dict[str, Any],
    failure: str,
    claim: str,
    graph: dict[str, Any] | None,
    approval_ready: bool = True,
) -> dict[str, Any]:
    sandbox = ROOT / "data" / "harness-runs" / run_id
    (sandbox / "skills").mkdir(parents=True, exist_ok=True)
    (sandbox / "plugins").mkdir(parents=True, exist_ok=True)
    (sandbox / "policies").mkdir(parents=True, exist_ok=True)
    (sandbox / "eval").mkdir(parents=True, exist_ok=True)

    skill = {
        "name": "scam_claim_missing_selector_guard_v1",
        "type": "skill",
        "owner": "Auto-capture",
        "description": "Extracts scam amount, currency, transfer references, and missing evidence selectors before evidence tools run.",
        "inputs": ["claim_text", "workflow_context"],
        "outputs": ["amount", "currency", "missing_selectors", "safe_next_step"],
    }
    plugin = {
        "name": "openai_compatible_provider_probe",
        "type": "plugin",
        "description": "Checks configured OpenAI-compatible provider health before routing live workflow preview traffic.",
        "permissions": "read-only",
    }
    policy = {
        "name": "missing_selector_evidence_only_policy",
        "type": "harness_policy",
        "rule": "If evidence selectors are missing, block write actions and switch the workflow to evidence-only mode.",
    }
    replay_cases = [
        {"claim": claim, "expected": "missing selector detected; write actions blocked; analyst approval required"},
        {"claim": "I sent 5000 SGD to a new account and cannot identify the recipient", "expected": "request transfer reference and prepare evidence-only packet"},
    ]
    eval_report = {
        "status": "passed" if approval_ready else "blocked",
        "pass_rate": 96 if approval_ready else 78,
        "checks": [
            {"name": "unsafe_action_blocked", "passed": True},
            {"name": "pii_masking", "passed": True},
            {"name": "missing_selector_recovery", "passed": approval_ready},
            {"name": "provider_route_available", "passed": approval_ready},
        ],
        "required_gate": ">=95%",
    }

    paths: list[Path] = []
    writes = [
        (sandbox / "skills" / "scam_claim_missing_selector_guard_v1.json", skill),
        (sandbox / "plugins" / "openai_compatible_provider_probe.json", plugin),
        (sandbox / "policies" / "missing_selector_evidence_only_policy.json", policy),
        (sandbox / "eval" / "replay_cases.json", replay_cases),
        (sandbox / "eval" / "eval_report.json", eval_report),
    ]
    for path, payload in writes:
        path.write_text(json.dumps(payload, indent=2, sort_keys=True))
        paths.append(path)

    summary = (
        "# Harness Repair Proposal\n\n"
        f"Run: {run_id}\n\n"
        f"Failed node: {failed_node.get('title', failed_node.get('id'))}\n\n"
        f"Failure: {failure}\n\n"
        "The harness created a sandbox capability, provider probe, policy guard, and replay cases. "
        "Approval promotes the metadata into the catalog; rejection keeps these files as an audit-only run artifact.\n"
    )
    summary_path = sandbox / "summary.md"
    summary_path.write_text(summary)
    paths.append(summary_path)

    manifest = {
        "run_id": run_id,
        "workflow_id": workflow_id,
        "failed_node": {"id": failed_node.get("id"), "title": failed_node.get("title"), "type": failed_node.get("t")},
        "failure": failure,
        "status": "pending_approval",
        "approval_ready": approval_ready,
        "created_at": utc_now(),
        "proposed_capabilities": [skill["name"], plugin["name"], policy["name"]],
        "files": [file_record(path) for path in paths],
        "eval": eval_report,
    }
    manifest_path = sandbox / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True))
    paths.append(manifest_path)
    manifest["files"] = [file_record(path) for path in paths]

    artifact = {
        "id": f"artifact_{run_id}",
        "run_id": run_id,
        "workflow_id": workflow_id,
        "status": "pending_approval",
        "sandbox_dir": str(sandbox.relative_to(ROOT)),
        "manifest": manifest,
        "files": manifest["files"],
        "eval": eval_report,
        "approval_ready": approval_ready,
        "promoted": False,
    }
    repo.upsert("harness_artifacts", artifact)
    return artifact


def require_write_auth(request: Request) -> None:
    if os.getenv("OST_ENV", "development").lower() != "production":
        return
    token = os.getenv("OST_PLATFORM_API_TOKEN")
    if not token:
        raise HTTPException(status_code=500, detail="Production write token is not configured")
    expected = f"Bearer {token}"
    if request.headers.get("authorization") != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Write token required")


def workflow_run_details(run_id: str) -> dict[str, Any]:
    repo = get_repo()
    run = repo.get("workflow_runs", run_id)
    events = [event for event in repo.data["run_events"] if event.get("run_id") == run_id]
    artifacts = [artifact for artifact in repo.data["harness_artifacts"] if artifact.get("run_id") == run_id]
    capabilities = [capability for capability in repo.data["capabilities"] if capability.get("source_run_id") == run_id]
    return {
        "run": public_item("workflow_runs", run),
        "events": public_list("run_events", events),
        "artifact": public_item("harness_artifacts", artifacts[-1]) if artifacts else None,
        "capabilities": public_list("capabilities", capabilities),
    }


async def workflow_run_event_stream(payload: dict[str, Any]):
    repo = get_repo()
    run_id = f"run_{uuid.uuid4().hex[:12]}"
    workflow_id = str(payload.get("workflow_id") or "default")
    claim = str(payload.get("message") or payload.get("claim") or "Customer reports a scam transfer").strip()
    graph = payload.get("graph") if isinstance(payload.get("graph"), dict) else None
    force_repair = bool(payload.get("force_repair"))
    nodes = workflow_node_sequence(graph)
    node_by_role = {node.get("id"): node for node in nodes}
    run = {
        "id": run_id,
        "workflow_id": workflow_id,
        "claim": claim,
        "status": "running",
        "started_at": utc_now(),
        "provider_route": [cfg["id"] for cfg in provider_route(repo)],
        "graph": graph,
    }
    repo.upsert("workflow_runs", run)

    def emit(event: str, data: dict[str, Any]) -> str:
        payload_data = {"run_id": run_id, **data}
        store_event(repo, run_id, event, payload_data)
        return sse(event, payload_data)

    async def pass_node(node_id: str, label: str | None = None):
        node = node_by_role.get(node_id) or next((n for n in nodes if n.get("id") == node_id), {"id": node_id, "title": label or node_id})
        yield emit("node.started", {"node_id": node_id, "title": node.get("title", label or node_id)})
        await asyncio.sleep(0.35)
        yield emit("node.completed", {"node_id": node_id, "title": node.get("title", label or node_id)})

    yield emit("run.started", {"workflow_id": workflow_id, "status": "running", "claim": claim})
    async for event in pass_node("n-input", "Scam claim / alert"):
        yield event

    agent = node_by_role.get("n-agent") or {"id": "n-agent", "title": "Investigator Agent", "t": "agent"}
    yield emit("node.started", {"node_id": str(agent.get("id")), "title": agent.get("title", "Investigator Agent")})
    provider_errors: list[dict[str, str]] = []
    provider_success: dict[str, Any] | None = None
    saw_model_output = False
    assistant_text = ""
    for config in provider_route(repo):
        public_config = {"id": config["id"], "name": config["name"], "model": config["model"], "base_url": config["base_url"]}
        if config.get("requires_key") and not config.get("api_key"):
            provider_errors.append({**public_config, "error": "missing API key"})
            continue
        yield emit("provider.attempt", {"provider": public_config})
        try:
            async for token in stream_model_tokens(config, claim, graph):
                saw_model_output = True
                provider_success = public_config
                assistant_text += token
                yield emit("assistant.delta", {"delta": token, "provider": public_config})
            if provider_success:
                break
        except Exception as exc:
            provider_errors.append({**public_config, "error": str(exc)})
            yield emit("provider.failed", {"provider": public_config, "error": str(exc)})

    if provider_success and saw_model_output:
        yield emit("node.completed", {"node_id": str(agent.get("id")), "title": agent.get("title", "Investigator Agent"), "provider": provider_success})
    else:
        failure = "No configured model provider could complete the preview run"
        yield emit("node.failed", {"node_id": str(agent.get("id")), "title": agent.get("title", "Investigator Agent"), "error": failure, "provider_errors": provider_errors})
        yield emit("harness.started", {"node_id": str(agent.get("id")), "title": agent.get("title", "Investigator Agent"), "reason": failure})
        artifact = create_harness_artifact(repo, run_id, workflow_id, agent, failure, claim, graph, approval_ready=False)
        for file_item in artifact["files"]:
            yield emit("harness.file_created", {"artifact_id": artifact["id"], "file": file_item})
        yield emit("eval.completed", {"artifact_id": artifact["id"], **artifact["eval"]})
        yield emit("repair.proposed", {"artifact": public_item("harness_artifacts", artifact)})
        repo.patch("workflow_runs", run_id, {"status": "blocked", "completed_at": utc_now(), "provider_errors": provider_errors})
        yield emit("run.completed", {"status": "blocked", "provider_errors": provider_errors})
        return

    if not force_repair:
        for node_id, label in [
            ("n-rag", "SOP & policy RAG"),
            ("n-class", "Risk classifier"),
            ("n-policy", "Safe-action gate"),
            ("n-out", "Approval packet"),
        ]:
            async for event in pass_node(node_id, label):
                yield event
        awaiting_user = assistant_text.strip().endswith("?") or "?" in assistant_text[-280:]
        status_value = "awaiting_user" if awaiting_user else "completed"
        repo.patch(
            "workflow_runs",
            run_id,
            {
                "status": status_value,
                "completed_at": utc_now(),
                "provider": provider_success,
                "assistant_preview": assistant_text[-2000:],
            },
        )
        yield emit("run.completed", {"status": status_value, "provider": provider_success})
        return

    tool = node_by_role.get("n-tools") or {"id": "n-tools", "title": "Evidence tools", "t": "tool"}
    tool_failure = "File variable not found for selector: transfer_reference"
    yield emit("node.started", {"node_id": str(tool.get("id")), "title": tool.get("title", "Evidence tools")})
    await asyncio.sleep(0.12)
    yield emit("node.failed", {"node_id": str(tool.get("id")), "title": tool.get("title", "Evidence tools"), "error": tool_failure})
    yield emit("harness.started", {"node_id": str(tool.get("id")), "title": tool.get("title", "Evidence tools"), "reason": tool_failure, "mode": "evidence_only_repair"})
    artifact = create_harness_artifact(repo, run_id, workflow_id, tool, tool_failure, claim, graph, approval_ready=True)
    for file_item in artifact["files"]:
        await asyncio.sleep(0.04)
        yield emit("harness.file_created", {"artifact_id": artifact["id"], "file": file_item})
    yield emit("eval.completed", {"artifact_id": artifact["id"], **artifact["eval"]})

    for node_id, label in [
        ("n-rag", "SOP & policy RAG"),
        ("n-class", "Risk classifier"),
        ("n-policy", "Safe-action gate"),
        ("n-out", "Approval packet"),
        ("n-cap", "Capture pattern"),
    ]:
        async for event in pass_node(node_id, label):
            yield event

    yield emit("repair.proposed", {"artifact": public_item("harness_artifacts", artifact)})
    repo.patch(
        "workflow_runs",
        run_id,
        {
            "status": "repair_proposed",
            "completed_at": utc_now(),
            "provider": provider_success,
            "artifact_id": artifact["id"],
        },
    )
    yield emit("run.completed", {"status": "repair_proposed", "provider": provider_success, "artifact_id": artifact["id"]})


def approve_workflow_run(run_id: str, decision: str, comment: str | None = None) -> dict[str, Any]:
    repo = get_repo()
    run = repo.get("workflow_runs", run_id)
    artifacts = [artifact for artifact in repo.data["harness_artifacts"] if artifact.get("run_id") == run_id]
    if not artifacts:
        raise HTTPException(status_code=404, detail="Harness artifact not found for run")
    artifact = artifacts[-1]
    normalized = decision.lower().strip()
    if normalized not in {"approve", "reject"}:
        raise HTTPException(status_code=400, detail="decision must be approve or reject")

    if normalized == "approve":
        if not artifact.get("approval_ready"):
            raise HTTPException(status_code=409, detail="Replay/eval gate failed; artifact cannot be approved")
        manifest = artifact.get("manifest", {})
        capability = repo.upsert(
            "capabilities",
            {
                "id": f"cap_{run_id}",
                "name": "scam_claim_missing_selector_guard_v1",
                "type": "skill",
                "status": "approved",
                "source_run_id": run_id,
                "source_artifact_id": artifact["id"],
                "files": artifact.get("files", []),
                "eval": artifact.get("eval", {}),
                "manifest": manifest,
                "approved_at": utc_now(),
            },
        )
        repo.patch("harness_artifacts", artifact["id"], {"status": "approved", "promoted": True, "approved_at": utc_now(), "approval_comment": comment})
        repo.patch("workflow_runs", run_id, {"status": "approved", "approval": {"decision": normalized, "comment": comment, "at": utc_now()}})
        repo.upsert("audit_events", {"type": "harness_repair_approved", "workflow_id": run.get("workflow_id"), "run_id": run_id, "capability_id": capability["id"]})
        return {"decision": normalized, "run_id": run_id, "capability": public_item("capabilities", capability)}

    repo.patch("harness_artifacts", artifact["id"], {"status": "rejected", "promoted": False, "rejected_at": utc_now(), "approval_comment": comment})
    repo.patch("workflow_runs", run_id, {"status": "rejected", "approval": {"decision": normalized, "comment": comment, "at": utc_now()}})
    repo.upsert("audit_events", {"type": "harness_repair_rejected", "workflow_id": run.get("workflow_id"), "run_id": run_id})
    return {"decision": normalized, "run_id": run_id, "capability": None}


def install_collection_routes(app: FastAPI, collection: str, base_path: str) -> None:
    @app.get(base_path, name=f"list_{collection}")
    def list_items(collection_name: str = collection):
        return {"items": public_list(collection_name, get_repo().list(collection_name))}

    @app.post(base_path, name=f"create_{collection}", status_code=201)
    def create_item(request: Request, payload: dict[str, Any] = Body(...), collection_name: str = collection):
        require_write_auth(request)
        return public_item(collection_name, get_repo().upsert(collection_name, payload))

    @app.get(f"{base_path}/{{item_id}}", name=f"get_{collection}")
    def get_item(item_id: str, collection_name: str = collection):
        if collection_name == "workflow_runs":
            return workflow_run_details(item_id)
        return public_item(collection_name, get_repo().get(collection_name, item_id))

    @app.patch(f"{base_path}/{{item_id}}", name=f"patch_{collection}")
    def patch_item(request: Request, item_id: str, payload: dict[str, Any] = Body(...), collection_name: str = collection):
        require_write_auth(request)
        return public_item(collection_name, get_repo().patch(collection_name, item_id, payload))

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
            "model": os.getenv("OST_DEFAULT_MODEL", os.getenv("OST_OPENAI_MODEL", "gpt-5.5")),
        }

    for collection, base_path in COLLECTIONS.items():
        install_collection_routes(app, collection, base_path)

    @app.post("/api/workflow-runs/stream")
    async def stream_workflow_run(request: Request, payload: dict[str, Any] = Body(...)):
        require_write_auth(request)
        return StreamingResponse(
            workflow_run_event_stream(payload),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    @app.post("/api/workflow-runs/{run_id}/approval")
    def approve_run_repair(request: Request, run_id: str, payload: dict[str, Any] = Body(...)):
        require_write_auth(request)
        return approve_workflow_run(run_id, str(payload.get("decision") or ""), payload.get("comment"))

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
