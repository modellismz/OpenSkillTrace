from __future__ import annotations

import os
import uuid
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


ROOT = Path(__file__).resolve().parents[1]
ASSETS_DIR = ROOT / "assets"
INDEX_HTML = ROOT / "index.html"
LOCAL_ENV = ROOT / ".env.local"


def load_local_env(path: Path = LOCAL_ENV) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


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

    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str):
        if path.startswith("api/"):
            return {"detail": "Not found"}
        return FileResponse(INDEX_HTML)

    return app


app = create_app()
