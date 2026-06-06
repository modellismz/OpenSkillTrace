from __future__ import annotations

import json
import argparse
import os
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from mcp.server.fastmcp import FastMCP

from backend import rag
from backend.main import (
    COLLECTIONS,
    ROOT,
    approve_case_action as approve_case_action_impl,
    approve_workflow_run,
    build_case_approval_packet,
    compact_case_state,
    get_repo,
    infer_case_state_from_text,
    intake_schema_payload,
    intake_update_payload,
    load_local_env,
    merge_case_state,
    provider_route,
    public_item,
    public_list,
    sign_audit_packet,
    utc_now,
    workflow_node_sequence,
    workflow_run_details,
    workflow_run_event_stream,
)


load_local_env()
mcp = FastMCP(
    "OpenSkillTrace",
    host=os.getenv("OST_MCP_HOST", "0.0.0.0"),
    port=int(os.getenv("OST_MCP_PORT", "8001")),
)


def _public_provider(config: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in config.items() if key != "api_key"}


def _raise_readable(exc: Exception) -> None:
    if isinstance(exc, HTTPException):
        detail = exc.detail if isinstance(exc.detail, str) else json.dumps(exc.detail)
        raise ValueError(detail) from exc
    raise exc


def _collection_name(collection: str) -> str:
    normalized = collection.strip()
    if normalized not in COLLECTIONS:
        allowed = ", ".join(sorted(COLLECTIONS))
        raise ValueError(f"Unknown collection '{collection}'. Allowed collections: {allowed}")
    return normalized


async def _collect_workflow_events(payload: dict[str, Any]) -> dict[str, Any]:
    events: list[dict[str, Any]] = []
    async for raw_event in workflow_run_event_stream(payload):
        parsed = _parse_sse_event(raw_event)
        if parsed:
            events.append(parsed)
    run_id = events[0]["data"]["run_id"] if events else None
    return {
        "run_id": run_id,
        "events": events,
        "details": workflow_run_details(run_id) if run_id else None,
    }


def _parse_sse_event(block: str) -> dict[str, Any] | None:
    event = "message"
    data: dict[str, Any] | None = None
    for line in block.strip().splitlines():
        if line.startswith("event:"):
            event = line.split(":", 1)[1].strip()
        elif line.startswith("data:"):
            data = json.loads(line.split(":", 1)[1].strip())
    if data is None:
        return None
    return {"event": event, "data": data}


@mcp.tool()
def health() -> dict[str, Any]:
    """Return OpenSkillTrace service health and active model route metadata."""

    repo = get_repo()
    return {
        "status": "ok",
        "service": "openskilltrace",
        "time": utc_now(),
        "collections": sorted(COLLECTIONS),
        "providers": [_public_provider(config) for config in provider_route(repo)],
        "rag": rag.config_payload(),
    }


@mcp.tool()
def list_collections() -> dict[str, Any]:
    """List AgentOps collections exposed by the OpenSkillTrace backend."""

    repo = get_repo()
    return {
        "collections": [
            {"name": name, "api_path": path, "count": len(repo.data[name])}
            for name, path in COLLECTIONS.items()
        ]
    }


@mcp.tool()
def list_collection_items(collection: str) -> dict[str, Any]:
    """List items in an AgentOps collection such as workflows, providers, or audit_events."""

    name = _collection_name(collection)
    return {"items": public_list(name, get_repo().list(name))}


@mcp.tool()
def get_collection_item(collection: str, item_id: str) -> dict[str, Any]:
    """Get one item from an AgentOps collection by id."""

    name = _collection_name(collection)
    try:
        if name == "workflow_runs":
            return workflow_run_details(item_id)
        return public_item(name, get_repo().get(name, item_id))
    except Exception as exc:
        _raise_readable(exc)
        raise


