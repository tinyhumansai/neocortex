#!/usr/bin/env python3
"""SDK route smoke test for tinyhumansai.

Loads credentials from .env (or ENV_FILE) and exercises all client routes.
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path
from typing import Any, Callable

import tinyhumansai as api


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if value.startswith(("\"", "'")) and value.endswith(("\"", "'")):
            value = value[1:-1]
        os.environ.setdefault(key, value)


def env(name: str, *fallbacks: str) -> str | None:
    for key in (name, *fallbacks):
        value = os.getenv(key)
        if value:
            return value
    return None


def collect_job_ids(payload: Any) -> list[str]:
    ids: list[str] = []
    if not isinstance(payload, dict):
        return ids
    direct = payload.get("jobId") or payload.get("job_id")
    if isinstance(direct, str) and direct:
        ids.append(direct)
    accepted = payload.get("accepted")
    if isinstance(accepted, list):
        for row in accepted:
            if isinstance(row, dict):
                jid = row.get("jobId") or row.get("job_id")
                if isinstance(jid, str) and jid:
                    ids.append(jid)
    # stable dedupe
    seen: set[str] = set()
    out: list[str] = []
    for jid in ids:
        if jid not in seen:
            seen.add(jid)
            out.append(jid)
    return out


def collect_document_ids(payload: Any) -> list[str]:
    found: list[str] = []

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            for key in ("documentId", "document_id", "id"):
                value = node.get(key)
                if isinstance(value, str) and value:
                    found.append(value)
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(payload)
    seen: set[str] = set()
    out: list[str] = []
    for doc_id in found:
        if doc_id not in seen:
            seen.add(doc_id)
            out.append(doc_id)
    return out


def main() -> int:
    pkg_root = Path(__file__).resolve().parents[1]
    env_file = Path(env("ENV_FILE") or pkg_root / ".env")
    load_env_file(env_file)

    token = env("TINYHUMANS_TOKEN", "NEOCORTEX_TOKEN")
    if not token:
        print("Missing token. Set TINYHUMANS_TOKEN (or NEOCORTEX_TOKEN).", file=sys.stderr)
        return 2

    base_url = env("TINYHUMANS_BASE_URL", "NEOCORTEX_BASE_URL")
    model_id = env("TINYHUMANS_MODEL_ID") or "neocortex-mk1"

    ts = int(time.time())
    namespace = f"sdk-python-routes-{ts}"
    doc_single = f"py-doc-single-{ts}"
    doc_batch_1 = f"py-doc-batch-1-{ts}"
    doc_batch_2 = f"py-doc-batch-2-{ts}"

    client = api.TinyHumansMemoryClient(token=token, model_id=model_id, base_url=base_url)

    results: list[tuple[str, bool, str]] = []
    maybe_job_id: str | None = None

    def run(name: str, fn: Callable[[], Any], optional: bool = False) -> Any:
        try:
            data = fn()
            results.append((name, True, "ok"))
            return data
        except Exception as exc:
            if optional:
                results.append((name, True, f"optional-skip: {exc}"))
                return None
            results.append((name, False, str(exc)))
            return None

    try:
        run(
            "insert_memory",
            lambda: client.insert_memory(
                item={
                    "key": f"{doc_single}-memory",
                    "content": "python route test memory",
                    "namespace": namespace,
                    "metadata": {"source": "sdk-python-route-test"},
                }
            ),
        )

        run(
            "query_memory",
            lambda: client.recall_memory(
                namespace=namespace,
                prompt="what memory was stored",
                num_chunks=5,
            ),
        )

        single_insert_res = run(
            "insert_document",
            lambda: client.insert_document(
                title="Python Route Test Single",
                content="Single document for route test",
                namespace=namespace,
                source_type="doc",
                metadata={"source": "sdk-python-route-test", "kind": "single"},
                document_id=doc_single,
            ),
        )
        single_job_ids = collect_job_ids(single_insert_res)
        if single_job_ids:
            if not maybe_job_id:
                maybe_job_id = single_job_ids[0]
            for jid in single_job_ids:
                run(
                    f"insert_document_job_poll({jid})",
                    lambda jid=jid: client.wait_for_ingestion_job(job_id=jid),
                )
        else:
            results.append(
                (
                    "insert_document_job_poll",
                    False,
                    "insert_document did not return jobId",
                )
            )

        batch_res = run(
            "insert_documents_batch",
            lambda: client.insert_documents_batch(
                items=[
                    {
                        "title": "Python Route Test Batch 1",
                        "content": "Batch document 1",
                        "namespace": namespace,
                        "documentId": doc_batch_1,
                    },
                    {
                        "title": "Python Route Test Batch 2",
                        "content": "Batch document 2",
                        "namespace": namespace,
                        "documentId": doc_batch_2,
                    },
                ]
            ),
        )
        batch_job_ids = collect_job_ids(batch_res)
        if batch_job_ids:
            if not maybe_job_id:
                maybe_job_id = batch_job_ids[0]
            for jid in batch_job_ids:
                run(
                    f"insert_documents_batch_job_poll({jid})",
                    lambda jid=jid: client.wait_for_ingestion_job(job_id=jid),
                )
        else:
            results.append(
                (
                    "insert_documents_batch_job_poll",
                    False,
                    "insert_documents_batch did not return jobId",
                )
            )

        run("list_documents", lambda: client.list_documents(namespace=namespace, limit=20, offset=0))
        run("get_document", lambda: client.get_document(document_id=doc_single, namespace=namespace))

        run(
            "query_memory_context",
            lambda: client.query_memory_context(
                query="summarize route test docs",
                namespace=namespace,
                include_references=True,
                max_chunks=5,
                document_ids=[doc_single],
            ),
        )

        run(
            "chat_memory_context",
            lambda: client.chat_memory_context(
                messages=[
                    {
                        "role": "user",
                        "content": "Summarize what the route test inserted.",
                    }
                ],
                temperature=0,
                max_tokens=128,
            ),
            optional=True,
        )

        run(
            "record_interactions",
            lambda: client.record_interactions(
                namespace=namespace,
                entity_names=["PY-ROUTE-TEST-A", "PY-ROUTE-TEST-B"],
                description="python route test interactions",
                interaction_level="engage",
            ),
        )

        run("recall_thoughts", lambda: client.recall_thoughts(namespace=namespace, max_chunks=5))
        run("get_graph_snapshot", lambda: client.get_graph_snapshot(namespace=namespace, mode="latest_chunks", limit=10, seed_limit=3), optional=True)

        run(
            "chat_memory",
            lambda: client.chat_memory(
                messages=[{"role": "user", "content": "Reply with ok"}],
                temperature=0,
                max_tokens=64,
            ),
            optional=True,
        )

        run(
            "interact_memory",
            lambda: client.interact_memory(
                namespace=namespace,
                entity_names=["PY-ROUTE-TEST-A", "PY-ROUTE-TEST-B"],
                description="python route test interact",
                interaction_level="engage",
                timestamp=time.time(),
            ),
        )

        run("recall_memory_master", lambda: client.recall_memory_master(namespace=namespace, max_chunks=5))
        run("recall_memories", lambda: client.recall_memories(namespace=namespace, top_k=5, min_retention=0))

        if maybe_job_id:
            run("get_ingestion_job", lambda: client.get_ingestion_job(job_id=maybe_job_id))
        else:
            results.append(("get_ingestion_job", True, "optional-skip: no jobId returned by inserts"))

    finally:
        cleanup_ids: list[str] = [doc_single, doc_batch_1, doc_batch_2]
        docs_payload = run(
            "list_documents(cleanup)",
            lambda: client.list_documents(namespace=namespace, limit=200, offset=0),
            optional=True,
        )
        for discovered in collect_document_ids(docs_payload):
            if discovered not in cleanup_ids:
                cleanup_ids.append(discovered)
        for doc_id in cleanup_ids:
            run(
                f"delete_document({doc_id})",
                lambda doc_id=doc_id: client.delete_document(
                    document_id=doc_id,
                    namespace=namespace,
                ),
                optional=True,
            )
        run("delete_memory(namespace)", lambda: client.delete_memory(namespace=namespace, delete_all=True), optional=True)
        client.close()

    print("\nRoute smoke test results (sdk-python):")
    for name, ok, msg in results:
        status = "PASS" if ok else "FAIL"
        print(f"- {status:4} {name}: {msg}")

    failed = [row for row in results if not row[1]]
    if failed:
        print(f"\nFailed checks: {len(failed)}", file=sys.stderr)
        return 1

    print(f"\nAll required checks passed: {len(results)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
