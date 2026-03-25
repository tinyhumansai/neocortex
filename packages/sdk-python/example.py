"""
Example usage of the TinyHumans SDK.

Install with examples extra for dotenv: pip install -e ".[examples]"
Copy .env.example to .env and set TINYHUMANS_TOKEN, TINYHUMANS_MODEL_ID, OPENAI_API_KEY.
Optional: set TINYHUMANSAI_LOG_LEVEL=DEBUG to print outbound API requests.
"""

import logging
import os
import time
from typing import Any, Callable, Optional, Tuple

try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:
    # Optional dependency: run with plain environment variables if python-dotenv is not installed.
    pass
if os.environ.get("TINYHUMANSAI_LOG_LEVEL") and not logging.getLogger().handlers:
    logging.basicConfig(level=logging.INFO)

import tinyhumansai as api

client = api.TinyHumansMemoryClient(
    os.environ["TINYHUMANS_TOKEN"],
    model_id=os.environ.get("TINYHUMANS_MODEL_ID", "neocortex-mk1"),
)

def run_step(
    name: str,
    fn: Callable[[], Any],
    *,
    optional: bool = False,
) -> Tuple[bool, Optional[Any]]:
    try:
        out = fn()
        print(f"[ok] {name}")
        return True, out
    except Exception as e:
        if optional:
            print(f"[skip] {name}: {e}")
            return True, None
        print(f"[error] {name}: {e}")
        return False, None


results: list[tuple[str, bool]] = []

# Ingest (upsert) a single memory
preferences_ns = "preferences"
ingest_key = f"user-preference-theme-{int(time.time())}"

ok, result = run_step(
    "insert_memory",
    lambda: client.insert_memory(
        item={
            # For the legacy ingest route, `key` is mapped to backend `documentId` (and title).
            "key": ingest_key,
            "content": "User prefers dark mode",
            "namespace": preferences_ns,
            "metadata": {"source": "onboarding"},
            "created_at": time.time(),  # Optional: Unix timestamp (seconds)
            "updated_at": time.time(),  # Optional: Unix timestamp (seconds)
        }
    ),
)
results.append(("insert_memory", ok))
if result is not None:
    print("insert_memory:", result)  # IngestMemoryResponse(...)

# Or ingest multiple at once: client.insert_memories(items=[...])

# Get LLM context (prompt fetches relevant chunks; num_chunks limits how many)
ok, ctx = run_step(
    "recall_memory",
    lambda: client.recall_memory(
        namespace=preferences_ns,
        prompt="What is the user's preference for theme?",
        num_chunks=10,
    ),
)
results.append(("recall_memory", ok))
if ctx is not None:
    print("recall_memory.context:", getattr(ctx, "context", ctx))

# (Optional) Query LLM with context (use your own API key from the provider)
# Built-in providers: "openai", "anthropic", "google"
def _recall_with_llm_if_configured() -> Any:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")
    if ctx is None:
        raise RuntimeError("recall_memory did not return context")
    return client.recall_with_llm(
        prompt="What is the user's preference for theme?",
        provider="openai",
        model="gpt-4o-mini",
        api_key=api_key,
        context=ctx.context,
    )

ok, response = run_step("recall_with_llm (openai)", _recall_with_llm_if_configured, optional=True)
results.append(("recall_with_llm (openai)", ok))
if response is not None:
    print("recall_with_llm.text:", getattr(response, "text", response))

# Custom provider (OpenAI-compatible API)
# response = client.recall_with_llm(
#     prompt="What is the user's preference for theme?",
#     provider="custom",
#     model="your-model-name",
#     api_key="your-api-key",
#     url="https://api.example.com/v1/chat/completions",
#     context=ctx.context,
# )

# Delete all memory in namespace
# The current API exposes namespace-wide delete, not key-scoped delete.
ok, _ = run_step(
    "delete_memory(preferences)",
    lambda: client.delete_memory(namespace=preferences_ns, delete_all=True),
    optional=True,
)
results.append(("delete_memory(preferences)", ok))

# ---------------------------------------------------------------------------
# Documents & mirrored endpoints (aligned with the TypeScript SDK)
# ---------------------------------------------------------------------------

docs_ns = f"python-e2e-docs-{int(time.time())}"

document_id_single = f"py-doc-single-{int(time.time())}"
document_id_batch_0 = f"py-doc-batch-0-{int(time.time())}"
document_id_batch_1 = f"py-doc-batch-1-{int(time.time())}"

print("\n--- Documents endpoints (new) ---")

single_doc: Any = None
batch_res: Any = None

ok, single_doc = run_step(
    "insert_document",
    lambda: client.insert_document(
        title="Python E2E Doc (single)",
        content="Content stored by the Python SDK example (single).",
        namespace=docs_ns,
        source_type="doc",
        metadata={"source": "sdk-python-example", "variant": "single"},
        document_id=document_id_single,
    ),
)
results.append(("insert_document", ok))
if single_doc is not None:
    print("insert_document:", single_doc)

