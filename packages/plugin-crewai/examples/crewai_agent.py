"""Example demonstrating broad Neocortex tool usage with CrewAI."""

import json
import os
import time

from dotenv import load_dotenv
from tinyhumansai import TinyHumanMemoryClient

from neocortex_crewai import create_neocortex_tools


def run_tool(tools_by_name, name: str, **kwargs):
    print(f"\n--- {name} ---")
    result = tools_by_name[name].run(**kwargs)
    print(result)
    return result


def parse_json_result(result: str) -> dict:
    try:
        return json.loads(result)
    except Exception:
        return {}


def recall_with_retries(tools_by_name, namespace: str, attempts: int = 4, delay_s: float = 1.0) -> str:
    last = ""
    for i in range(attempts):
        last = tools_by_name["recall_memory"].run(
            prompt="favorite author",
            namespace=namespace,
            num_chunks=5,
        )
        if "No memories found" not in last:
            return last
        if i < attempts - 1:
            time.sleep(delay_s)
    return last


def main() -> None:
    load_dotenv()
    token = os.getenv("TINYHUMANS_API_KEY")
    if not token:
        print("Please set TINYHUMANS_API_KEY")
        return

    namespace = f"crew-session-{int(time.time())}"
    client = TinyHumanMemoryClient(token=token)
    tools = create_neocortex_tools(client=client, default_namespace=namespace)
    tools_by_name = {tool.name: tool for tool in tools}

    print(f"Loaded {len(tools)} Neocortex CrewAI tools")
    print(f"Using namespace: {namespace}")

    run_tool(
        tools_by_name,
        "save_memory",
        key="favorite_author",
        content="My favorite author is Isaac Asimov.",
        namespace=namespace,
    )
    print("\n--- recall_memory ---")
    print(recall_with_retries(tools_by_name, namespace))

    doc_id = f"crew-doc-{int(time.time())}"
    batch_doc_id = f"{doc_id}-batch-1"
    insert_doc_res = run_tool(
        tools_by_name,
        "insert_document",
        title="Favorite Author",
        content="My favorite author is Isaac Asimov.",
        namespace=namespace,
        source_type="doc",
        metadata_json=json.dumps({"topic": "preferences"}),
        document_id=doc_id,
    )
    insert_batch_res = run_tool(
        tools_by_name,
        "insert_documents_batch",
        items_json=json.dumps(
            [
                {
                    "title": "Second Fact",
                    "content": "I enjoy science fiction.",
                    "namespace": namespace,
                    "sourceType": "doc",
                    "document_id": batch_doc_id,
                }
            ]
        ),
    )
    list_res = run_tool(tools_by_name, "list_documents", namespace=namespace, limit=10, offset=0)
    listed_doc_id = doc_id
    parsed_list = parse_json_result(list_res)
    docs = parsed_list.get("documents", []) if isinstance(parsed_list, dict) else []
    if isinstance(docs, list) and docs:
        first = docs[0] if isinstance(docs[0], dict) else {}
        listed_doc_id = str(first.get("document_id") or listed_doc_id)
    run_tool(tools_by_name, "get_document", document_id=listed_doc_id, namespace=namespace)
    run_tool(
        tools_by_name,
        "query_memory_context",
        query="favorite author",
        namespace=namespace,
        max_chunks=5,
    )
    chat_ctx_res = run_tool(
        tools_by_name,
        "chat_memory_context",
        messages_json=json.dumps([{"role": "user", "content": "Who is my favorite author?"}]),
        temperature=0.0,
        max_tokens=128,
    )
    if "Memory cache chat is not enabled" in chat_ctx_res:
        print("chat_memory_context unsupported on this backend; skipping follow-up expectations.")
    chat_res = run_tool(
        tools_by_name,
        "chat_memory",
        messages_json=json.dumps([{"role": "user", "content": "Summarize what you remember about me."}]),
        temperature=0.0,
        max_tokens=128,
    )
    if "Memory cache chat is not enabled" in chat_res:
        print("chat_memory unsupported on this backend.")
    run_tool(
        tools_by_name,
        "record_interactions",
        namespace=namespace,
        entity_names_json=json.dumps(["isaac asimov", "favorite_author"]),
        description="user preference referenced",
        interaction_levels_json=json.dumps(["read", "read"]),
        timestamp=int(time.time()),
    )
    run_tool(
        tools_by_name,
        "interact_memory",
        namespace=namespace,
        entity_names_json=json.dumps(["isaac asimov"]),
        description="agent accessed memory",
        interaction_levels_json=json.dumps(["react"]),
        timestamp=int(time.time()),
    )
    run_tool(tools_by_name, "recall_thoughts", namespace=namespace, max_chunks=5)
    run_tool(tools_by_name, "recall_memory_master", namespace=namespace, max_chunks=5)
    run_tool(tools_by_name, "recall_memories", namespace=namespace, top_k=5, min_retention=0.0, as_of=int(time.time()))
    sync_res = run_tool(
        tools_by_name,
        "sync_memory",
        workspace_id="demo-workspace",
        agent_id="crew-agent",
        source="startup",
        files_json=json.dumps(
            [
                {
                    "filePath": "notes/profile.txt",
                    "content": "favorite_author=Isaac Asimov",
                    "timestamp": str(int(time.time())),
                    "hash": "demo-hash",
                }
            ]
        ),
    )
    if "Cannot POST /v1/memory/sync" in sync_res or "Failed to sync memory" in sync_res:
        print("\n--- get_ingestion_job ---")
        print("Skipped: sync endpoint unavailable, no real job id to query.")
    else:
        job_id = None
        doc_payload = parse_json_result(insert_doc_res)
        if isinstance(doc_payload, dict):
            job_id = doc_payload.get("jobId")
        if not job_id:
            batch_payload = parse_json_result(insert_batch_res)
            accepted = batch_payload.get("accepted") if isinstance(batch_payload, dict) else None
            if isinstance(accepted, list) and accepted and isinstance(accepted[0], dict):
                job_id = accepted[0].get("jobId")
        if job_id:
            run_tool(tools_by_name, "get_ingestion_job", job_id=str(job_id))
        else:
            print("\n--- get_ingestion_job ---")
            print("Skipped: no real ingestion job id returned.")
    run_tool(tools_by_name, "get_graph_snapshot", namespace=namespace, mode="master", limit=10, seed_limit=5)

    run_tool(tools_by_name, "delete_document", document_id=listed_doc_id, namespace=namespace)
    run_tool(tools_by_name, "delete_memory", namespace=namespace)


if __name__ == "__main__":
    main()
