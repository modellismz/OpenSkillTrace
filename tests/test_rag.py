from __future__ import annotations

import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

import backend.rag as rag
from backend.main import create_app


def make_client(monkeypatch, tmp_path: Path) -> TestClient:
    monkeypatch.setenv("OST_DATABASE_PATH", str(tmp_path / "openskilltrace.json"))
    monkeypatch.setenv("OST_ENV", "development")
    monkeypatch.setenv("OST_RAG_EMBED_PROVIDER", "local")
    monkeypatch.setenv("OST_QDRANT_URL", "http://127.0.0.1:1")
    return TestClient(create_app())


def tiny_pdf_bytes(text: str) -> bytes:
    safe = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    stream = f"BT /F1 12 Tf 72 720 Td ({safe}) Tj ET".encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    body = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(body))
        body.extend(f"{index} 0 obj\n".encode() + obj + b"\nendobj\n")
    xref = len(body)
    body.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        body.extend(f"{offset:010d} 00000 n \n".encode())
    body.extend(
        f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    )
    return bytes(body)


def upload_and_process(client: TestClient, filename: str, content: bytes, content_type: str):
    upload = client.post(
        "/api/rag/sources/upload",
        files=[("files", (filename, content, content_type))],
    )
    assert upload.status_code == 201, upload.text
    job_id = upload.json()["jobs"][0]["id"]
    processed = client.post(f"/api/rag/jobs/{job_id}/process")
    assert processed.status_code == 200, processed.text
    return upload.json()["items"][0], processed.json()


def test_rag_upload_indexes_redacted_chunks_and_keyword_fallback(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)

    def qdrant_down(*args, **kwargs):
        raise RuntimeError("qdrant down")

    monkeypatch.setattr(rag, "index_chunks_in_qdrant", qdrant_down)
    monkeypatch.setattr(rag, "vector_search", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("qdrant unavailable")))

    source, job = upload_and_process(
        client,
        "fraud-sop.txt",
        b"Refund freeze policy: escalate suspicious transfers. Contact jane@example.com, +65 8123 4567, card 4111111111111111.",
        "text/plain",
    )

    assert job["status"] == "indexed"
    assert job["phase"] == "keyword_fallback"
    listed = client.get("/api/rag/sources").json()["items"]
    assert listed[0]["id"] == source["id"]
    assert listed[0]["status"] == "indexed"
    assert listed[0]["chunk_count"] == 1
    assert "keyword fallback" in listed[0]["error"]

    response = client.post("/api/rag/search", json={"query": "refund freeze suspicious transfer", "top_k": 4})
    assert response.status_code == 200
    body = response.json()
    assert body["fallback_used"] is True
    assert body["results"]
    excerpt = body["results"][0]["excerpt"]
    assert "jane@example.com" not in excerpt
    assert "4111111111111111" not in excerpt
    assert "[EMAIL]" in excerpt
    assert body["citations"][0].startswith("fraud-sop")


def test_rag_upload_supports_markdown_csv_and_pdf(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)
    monkeypatch.setattr(rag, "index_chunks_in_qdrant", lambda *args, **kwargs: True)

    cases = [
        ("policy.md", b"# AML escalation\nEscalate mule account cases to AML.", "text/markdown", "AML"),
        ("cases.csv", b"id,summary\n1,Customer notification script for scam case\n", "text/csv", "Customer notification"),
        ("playbook.pdf", tiny_pdf_bytes("Refund freeze policy citation"), "application/pdf", "Refund"),
    ]
    for filename, content, content_type, query in cases:
        _, job = upload_and_process(client, filename, content, content_type)
        assert job["status"] == "indexed"
        assert job["phase"] == "complete"
        monkeypatch.setattr(rag, "vector_search", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("vector disabled")))
        result = client.post("/api/rag/search", json={"query": query, "top_k": 2}).json()
        assert result["results"], filename


def test_rag_provider_switch_marks_existing_sources_needs_reindex(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)
    monkeypatch.setattr(rag, "index_chunks_in_qdrant", lambda *args, **kwargs: True)
    upload_and_process(client, "policy.txt", b"Refund policy and AML escalation.", "text/plain")

    config = client.patch(
        "/api/rag/config",
        json={"embedding_provider": "openai", "openai_model": "text-embedding-3-small"},
    )
    assert config.status_code == 200
    assert config.json()["collection_name"] == "openskilltrace_rag_openai_text_embedding_3_small"
    source = client.get("/api/rag/sources").json()["items"][0]
    assert source["status"] == "needs_reindex"


def test_rag_delete_removes_source_chunks_and_qdrant_points(monkeypatch, tmp_path):
    client = make_client(monkeypatch, tmp_path)
    deleted = []
    monkeypatch.setattr(rag, "index_chunks_in_qdrant", lambda *args, **kwargs: True)
    monkeypatch.setattr(rag, "delete_qdrant_source", lambda source_id, profile=None: deleted.append(source_id))
    source, _ = upload_and_process(client, "delete-me.txt", b"Refund policy text.", "text/plain")

    response = client.delete(f"/api/rag/sources/{source['id']}")
    assert response.status_code == 200
    assert client.get("/api/rag/sources").json()["items"] == []
    assert source["id"] in deleted

    with sqlite3.connect(tmp_path / "rag" / "rag.db") as conn:
        assert conn.execute("SELECT COUNT(*) FROM rag_chunks").fetchone()[0] == 0


def test_openai_embedding_path_uses_embeddings_api(monkeypatch):
    calls = []

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"data": [{"index": 1, "embedding": [0.3]}, {"index": 0, "embedding": [0.1]}]}

    class FakeClient:
        def __init__(self, timeout):
            self.timeout = timeout

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def post(self, url, headers, json):
            calls.append((url, headers, json))
            return FakeResponse()

    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setattr(rag.httpx, "Client", FakeClient)

    vectors = rag.embed_texts(["first", "second"], {"provider": "openai", "model": "text-embedding-3-small"})

    assert vectors == [[0.1], [0.3]]
    assert calls[0][0] == "https://api.openai.com/v1/embeddings"
    assert calls[0][1]["Authorization"] == "Bearer sk-test"
    assert calls[0][2]["model"] == "text-embedding-3-small"
