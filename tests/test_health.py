from fastapi.testclient import TestClient

import backend.main as backend_main
from backend.main import create_app


def make_client(monkeypatch, tmp_path, preserve_telegram=False):
    monkeypatch.setenv("OST_DATABASE_PATH", str(tmp_path / "ost-test.json"))
    monkeypatch.setenv("OST_ENV", "development")
    if not preserve_telegram:
        for key in ("OST_TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_TOKEN", "OST_TELEGRAM_CHAT_ID", "TELEGRAM_CHAT_ID"):
            monkeypatch.setenv(key, "")
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


def test_realtime_session_rejects_missing_or_invalid_sdp(monkeypatch, tmp_path):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    client = make_client(monkeypatch, tmp_path)

    empty = client.post("/api/realtime/session", content="", headers={"Content-Type": "application/sdp"})
    assert empty.status_code == 400
    assert empty.json()["detail"] == "Missing WebRTC SDP offer"

    invalid = client.post("/api/realtime/session", content="not sdp", headers={"Content-Type": "application/sdp"})
    assert invalid.status_code == 400
    assert "missing v=0" in invalid.json()["detail"]

    no_audio = client.post("/api/realtime/session", content="v=0\r\n", headers={"Content-Type": "application/sdp"})
    assert no_audio.status_code == 400
    assert "missing audio media section" in no_audio.json()["detail"]


def test_realtime_session_forwards_valid_sdp_to_openai(monkeypatch, tmp_path):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setenv("OST_REALTIME_MODEL", "gpt-realtime")
    calls = []

    class FakeOpenAIResponse:
        status_code = 200
        text = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n"
        reason_phrase = "OK"

    class FakeAsyncClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, headers, files=None, json=None):
            calls.append({"url": url, "headers": headers, "files": files, "json": json})
            return FakeOpenAIResponse()

    monkeypatch.setattr(backend_main.httpx, "AsyncClient", FakeAsyncClient)
    client = make_client(monkeypatch, tmp_path)
    offer_sdp = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n"

    response = client.post("/api/realtime/session", content=offer_sdp, headers={"Content-Type": "application/sdp"})

    assert response.status_code == 200
    assert response.text.startswith("v=0")
    assert calls
    call = calls[0]
    assert call["url"] == "https://api.openai.com/v1/realtime/calls"
    assert call["headers"]["Authorization"] == "Bearer sk-test"
    assert call["files"]["sdp"] == (None, offer_sdp.strip(), "application/sdp")
    assert '"model": "gpt-realtime-2"' in call["files"]["session"][1]


def test_realtime_client_secret_uses_realtime_2(monkeypatch, tmp_path):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setenv("OST_REALTIME_MODEL", "gpt-realtime")
    calls = []

    class FakeOpenAIResponse:
        status_code = 200
        text = '{"value":"ek-test","expires_at":4102444800}'
        reason_phrase = "OK"

        def json(self):
            return {"value": "ek-test", "expires_at": 4102444800}

    class FakeAsyncClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, headers, files=None, json=None):
            calls.append({"url": url, "headers": headers, "files": files, "json": json})
            return FakeOpenAIResponse()

    monkeypatch.setattr(backend_main.httpx, "AsyncClient", FakeAsyncClient)
    client = make_client(monkeypatch, tmp_path)

    response = client.post("/api/realtime/client-secret", json={"workflow_id": "default"})

    assert response.status_code == 200
    assert response.json()["value"] == "ek-test"
    assert response.json()["model"] == "gpt-realtime-2"
    call = calls[0]
    assert call["url"] == "https://api.openai.com/v1/realtime/client_secrets"
    assert call["headers"]["Authorization"] == "Bearer sk-test"
    assert call["json"]["session"]["model"] == "gpt-realtime-2"


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


def complete_case_state():
    return {
        "amount": "5000 SGD",
        "occurred_at": "today 2pm",
        "payment_method": "PayNow",
        "scam_type": "Online purchase",
        "platform": "WhatsApp",
        "recipient": "29138192371823",
        "shared_sensitive": ["Password", "Card details"],
        "evidence_available": ["Recipient details", "Transaction ID", "Screenshots"],
        "additional_payment": "Asked but did not pay",
        "notes": "please refund me",
    }


