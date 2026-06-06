from fastapi.testclient import TestClient

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
    assert body["key_masked"].startswith("sk-secr")
    assert body["key_fingerprint"]


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
