from fastapi.testclient import TestClient

from backend.main import create_app


def test_health_endpoint_reports_service_status():
    client = TestClient(create_app())

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"] == "openskilltrace"
    assert response.headers["x-request-id"]