ok, batch_res = run_step(
    "insert_documents_batch",
    lambda: client.insert_documents_batch(
        items=[
            {
                "title": "Python E2E Doc (batch 0)",
                "content": "Content stored by the Python SDK example (batch 0).",
                "namespace": docs_ns,
                "source_type": "doc",
                "metadata": {"source": "sdk-python-example", "variant": "batch-0"},
                "document_id": document_id_batch_0,
            },
            {
                "title": "Python E2E Doc (batch 1)",
                "content": "Content stored by the Python SDK example (batch 1).",
                "namespace": docs_ns,
                "source_type": "doc",
                "metadata": {"source": "sdk-python-example", "variant": "batch-1"},
                "document_id": document_id_batch_1,
            },
        ]
    ),
)
results.append(("insert_documents_batch", ok))
if batch_res is not None:
    print("insert_documents_batch:", batch_res)

def _collect_job_ids(payload: Any) -> list[str]:
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
    # stable de-dupe
    seen: set[str] = set()
    out: list[str] = []
    for jid in ids:
        if jid not in seen:
            seen.add(jid)
            out.append(jid)
    return out


def _wait_for_insert_completion(step_name: str, payload: Any) -> None:
    job_ids = _collect_job_ids(payload)
    if not job_ids:
        print(f"[skip] wait_for_ingestion_job({step_name}): no jobId returned")
        results.append((f"wait_for_ingestion_job({step_name})", True))
        return
    for jid in job_ids:
        ok, status = run_step(
            f"get_ingestion_job({step_name}:{jid})",
            lambda jid=jid: client.get_ingestion_job(job_id=jid),
            optional=True,
        )
        results.append((f"get_ingestion_job({step_name}:{jid})", ok))
        if status is not None:
            print(f"get_ingestion_job({step_name}:{jid}):", status)
        ok, done = run_step(
            f"wait_for_ingestion_job({step_name}:{jid})",
            lambda jid=jid: client.wait_for_ingestion_job(
                job_id=jid,
                timeout_seconds=60,
                poll_interval_seconds=1,
            ),
            optional=True,
        )
        results.append((f"wait_for_ingestion_job({step_name}:{jid})", ok))
        if done is not None:
            print(f"wait_for_ingestion_job({step_name}:{jid}):", done)


_wait_for_insert_completion("insert_document", single_doc)
_wait_for_insert_completion("insert_documents_batch", batch_res)

def _collect_document_ids(payload: Any) -> list[str]:
    found: list[str] = []

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            for key in ("documentId", "document_id", "id"):
                v = node.get(key)
                if isinstance(v, str) and v:
                    found.append(v)
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(payload)
    # stable de-dupe
    seen: set[str] = set()
    out: list[str] = []
    for doc_id in found:
        if doc_id not in seen:
            seen.add(doc_id)
            out.append(doc_id)
    return out


def _list_documents_with_retry(
    *,
    attempts: int = 8,
    delay_s: float = 1.5,
) -> Any:
    last: Any = None
    for i in range(attempts):
        ok, res = run_step(
            f"list_documents(attempt-{i + 1})",
            lambda: client.list_documents(namespace=docs_ns, limit=50, offset=0),
            optional=True,
        )
        results.append((f"list_documents(attempt-{i + 1})", ok))
        if res is not None:
            print(f"list_documents(attempt-{i + 1}):", res)
            last = res
            if _collect_document_ids(res):
                return res
        if i < attempts - 1:
            time.sleep(delay_s)
    return last


list_res = _list_documents_with_retry()

listed_ids = _collect_document_ids(list_res) if list_res is not None else []
doc_to_get = document_id_single if document_id_single in listed_ids else (listed_ids[0] if listed_ids else None)

ok, get_res = run_step(
    "get_document",
    (lambda: client.get_document(document_id=doc_to_get, namespace=docs_ns)) if doc_to_get else (lambda: (_ for _ in ()).throw(RuntimeError("no document ids returned by list_documents"))),
    optional=True,
)
results.append(("get_document", ok))
if get_res is not None:
    print("get_document:", get_res)

ok, query_ctx_res = run_step(
    "query_memory_context",
    lambda: client.query_memory_context(
        query="What content did the Python SDK example store?",
        namespace=docs_ns,
        include_references=True,
        max_chunks=5,
        document_ids=[doc_to_get] if doc_to_get else [],
    ),
    optional=True if not doc_to_get else False,
)
results.append(("query_memory_context", ok))
if query_ctx_res is not None:
    print("query_memory_context:", query_ctx_res)

ok, chat_ctx_res = run_step(
    "chat_memory_context",
    lambda: client.chat_memory_context(
        messages=[
            {
                "role": "user",
                "content": "Using the stored memory, summarize what the single document contains.",
            }
        ],
        temperature=0,
        max_tokens=256,
    ),
    optional=True,
)
results.append(("chat_memory_context", ok))
if chat_ctx_res is not None:
    print("chat_memory_context:", chat_ctx_res)

