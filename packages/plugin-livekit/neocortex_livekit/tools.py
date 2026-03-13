"""Neocortex (Alphahuman) memory tools for LiveKit agents."""

from __future__ import annotations

import os
from typing import Any, Optional

import httpx

__all__ = ["NeocortexLiveKitTools", "AlphahumanError"]


DEFAULT_BASE_URL = "https://staging-api.alphahuman.xyz"
BASE_URL_ENV = "ALPHAHUMAN_BASE_URL"


class AlphahumanError(Exception):
    """Error raised for Alphahuman memory API failures."""

    def __init__(self, message: str, status: int, body: Any | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.body = body


class AlphahumanMemoryClient:
    """Minimal Alphahuman memory client aligned with the TypeScript SDK."""

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
        success = bool(payload.get("success"))
        if not res.is_success or not success:
            message = payload.get("error") or f"HTTP {res.status_code}"
            raise AlphahumanError(message, res.status_code, payload)
        data = payload.get("data")
        return data if isinstance(data, dict) else payload


class NeocortexLiveKitTools:
    """LiveKit-friendly helper exposing save/recall/delete memory operations."""

    def __init__(
        self,
        token: str,
        base_url: Optional[str] = None,
        namespace: Optional[str] = None,
    ) -> None:
        self._client = AlphahumanMemoryClient(token=token, base_url=base_url)
        self._namespace = namespace

    def close(self) -> None:
        self._client.close()

    def _ns(self, namespace: Optional[str]) -> Optional[str]:
        return namespace or self._namespace

    def save_memory(
        self,
        *,
        key: str,
        content: str,
        namespace: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> str:
        """Save or update a memory in Neocortex."""
        ns = self._ns(namespace)
        if not ns:
            raise ValueError("namespace is required")
        result = self._client.insert_memory(
            title=key,
            content=content,
            namespace=ns,
            metadata=metadata or {},
        )
        status = result.get("status") or "ok"
        return f"Saved memory '{key}' in namespace '{ns}' (status={status})."

    def recall_memory(
        self,
        *,
        prompt: str,
        namespace: Optional[str] = None,
        num_chunks: int = 10,
    ) -> str:
        """Recall relevant memories from Neocortex for a prompt."""
        ns = self._ns(namespace)
        data = self._client.query_memory(
            query=prompt,
            namespace=ns,
            max_chunks=num_chunks,
        )
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
            return "No memories found for that query."
        return "\n\n".join(texts)

    def delete_memory(
        self,
        *,
        namespace: Optional[str] = None,
        delete_all: bool = True,
    ) -> str:
        """Delete namespace memory from Neocortex."""
        ns = self._ns(namespace)
        if not ns:
            raise ValueError("namespace is required")
        if not delete_all:
            raise ValueError("LiveKit plugin delete is namespace-wide. Set delete_all=True.")
        result = self._client.delete_memory(namespace=ns)
        nodes_deleted = result.get("nodesDeleted", 0)
        return f"Deleted {nodes_deleted} memory node(s) from namespace '{ns}'."

    def build_prompt_with_memory(
        self,
        *,
        base_instructions: str,
        user_prompt: str,
        namespace: Optional[str] = None,
        num_chunks: int = 10,
    ) -> str:
        """Return prompt text with recalled memory prepended."""
        memory = self.recall_memory(
            prompt=user_prompt,
            namespace=namespace,
            num_chunks=num_chunks,
        )
        return (
            f"{base_instructions.strip()}\n\n"
            "Relevant memory context:\n"
            f"{memory}\n\n"
            f"User: {user_prompt.strip()}"
        )
