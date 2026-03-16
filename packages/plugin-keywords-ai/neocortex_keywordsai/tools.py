"""Neocortex memory tools providing OpenAI-compatible JSON schemas for Keywords AI."""

import json
from typing import Optional, List, Dict, Callable, Any

from tinyhumansai import TinyHumanMemoryClient, MemoryItem, TinyHumanError


class NeocortexMemoryTools:
    """Wrapper class providing OpenAI-compatible tool schemas for memory operations."""

    def __init__(self, client: TinyHumanMemoryClient, default_namespace: str = "agent_memory") -> None:
        """Initialize the tools wrapper.

        Args:
            client (TinyHumanMemoryClient): Configured Neocortex memory client.
            default_namespace (str): Fallback namespace if none is provided in calls.
        """
        self._client = client
        self._default_namespace = default_namespace

    def _save_memory(
        self,
        key: str,
        content: str,
        namespace: Optional[str] = None,
        metadata_json: Optional[str] = None,
    ) -> str:
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

    def _recall_memory(
        self,
        prompt: str,
        namespace: Optional[str] = None,
        num_chunks: int = 10,
    ) -> str:
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

    def _delete_memory(self, namespace: Optional[str] = None) -> str:
        ns = namespace or self._default_namespace
        try:
            self._client.delete_memory(namespace=ns, delete_all=True)
            return f"Deleted memories from namespace '{ns}'."
        except TinyHumanError as exc:
            return f"Failed to delete memory: {exc}"

    def get_tool_definitions(self) -> List[Dict[str, Any]]:
        """Return a list of OpenAI-compatible tool specifications."""
        return [
            {
                "type": "function",
                "function": {
                    "name": "save_memory",
                    "description": "Save or update a single memory in Neocortex. Use this when you learn a fact (e.g. user preference, context) that should persist.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "key": {
                                "type": "string",
                                "description": "Unique identifier for this memory. Required."
                            },
                            "content": {
                                "type": "string",
                                "description": "The memory content to store. Required."
                            },
                            "namespace": {
                                "type": "string",
                                "description": "Scope for organizing memories. Falls back to default if not provided."
                            },
                            "metadata_json": {
                                "type": "string",
                                "description": "JSON-encoded key-value dictionary for metadata."
                            }
                        },
                        "required": ["key", "content"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "recall_memory",
                    "description": "Recall relevant memories from Neocortex for a given question or topic. Use this to look up past facts before answering.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "prompt": {
                                "type": "string",
                                "description": "Natural-language query describing what you need. Required."
                            },
                            "namespace": {
                                "type": "string",
                                "description": "The namespace to search in. Falls back to default if not provided."
                            },
                            "num_chunks": {
                                "type": "integer",
                                "description": "Maximum number of memory chunks to retrieve. Defaults to 10."
                            }
                        },
                        "required": ["prompt"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "delete_memory",
                    "description": "Delete all memories in a given namespace from Neocortex.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "namespace": {
                                "type": "string",
                                "description": "The namespace to clear. Falls back to default if not provided."
                            }
                        }
                    }
                }
            }
        ]

    def get_tool_functions(self) -> Dict[str, Callable]:
        """Return a dictionary mapping tool names to actual Python callables."""
        return {
            "save_memory": self._save_memory,
            "recall_memory": self._recall_memory,
            "delete_memory": self._delete_memory,
        }
