from __future__ import annotations

import asyncio
import json
from pathlib import Path

from backend import mcp_server


def call_tool(name: str, arguments: dict | None = None):
    async def run():
        result = await mcp_server.mcp.call_tool(name, arguments or {})
        assert result
        return json.loads(result[0].text)

    return asyncio.run(run())


def list_tool_names() -> list[str]:
    async def run():
        return [tool.name for tool in await mcp_server.mcp.list_tools()]

    return asyncio.run(run())


def configure_tmp_env(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("OST_DATABASE_PATH", str(tmp_path / "openskilltrace.json"))
    monkeypatch.setenv("OST_RAG_DATABASE_PATH", str(tmp_path / "rag" / "rag.db"))
    monkeypatch.setenv("OST_RAG_UPLOAD_DIR", str(tmp_path / "rag" / "uploads"))
    monkeypatch.setenv("OST_ENV", "development")
    monkeypatch.setenv("OST_RAG_EMBED_PROVIDER", "local")
    monkeypatch.setenv("OST_QDRANT_URL", "http://127.0.0.1:1")


def test_mcp_lists_project_tools():
    names = set(list_tool_names())

    assert {
        "health",
        "list_collection_items",
        "upsert_collection_item",
        "run_workflow_preview",
        "upload_rag_source",
        "search_rag",
        "evaluate_rag",
    }.issubset(names)


def test_mcp_collection_tools_persist_and_redact_provider_keys(monkeypatch, tmp_path):
    configure_tmp_env(monkeypatch, tmp_path)

    created = call_tool(
        "upsert_collection_item",
        {"collection": "provider_keys", "payload": {"provider": "openai", "key": "sk-secret-1234567890"}},
    )

    assert "key" not in created
    assert "key_ciphertext" not in created
    assert created["key_masked"].startswith("sk-secr")

    listed = call_tool("list_collection_items", {"collection": "provider_keys"})
    assert listed["items"][0]["key_fingerprint"] == created["key_fingerprint"]

    stored = (tmp_path / "openskilltrace.json").read_text()
    assert "key_ciphertext" in stored
    assert "sk-secret-1234567890" not in stored


def test_mcp_rag_upload_process_and_search(monkeypatch, tmp_path):
    configure_tmp_env(monkeypatch, tmp_path)
    source_path = tmp_path / "fraud-sop.txt"
    source_path.write_text(
        "Refund freeze policy: escalate suspicious transfers. Contact jane@example.com.",
        encoding="utf-8",
    )
    monkeypatch.setattr(mcp_server.rag, "index_chunks_in_qdrant", lambda *args, **kwargs: True)
    monkeypatch.setattr(
        mcp_server.rag,
        "vector_search",
        lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("vector disabled")),
    )

    uploaded = call_tool("upload_rag_source", {"path": str(source_path), "workflow_node_ids": ["n-rag"]})
    job = call_tool("process_rag_job", {"job_id": uploaded["job"]["id"]})
    result = call_tool("search_rag", {"query": "refund freeze suspicious transfer", "top_k": 3})

    assert job["status"] == "indexed"
    assert result["fallback_used"] is True
    assert result["results"]
    assert "[EMAIL]" in result["results"][0]["excerpt"]