ok, record_interactions_res = run_step(
    "record_interactions",
    lambda: client.record_interactions(
        namespace=docs_ns,
        entity_names=["PY-ENTITY-A", "PY-ENTITY-B"],
        description="Recorded by sdk-python example",
        interaction_level="engage",
    ),
)
results.append(("record_interactions", ok))
if record_interactions_res is not None:
    print("record_interactions:", record_interactions_res)

ok, thoughts_res = run_step(
    "recall_thoughts",
    lambda: client.recall_thoughts(namespace=docs_ns, max_chunks=5),
)
results.append(("recall_thoughts", ok))
if thoughts_res is not None:
    print("recall_thoughts:", thoughts_res)

ok, graph_snapshot = run_step(
    "get_graph_snapshot",
    lambda: client.get_graph_snapshot(
        namespace=docs_ns,
        mode="latest_chunks",
        limit=10,
        seed_limit=3,
    ),
    optional=True,
)
results.append(("get_graph_snapshot", ok))
if graph_snapshot is not None:
    print("get_graph_snapshot:", graph_snapshot)

print("\n--- Core endpoints (new) ---")

ok, chat_res = run_step(
    "chat_memory",
    lambda: client.chat_memory(
        messages=[
            {
                "role": "user",
                "content": "Summarize the single document that was stored earlier.",
            }
        ],
        temperature=0,
        max_tokens=256,
    ),
    optional=True,
)
results.append(("chat_memory", ok))
if chat_res is not None:
    print("chat_memory:", chat_res)

ok, interact_res = run_step(
    "interact_memory",
    lambda: client.interact_memory(
        namespace=docs_ns,
        entity_names=["PY-ENTITY-A", "PY-ENTITY-B"],
        description="Recorded by sdk-python example (interactMemory endpoint).",
        interaction_level="engage",
        timestamp=time.time(),
    ),
    optional=True,
)
results.append(("interact_memory", ok))
if interact_res is not None:
    print("interact_memory:", interact_res)

ok, master_ctx = run_step(
    "recall_memory_master",
    lambda: client.recall_memory_master(namespace=docs_ns, max_chunks=5),
    optional=True,
)
results.append(("recall_memory_master", ok))
if master_ctx is not None:
    print("recall_memory_master.context:", getattr(master_ctx, "context", master_ctx))

ok, memories_res = run_step(
    "recall_memories",
    lambda: client.recall_memories(namespace=docs_ns, top_k=5, min_retention=0),
    optional=True,
)
results.append(("recall_memories", ok))
if memories_res is not None:
    print("recall_memories:", memories_res)

def _job_id_from_payload(payload: Any) -> Optional[str]:
    if isinstance(payload, dict):
        v = payload.get("jobId") or payload.get("job_id")
        if isinstance(v, str) and v:
            return v
        data = payload.get("data")
        if isinstance(data, dict):
            v = data.get("jobId") or data.get("job_id")
            if isinstance(v, str) and v:
                return v
    return None


job_id = _job_id_from_payload(single_doc) or _job_id_from_payload(batch_res)
if job_id:
    ok, ingestion_job = run_step(
        f"get_ingestion_job({job_id})",
        lambda: client.get_ingestion_job(job_id=job_id),
        optional=True,
    )
    results.append(("get_ingestion_job", ok))
    if ingestion_job is not None:
        print("get_ingestion_job:", ingestion_job)

    ok, waited_job = run_step(
        f"wait_for_ingestion_job({job_id})",
        lambda: client.wait_for_ingestion_job(
            job_id=job_id,
            timeout_seconds=30,
            poll_interval_seconds=1,
        ),
        optional=True,
    )
    results.append(("wait_for_ingestion_job", ok))
    if waited_job is not None:
        print("wait_for_ingestion_job:", waited_job)
else:
    print("[skip] get_ingestion_job/wait_for_ingestion_job: no jobId returned by inserts")
    results.append(("get_ingestion_job/wait_for_ingestion_job", True))

ok, _ = run_step(
    f"delete_document(single:{document_id_single})",
    lambda: client.delete_document(document_id=document_id_single, namespace=docs_ns),
    optional=True,
)
results.append((f"delete_document(single:{document_id_single})", ok))

for doc_id in [document_id_batch_0, document_id_batch_1]:
    ok, _ = run_step(
        f"delete_document(batch:{doc_id})",
        lambda doc_id=doc_id: client.delete_document(document_id=doc_id, namespace=docs_ns),
        optional=True,
    )
    results.append((f"delete_document(batch:{doc_id})", ok))

# Cleanup: delete entire namespace (safe fallback).
ok, _ = run_step(
    f"delete_memory(namespace:{docs_ns})",
    lambda: client.delete_memory(namespace=docs_ns, delete_all=True),
    optional=True,
)
results.append((f"delete_memory(namespace:{docs_ns})", ok))

print("\n--- Summary ---")
failed = [name for name, ok in results if not ok]
if failed:
    print(f"Failed steps: {len(failed)}")
    for name in failed:
        print(f"- {name}")
else:
    print(f"All steps completed (count={len(results)})")
