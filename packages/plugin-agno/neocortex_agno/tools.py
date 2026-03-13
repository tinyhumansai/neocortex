"""Neocortex (Alphahuman) memory tools for Agno agents."""

from __future__ import annotations

import os
from typing import Any, Optional, Sequence

import httpx
from agno.tools import Toolkit

__all__ = ["NeocortexTools", "AlphahumanError"]


DEFAULT_BASE_URL = "https://staging-api.alphahuman.xyz"
BASE_URL_ENV = "ALPHAHUMAN_BASE_URL"


class AlphahumanError(Exception):
    """Error raised for Alphahuman memory API failures."""

    def __init__(self, message: str, status: int, body: Any | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.body = body


class AlphahumanMemoryClient:
    """Minimal Alphahuman memory client aligned with the TypeScript SDK.

    Endpoints:
      - POST /v1/memory/insert
      - POST /v1/memory/query
      - POST /v1/memory/admin/delete
    """

    def __init__(self, token: str, base_url: Optional[str] = None) -> None:
        if not token or not token.strip():
            raise ValueError("token is required")
        resolved = base_url or os.getenv(BASE_URL_ENV) or DEFAULT_BASE_URL
        self._base_url = resolved.rstrip("/")
        self._token = token
        self._http = httpx.Client(
            base_url=self._base_url,
            headers={
                "Authorization": f"Bearer {self._token}",
                "Content-Type": "application/json",
            },
            timeout=30,
        )

    def close(self) -> None:
        self._http.close()

    def insert_memory(
        self,
        *,
        title: str,
        content: str,
        namespace: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "title": title,
            "content": content,
            "namespace": namespace,
            "sourceType": "doc",
            "metadata": metadata or {},
        }
        return self._post("/v1/memory/insert", body)

    def query_memory(
        self,
        *,
        query: str,
        namespace: Optional[str] = None,
        max_chunks: Optional[int] = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "query": query,
            "includeReferences": False,
            "namespace": namespace,
            "maxChunks": max_chunks,
        }
        return self._post("/v1/memory/query", body)

    def delete_memory(self, *, namespace: Optional[str] = None) -> dict[str, Any]:
        body: dict[str, Any] = {"namespace": namespace}
        return self._post("/v1/memory/admin/delete", body)

    def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        res = self._http.post(path, json=body)
        try:
            payload = res.json()
        except Exception:
            raise AlphahumanError(
                f"HTTP {res.status_code}: non-JSON response",
                res.status_code,
                res.text,
            )
        # Alphahuman responses are shaped as { success: bool, data?: ..., error?: str }
        success = bool(payload.get("success"))
        if not res.is_success or not success:
            message = payload.get("error") or f"HTTP {res.status_code}"
            raise AlphahumanError(message, res.status_code, payload)
        data = payload.get("data")
        return data if isinstance(data, dict) else payload


class NeocortexTools(Toolkit):
    """Agno toolkit that exposes Neocortex (Alphahuman) memory as agent tools.

    Gives agents the ability to save, recall, and delete persistent memory
    via the Alphahuman backend. Credentials are set at construction and are
    never exposed to the LLM as tool parameters.
    """

    def __init__(
        self,
        token: str,
        base_url: Optional[str] = None,
        **kwargs: Any,
    ) -> None:
        """Create the toolkit with Neocortex (Alphahuman) API credentials.

        Args:
            token: API token (Bearer). Not exposed to the agent.
            base_url: Optional API base URL. Uses ALPHAHUMAN_BASE_URL env or default if omitted.
            **kwargs: Passed through to Toolkit (e.g. name).
        """
        self._client = AlphahumanMemoryClient(token=token, base_url=base_url)
        tools = [
            self.save_memory,
            self.recall_memory,
            self.delete_memory,
        ]
        super().__init__(name="neocortex_memory", tools=tools, **kwargs)

    def save_memory(
        self,
        key: str,
        content: str,
        namespace: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> str:
        """Save or update a single memory in Neocortex.

        Use this when the user asks you to remember something, or when you
        learn a fact (e.g. a preference, name, or context) that should persist.

        Args:
            key: Unique identifier for this memory within the namespace (e.g. "user-theme-preference").
            content: The memory content to store (e.g. "User prefers dark mode").
            namespace: Scope for organizing memories (e.g. "preferences", "user-facts", "session-123").
            metadata: Optional key-value metadata for filtering or tagging.

        Returns:
            A short confirmation message (e.g. "Saved 1 memory" or "Updated 1 memory").
        """
        # Map our logical key/content/namespace into Alphahuman's insert API.
        result = self._client.insert_memory(
            title=key,
            content=content,
            namespace=namespace,
            metadata=metadata or {},
        )
        status = result.get("status") or "ok"
        return f"Saved memory '{key}' in namespace '{namespace}' (status={status})."

    def recall_memory(
        self,
        namespace: str,
        prompt: str,
        num_chunks: int = 10,
    ) -> str:
        """Recall relevant memories from Neocortex for a given question or topic.

        Use this when you need to look up what was previously stored (e.g. user
        preferences, past facts, or conversation context) before answering.

        Args:
            namespace: The namespace to search in (e.g. "preferences", "user-facts").
            prompt: Natural-language query describing what you need (e.g. "What theme does the user prefer?").
            num_chunks: Maximum number of memory chunks to retrieve (default 10).

        Returns:
            A formatted string of relevant memories, or a message if none were found.
        """
        data = self._client.query_memory(
            query=prompt,
            namespace=namespace,
            max_chunks=num_chunks,
        )
        # Try to return an LLM-ready string. Prefer llmContextMessage/response,
        # fall back to concatenated chunk content.
        llm_msg = data.get("llmContextMessage") or data.get("response")
        if isinstance(llm_msg, str) and llm_msg.strip():
            return llm_msg

        context = data.get("context") or {}
        chunks = context.get("chunks") or []
        texts: list[str] = []
        for chunk in chunks:
            if isinstance(chunk, dict):
                text = chunk.get("content") or chunk.get("text") or ""
                if isinstance(text, str) and text.strip():
                    texts.append(text.strip())
        if not texts:
            return f"No memories found in namespace '{namespace}' for that query."
        return "\n\n".join(texts)

    def delete_memory(
        self,
        namespace: str,
        key: Optional[str] = None,
        keys: Optional[Sequence[str]] = None,
        delete_all: bool = False,
    ) -> str:
        """Delete one or more memories from Neocortex.

        Use when the user asks to forget something or to clear stored data.
        You must provide either key, keys, or delete_all=True.

        Args:
            namespace: The namespace to delete from (required).
            key: Optional single memory key to delete.
            keys: Optional list of memory keys to delete.
            delete_all: If True, delete all memories in this namespace. Use with care.

        Returns:
            A short confirmation of how many memories were deleted.
        """
        # Alphahuman delete API only supports namespace-scoped admin delete.
        # We ignore key/keys and require either delete_all or explicit call.
        if (key or keys) and not delete_all:
            raise ValueError(
                "Alphahuman delete only supports namespace-wide delete. "
                "Set delete_all=True when calling delete_memory."
            )
        result = self._client.delete_memory(namespace=namespace)
        nodes_deleted = result.get("nodesDeleted", 0)
        return f"Deleted {nodes_deleted} memory node(s) from namespace '{namespace}'."
