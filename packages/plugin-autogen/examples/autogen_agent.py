"""Example demonstrating Neocortex memory tools with AutoGen agents."""

from __future__ import annotations

import os
import re
import time

import autogen
from dotenv import load_dotenv
from tinyhumansai import TinyHumanMemoryClient

from neocortex_autogen import NeocortexMemoryTools, register_neocortex_tools

def _is_terminate_message(msg: dict) -> bool:
    content = msg.get("content", "")
    if not isinstance(content, str):
        return False
    return bool(re.search(r"\bTERMINATE\b[.!?\s]*$", content.strip(), re.IGNORECASE))


def main():
    load_dotenv()
    token = os.getenv("TINYHUMANS_API_KEY")
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not token:
        print("Please set TINYHUMANS_API_KEY")
        return
    if not openai_api_key:
        print("Please set OPENAI_API_KEY")
        return

    namespace = f"autogen-session-{int(time.time())}"
    memory_client = TinyHumanMemoryClient(token=token)
    memory_tools = NeocortexMemoryTools(client=memory_client, default_namespace=namespace)

    llm_config = {
        "config_list": [{"model": "gpt-4o-mini", "api_key": openai_api_key}],
        "cache_seed": None,
    }

    assistant = autogen.AssistantAgent(
        name="assistant",
        system_message=(
            "You are a helpful assistant with Neocortex memory tools. "
            "Use tools whenever the user asks to remember, retrieve, or manage memory. "
            f"Always use namespace '{namespace}' unless the user explicitly provides another one. "
            "Do not invent IDs; for insert_document, use document_id matching the provided key. "
            "If list_documents returns no documents, skip get_document. "
            "For chat_memory_context and chat_memory, always pass non-empty messages_json. "
            "For interact_memory, always include a non-empty description string. "
            "When calling recall_memories, include min_retention=0 and as_of as current unix seconds. "
            "Reply with TERMINATE when done."
        ),
        llm_config=llm_config,
    )

    user_proxy = autogen.UserProxyAgent(
        name="user_proxy",
        is_termination_msg=_is_terminate_message,
        human_input_mode="NEVER",
        max_consecutive_auto_reply=12,
        code_execution_config=False,
    )

    # Assistant proposes tools; user_proxy executes them locally.
    register_neocortex_tools(tools=memory_tools, caller=assistant, executor=user_proxy)

    print("--- Round 1: save + insert document ---")
    user_proxy.initiate_chat(
        assistant,
        message=(
            f"Use save_memory with namespace='{namespace}', key='favorite_author', "
            "content='My favorite author is Isaac Asimov.'. "
            f"Then use insert_document with namespace='{namespace}', title='Favorite Author', "
            "content='My favorite author is Isaac Asimov.', source_type='doc', document_id='favorite_author'. "
            "Then say TERMINATE."
        ),
    )

    print("\n--- Round 2: recall + context query ---")
    user_proxy.initiate_chat(
        assistant,
        message=(
            f"Use recall_memory with namespace='{namespace}' and prompt='Who is my favorite author?'. "
            f"Then use query_memory_context with namespace='{namespace}' and "
            "query='Who is my favorite author?'. Then say TERMINATE."
        ),
        clear_history=True,
    )

    print("\n--- Round 3: document + context + chat tools ---")
    user_proxy.initiate_chat(
        assistant,
        message=(
            "Call these tools in order using namespace "
            f"'{namespace}': "
            "list_documents, get_document (pick any id from list if available), "
            "chat_memory_context, and chat_memory. "
            "Use messages_json='[{\"role\":\"user\",\"content\":\"Who is my favorite author?\"}]' "
            "for both chat tools. "
            "If documents is empty, skip get_document. "
            "Summarize what happened and then say TERMINATE."
        ),
        clear_history=True,
    )

    print("\n--- Round 4: interaction + thought + recall tools ---")
    user_proxy.initiate_chat(
        assistant,
        message=(
            "Call record_interactions and interact_memory with two entity names, then "
            "call recall_thoughts, recall_memory_master, and recall_memories for namespace "
            f"'{namespace}'. "
            "Use entity_names_json='[\"entity1\",\"entity2\"]'. "
            "For interact_memory include description='agent interaction sample'. "
            "Summarize results and then say TERMINATE."
        ),
        clear_history=True,
    )

    print("\n--- Round 5: best-effort sync + ingestion status ---")
    user_proxy.initiate_chat(
        assistant,
        message=(
            "Try calling sync_memory using workspace_id='demo-workspace' and "
            "agent_id='demo-agent' with one simple file payload; this may fail on some backends. "
            "Then try get_ingestion_job with a placeholder id like 'demo-job-id' (best-effort). "
            "Report outcomes and then say TERMINATE."
        ),
        clear_history=True,
    )

    print("\n--- Round 6: cleanup ---")
    user_proxy.initiate_chat(
        assistant,
        message=(
            f"Use list_documents and delete_document for namespace '{namespace}' to clean up "
            "any test docs if possible, then call delete_memory for the same namespace, then "
            "say TERMINATE."
        ),
        clear_history=True,
    )


if __name__ == "__main__":
    main()
