"""LangGraph-compatible tools for Alphahuman Memory API.

These tools can be used as LangGraph nodes or bound to LLM tool-calling
via LangChain's ``@tool`` decorator.

Recommended usage — factory pattern (avoids exposing credentials to the LLM):

    from alphahuman_langgraph import make_memory_tools

    tools = make_memory_tools(token="your-api-key")
    llm_with_tools = llm.bind_tools(tools)

For quick scripting you can also use the convenience accessor that reads
``ALPHAHUMAN_API_KEY`` / ``ALPHAHUMAN_BASE_URL`` from the environment:

    from alphahuman_langgraph import get_tools

    tools = get_tools()
"""

from __future__ import annotations

import os
from typing import Any, Optional

from langchain_core.tools import tool

from alphahuman_memory import (
    AlphahumanConfig,
    AlphahumanMemoryClient,
    DeleteMemoryRequest,
    IngestMemoryRequest,
    MemoryItem,
    ReadMemoryRequest,
)
from alphahuman_memory.types import DEFAULT_BASE_URL

_TOKEN_ENV = "ALPHAHUMAN_API_KEY"
_BASE_URL_ENV = "ALPHAHUMAN_BASE_URL"


def make_memory_tools(
    token: str,
    base_url: Optional[str] = None,
) -> list[Any]:
    """Create Alphahuman Memory tools bound to a specific client.

    Credentials are captured at construction time and are never exposed to
    the LLM as tool parameters, preventing prompt-injection attacks.

    Args:
        token: Bearer token (JWT or API key).
        base_url: Optional API base URL override.

    Returns:
        List of three LangChain ``@tool`` callables:
        ``alphahuman_ingest_memory``, ``alphahuman_read_memory``,
        ``alphahuman_delete_memory``.
    """
    client = AlphahumanMemoryClient(
        AlphahumanConfig(token=token, base_url=base_url or DEFAULT_BASE_URL)
    )

    @tool
    def alphahuman_ingest_memory(items: list[dict[str, Any]]) -> dict[str, Any]:
        """Ingest (upsert) memory items into the Alphahuman Memory API.

        Each item must have 'key' (str) and 'content' (str). Optional fields:
        'namespace' (str, default 'default') and 'metadata' (dict).

        Args:
            items: List of memory items to ingest.

        Returns:
            Dict with counts: ingested, updated, errors.
        """
        memory_items = [
            MemoryItem(
                key=item["key"],
                content=item["content"],
                namespace=item.get("namespace", "default"),
                metadata=item.get("metadata", {}),
            )
            for item in items
        ]
        result = client.ingest_memory(IngestMemoryRequest(items=memory_items))
        return {"ingested": result.ingested, "updated": result.updated, "errors": result.errors}

    @tool
    def alphahuman_read_memory(
        key: Optional[str] = None,
        keys: Optional[list[str]] = None,
        namespace: Optional[str] = None,
    ) -> dict[str, Any]:
        """Read memory items from the Alphahuman Memory API.

        Optionally filter by 'key', 'keys', or 'namespace'.
        Returns all user memory if no filters are provided.

        Args:
            key: Single key to read.
            keys: List of keys to read.
            namespace: Namespace scope.

        Returns:
            Dict with 'items' list and 'count'.
        """
        result = client.read_memory(ReadMemoryRequest(key=key, keys=keys, namespace=namespace))
        return {
            "items": [
                {
                    "key": item.key,
                    "content": item.content,
                    "namespace": item.namespace,
                    "metadata": item.metadata,
                    "created_at": item.created_at,
                    "updated_at": item.updated_at,
                }
                for item in result.items
            ],
            "count": result.count,
        }

    @tool
    def alphahuman_delete_memory(
        key: Optional[str] = None,
        keys: Optional[list[str]] = None,
        namespace: Optional[str] = None,
        delete_all: bool = False,
    ) -> dict[str, int]:
        """Delete memory items from the Alphahuman Memory API.

        Provide 'key' (single), 'keys' (list), or set 'delete_all' to True.
        Optionally scope by 'namespace'.

        Args:
            key: Single key to delete.
            keys: List of keys to delete.
            namespace: Namespace scope.
            delete_all: Delete all user memory (use with caution).

        Returns:
            Dict with 'deleted' count.
        """
        result = client.delete_memory(
            DeleteMemoryRequest(key=key, keys=keys, namespace=namespace, delete_all=delete_all)
        )
        return {"deleted": result.deleted}

    return [alphahuman_ingest_memory, alphahuman_read_memory, alphahuman_delete_memory]


def get_tools() -> list[Any]:
    """Return memory tools configured from environment variables.

    Reads ``ALPHAHUMAN_API_KEY`` (required) and ``ALPHAHUMAN_BASE_URL``
    (optional) from the environment.

    Raises:
        ValueError: If ``ALPHAHUMAN_API_KEY`` is not set.
    """
    token = os.environ.get(_TOKEN_ENV, "")
    if not token:
        raise ValueError(
            f"Set the {_TOKEN_ENV} environment variable or use make_memory_tools(token=...)"
        )
    base_url = os.environ.get(_BASE_URL_ENV) or None
    return make_memory_tools(token=token, base_url=base_url)