@mcp.tool()
def upsert_collection_item(collection: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Create or replace an AgentOps collection item using the backend's persistence rules."""

    name = _collection_name(collection)
    try:
        return public_item(name, get_repo().upsert(name, payload))
    except Exception as exc:
        _raise_readable(exc)
        raise


@mcp.tool()
def patch_collection_item(collection: str, item_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Patch an AgentOps collection item by id."""

    name = _collection_name(collection)
    try:
        return public_item(name, get_repo().patch(name, item_id, payload))
    except Exception as exc:
        _raise_readable(exc)
        raise


@mcp.tool()
def delete_collection_item(collection: str, item_id: str) -> dict[str, Any]:
    """Delete an AgentOps collection item by id."""

    name = _collection_name(collection)
    try:
        return get_repo().delete(name, item_id)
    except Exception as exc:
        _raise_readable(exc)
        raise


@mcp.tool()
def get_settings() -> dict[str, Any]:
    """Return saved OpenSkillTrace settings."""

    return get_repo().data["settings"]


@mcp.tool()
def save_settings(payload: dict[str, Any]) -> dict[str, Any]:
    """Merge and persist OpenSkillTrace settings."""

    repo = get_repo()
    repo.data["settings"] = {**repo.data["settings"], **payload, "updated_at": utc_now()}
    repo.save()
    return repo.data["settings"]


@mcp.tool()
def run_scam_response(claim: str = "Customer reports a scam transfer", amount: str = "฿50,000") -> dict[str, Any]:
    """Run the evidence-only scam-response investigation function and persist an audit event."""

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
    get_repo().upsert("audit_events", {"type": "investigation", "packet": packet})
    return packet


@mcp.tool()
def infer_case_state(message: str, existing: dict[str, Any] | None = None, answers: dict[str, Any] | None = None) -> dict[str, Any]:
    """Infer and merge structured customer scam-intake state from free text and optional answers."""

    return {
        "inferred": infer_case_state_from_text(message),
        "case_state": merge_case_state(existing or {}, answers or {}, message),
    }


@mcp.tool()
def get_intake_schema(case_state: dict[str, Any] | None = None) -> dict[str, Any]:
    """Return the scam-claim intake schema with progress for a case state."""

    return intake_schema_payload(compact_case_state(case_state or {}))


@mcp.tool()
def get_intake_update(case_state: dict[str, Any] | None = None, limit: int = 3) -> dict[str, Any]:
    """Return the next missing scam-claim intake fields for a case state."""

    return intake_update_payload(compact_case_state(case_state or {}), limit=max(1, min(int(limit), 12)))


@mcp.tool()
def build_approval_packet(
    run_id: str,
    workflow_id: str,
    case_state: dict[str, Any],
    provider: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build the human-approval packet for a completed customer scam-intake case."""

    return build_case_approval_packet(run_id, workflow_id, compact_case_state(case_state), provider)


@mcp.tool()
def get_workflow_nodes(graph: dict[str, Any] | None = None) -> dict[str, Any]:
    """Return the normalized workflow node execution sequence for a workflow graph."""

    return {"nodes": workflow_node_sequence(graph)}


@mcp.tool()
async def run_workflow_preview(payload: dict[str, Any]) -> dict[str, Any]:
    """Run the workflow preview function and return collected SSE events plus persisted run details."""

    try:
        return await _collect_workflow_events(payload)
    except Exception as exc:
        _raise_readable(exc)
        raise


@mcp.tool()
def get_workflow_run(run_id: str) -> dict[str, Any]:
    """Return a workflow run with events, harness artifact, and promoted capabilities."""

    try:
        return workflow_run_details(run_id)
    except Exception as exc:
        _raise_readable(exc)
        raise


@mcp.tool()
def approve_harness_repair(run_id: str, decision: str, comment: str | None = None) -> dict[str, Any]:
    """Approve or reject a workflow harness repair proposal."""

    try:
        return approve_workflow_run(run_id, decision, comment)
    except Exception as exc:
        _raise_readable(exc)
        raise


@mcp.tool()
def approve_case_action(run_id: str, decision: str, comment: str | None = None) -> dict[str, Any]:
    """Approve, reject, or escalate a human-gated scam case action."""

    try:
        return approve_case_action_impl(run_id, decision, comment)
    except Exception as exc:
        _raise_readable(exc)
        raise


@mcp.tool()
def get_rag_config() -> dict[str, Any]:
    """Return RAG embedding configuration, Qdrant health, and index counts."""

    return rag.config_payload()


@mcp.tool()
def update_rag_config(payload: dict[str, Any]) -> dict[str, Any]:
    """Update RAG embedding configuration and mark indexed sources for reindex when needed."""

    try:
        return rag.update_config(payload)
    except Exception as exc:
        _raise_readable(exc)
        raise


@mcp.tool()
def list_rag_sources() -> dict[str, Any]:
    """List uploaded RAG sources."""

    return {"items": rag.list_sources()}


@mcp.tool()
def upload_rag_source(
    path: str,
    name: str | None = None,
    workflow_node_ids: list[str] | None = None,
    content_type: str | None = None,
) -> dict[str, Any]:
    """Upload a local .txt, .md, .csv, or .pdf file into the RAG source store and enqueue indexing."""

    source_path = Path(path).expanduser()
    if not source_path.is_absolute():
        source_path = ROOT / source_path
    if not source_path.exists() or not source_path.is_file():
        raise ValueError(f"RAG source file not found: {source_path}")
    try:
        source, job = rag.create_upload_source(
            source_path.read_bytes(),
            source_path.name,
            content_type,
            name,
            workflow_node_ids or [],
        )
        return {"source": source, "job": job}
    except Exception as exc:
        _raise_readable(exc)
        raise


@mcp.tool()
def delete_rag_source(source_id: str) -> dict[str, Any]:
    """Delete a RAG source, its chunks, uploaded file, and associated vector points when available."""

    try:
        return rag.delete_source(source_id)
    except Exception as exc:
        _raise_readable(exc)
        raise


@mcp.tool()
def reindex_rag_source(source_id: str) -> dict[str, Any]:
    """Enqueue a RAG source for reindexing."""

    try:
        return rag.enqueue_reindex(source_id)
    except Exception as exc:
        _raise_readable(exc)
        raise


@mcp.tool()
def get_rag_job(job_id: str) -> dict[str, Any]:
    """Return a RAG indexing job by id."""

    try:
        return rag.get_job(job_id)
    except Exception as exc:
        _raise_readable(exc)
        raise


@mcp.tool()
def process_rag_job(job_id: str) -> dict[str, Any]:
    """Process one queued RAG indexing job immediately."""

    try:
        return rag.process_job(job_id)
    except Exception as exc:
        _raise_readable(exc)
        raise


@mcp.tool()
def process_next_rag_job() -> dict[str, Any]:
    """Process the next pending RAG indexing job, if any."""

    processed = rag.process_next_job()
    return processed or {"processed": False, "message": "No pending RAG jobs"}


@mcp.tool()
def search_rag(
    query: str,
    top_k: int = 8,
    source_ids: list[str] | None = None,
    workflow_node_ids: list[str] | None = None,
) -> dict[str, Any]:
    """Search indexed RAG sources with vector retrieval and keyword fallback."""

    try:
        return rag.search(
            {
                "query": query,
                "top_k": top_k,
                "source_ids": source_ids or [],
                "workflow_node_ids": workflow_node_ids or [],
            }
        )
    except Exception as exc:
        _raise_readable(exc)
        raise


@mcp.tool()
def evaluate_rag() -> dict[str, Any]:
    """Run the built-in RAG citation coverage evaluation."""

    try:
        return rag.eval_rag()
    except Exception as exc:
        _raise_readable(exc)
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the OpenSkillTrace MCP server.")
    parser.add_argument(
        "--transport",
        choices=("stdio", "sse"),
        default=os.getenv("OST_MCP_TRANSPORT", "stdio"),
        help="MCP transport to use. Defaults to OST_MCP_TRANSPORT or stdio.",
    )
    parser.add_argument(
        "--host",
        default=os.getenv("OST_MCP_HOST"),
        help="Host for SSE transport. Defaults to OST_MCP_HOST or 0.0.0.0.",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.getenv("OST_MCP_PORT", "8001")),
        help="Port for SSE transport. Defaults to OST_MCP_PORT or 8001.",
    )
    args = parser.parse_args()
    if args.host:
        mcp.settings.host = args.host
    if args.port:
        mcp.settings.port = args.port
    mcp.run(transport=args.transport)


if __name__ == "__main__":
    main()
