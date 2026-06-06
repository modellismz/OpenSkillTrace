from __future__ import annotations

import csv
import hashlib
import json
import os
import re
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path
from typing import Any

import httpx
from fastapi import Body, File, Form, HTTPException, Request, UploadFile, status


ROOT = Path(__file__).resolve().parents[1]
RAG_DIR = ROOT / "data" / "rag"
RAG_DB = RAG_DIR / "rag.db"
UPLOADS_DIR = RAG_DIR / "uploads"
SUPPORTED_SUFFIXES = {".pdf", ".md", ".txt", ".csv"}
DEFAULT_LOCAL_MODEL = "BAAI/bge-small-en-v1.5"
DEFAULT_OPENAI_MODEL = "text-embedding-3-small"
SCHEMA_LOCK = threading.Lock()
PII_PATTERNS = [
    (re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I), "[EMAIL]"),
    (re.compile(r"\b(?:\+?\d[\s.-]?){8,15}\b"), "[PHONE_OR_ACCOUNT]"),
    (re.compile(r"\b(?:\d[ -]*?){13,19}\b"), "[CARD_OR_ACCOUNT]"),
    (re.compile(r"\b[A-Z]{2,6}[-_ ]?\d{5,}\b", re.I), "[REFERENCE_ID]"),
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def rag_db_path() -> Path:
    configured = os.getenv("OST_RAG_DATABASE_PATH")
    if configured:
        path = Path(configured)
        return path if path.is_absolute() else ROOT / path
    base = Path(os.getenv("OST_DATABASE_PATH", str(ROOT / "data" / "openskilltrace.json")))
    if not base.is_absolute():
        base = ROOT / base
    return base.parent / "rag" / "rag.db"