def test_workflow_preview_stream_creates_sandbox_and_approval_promotes(monkeypatch, tmp_path):
    monkeypatch.setenv("OST_MODEL_ROUTE", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")

    async def fake_stream(config, claim, graph, case_state=None, intake_update=None):
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
    assert names[:7] == ["run.started", "node.started", "node.completed", "node.started", "intake.schema", "case_state.updated", "node.completed"]
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

    async def fake_stream(config, claim, graph, case_state=None, intake_update=None):
        yield "We are working on this and have enough information to prepare the safe report."

    monkeypatch.setattr(backend_main, "stream_model_tokens", fake_stream)
    client = make_client(monkeypatch, tmp_path)

    response = client.post(
        "/api/workflow-runs/stream",
        json={
            "workflow_id": "default",
            "message": "I gave them 5000 SGD by PayNow",
            "case_state": {
                "amount": "5000 SGD",
                "occurred_at": "today 2pm",
                "payment_method": "PayNow",
                "scam_type": "Investment",
                "platform": "Telegram",
                "recipient": "recipient account",
                "shared_sensitive": ["No sensitive info"],
                "evidence_available": ["Screenshots"],
                "additional_payment": "No",
            },
            "graph": {"flow": [], "edges": []},
        },
    )

    assert response.status_code == 200
    events = parse_sse(response.text)
    names = [event for event, _ in events]
    assert "intake.schema" in names
    assert "case_state.updated" in names
    assert "intake.update" in names
    assert "approval.packet" in names
    assert "assistant.delta" in names
    assert "repair.proposed" not in names
    assert "harness.file_created" not in names
    assert names[-1] == "run.completed"
    assert events[-1][1]["status"] == "approval_required"
    packet = next(data for event, data in events if event == "approval.packet")["packet"]
    assert packet["status"] == "pending_employee_approval"
    assert packet["summary"]["amount"] == "5000 SGD"
    assert packet["classification"]["refund_probability"] >= 1
    assert packet["classification"]["evidence_coverage"] >= 1
    assert packet["evidence_records"]
    assert packet["rag_context"]
    tickets = client.get("/api/tickets").json()["items"]
    ticket = next(item for item in tickets if item["run_id"] == packet["run_id"])
    assert ticket["status"] == "pending_employee_approval"
    assert ticket["summary"]["amount"] == "5000 SGD"
    assert ticket["classification"]["model_id"] == "refund_pattern_classifier_v0.3"
    assert ticket["evidence_count"] == len(packet["evidence_records"])

    approval = client.post(f"/api/workflow-runs/{packet['run_id']}/case-approval", json={"decision": "approve_refund"})
    assert approval.status_code == 200
    assert approval.json()["status"] == "refund_approved"
    assert approval.json()["packet"]["status"] == "approved"
    assert approval.json()["learning"]["agreement"] is True
    ticket_after = client.get(f"/api/tickets/ticket_{packet['run_id']}").json()
    assert ticket_after["status"] == "refund_approved"
    assert ticket_after["customer_status"] == "Refund approved and customer notified"
    assert ticket_after["harness_learning"]["status"] == "accuracy_confirmed"

    details = client.get(f"/api/workflow-runs/{packet['run_id']}").json()
    assert details["run"]["status"] == "refund_approved"
    assert details["run"]["case_approval"]["decision"] == "approve_refund"


def test_ticket_creation_sends_telegram_warroom_call_when_configured(monkeypatch, tmp_path):
    monkeypatch.setenv("OST_MODEL_ROUTE", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setenv("OST_TELEGRAM_BOT_TOKEN", "bot-secret-token")
    monkeypatch.setenv("OST_TELEGRAM_CHAT_ID", "-1001234567890")
    monkeypatch.setenv("OST_PUBLIC_BASE_URL", "https://ops.example")
    calls = []

    async def fake_stream(config, claim, graph, case_state=None, intake_update=None):
        yield "The employee approval packet is ready."

    class FakeTelegramResponse:
        status_code = 200
        reason_phrase = "OK"

        def json(self):
            return {"ok": True, "result": {"message_id": 77}}

    class FakeTelegramClient:
        def __init__(self, timeout):
            self.timeout = timeout

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def post(self, url, json):
            calls.append({"url": url, "json": json})
            return FakeTelegramResponse()

    monkeypatch.setattr(backend_main, "stream_model_tokens", fake_stream)
    monkeypatch.setattr(backend_main.httpx, "Client", FakeTelegramClient)
    client = make_client(monkeypatch, tmp_path, preserve_telegram=True)

    response = client.post(
        "/api/workflow-runs/stream",
        json={
            "workflow_id": "default",
            "message": "I gave them 5000 SGD by PayNow",
            "case_state": complete_case_state(),
            "graph": {"flow": [], "edges": []},
        },
    )

    assert response.status_code == 200
    events = parse_sse(response.text)
    names = [event for event, _ in events]
    assert "telegram.sent" in names
    assert "bot-secret-token" not in response.text
    telegram_event = next(data for event, data in events if event == "telegram.sent")
    assert telegram_event["telegram"]["sent"] is True
    assert telegram_event["telegram"]["message_id"] == 77

    assert calls
    sent_payload = calls[0]["json"]
    assert sent_payload["chat_id"] == "-1001234567890"
    assert "OpenSkillTrace War Room Call" in sent_payload["text"]
    assert "Ticket:" in sent_payload["text"]
    assert "Open: https://ops.example/#warroom" in sent_payload["text"]
    assert sent_payload["reply_markup"]["inline_keyboard"][0][0]["url"] == "https://ops.example/#warroom"

    packet = next(data for event, data in events if event == "approval.packet")["packet"]
    manual = client.post("/api/telegram/warroom-call", json={"ticket_id": f"ticket_{packet['run_id']}", "source": "test_manual"})
    assert manual.status_code == 200
    assert manual.json()["telegram"]["sent"] is True
    assert len(calls) == 2


def test_case_reject_updates_customer_and_creates_learning_signal(monkeypatch, tmp_path):
    monkeypatch.setenv("OST_MODEL_ROUTE", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")

    async def fake_stream(config, claim, graph, case_state=None, intake_update=None):
        yield "We are working on this and the packet is ready for review."

    monkeypatch.setattr(backend_main, "stream_model_tokens", fake_stream)
    client = make_client(monkeypatch, tmp_path)

    response = client.post(
        "/api/workflow-runs/stream",
        json={
            "workflow_id": "default",
            "message": "online purchase scam",
            "case_state": {
                "amount": "5000 SGD",
                "occurred_at": "today 2pm",
                "payment_method": "PayNow",
                "scam_type": "Online purchase",
                "platform": "WhatsApp",
                "recipient": "29138192371823",
                "shared_sensitive": ["Password", "Card details"],
                "evidence_available": ["Recipient details", "Transaction ID", "Screenshots"],
                "additional_payment": "Asked but did not pay",
                "notes": "please refund me",
            },
            "graph": {"flow": [], "edges": []},
        },
    )

    events = parse_sse(response.text)
    packet = next(data for event, data in events if event == "approval.packet")["packet"]
    assert packet["classification"]["recommended_decision"] == "approve_refund"

    rejection = client.post(f"/api/workflow-runs/{packet['run_id']}/case-approval", json={"decision": "reject"})
    assert rejection.status_code == 200
    body = rejection.json()
    assert body["status"] == "refund_rejected"
    assert body["packet"]["status"] == "rejected"
    assert "rejected" in body["message"].lower()
    assert body["learning"]["agreement"] is False
    assert body["learning"]["status"] == "learning_queued"

    ticket = client.get(f"/api/tickets/ticket_{packet['run_id']}").json()
    assert ticket["status"] == "refund_rejected"
    assert ticket["customer_status"] == "Refund request rejected and customer notified"
    assert ticket["harness_learning"]["replay_eval"]["cases_added"] == 1


def test_workflow_preview_intake_update_uses_structured_missing_fields(monkeypatch, tmp_path):
    monkeypatch.setenv("OST_MODEL_ROUTE", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")

    seen = {}

    async def fake_stream(config, claim, graph, case_state=None, intake_update=None):
        seen["case_state"] = case_state
        seen["intake_update"] = intake_update
        yield "We are working on this. The form below has the next details needed."

    monkeypatch.setattr(backend_main, "stream_model_tokens", fake_stream)
    client = make_client(monkeypatch, tmp_path)

    response = client.post(
        "/api/workflow-runs/stream",
        json={
            "workflow_id": "default",
            "message": "Here are details from the guided form",
            "case_state": {"amount": "5000 SGD"},
            "customer_answers": {
                "payment_method": "Bank transfer",
                "scam_type": "Investment",
                "platform": "Telegram",
                "shared_sensitive": ["Card details"],
                "evidence_available": ["Screenshots"],
            },
            "graph": {"flow": [], "edges": []},
        },
    )

    assert response.status_code == 200
    events = parse_sse(response.text)
    schema = next(data for event, data in events if event == "intake.schema")
    update = next(data for event, data in events if event == "intake.update")
    assert schema["node_id"] == "n-intake"
    assert seen["case_state"]["payment_method"] == "Bank transfer"
    assert [field["field_id"] for field in update["fields"]] == ["occurred_at", "recipient", "additional_payment"]
    assert "We are working on this" not in str(update["fields"])
    assert update["progress"]["collected"] == 6
    assert "approval.packet" not in [event for event, _ in events]
    assert events[-1][1]["status"] == "awaiting_user"


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


def test_api_logs_report_answered_model_and_masked_key(monkeypatch, tmp_path):
    raw_key = "sk-test-1234567890"
    monkeypatch.setenv("OST_MODEL_ROUTE", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", raw_key)

    async def fake_stream(config, claim, graph, case_state=None, intake_update=None):
        yield "The safe evidence packet is ready for employee approval."

    monkeypatch.setattr(backend_main, "stream_model_tokens", fake_stream)
    client = make_client(monkeypatch, tmp_path)

    response = client.post(
        "/api/workflow-runs/stream",
        json={
            "workflow_id": "default",
            "message": "I gave them 5000 SGD by PayNow",
            "case_state": complete_case_state(),
            "graph": {"flow": [], "edges": []},
        },
    )
    assert response.status_code == 200

    logs = client.get("/api/logs")
    assert logs.status_code == 200
    body = logs.json()
    assert raw_key not in str(body)
    assert body["route"][0]["model"] == "gpt-5.5"
    assert body["route"][0]["key"]["source"] == "env"
    assert body["route"][0]["key"]["key_masked"] == "sk-test...7890"
    assert body["stats"]["answered_count"] == 1

    item = body["items"][0]
    assert item["model_answered"] == "gpt-5.5"
    assert item["api_key"]["key_masked"] == "sk-test...7890"
    assert item["fallback_used"] is False
    assert item["status"] == "approval_required"


def test_fallback_drill_primary_model_selects_next_route(monkeypatch, tmp_path):
    monkeypatch.setenv("OST_MODEL_ROUTE", "openai,local_gpt_oss,fireworks_gpt_oss")
    monkeypatch.setenv("OPENAI_API_KEY", "")
    client = make_client(monkeypatch, tmp_path)

    response = client.post(
        "/api/workflow-runs/stream",
        json={
            "workflow_id": "default",
            "message": "Fallback drill: primary model outage",
            "case_state": complete_case_state(),
            "fallback_test": {"scenario": "model_primary_down"},
            "graph": {"flow": [], "edges": []},
        },
    )

    assert response.status_code == 200
    events = parse_sse(response.text)
    names = [event for event, _ in events]
    assert "fallback.drill.started" in names
    assert "fallback.hop.failed" in names
    assert "fallback.hop.selected" in names
    assert "assistant.delta" in names
    assert "repair.proposed" not in names
    selected = next(data for event, data in events if event == "fallback.hop.selected")
    assert selected["route_type"] == "model"
    assert selected["hop"]["id"] == "local_gpt_oss"
    assert events[-1][1]["status"] == "approval_required"


def test_fallback_drill_all_models_down_fails_closed(monkeypatch, tmp_path):
    monkeypatch.setenv("OST_MODEL_ROUTE", "openai,local_gpt_oss")
    monkeypatch.setenv("OPENAI_API_KEY", "")
    client = make_client(monkeypatch, tmp_path)

    response = client.post(
        "/api/workflow-runs/stream",
        json={
            "workflow_id": "default",
            "message": "Fallback drill: all models down",
            "case_state": complete_case_state(),
            "fallback_test": {"scenario": "model_all_down"},
            "graph": {"flow": [], "edges": []},
        },
    )

    assert response.status_code == 200
    events = parse_sse(response.text)
    names = [event for event, _ in events]
    assert names.count("fallback.hop.failed") == 2
    assert "assistant.delta" not in names
    assert "node.failed" in names
    assert "repair.proposed" in names
    repair = next(data for event, data in events if event == "repair.proposed")
    assert repair["artifact"]["approval_ready"] is False
    assert events[-1][1]["status"] == "blocked"


def test_fallback_drill_tool_down_enters_repair_harness(monkeypatch, tmp_path):
    monkeypatch.setenv("OST_MODEL_ROUTE", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")

    async def fake_stream(config, claim, graph, case_state=None, intake_update=None):
        yield "We are working on this and will test the evidence fallback path."

    monkeypatch.setattr(backend_main, "stream_model_tokens", fake_stream)
    client = make_client(monkeypatch, tmp_path)

    response = client.post(
        "/api/workflow-runs/stream",
        json={
            "workflow_id": "default",
            "message": "Fallback drill: evidence tool outage",
            "case_state": complete_case_state(),
            "fallback_test": {"scenario": "tool_down"},
            "graph": {"flow": [], "edges": []},
        },
    )

    assert response.status_code == 200
    events = parse_sse(response.text)
    selected = [data for event, data in events if event == "fallback.hop.selected"]
    assert selected[-1]["route_type"] == "tool"
    assert selected[-1]["hop"]["id"] == "evidence_only_repair"
    names = [event for event, _ in events]
    assert "harness.file_created" in names
    assert "eval.completed" in names
    assert "repair.proposed" in names
    assert events[-1][1]["status"] == "repair_proposed"
