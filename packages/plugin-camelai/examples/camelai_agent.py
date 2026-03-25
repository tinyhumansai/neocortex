"""Example demonstrating broad Neocortex tool usage with CAMEL AI."""

import json
import os
import time
from dotenv import load_dotenv

from camel.agents import ChatAgent
from camel.messages import BaseMessage
from camel.models import ModelFactory
from camel.types import ModelPlatformType, ModelType

from tinyhumansai import TinyHumanMemoryClient
from neocortex_camelai import NeocortexToolkit


def print_tool_result(name: str, result: str) -> None:
    print(f"\n--- {name} ---")
    if "HTTP 403" in result:
        print("blocked by backend/token policy (best-effort demo)")
        print("raw:", result)
        return
    print(result)


def parse_json_result(result: str) -> dict:
    try:
        return json.loads(result)
    except Exception:
        return {}


def recall_with_retries(toolkit: NeocortexToolkit, namespace: str, attempts: int = 4, delay_s: float = 1.0) -> str:
    last = ""
    for i in range(attempts):
        last = toolkit.recall_memory(prompt="favorite author", namespace=namespace, num_chunks=5)
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

    namespace = f"camel-session-{int(time.time())}"
    memory_client = TinyHumanMemoryClient(token=token)
    toolkit = NeocortexToolkit(client=memory_client, default_namespace=namespace)
    tools = toolkit.get_tools()
    print(f"Loaded {len(tools)} Neocortex CAMEL tools")
    print(f"Using namespace: {namespace}")

    print("\n=== Deterministic direct-tool coverage ===")
    print_tool_result(
        "save_memory",
        toolkit.save_memory(
            key="favorite_author",
            content="My favorite author is Isaac Asimov.",
            namespace=namespace,
        ),
    )
    print_tool_result("recall_memory", recall_with_retries(toolkit, namespace))

    doc_id = f"camel-doc-{int(time.time())}"
    batch_doc_id = f"{doc_id}-batch-1"
    print_tool_result(
        "insert_document",
        toolkit.insert_document(
            title="Favorite Author",
            content="My favorite author is Isaac Asimov.",
            namespace=namespace,
            source_type="doc",
            metadata_json=json.dumps({"topic": "preferences"}),
            document_id=doc_id,
        ),
    )
    print_tool_result(
        "insert_documents_batch",
        toolkit.insert_documents_batch(
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
            )
        ),
    )
    list_res = toolkit.list_documents(namespace=namespace, limit=10, offset=0)
    print_tool_result("list_documents", list_res)
    listed_doc_id = doc_id
    parsed_list = parse_json_result(list_res)
    docs = parsed_list.get("documents", []) if isinstance(parsed_list, dict) else []
    if isinstance(docs, list) and docs:
        first = docs[0] if isinstance(docs[0], dict) else {}
        listed_doc_id = str(first.get("document_id") or listed_doc_id)
    print_tool_result("get_document", toolkit.get_document(document_id=listed_doc_id, namespace=namespace))
    print_tool_result(
        "query_memory_context",
        toolkit.query_memory_context(
            query="favorite author",
            namespace=namespace,
            max_chunks=5,
            include_references=False,
        ),
    )
    print_tool_result(
        "chat_memory_context",
        toolkit.chat_memory_context(
            messages_json=json.dumps([{"role": "user", "content": "Who is my favorite author?"}]),
            temperature=0.0,
            max_tokens=128,
        ),
    )
    print_tool_result(
        "chat_memory",
        toolkit.chat_memory(
            messages_json=json.dumps([{"role": "user", "content": "Summarize what you remember about me."}]),
            temperature=0.0,
            max_tokens=128,
        ),
    )
    print_tool_result(
        "record_interactions",
        toolkit.record_interactions(
            namespace=namespace,
            entity_names_json=json.dumps(["isaac asimov", "favorite_author"]),
            description="user preference referenced",
            interaction_level="read",
            timestamp=int(time.time()),
        ),
    )
    print_tool_result(
        "interact_memory",
        toolkit.interact_memory(
            namespace=namespace,
            entity_names_json=json.dumps(["isaac asimov"]),
            description="agent accessed this memory",
            interaction_levels_json=json.dumps(["react"]),
            timestamp=int(time.time()),
        ),
    )
    print_tool_result("recall_thoughts", toolkit.recall_thoughts(namespace=namespace, max_chunks=5, temperature=0.3))
    print_tool_result("recall_memory_master", toolkit.recall_memory_master(namespace=namespace, max_chunks=5))
    print_tool_result(
        "recall_memories",
        toolkit.recall_memories(
            namespace=namespace,
            top_k=5,
            min_retention=0.0,
            as_of=int(time.time()),
        ),
    )
    print_tool_result(
        "sync_memory",
        toolkit.sync_memory(
            workspace_id="demo-workspace",
            agent_id="camel-agent",
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
            source="startup",
        ),
    )
    print_tool_result("get_ingestion_job", toolkit.get_ingestion_job(job_id="demo-job-id"))
    print_tool_result(
        "get_graph_snapshot",
        toolkit.get_graph_snapshot(namespace=namespace, mode="master", limit=10, seed_limit=5),
    )

    print("\n=== Agent tool-calling sample ===")
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        print("Skipping ChatAgent demo (set OPENAI_API_KEY to enable).")
    else:
        model = ModelFactory.create(
            model_platform=ModelPlatformType.OPENAI,
            model_type=ModelType.GPT_4O_MINI,
            api_key=openai_api_key,
        )
        system_msg = BaseMessage.make_assistant_message(
            role_name="Memory Assistant",
            content=(
                "Use Neocortex tools for memory operations. "
                f"Default namespace is '{namespace}'."
            ),
        )
        agent = ChatAgent(system_message=system_msg, model=model, tools=tools)
        user_msg = BaseMessage.make_user_message(
            role_name="User",
            content=(
                "Use recall_memory to answer: Who is my favorite author? "
                f"Use namespace '{namespace}'."
            ),
        )
        response = agent.step(user_msg)
        print("Agent:", response.msgs[0].content)

    print("\n=== Cleanup ===")
    print_tool_result("delete_document", toolkit.delete_document(document_id=listed_doc_id, namespace=namespace))
    print_tool_result("delete_memory", toolkit.delete_memory(namespace=namespace))


if __name__ == "__main__":
    main()