def connect() -> sqlite3.Connection:
    db_path = rag_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout=30000")
    with SCHEMA_LOCK:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        ensure_schema(conn)
    return conn


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS rag_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS rag_sources (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            source_type TEXT NOT NULL,
            filename TEXT NOT NULL,
            content_type TEXT,
            file_path TEXT NOT NULL,
            bytes INTEGER NOT NULL DEFAULT 0,
            sha256 TEXT NOT NULL,
            status TEXT NOT NULL,
            error TEXT,
            workflow_node_ids TEXT NOT NULL DEFAULT '[]',
            embedding_provider TEXT,
            embedding_model TEXT,
            chunk_count INTEGER NOT NULL DEFAULT 0,
            last_indexed_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS rag_jobs (
            id TEXT PRIMARY KEY,
            source_id TEXT NOT NULL,
            status TEXT NOT NULL,
            phase TEXT NOT NULL,
            total_chunks INTEGER NOT NULL DEFAULT 0,
            indexed_chunks INTEGER NOT NULL DEFAULT 0,
            error TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(source_id) REFERENCES rag_sources(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS rag_chunks (
            id TEXT PRIMARY KEY,
            source_id TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            page INTEGER,
            row_start INTEGER,
            row_end INTEGER,
            redacted_text TEXT NOT NULL,
            sha256 TEXT NOT NULL,
            embedding_provider TEXT NOT NULL,
            embedding_model TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(source_id) REFERENCES rag_sources(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_rag_jobs_status ON rag_jobs(status, created_at);
        CREATE INDEX IF NOT EXISTS idx_rag_chunks_source ON rag_chunks(source_id);
        """
    )
    try:
        conn.execute(
            "CREATE VIRTUAL TABLE IF NOT EXISTS rag_chunks_fts USING fts5(chunk_id UNINDEXED, source_id UNINDEXED, redacted_text)"
        )
    except sqlite3.OperationalError:
        pass
    seed_default_settings(conn)
    conn.commit()


def seed_default_settings(conn: sqlite3.Connection) -> None:
    defaults = {
        "embedding_provider": os.getenv("OST_RAG_EMBED_PROVIDER", "local"),
        "local_model": os.getenv("OST_RAG_LOCAL_MODEL", DEFAULT_LOCAL_MODEL),
        "openai_model": os.getenv("OST_RAG_OPENAI_MODEL", DEFAULT_OPENAI_MODEL),
        "collection_prefix": os.getenv("OST_RAG_COLLECTION_PREFIX", "openskilltrace_rag"),
    }
    now = utc_now()
    for key, value in defaults.items():
        conn.execute(
            "INSERT OR IGNORE INTO rag_settings(key, value, updated_at) VALUES (?, ?, ?)",
            (key, value, now),
        )


def setting(conn: sqlite3.Connection, key: str) -> str:
    row = conn.execute("SELECT value FROM rag_settings WHERE key=?", (key,)).fetchone()
    if row:
        return str(row["value"])
    seed_default_settings(conn)
    return str(conn.execute("SELECT value FROM rag_settings WHERE key=?", (key,)).fetchone()["value"])


def active_profile(conn: sqlite3.Connection | None = None) -> dict[str, str]:
    own_conn = conn is None
    conn = conn or connect()
    try:
        provider = setting(conn, "embedding_provider")
        provider = provider if provider in {"local", "openai"} else "local"
        model = setting(conn, "openai_model" if provider == "openai" else "local_model")
        return {"provider": provider, "model": model, "collection": collection_name(provider, model, setting(conn, "collection_prefix"))}
    finally:
        if own_conn:
            conn.close()


def slug(value: str) -> str:
    clean = re.sub(r"[^a-zA-Z0-9]+", "_", value).strip("_").lower()
    return clean or "default"


def model_slug(model: str) -> str:
    name = model.split("/")[-1]
    name = name.replace("v1.5", "v15")
    return slug(name)


def collection_name(provider: str, model: str, prefix: str = "openskilltrace_rag") -> str:
    return f"{prefix}_{slug(provider)}_{model_slug(model)}"


def qdrant_url() -> str:
    return os.getenv("OST_QDRANT_URL", "http://localhost:6333").rstrip("/")


def qdrant_health() -> dict[str, Any]:
    try:
        with httpx.Client(timeout=1.5) as client:
            response = client.get(f"{qdrant_url()}/")
        return {"ok": response.status_code < 500, "url": qdrant_url(), "status_code": response.status_code}
    except Exception as exc:
        return {"ok": False, "url": qdrant_url(), "error": str(exc)}


def require_write_auth(request: Request) -> None:
    if os.getenv("OST_ENV", "development").lower() != "production":
        return
    token = os.getenv("OST_PLATFORM_API_TOKEN")
    if not token:
        raise HTTPException(status_code=500, detail="Production write token is not configured")
    if request.headers.get("authorization") != f"Bearer {token}":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Write token required")


def redact_pii(text: str) -> str:
    redacted = text
    for pattern, replacement in PII_PATTERNS:
        redacted = pattern.sub(replacement, redacted)
    return redacted


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\x00", " ")).strip()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def parse_workflow_ids(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [str(item) for item in parsed if str(item).strip()]
    except json.JSONDecodeError:
        pass
    return [part.strip() for part in value.split(",") if part.strip()]


def normalize_string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        items = value
    else:
        items = [value]
    normalized: list[str] = []
    for item in items:
        if isinstance(item, str):
            normalized.extend(parse_workflow_ids(item))
        elif item is not None:
            normalized.append(str(item))
    return [item for item in normalized if item]


def source_public(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "source_type": row["source_type"],
        "filename": row["filename"],
        "content_type": row["content_type"],
        "bytes": row["bytes"],
        "sha256": row["sha256"],
        "status": row["status"],
        "error": row["error"],
        "workflow_node_ids": json.loads(row["workflow_node_ids"] or "[]"),
        "embedding_provider": row["embedding_provider"],
        "embedding_model": row["embedding_model"],
        "chunk_count": row["chunk_count"],
        "last_indexed_at": row["last_indexed_at"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def job_public(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "source_id": row["source_id"],
        "status": row["status"],
        "phase": row["phase"],
        "total_chunks": row["total_chunks"],
        "indexed_chunks": row["indexed_chunks"],
        "error": row["error"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def list_sources() -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM rag_sources ORDER BY created_at DESC").fetchall()
        return [source_public(row) for row in rows]


def create_upload_source(
    content: bytes,
    filename: str,
    content_type: str | None,
    name: str | None,
    workflow_node_ids: list[str],
) -> tuple[dict[str, Any], dict[str, Any]]:
    suffix = Path(filename).suffix.lower()
    if suffix not in SUPPORTED_SUFFIXES:
        raise HTTPException(status_code=400, detail=f"Unsupported RAG source type: {suffix or 'unknown'}")
    source_id = f"src_{uuid.uuid4().hex[:12]}"
    job_id = f"job_{uuid.uuid4().hex[:12]}"
    now = utc_now()
    dest_dir = uploads_dir() / source_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    file_path = dest_dir / "original"
    file_path.write_bytes(content)
    digest = sha256_bytes(content)
    display_name = name.strip() if name and name.strip() else Path(filename).stem
    profile = active_profile()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO rag_sources(
              id, name, source_type, filename, content_type, file_path, bytes, sha256, status, error,
              workflow_node_ids, embedding_provider, embedding_model, chunk_count, last_indexed_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 0, NULL, ?, ?)
            """,
            (
                source_id,
                display_name,
                "file",
                filename,
                content_type,
                str(file_path),
                len(content),
                digest,
                "uploaded",
                json.dumps(workflow_node_ids),
                profile["provider"],
                profile["model"],
                now,
                now,
            ),
        )
        conn.execute(
            """
            INSERT INTO rag_jobs(id, source_id, status, phase, total_chunks, indexed_chunks, error, created_at, updated_at)
            VALUES (?, ?, 'pending', 'queued', 0, 0, NULL, ?, ?)
            """,
            (job_id, source_id, now, now),
        )
        conn.commit()
        return get_source(source_id, conn), get_job(job_id, conn)


def uploads_dir() -> Path:
    configured = os.getenv("OST_RAG_UPLOAD_DIR")
    if configured:
        path = Path(configured)
        return path if path.is_absolute() else ROOT / path
    path = rag_db_path().parent / "uploads"
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_source(source_id: str, conn: sqlite3.Connection | None = None) -> dict[str, Any]:
    own_conn = conn is None
    conn = conn or connect()
    try:
        row = conn.execute("SELECT * FROM rag_sources WHERE id=?", (source_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="RAG source not found")
        return source_public(row)
    finally:
        if own_conn:
            conn.close()


def get_job(job_id: str, conn: sqlite3.Connection | None = None) -> dict[str, Any]:
    own_conn = conn is None
    conn = conn or connect()
    try:
        row = conn.execute("SELECT * FROM rag_jobs WHERE id=?", (job_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="RAG job not found")
        return job_public(row)
    finally:
        if own_conn:
            conn.close()


def parse_document(source: sqlite3.Row) -> list[dict[str, Any]]:
    path = Path(source["file_path"])
    suffix = Path(source["filename"]).suffix.lower()
    if suffix in {".md", ".txt"}:
        text = path.read_text(encoding="utf-8", errors="ignore")
        return [{"text": text, "page": None, "row_start": None, "row_end": None}]
    if suffix == ".csv":
        raw = path.read_text(encoding="utf-8", errors="ignore")
        reader = csv.DictReader(StringIO(raw))
        pages = []
        for idx, row in enumerate(reader, start=2):
            parts = [f"{key}: {value}" for key, value in row.items() if value]
            if parts:
                pages.append({"text": "; ".join(parts), "page": None, "row_start": idx, "row_end": idx})
        if not pages and raw.strip():
            pages.append({"text": raw, "page": None, "row_start": None, "row_end": None})
        return pages
    if suffix == ".pdf":
        try:
            from pypdf import PdfReader
        except Exception as exc:
            raise RuntimeError("PDF support is not installed") from exc
        reader = PdfReader(str(path))
        pages = []
        for idx, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            if text.strip():
                pages.append({"text": text, "page": idx, "row_start": None, "row_end": None})
        return pages
    raise RuntimeError(f"Unsupported file type: {suffix}")


def chunk_units(units: list[dict[str, Any]], chunk_words: int = 750, overlap_words: int = 100) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    for unit in units:
        words = normalize_text(unit["text"]).split()
        if not words:
            continue
        step = max(1, chunk_words - overlap_words)
        for start in range(0, len(words), step):
            part = words[start : start + chunk_words]
            if not part:
                continue
            text = redact_pii(" ".join(part))
            chunks.append(
                {
                    "redacted_text": text,
                    "page": unit.get("page"),
                    "row_start": unit.get("row_start"),
                    "row_end": unit.get("row_end"),
                }
            )
            if start + chunk_words >= len(words):
                break
    return chunks


def embed_texts(texts: list[str], profile: dict[str, str]) -> list[list[float]]:
    if not texts:
        return []
    if profile["provider"] == "openai":
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is required for OpenAI embeddings")
        with httpx.Client(timeout=60) as client:
            response = client.post(
                "https://api.openai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": profile["model"], "input": texts},
            )
        response.raise_for_status()
        data = response.json()["data"]
        return [item["embedding"] for item in sorted(data, key=lambda x: x["index"])]
    try:
        from fastembed import TextEmbedding
    except Exception as exc:
        raise RuntimeError("FastEmbed is required for local embeddings") from exc
    model = TextEmbedding(model_name=profile["model"])
    return [list(vector) for vector in model.embed(texts)]


def qdrant_client():
    try:
        from qdrant_client import QdrantClient
    except Exception as exc:
        raise RuntimeError("qdrant-client is not installed") from exc
    return QdrantClient(url=qdrant_url(), timeout=8, check_compatibility=False)


def ensure_collection(client: Any, name: str, vector_size: int) -> None:
    from qdrant_client import models

    existing = [collection.name for collection in client.get_collections().collections]
    if name in existing:
        return
    client.create_collection(
        collection_name=name,
        vectors_config=models.VectorParams(size=vector_size, distance=models.Distance.COSINE),
    )


def delete_qdrant_source(source_id: str, profile: dict[str, str] | None = None) -> None:
    profile = profile or active_profile()
    try:
        from qdrant_client import models

        client = qdrant_client()
        client.delete(
            collection_name=profile["collection"],
            points_selector=models.FilterSelector(
                filter=models.Filter(
                    must=[models.FieldCondition(key="source_id", match=models.MatchValue(value=source_id))]
                )
            ),
        )
    except Exception:
        return


def index_chunks_in_qdrant(source: sqlite3.Row, chunks: list[dict[str, Any]], profile: dict[str, str]) -> bool:
    if not chunks:
        return False
    vectors = embed_texts([chunk["redacted_text"] for chunk in chunks], profile)
    if not vectors:
        return False
    from qdrant_client import models

    client = qdrant_client()
    ensure_collection(client, profile["collection"], len(vectors[0]))
    points = []
    for chunk, vector in zip(chunks, vectors):
        points.append(
            models.PointStruct(
                id=str(uuid.uuid5(uuid.NAMESPACE_URL, chunk["id"])),
                vector=vector,
                payload={
                    "source_id": source["id"],
                    "chunk_id": chunk["id"],
                    "source_name": source["name"],
                    "filename": source["filename"],
                    "chunk_index": chunk["chunk_index"],
                    "page": chunk.get("page"),
                    "row_start": chunk.get("row_start"),
                    "row_end": chunk.get("row_end"),
                    "redacted_text": chunk["redacted_text"],
                    "sha256": chunk["sha256"],
                },
            )
        )
    client.upsert(collection_name=profile["collection"], wait=True, points=points)
    return True


def process_job(job_id: str) -> dict[str, Any]:
    with connect() as conn:
        job_row = conn.execute("SELECT * FROM rag_jobs WHERE id=?", (job_id,)).fetchone()
        if not job_row:
            raise HTTPException(status_code=404, detail="RAG job not found")
        source = conn.execute("SELECT * FROM rag_sources WHERE id=?", (job_row["source_id"],)).fetchone()
        if not source:
            raise HTTPException(status_code=404, detail="RAG source not found")
        now = utc_now()
        conn.execute("UPDATE rag_jobs SET status='running', phase='parsing', updated_at=? WHERE id=?", (now, job_id))
        conn.execute("UPDATE rag_sources SET status='indexing', error=NULL, updated_at=? WHERE id=?", (now, source["id"]))
        conn.commit()
        try:
            units = parse_document(source)
            chunks = chunk_units(units)
            profile = active_profile(conn)
            if not chunks:
                raise RuntimeError("No extractable text found in source")
            conn.execute("DELETE FROM rag_chunks WHERE source_id=?", (source["id"],))
            try:
                conn.execute("DELETE FROM rag_chunks_fts WHERE source_id=?", (source["id"],))
            except sqlite3.OperationalError:
                pass
            now = utc_now()
            prepared = []
            for index, chunk in enumerate(chunks):
                chunk_id = f"chk_{uuid.uuid4().hex[:16]}"
                row = {
                    **chunk,
                    "id": chunk_id,
                    "source_id": source["id"],
                    "chunk_index": index,
                    "sha256": sha256_text(chunk["redacted_text"]),
                    "embedding_provider": profile["provider"],
                    "embedding_model": profile["model"],
                }
                prepared.append(row)
                conn.execute(
                    """
                    INSERT INTO rag_chunks(
                      id, source_id, chunk_index, page, row_start, row_end, redacted_text, sha256,
                      embedding_provider, embedding_model, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        row["id"],
                        row["source_id"],
                        row["chunk_index"],
                        row.get("page"),
                        row.get("row_start"),
                        row.get("row_end"),
                        row["redacted_text"],
                        row["sha256"],
                        row["embedding_provider"],
                        row["embedding_model"],
                        now,
                    ),
                )
                try:
                    conn.execute(
                        "INSERT INTO rag_chunks_fts(chunk_id, source_id, redacted_text) VALUES (?, ?, ?)",
                        (row["id"], row["source_id"], row["redacted_text"]),
                    )
                except sqlite3.OperationalError:
                    pass
            conn.execute(
                "UPDATE rag_jobs SET phase='embedding', total_chunks=?, indexed_chunks=0, updated_at=? WHERE id=?",
                (len(prepared), utc_now(), job_id),
            )
            conn.commit()
            qdrant_ok = False
            vector_error = None
            if prepared:
                try:
                    delete_qdrant_source(source["id"], profile)
                    qdrant_ok = index_chunks_in_qdrant(source, prepared, profile)
                    if not qdrant_ok:
                        vector_error = "Vector index did not accept chunks; keyword fallback is ready"
                except Exception as exc:
                    vector_error = f"{exc}; keyword fallback is ready"
            now = utc_now()
            conn.execute(
                """
                UPDATE rag_sources
                SET status='indexed', error=?, embedding_provider=?, embedding_model=?, chunk_count=?, last_indexed_at=?, updated_at=?
                WHERE id=?
                """,
                (vector_error, profile["provider"], profile["model"], len(prepared), now, now, source["id"]),
            )
            conn.execute(
                "UPDATE rag_jobs SET status='indexed', phase=?, indexed_chunks=?, error=?, updated_at=? WHERE id=?",
                ("complete" if qdrant_ok else "keyword_fallback", len(prepared) if qdrant_ok else 0, vector_error, now, job_id),
            )
            conn.commit()
        except Exception as exc:
            now = utc_now()
            conn.execute(
                "UPDATE rag_jobs SET status='failed', phase='failed', error=?, updated_at=? WHERE id=?",
                (str(exc), now, job_id),
            )
            conn.execute(
                "UPDATE rag_sources SET status='failed', error=?, updated_at=? WHERE id=?",
                (str(exc), now, source["id"]),
            )
            conn.commit()
    with connect() as conn:
        return get_job(job_id, conn)


def process_next_job() -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT id FROM rag_jobs WHERE status='pending' ORDER BY created_at LIMIT 1"
        ).fetchone()
    if not row:
        return None
    return process_job(row["id"])


def enqueue_reindex(source_id: str) -> dict[str, Any]:
    with connect() as conn:
        source = conn.execute("SELECT * FROM rag_sources WHERE id=?", (source_id,)).fetchone()
        if not source:
            raise HTTPException(status_code=404, detail="RAG source not found")
        job_id = f"job_{uuid.uuid4().hex[:12]}"
        now = utc_now()
        conn.execute(
            "INSERT INTO rag_jobs(id, source_id, status, phase, total_chunks, indexed_chunks, error, created_at, updated_at) VALUES (?, ?, 'pending', 'queued', 0, 0, NULL, ?, ?)",
            (job_id, source_id, now, now),
        )
        conn.execute("UPDATE rag_sources SET status='uploaded', error=NULL, updated_at=? WHERE id=?", (now, source_id))
        conn.commit()
        return get_job(job_id, conn)


def delete_source(source_id: str) -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute("SELECT * FROM rag_sources WHERE id=?", (source_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="RAG source not found")
        profile = {"provider": row["embedding_provider"] or "local", "model": row["embedding_model"] or DEFAULT_LOCAL_MODEL}
        profile["collection"] = collection_name(profile["provider"], profile["model"], setting(conn, "collection_prefix"))
        delete_qdrant_source(source_id, profile)
        source_dir = Path(row["file_path"]).parent
        conn.execute("DELETE FROM rag_sources WHERE id=?", (source_id,))
        try:
            conn.execute("DELETE FROM rag_chunks_fts WHERE source_id=?", (source_id,))
        except sqlite3.OperationalError:
            pass
        conn.commit()
    if source_dir.exists() and source_dir.is_dir():
        for child in source_dir.iterdir():
            child.unlink(missing_ok=True)
        source_dir.rmdir()
    return {"deleted": True, "id": source_id}


def keyword_search(query: str, top_k: int, source_ids: list[str] | None = None) -> list[dict[str, Any]]:
    terms = [term.lower() for term in re.findall(r"[a-zA-Z0-9_]{3,}", query)]
    if not terms:
        return []
    with connect() as conn:
        params: list[Any] = []
        where = ""
        if source_ids:
            placeholders = ",".join("?" for _ in source_ids)
            where = f" AND c.source_id IN ({placeholders})"
            params.extend(source_ids)
        rows: list[sqlite3.Row]
        try:
            fts_query = " OR ".join(terms)
            rows = conn.execute(
                f"""
                SELECT c.*, s.name AS source_name, s.filename
                FROM rag_chunks_fts f
                JOIN rag_chunks c ON c.id=f.chunk_id
                JOIN rag_sources s ON s.id=c.source_id
                WHERE rag_chunks_fts MATCH ? {where}
                LIMIT ?
                """,
                [fts_query, *params, top_k],
            ).fetchall()
        except sqlite3.OperationalError:
            like = " OR ".join("LOWER(c.redacted_text) LIKE ?" for _ in terms)
            rows = conn.execute(
                f"""
                SELECT c.*, s.name AS source_name, s.filename
                FROM rag_chunks c
                JOIN rag_sources s ON s.id=c.source_id
                WHERE ({like}) {where}
                LIMIT ?
                """,
                [*(f"%{term}%" for term in terms), *params, top_k],
            ).fetchall()
        results = []
        for row in rows:
            text = row["redacted_text"]
            score = sum(text.lower().count(term) for term in terms) / max(1, len(terms))
            results.append(result_from_chunk(row, min(1.0, 0.35 + score / 4), "keyword"))
        return sorted(results, key=lambda r: r["score"], reverse=True)[:top_k]


def source_ids_for_workflow_nodes(workflow_node_ids: list[str]) -> list[str]:
    wanted = set(workflow_node_ids)
    if not wanted:
        return []
    matches: list[str] = []
    with connect() as conn:
        rows = conn.execute("SELECT id, workflow_node_ids FROM rag_sources WHERE chunk_count > 0").fetchall()
        for row in rows:
            try:
                node_ids = set(json.loads(row["workflow_node_ids"] or "[]"))
            except json.JSONDecodeError:
                node_ids = set()
            if node_ids & wanted:
                matches.append(row["id"])
    return matches


def result_from_chunk(row: sqlite3.Row | dict[str, Any], score: float, mode: str) -> dict[str, Any]:
    get = row.get if isinstance(row, dict) else lambda key, default=None: row[key] if key in row.keys() else default
    citation = f"{get('source_name') or get('filename')}#chunk-{get('chunk_index')}"
    if get("page"):
        citation += f":p{get('page')}"
    if get("row_start"):
        citation += f":row{get('row_start')}"
    return {
        "chunk_id": get("id") or get("chunk_id"),
        "source_id": get("source_id"),
        "source_name": get("source_name"),
        "filename": get("filename"),
        "chunk_index": get("chunk_index"),
        "page": get("page"),
        "row_start": get("row_start"),
        "row_end": get("row_end"),
        "score": round(float(score), 4),
        "retrieval_mode": mode,
        "citation": citation,
        "excerpt": get("redacted_text"),
    }


def vector_search(query: str, top_k: int, source_ids: list[str] | None = None) -> list[dict[str, Any]]:
    profile = active_profile()
    vector = embed_texts([query], profile)[0]
    from qdrant_client import models

    query_filter = None
    if source_ids:
        query_filter = models.Filter(
            must=[models.FieldCondition(key="source_id", match=models.MatchAny(any=source_ids))]
        )
    client = qdrant_client()
    points = client.query_points(
        collection_name=profile["collection"],
        query=vector,
        query_filter=query_filter,
        limit=top_k,
        with_payload=True,
    ).points
    results = []
    for point in points:
        payload = dict(point.payload or {})
        payload["id"] = payload.get("chunk_id")
        results.append(result_from_chunk(payload, point.score, "vector"))
    return results


def search(payload: dict[str, Any]) -> dict[str, Any]:
    query = str(payload.get("query") or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="query is required")
    top_k = max(1, min(int(payload.get("top_k") or 8), 20))
    source_ids = normalize_string_list(payload.get("source_ids"))
    workflow_node_ids = normalize_string_list(payload.get("workflow_node_ids"))
    if workflow_node_ids:
        node_source_ids = set(source_ids_for_workflow_nodes(workflow_node_ids))
        source_ids = sorted(node_source_ids & set(source_ids)) if source_ids else sorted(node_source_ids)
    started = time.time()
    fallback_used = False
    error = None
    results: list[dict[str, Any]] = []
    try:
        results = vector_search(query, top_k, source_ids)
    except Exception as exc:
        fallback_used = True
        error = str(exc)
        results = keyword_search(query, top_k, source_ids)
    status_value = "grounded" if results else "ask_human"
    return {
        "query": query,
        "status": status_value,
        "fallback_used": fallback_used,
        "fallback_reason": error if fallback_used else None,
        "latency_ms": round((time.time() - started) * 1000),
        "results": results,
        "citations": [result["citation"] for result in results],
        "message": "No grounded evidence found. Ask a human analyst." if not results else "Retrieved cited evidence.",
    }


def eval_rag() -> dict[str, Any]:
    scenarios = [
        {"name": "Refund policy", "query": "refund freeze policy scam transfer", "min_citations": 1},
        {"name": "AML escalation", "query": "AML escalation suspicious mule account", "min_citations": 1},
        {"name": "Customer notification", "query": "customer notification script scam", "min_citations": 1},
    ]
    results = []
    passed = 0
    unsupported = 0
    for scenario in scenarios:
        response = search({"query": scenario["query"], "top_k": 5})
        ok = len(response["citations"]) >= scenario["min_citations"]
        passed += 1 if ok else 0
        unsupported += 0 if ok else 1
        results.append({**scenario, "passed": ok, "citations": response["citations"], "fallback_used": response["fallback_used"]})
    total = len(scenarios)
    return {
        "status": "passed" if passed == total else "review",
        "pass_rate": round((passed / total) * 100) if total else 0,
        "citation_coverage": round((passed / total) * 100) if total else 0,
        "unsupported_rate": round((unsupported / total) * 100) if total else 0,
        "failed_cases": [result for result in results if not result["passed"]],
        "results": results,
    }


def config_payload() -> dict[str, Any]:
    with connect() as conn:
        profile = active_profile(conn)
        total_sources = conn.execute("SELECT COUNT(*) AS n FROM rag_sources").fetchone()["n"]
        indexed = conn.execute("SELECT COUNT(*) AS n FROM rag_sources WHERE status='indexed'").fetchone()["n"]
        needs_reindex = conn.execute("SELECT COUNT(*) AS n FROM rag_sources WHERE status='needs_reindex'").fetchone()["n"]
        return {
            "embedding_provider": profile["provider"],
            "embedding_model": profile["model"],
            "local_model": setting(conn, "local_model"),
            "openai_model": setting(conn, "openai_model"),
            "collection_name": profile["collection"],
            "qdrant": qdrant_health(),
            "counts": {"sources": total_sources, "indexed": indexed, "needs_reindex": needs_reindex},
        }


def update_config(payload: dict[str, Any]) -> dict[str, Any]:
    provider = str(payload.get("embedding_provider") or "").strip() or None
    local_model = str(payload.get("local_model") or "").strip() or None
    openai_model = str(payload.get("openai_model") or "").strip() or None
    if provider and provider not in {"local", "openai"}:
        raise HTTPException(status_code=400, detail="embedding_provider must be local or openai")
    with connect() as conn:
        before = active_profile(conn)
        now = utc_now()
        if provider:
            conn.execute("REPLACE INTO rag_settings(key, value, updated_at) VALUES ('embedding_provider', ?, ?)", (provider, now))
        if local_model:
            conn.execute("REPLACE INTO rag_settings(key, value, updated_at) VALUES ('local_model', ?, ?)", (local_model, now))
        if openai_model:
            conn.execute("REPLACE INTO rag_settings(key, value, updated_at) VALUES ('openai_model', ?, ?)", (openai_model, now))
        after = active_profile(conn)
        if before["provider"] != after["provider"] or before["model"] != after["model"]:
            conn.execute("UPDATE rag_sources SET status='needs_reindex', updated_at=? WHERE chunk_count > 0", (now,))
        conn.commit()
    return config_payload()


def install_rag_routes(app: Any) -> None:
    @app.get("/api/rag/config")
    def get_rag_config():
        return config_payload()

    @app.patch("/api/rag/config")
    def patch_rag_config(request: Request, payload: dict[str, Any] = Body(...)):
        require_write_auth(request)
        return update_config(payload)

    @app.get("/api/rag/sources")
    def get_rag_sources():
        return {"items": list_sources()}

    @app.post("/api/rag/sources/upload", status_code=201)
    async def upload_rag_sources(
        request: Request,
        files: list[UploadFile] = File(...),
        name: str | None = Form(default=None),
        source_type: str = Form(default="file"),
    ):
        require_write_auth(request)
        if source_type != "file":
            raise HTTPException(status_code=400, detail="Only file sources are supported in RAG v1")
        form = await request.form()
        ids = []
        for key in ("workflow_node_ids", "workflow_node_ids[]"):
            for value in form.getlist(key):
                ids.extend(normalize_string_list(value))
        created = []
        jobs = []
        for file in files:
            content = await file.read()
            source, job = create_upload_source(content, file.filename or "source.txt", file.content_type, name, ids)
            created.append(source)
            jobs.append(job)
        return {"items": created, "jobs": jobs}

    @app.delete("/api/rag/sources/{source_id}")
    def remove_rag_source(request: Request, source_id: str):
        require_write_auth(request)
        return delete_source(source_id)

    @app.post("/api/rag/sources/{source_id}/reindex", status_code=202)
    def reindex_rag_source(request: Request, source_id: str):
        require_write_auth(request)
        return enqueue_reindex(source_id)

    @app.get("/api/rag/jobs/{job_id}")
    def get_rag_job(job_id: str):
        return get_job(job_id)

    @app.post("/api/rag/search")
    def search_rag(payload: dict[str, Any] = Body(...)):
        return search(payload)

    @app.post("/api/rag/eval")
    def run_rag_eval(request: Request):
        require_write_auth(request)
        return eval_rag()

    @app.post("/api/rag/jobs/{job_id}/process")
    def process_rag_job_now(request: Request, job_id: str):
        require_write_auth(request)
        return process_job(job_id)
