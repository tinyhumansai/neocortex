"""Neocortex memory tools as a LlamaIndex ToolSpec."""

from typing import Any, List, Optional
from llama_index.core.tools.tool_spec.base import BaseToolSpec
from tinyhumansai import TinyHumanMemoryClient, MemoryItem, TinyHumanError

class NeocortexToolSpec(BaseToolSpec):
    """NeocortexToolSpec.

    Provides explicit save/recall/delete memory tools for LlamaIndex agents.
    """

    spec_functions: List[str] = [
        "save_memory",
        "recall_memory",
        "delete_memory",
    ]

    def __init__(self, client: TinyHumanMemoryClient, default_namespace: str = "agent_memory") -> None:
        """Initialize with a TinyHumanMemoryClient."""
        self._client = client
        self._default_namespace = default_namespace

    def save_memory(
        self,
        key: str,
        content: str,
        namespace: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> str:
        """Save or update a single memory in Neocortex.

        Use this when you learn a fact (e.g. user preference, context) that should persist.

        Args:
            key (str): Unique identifier for this memory.
            content (str): The memory content to store.
            namespace (Optional[str]): Scope for organizing memories. Falls back to default.
            metadata (Optional[dict]): Key-value metadata.
        """
        ns = namespace or self._default_namespace
        try:
            self._client.ingest_memory(
                item=MemoryItem(
                    key=key,
                    content=content,
                    namespace=ns,
                    metadata=metadata or {},
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
            prompt (str): Natural-language query describing what you need.
            namespace (Optional[str]): The namespace to search in.
            num_chunks (int): Maximum number of memory chunks to retrieve.
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
            namespace (Optional[str]): The namespace to clear.
        """
        ns = namespace or self._default_namespace
        try:
            self._client.delete_memory(namespace=ns, delete_all=True)
            return f"Deleted memories from namespace '{ns}'."
        except TinyHumanError as exc:
            return f"Failed to delete memory: {exc}"
