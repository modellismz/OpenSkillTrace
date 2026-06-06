from __future__ import annotations

import os
import time

from backend.rag import process_next_job


def main() -> None:
    poll_seconds = float(os.getenv("OST_RAG_WORKER_POLL_SECONDS", "2"))
    print("RAG worker started", flush=True)
    while True:
        try:
            job = process_next_job()
            if job:
                print(f"Processed RAG job {job['id']} status={job['status']} phase={job['phase']}", flush=True)
                continue
        except Exception as exc:
            print(f"RAG worker error: {exc}", flush=True)
        time.sleep(poll_seconds)


if __name__ == "__main__":
    main()
