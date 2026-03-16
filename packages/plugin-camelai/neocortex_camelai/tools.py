"""Neocortex memory tools for CAMEL AI."""

import json
from typing import Optional, List, Dict
from camel.toolkits import FunctionTool

from tinyhumansai import TinyHumanMemoryClient, MemoryItem, TinyHumanError


class NeocortexToolkit:
    """Toolkit providing memory functions for CAMEL AI agents."""

    def __init__(self, client: TinyHumanMemoryClient, default_namespace: str = "agent_memory") -> None:
        """Initialize the toolkit.

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

    def get_tools(self) -> List[FunctionTool]:
        """Return a list of FunctionTools for the CAMEL AI agent."""
        return [
            FunctionTool(self.save_memory),
            FunctionTool(self.recall_memory),
            FunctionTool(self.delete_memory),
        ]
