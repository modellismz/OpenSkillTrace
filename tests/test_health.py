from fastapi.testclient import TestClient

import backend.main as backend_main
from backend.main import create_app


def make_client(monkeypatch, tmp_path):
    monkeypatch.setenv("OST_DATABASE_PATH", str(tmp_path / "ost-test.json"))
    monkeypatch.setenv("OST_ENV", "development")
    return TestClient(create_app())


def test_health_endpoint_reports_service_status(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"] == "openskilltrace"
    assert response.headers["x-request-id"]


def test_agentops_workflow_crud_persists_graph(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    created = client.post(
        "/api/workflows",
        json={"id": "default", "name": "Scam Response", "graph": {"flow": [{"id": "n1"}], "edges": []}},
    )
    assert created.status_code == 201
    assert created.json()["id"] == "default"

    listed = client.get("/api/workflows")
    assert listed.status_code == 200
    assert listed.json()["items"][0]["graph"]["flow"][0]["id"] == "n1"

    patched = client.patch("/api/workflows/default", json={"status": "published"})
    assert patched.status_code == 200
    assert patched.json()["status"] == "published"


def test_provider_key_is_never_returned_as_plaintext(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    response = client.post("/api/provider-keys", json={"provider": "openai", "key": "sk-secret-1234567890"})

    assert response.status_code == 201
    body = response.json()
    assert "key" not in body
    assert "sk-secret-1234567890" not in str(body)
    assert "key_ciphertext" not in body
    assert body["key_masked"].startswith("sk-secr")
    assert body["key_fingerprint"]

    stored = (tmp_path / "ost-test.json").read_text()
    assert "key_ciphertext" in stored
    assert "sk-secret-1234567890" not in stored


def test_settings_and_investigation_flow(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    settings = client.post("/api/settings", json={"default_model": "gpt-5.5"})
    assert settings.status_code == 200
    assert client.get("/api/settings").json()["default_model"] == "gpt-5.5"

    response = client.post(
        "/api/investigations/scam-response",
        json={"claim": "I was tricked into transferring money", "amount": "฿50,000"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["decision"]["mode"] == "evidence_only"
    assert "freeze" in body["decision"]["blocked_actions"]
    assert body["audit_signature"]

    audit_events = client.get("/api/audit-events").json()["items"]
    assert audit_events[0]["type"] == "investigation"


def parse_sse(text):
    events = []
    for block in text.strip().split("\n\n"):
        event = "message"
        data = None
        for line in block.splitlines():
            if line.startswith("event:"):
                event = line.split(":", 1)[1].strip()
            if line.startswith("data:"):
                import json

                data = json.loads(line.split(":", 1)[1])
        if data is not None:
            events.append((event, data))
    return events


def test_workflow_preview_stream_creates_sandbox_and_approval_promotes(monkeypatch, tmp_path):
    monkeypatch.setenv("OST_MODEL_ROUTE", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")

    async def fake_stream(config, claim, graph):
        yield "I can help you prepare an evidence-only fraud report. "
        yield "A human must approve risky actions."

    monkeypatch.setattr(backend_main, "stream_model_tokens", fake_stream)
    client = make_client(monkeypatch, tmp_path)

    response = client.post(
        "/api/workflow-runs/stream",
        json={"workflow_id": "default", "message": "hi i got scam for 5000 SGD", "force_repair": True, "graph": {"flow": [], "edges": []}},
    )

    assert response.status_code == 200
    events = parse_sse(response.text)
    names = [event for event, _ in events]
    assert names[:3] == ["run.started", "node.started", "node.completed"]
    assert "assistant.delta" in names
    assert "node.failed" in names
    assert "harness.file_created" in names
    assert "eval.completed" in names
    assert "repair.proposed" in names
    assert names[-1] == "run.completed"

    repair = next(data for event, data in events if event == "repair.proposed")
    run_id = repair["run_id"]
    artifact = repair["artifact"]
    assert artifact["approval_ready"] is True
    assert all(file["path"].startswith(f"data/harness-runs/{run_id}/") for file in artifact["files"])

    approval = client.post(f"/api/workflow-runs/{run_id}/approval", json={"decision": "approve"})
    assert approval.status_code == 200
    assert approval.json()["capability"]["status"] == "approved"

    details = client.get(f"/api/workflow-runs/{run_id}").json()
    assert details["run"]["status"] == "approved"
    assert details["artifact"]["promoted"] is True
    assert details["capabilities"][0]["source_run_id"] == run_id


def test_workflow_preview_successful_chat_does_not_force_repair(monkeypatch, tmp_path):
    monkeypatch.setenv("OST_MODEL_ROUTE", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")

    async def fake_stream(config, claim, graph):
        yield "We are working on this and have enough information to prepare the safe report."

    monkeypatch.setattr(backend_main, "stream_model_tokens", fake_stream)
    client = make_client(monkeypatch, tmp_path)

    response = client.post(
        "/api/workflow-runs/stream",
        json={"workflow_id": "default", "message": "I gave them 5000 SGD by PayNow", "graph": {"flow": [], "edges": []}},
    )

    assert response.status_code == 200
    events = parse_sse(response.text)
    names = [event for event, _ in events]
    assert "assistant.delta" in names
    assert "repair.proposed" not in names
    assert "harness.file_created" not in names
    assert names[-1] == "run.completed"
    assert events[-1][1]["status"] == "completed"


def test_workflow_preview_missing_provider_fails_closed_and_blocks_approval(monkeypatch, tmp_path):
    monkeypatch.setenv("OST_MODEL_ROUTE", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "")
    client = make_client(monkeypatch, tmp_path)

    response = client.post(
        "/api/workflow-runs/stream",
        json={"workflow_id": "default", "message": "hi i got scam for 5000 SGD", "graph": {"flow": [], "edges": []}},
    )

    assert response.status_code == 200
    events = parse_sse(response.text)
    names = [event for event, _ in events]
    assert "assistant.delta" not in names
    assert "node.failed" in names
    assert "repair.proposed" in names

    repair = next(data for event, data in events if event == "repair.proposed")
    run_id = repair["run_id"]
    assert repair["artifact"]["approval_ready"] is False
    approval = client.post(f"/api/workflow-runs/{run_id}/approval", json={"decision": "approve"})
    assert approval.status_code == 409

    rejection = client.post(f"/api/workflow-runs/{run_id}/approval", json={"decision": "reject"})
    assert rejection.status_code == 200
    assert rejection.json()["capability"] is None
