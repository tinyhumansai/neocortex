"""Neocortex memory tools for Microsoft AutoGen."""

import json
from typing import Optional, Dict

from autogen import ConversableAgent, register_function
from tinyhumansai import TinyHumanMemoryClient, MemoryItem, TinyHumanError


class NeocortexMemoryTools:
    """Wrapper class providing memory tools for AutoGen agents.

    Exposes methods that can be registered as tools to ConversableAgents.
    """

    def __init__(self, client: TinyHumanMemoryClient, default_namespace: str = "agent_memory") -> None:
        """Initialize the tools wrapper.

        Args:
            client (TinyHumanMemoryClient): Configured Neocortex memory client.
            default_namespace (str): Fallback namespace if none is provided in calls.
        """
        self._client = client
        self._default_namespace = default_namespace

    def save_memory(
        self,
        key: str,
        content: str,
        namespace: Optional[str] = None,
        metadata_json: Optional[str] = None,
    ) -> str:
        """Save or update a single memory in Neocortex.

        Use this when you learn a fact (e.g. user preference, context) that should persist.

        Args:
            key (str): Unique identifier for this memory. Required.
            content (str): The memory content to store. Required.
            namespace (Optional[str]): Scope for organizing memories. Falls back to default.
            metadata_json (Optional[str]): JSON-encoded key-value dictionary for metadata.
        """
        ns = namespace or self._default_namespace
        metadata: Dict = {}
        if metadata_json:
            try:
                metadata = json.loads(metadata_json)
            except json.JSONDecodeError:
                pass

        try:
            self._client.ingest_memory(
                item=MemoryItem(
                    key=key,
                    content=content,
                    namespace=ns,
                    metadata=metadata,
                )
            )
            return f"Saved memory '{key}' in namespace '{ns}'."
        except TinyHumanError as exc:
            return f"Failed to save memory: {exc}"

    def recall_memory(
        self,
        prompt: str,
        namespace: Optional[str] = None,
        num_chunks: int = 10,
    ) -> str:
        """Recall relevant memories from Neocortex for a given question or topic.

        Use this to look up past facts before answering.

        Args:
            prompt (str): Natural-language query describing what you need. Required.
            namespace (Optional[str]): The namespace to search in. Falls back to default.
            num_chunks (int): Maximum number of memory chunks to retrieve. Defaults to 10.
        """
        ns = namespace or self._default_namespace
        try:
            resp = self._client.recall_memory(
                namespace=ns,
                prompt=prompt,
                num_chunks=num_chunks,
            )

            if not resp.items:
                return f"No memories found in namespace '{ns}' for that query."

            texts = [item.content for item in resp.items if item.content.strip()]
            return "\\n\\n".join(texts)
        except TinyHumanError as exc:
            return f"Failed to recall memory: {exc}"

    def delete_memory(self, namespace: Optional[str] = None) -> str:
        """Delete all memories in a given namespace from Neocortex.

        Args:
            namespace (Optional[str]): The namespace to clear. Falls back to default.
        """
        ns = namespace or self._default_namespace
        try:
            self._client.delete_memory(namespace=ns, delete_all=True)
            return f"Deleted memories from namespace '{ns}'."
        except TinyHumanError as exc:
            return f"Failed to delete memory: {exc}"


def register_neocortex_tools(
    tools: NeocortexMemoryTools, caller: ConversableAgent, executor: ConversableAgent
) -> None:
    """Helper to register all Neocortex memory tools to an AutoGen caller/executor pair.

    The caller agent will have the tools in its llm_config to propose tool calls.
    The executor agent (usually the UserProxyAgent) will execute the tool calls locally.

    Args:
        tools (NeocortexMemoryTools): Initialized memory tools instance.
        caller (ConversableAgent): The LLM agent that will propose tool calls.
        executor (ConversableAgent): The agent that will execute tool calls.
    """
    register_function(
        tools.save_memory,
        caller=caller,
        executor=executor,
        name="save_memory",
        description="Save or update a fact or context into persistent memory.",
    )
    register_function(
        tools.recall_memory,
        caller=caller,
        executor=executor,
        name="recall_memory",
        description="Search persistent memory for facts matching a natural language query.",
    )
    register_function(
        tools.delete_memory,
        caller=caller,
        executor=executor,
        name="delete_memory",
        description="Clear an entire namespace of persistent memory.",
    )
