"""Neocortex (TinyHuman) memory tools for Agno agents."""

from __future__ import annotations

import json
import os
import time
from typing import Any, Optional, Sequence
from urllib.parse import quote

import httpx
from agno.tools import Toolkit

__all__ = ["NeocortexTools", "TinyHumanError"]


DEFAULT_BASE_URL = "https://api.tinyhumans.ai"
TINYHUMANS_BASE_URL = "TINYHUMANS_BASE_URL"


class TinyHumanError(Exception):
    """Error raised for TinyHuman memory API failures."""

    def __init__(self, message: str, status: int, body: Any | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.body = body


class TinyHumanMemoryClient:
    """Minimal TinyHuman memory client aligned with the TypeScript SDK.

    Endpoints:
      - POST /v1/memory/insert
      - POST /v1/memory/query
      - POST /v1/memory/admin/delete
      - POST /v1/memory/sync
      - POST /v1/memory/recall
      - POST /v1/memory/memories/recall
      - POST /v1/memory/memories/thoughts
      - POST /v1/memory/chat
      - POST /v1/memory/interact
      - POST /v1/memory/interactions
      - POST /v1/memory/queries
      - POST /v1/memory/conversations
      - GET /v1/memory/ingestion/jobs/:jobId
      - POST /v1/memory/documents
      - POST /v1/memory/documents/batch
      - GET /v1/memory/documents
      - GET /v1/memory/documents/:documentId
      - DELETE /v1/memory/documents/:documentId
    """

    def __init__(self, token: str, base_url: Optional[str] = None) -> None:
        if not token or not token.strip():
            raise ValueError("token is required")
        resolved = base_url or os.getenv(TINYHUMANS_BASE_URL) or DEFAULT_BASE_URL
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
        document_id: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "title": title,
            "content": content,
            "namespace": namespace,
            "sourceType": "doc",
            "metadata": metadata or {},
            "document_id": document_id,
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

    def insert_document(
        self,
        *,
        title: str,
        content: str,
        namespace: str,
        source_type: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        priority: Optional[str] = None,
        created_at: Optional[float] = None,
        updated_at: Optional[float] = None,
        document_id: str,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "title": title,
            "content": content,
            "namespace": namespace,
        }
        if source_type is not None:
            body["sourceType"] = source_type
        if metadata is not None:
            body["metadata"] = metadata
        if priority is not None:
            body["priority"] = priority
        if created_at is not None:
            body["createdAt"] = created_at
        if updated_at is not None:
            body["updatedAt"] = updated_at
        body["documentId"] = document_id
        result = self._post("/v1/memory/documents", body)
        return self._wait_for_document_ingestion(result)

    def insert_documents_batch(
        self,
        *,
        items: Sequence[dict[str, Any]],
    ) -> dict[str, Any]:
        if not items:
            raise ValueError("items must be a non-empty list")
        result = self._post("/v1/memory/documents/batch", {"items": list(items)})
        self._wait_for_batch_ingestions(result)
        return result

    def _wait_for_document_ingestion(
        self,
        insert_result: dict[str, Any],
        *,
        max_wait_seconds: int = 30,
    ) -> dict[str, Any]:
        """Wait for a document ingestion job to finish.

        The backend creates documents asynchronously; without polling, callers
        may observe 'pending' and immediately fail list/get/query.
        """
        if not isinstance(insert_result, dict):
            return insert_result

        job_id = insert_result.get("jobId") or insert_result.get("job_id")
        state = insert_result.get("state") or insert_result.get("status")
        if not isinstance(job_id, str):
            return insert_result

        pending_states = {
            "pending",
            "queued",
            "processing",
            "in_progress",
            "in-progress",
            "started",
            "start",
        }
        completed_states = {"completed", "done", "succeeded", "success"}
        failed_states = {"failed", "error", "cancelled", "canceled"}

        if isinstance(state, str) and state.strip().lower() in completed_states:
            return insert_result
        if isinstance(state, str) and state.strip().lower() not in pending_states:
            # Unknown state; avoid blocking.
            return insert_result

        deadline = time.time() + max_wait_seconds
        last_job: dict[str, Any] | None = None
        while time.time() < deadline:
            last_job = self.get_ingestion_job(job_id=job_id)
            job_state = (
                last_job.get("state")
                or last_job.get("status")
                or last_job.get("jobState")
            )
            if isinstance(job_state, str):
                s = job_state.strip().lower()
                if s in completed_states:
                    return last_job
                if s in failed_states:
                    raise TinyHumanError(
                        f"Ingestion job {job_id} failed (state={job_state})",
                        500,
                        last_job,
                    )
            time.sleep(1.0)

        # Timeout: return original insert result so the caller can decide.
        return insert_result

    def _wait_for_batch_ingestions(
        self,
        insert_result: dict[str, Any],
        *,
        max_wait_seconds: int = 30,
    ) -> None:
        """Wait for insert_documents_batch accepted jobs to finish."""
        if not isinstance(insert_result, dict):
            return

        job_ids: list[str] = []

        accepted = insert_result.get("accepted")
        if isinstance(accepted, list):
            for a in accepted:
                if isinstance(a, dict):
                    jid = a.get("jobId") or a.get("job_id")
                    if isinstance(jid, str):
                        job_ids.append(jid)

        direct_job_id = insert_result.get("jobId") or insert_result.get("job_id")
        if isinstance(direct_job_id, str):
            job_ids.append(direct_job_id)

        # De-dupe while preserving order.
        seen: set[str] = set()
        deduped_job_ids: list[str] = []
        for jid in job_ids:
            if jid not in seen:
                seen.add(jid)
                deduped_job_ids.append(jid)

        if not deduped_job_ids:
            return

        deadline = time.time() + max_wait_seconds
        remaining = set(deduped_job_ids)
        completed_states = {"completed", "done", "succeeded", "success"}
        failed_states = {"failed", "error", "cancelled", "canceled"}

        while remaining and time.time() < deadline:
            for job_id in list(remaining):
                job = self.get_ingestion_job(job_id=job_id)
                job_state = (
                    job.get("state") or job.get("status") or job.get("jobState")
                )
                if isinstance(job_state, str):
                    s = job_state.strip().lower()
                    if s in completed_states:
                        remaining.remove(job_id)
                    elif s in failed_states:
                        raise TinyHumanError(
                            f"Ingestion job {job_id} failed (state={job_state})",
                            500,
                            job,
                        )
            if remaining:
                time.sleep(1.0)

    def list_documents(
        self,
        *,
        namespace: Optional[str] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {}
        if namespace:
            params["namespace"] = namespace
        if limit is not None:
            params["limit"] = limit
        if offset is not None:
            params["offset"] = offset
        return self._get("/v1/memory/documents", params if params else None)

    def get_document(
        self,
        *,
        document_id: str,
        namespace: Optional[str] = None,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {}
        if namespace:
            params["namespace"] = namespace
        path = f"/v1/memory/documents/{quote(document_id, safe='')}"
        return self._get(path, params if params else None)

    def delete_document(
        self,
        *,
        document_id: str,
        namespace: str,
    ) -> dict[str, Any]:
        path = f"/v1/memory/documents/{quote(document_id, safe='')}"
        return self._delete(path, {"namespace": namespace})

    def query_memory_context(
        self,
        *,
        query: str,
        namespace: Optional[str] = None,
        include_references: Optional[bool] = None,
        max_chunks: Optional[int] = None,
        document_ids: Optional[Sequence[str]] = None,
        recall_only: Optional[bool] = None,
        llm_query: Optional[str] = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"query": query}
        if include_references is not None:
            body["includeReferences"] = include_references
        if namespace:
            body["namespace"] = namespace
        if max_chunks is not None:
            body["maxChunks"] = max_chunks
        if document_ids is not None:
            body["documentIds"] = list(document_ids)
        if recall_only is not None:
            body["recallOnly"] = recall_only
        if llm_query is not None:
            body["llmQuery"] = llm_query
        return self._post("/v1/memory/queries", body)

    def chat_memory_context(
        self,
        *,
        messages: Sequence[dict[str, Any]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"messages": list(messages)}
        if temperature is not None:
            body["temperature"] = temperature
        if max_tokens is not None:
            body["maxTokens"] = max_tokens
        return self._post("/v1/memory/conversations", body)

    def record_interactions(
        self,
        *,
        namespace: str,
        entity_names: Sequence[str],
        description: Optional[str] = None,
        interaction_level: Optional[str] = None,
        interaction_levels: Optional[Sequence[str]] = None,
        timestamp: Optional[float] = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "namespace": namespace,
            "entityNames": list(entity_names),
        }
        if description is not None:
            body["description"] = description
        if interaction_level is not None:
            body["interactionLevel"] = interaction_level
        if interaction_levels is not None:
            body["interactionLevels"] = list(interaction_levels)
        if timestamp is not None:
            body["timestamp"] = timestamp
        return self._post("/v1/memory/interactions", body)

    def recall_thoughts(
        self,
        *,
        namespace: Optional[str] = None,
        max_chunks: Optional[int] = None,
        temperature: Optional[float] = None,
        randomness_seed: Optional[int] = None,
        persist: Optional[bool] = None,
        enable_prediction_check: Optional[bool] = None,
        thought_prompt: Optional[str] = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {}
        if namespace:
            body["namespace"] = namespace
        if max_chunks is not None:
            body["maxChunks"] = max_chunks
        if temperature is not None:
            body["temperature"] = temperature
        if randomness_seed is not None:
            body["randomnessSeed"] = randomness_seed
        if persist is not None:
            body["persist"] = persist
        if enable_prediction_check is not None:
            body["enablePredictionCheck"] = enable_prediction_check
        if thought_prompt is not None:
            body["thoughtPrompt"] = thought_prompt
        return self._post("/v1/memory/memories/thoughts", body)

    def sync_memory(
        self,
        *,
        workspace_id: str,
        agent_id: str,
        files: Sequence[dict[str, Any]],
        source: Optional[str] = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "workspaceId": workspace_id,
            "agentId": agent_id,
            "files": list(files),
        }
        if source is not None:
            body["source"] = source
        return self._post("/v1/memory/sync", body)

    def chat_memory(
        self,
        *,
        messages: Sequence[dict[str, Any]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"messages": list(messages)}
        if temperature is not None:
            body["temperature"] = temperature
        if max_tokens is not None:
            body["maxTokens"] = max_tokens
        return self._post("/v1/memory/chat", body)

    def interact_memory(
        self,
        *,
        namespace: str,
        entity_names: Sequence[str],
        description: Optional[str] = None,
        interaction_level: Optional[str] = None,
        interaction_levels: Optional[Sequence[str]] = None,
        timestamp: Optional[float] = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "namespace": namespace,
            "entityNames": list(entity_names),
        }
        if description is not None:
            body["description"] = description
        if interaction_level is not None:
            body["interactionLevel"] = interaction_level
        if interaction_levels is not None:
            body["interactionLevels"] = list(interaction_levels)
        if timestamp is not None:
            body["timestamp"] = timestamp
        return self._post("/v1/memory/interact", body)

    def recall_memory_master(
        self,
        *,
        namespace: Optional[str] = None,
        max_chunks: Optional[int] = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {}
        if namespace:
            body["namespace"] = namespace
        if max_chunks is not None:
            body["maxChunks"] = max_chunks
        return self._post("/v1/memory/recall", body)

    def recall_memories(
        self,
        *,
        namespace: Optional[str] = None,
        top_k: Optional[float] = None,
        min_retention: Optional[float] = None,
        as_of: Optional[float] = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {}
        if namespace:
            body["namespace"] = namespace
        if top_k is not None:
            body["topK"] = top_k
        if min_retention is not None:
            body["minRetention"] = min_retention
        if as_of is not None:
            body["asOf"] = as_of
        return self._post("/v1/memory/memories/recall", body)

    def get_ingestion_job(self, *, job_id: str) -> dict[str, Any]:
        path = f"/v1/memory/ingestion/jobs/{quote(job_id, safe='')}"
        return self._get(path, None)

    def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        res = self._http.post(path, json=body)
        return self._parse_success(res)

    def _get(
        self, path: str, params: Optional[dict[str, Any]] = None
    ) -> dict[str, Any]:
        res = self._http.get(path, params=params)
        return self._parse_success(res)

    def _delete(
        self, path: str, params: Optional[dict[str, Any]] = None
    ) -> dict[str, Any]:
        res = self._http.delete(path, params=params)
        return self._parse_success(res)

    def _parse_success(self, res: httpx.Response) -> dict[str, Any]:
        try:
            payload = res.json()
        except Exception:
            raise TinyHumanError(
                f"HTTP {res.status_code}: non-JSON response",
                res.status_code,
                res.text,
            )
        # TinyHuman responses are shaped as { success: bool, data?: ..., error?: str }
        success = bool(payload.get("success"))
        if not res.is_success or not success:
            message = payload.get("error") or f"HTTP {res.status_code}"
            raise TinyHumanError(message, res.status_code, payload)
        data = payload.get("data")
        return data if isinstance(data, dict) else payload


class NeocortexTools(Toolkit):
    """Agno toolkit that exposes Neocortex (TinyHuman) memory as agent tools.

    Gives agents the ability to save, recall, and delete persistent memory
    via the TinyHuman backend. Credentials are set at construction and are
    never exposed to the LLM as tool parameters.
    """

    def __init__(
        self,
        token: str,
        base_url: Optional[str] = None,
        **kwargs: Any,
    ) -> None:
        """Create the toolkit with Neocortex (TinyHuman) API credentials.

        Args:
            token: API token (Bearer). Not exposed to the agent.
            base_url: Optional API base URL. Uses TINYHUMANS_BASE_URL env or default if omitted.
            **kwargs: Passed through to Toolkit (e.g. name).
        """
        self._client = TinyHumanMemoryClient(token=token, base_url=base_url)
        tools = [
            self.save_memory,
            self.recall_memory,
            self.delete_memory,
            self.sync_memory,
            self.insert_document,
            self.insert_documents_batch,
            self.list_documents,
            self.get_document,
            self.delete_document,
            self.query_memory_context,
            self.chat_memory_context,
            self.record_interactions,
            self.recall_thoughts,
            self.chat_memory,
            self.interact_memory,
            self.recall_memory_master,
            self.recall_memories,
            self.get_ingestion_job,
        ]
        super().__init__(name="neocortex_memory", tools=tools, **kwargs)

    def _json(self, value: Any) -> str:
        try:
            return json.dumps(value, ensure_ascii=False, indent=2)
        except Exception:
            return str(value)

    def _extract_context_string(self, data: dict[str, Any], namespace: Optional[str] = None) -> str:
        llm_msg = data.get("llmContextMessage") or data.get("response")
        if isinstance(llm_msg, str) and llm_msg.strip():
            return llm_msg

        context = data.get("context") or {}
        chunks = context.get("chunks") or []
        texts: list[str] = []
        for chunk in chunks:
            if not isinstance(chunk, dict):
                continue
            text = chunk.get("content") or chunk.get("text") or ""
            if isinstance(text, str) and text.strip():
                texts.append(text.strip())

        if not texts:
            ns = namespace or "?"
            return f"No context found in namespace '{ns}'."
        return "\n\n".join(texts)

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
        # Map our logical key/content/namespace into TinyHuman's insert API.
        result = self._client.insert_memory(
            title=key,
            content=content,
            namespace=namespace,
            document_id=key,
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
        # TinyHuman delete API only supports namespace-scoped admin delete.
        # We ignore key/keys and require either delete_all or explicit call.
        if (key or keys) and not delete_all:
            raise ValueError(
                "TinyHuman delete only supports namespace-wide delete. "
                "Set delete_all=True when calling delete_memory."
            )
        result = self._client.delete_memory(namespace=namespace)
        nodes_deleted = result.get("nodesDeleted", 0)
        return f"Deleted {nodes_deleted} memory node(s) from namespace '{namespace}'."

    def sync_memory(
        self,
        workspace_id: str,
        agent_id: str,
        files: Sequence[dict[str, Any]],
        source: Optional[str] = None,
    ) -> str:
        """Sync OpenClaw memory files (POST /v1/memory/sync)."""
        result = self._client.sync_memory(
            workspace_id=workspace_id,
            agent_id=agent_id,
            files=files,
            source=source,
        )
        return self._json(result)

    def insert_document(
        self,
        title: str,
        content: str,
        namespace: str,
        document_id: str,
        source_type: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        priority: Optional[str] = None,
        created_at: Optional[float] = None,
        updated_at: Optional[float] = None,
    ) -> str:
        """Insert a single memory document (POST /v1/memory/documents)."""
        result = self._client.insert_document(
            title=title,
            content=content,
            namespace=namespace,
            source_type=source_type,
            metadata=metadata,
            priority=priority,
            created_at=created_at,
            updated_at=updated_at,
            document_id=document_id,
        )
        return self._json(result)

    def insert_documents_batch(
        self,
        items: Sequence[dict[str, Any]],
    ) -> str:
        """Insert multiple documents (POST /v1/memory/documents/batch)."""
        result = self._client.insert_documents_batch(items=items)
        return self._json(result)

    def list_documents(
        self,
        namespace: Optional[str] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> str:
        """List documents (GET /v1/memory/documents)."""
        result = self._client.list_documents(namespace=namespace, limit=limit, offset=offset)
        return self._json(result)

    def get_document(
        self,
        document_id: str,
        namespace: Optional[str] = None,
    ) -> str:
        """Get a document (GET /v1/memory/documents/:documentId)."""
        result = self._client.get_document(document_id=document_id, namespace=namespace)
        return self._json(result)

    def delete_document(
        self,
        document_id: str,
        namespace: str,
    ) -> str:
        """Delete a document (DELETE /v1/memory/documents/:documentId)."""
        result = self._client.delete_document(document_id=document_id, namespace=namespace)
        return self._json(result)

    def query_memory_context(
        self,
        query: str,
        namespace: Optional[str] = None,
        include_references: Optional[bool] = True,
        max_chunks: Optional[int] = None,
        document_ids: Optional[Any] = None,
        recall_only: Optional[bool] = None,
        llm_query: Optional[str] = None,
    ) -> str:
        """Query memory context (POST /v1/memory/queries)."""
        # Agents can pass `{}` for optional list args; normalize to None.
        normalized_document_ids: Optional[Sequence[str]] = None
        if document_ids is None:
            normalized_document_ids = None
        elif isinstance(document_ids, dict):
            if len(document_ids) == 0:
                normalized_document_ids = None
            else:
                candidates = [
                    v for v in document_ids.values() if isinstance(v, str)
                ]
                normalized_document_ids = candidates or None
        elif isinstance(document_ids, str):
            normalized_document_ids = [document_ids]
        elif isinstance(document_ids, (list, tuple, set)):
            candidates = [d for d in document_ids if isinstance(d, str)]
            normalized_document_ids = candidates or None
        else:
            normalized_document_ids = None

        data = self._client.query_memory_context(
            query=query,
            namespace=namespace,
            include_references=include_references,
            max_chunks=max_chunks,
            document_ids=normalized_document_ids,
            recall_only=recall_only,
            llm_query=llm_query,
        )
        if namespace:
            return self._extract_context_string(data, namespace=namespace)
        return self._json(data)

    def chat_memory_context(
        self,
        messages: Any,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> str:
        """Chat with memory context (POST /v1/memory/conversations)."""
        normalized: list[dict[str, Any]] = []
        if messages is None:
            normalized = []
        elif isinstance(messages, dict):
            # Common bad agent output: `{}`.
            if not messages:
                normalized = []
            # Sometimes the agent might wrap messages in `{ "messages": [...] }`.
            elif isinstance(messages.get("messages"), list):
                normalized = [
                    m
                    for m in messages["messages"]
                    if isinstance(m, dict) and isinstance(m.get("role"), str) and isinstance(m.get("content"), str)
                ]
            # Or the agent might send a single message: `{role: ..., content: ...}`.
            elif isinstance(messages.get("role"), str) and isinstance(messages.get("content"), str):
                normalized = [{"role": messages["role"], "content": messages["content"]}]
        elif isinstance(messages, str):
            normalized = [{"role": "user", "content": messages}]
        elif isinstance(messages, (list, tuple)):
            normalized = [
                m
                for m in messages
                if isinstance(m, dict)
                and isinstance(m.get("role"), str)
                and isinstance(m.get("content"), str)
            ]

        if not normalized:
            return "chat_memory_context: missing/invalid messages; expected messages=[{role: 'user', content: '...'}]."

        data = self._client.chat_memory_context(
            messages=normalized,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        content = data.get("content")
        if isinstance(content, str) and content.strip():
            return content
        return self._json(data)

    def record_interactions(
        self,
        namespace: str,
        entity_names: Any,
        description: Optional[str] = None,
        interaction_level: Optional[str] = None,
        interaction_levels: Optional[Any] = None,
        timestamp: Optional[float] = None,
    ) -> str:
        """Record interaction signals (POST /v1/memory/interactions)."""
        normalized_entity_names: list[str] = []
        if isinstance(entity_names, dict):
            # Common bad agent output: `{}`.
            if entity_names:
                normalized_entity_names = [
                    v for v in entity_names.values() if isinstance(v, str) and v.strip()
                ]
        elif isinstance(entity_names, str):
            if entity_names.strip():
                normalized_entity_names = [entity_names.strip()]
        elif isinstance(entity_names, (list, tuple, set)):
            normalized_entity_names = [
                v.strip()
                for v in entity_names
                if isinstance(v, str) and v.strip()
            ]

        normalized_interaction_levels: Optional[list[str]] = None
        if isinstance(interaction_levels, dict):
            if interaction_levels:
                candidates = [
                    v for v in interaction_levels.values() if isinstance(v, str) and v.strip()
                ]
                normalized_interaction_levels = candidates or None
        elif isinstance(interaction_levels, str):
            normalized_interaction_levels = [interaction_levels.strip()] if interaction_levels.strip() else None
        elif isinstance(interaction_levels, (list, tuple, set)):
            candidates = [v.strip() for v in interaction_levels if isinstance(v, str) and v.strip()]
            normalized_interaction_levels = candidates or None

        if not normalized_entity_names:
            return "record_interactions: missing/invalid entity_names; expected entity_names=['...','...']."

        data = self._client.record_interactions(
            namespace=namespace,
            entity_names=normalized_entity_names,
            description=description,
            interaction_level=interaction_level,
            interaction_levels=normalized_interaction_levels,
            timestamp=timestamp,
        )
        return self._json(data)

    def recall_thoughts(
        self,
        namespace: Optional[str] = None,
        max_chunks: Optional[int] = None,
        temperature: Optional[float] = None,
        randomness_seed: Optional[int] = None,
        persist: Optional[bool] = None,
        enable_prediction_check: Optional[bool] = None,
        thought_prompt: Optional[str] = None,
    ) -> str:
        """Generate reflective thoughts (POST /v1/memory/memories/thoughts)."""
        data = self._client.recall_thoughts(
            namespace=namespace,
            max_chunks=max_chunks,
            temperature=temperature,
            randomness_seed=randomness_seed,
            persist=persist,
            enable_prediction_check=enable_prediction_check,
            thought_prompt=thought_prompt,
        )
        thought = data.get("thought")
        if isinstance(thought, str) and thought.strip():
            return thought
        return self._json(data)

    def chat_memory(
        self,
        messages: Sequence[dict[str, Any]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> str:
        """Chat with memory (POST /v1/memory/chat)."""
        data = self._client.chat_memory(
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        content = data.get("content")
        if isinstance(content, str) and content.strip():
            return content
        return self._json(data)

    def interact_memory(
        self,
        namespace: str,
        entity_names: Sequence[str],
        description: Optional[str] = None,
        interaction_level: Optional[str] = None,
        interaction_levels: Optional[Sequence[str]] = None,
        timestamp: Optional[float] = None,
    ) -> str:
        """Record interactions (POST /v1/memory/interact)."""
        data = self._client.interact_memory(
            namespace=namespace,
            entity_names=entity_names,
            description=description,
            interaction_level=interaction_level,
            interaction_levels=interaction_levels,
            timestamp=timestamp,
        )
        return self._json(data)

    def recall_memory_master(
        self,
        namespace: Optional[str] = None,
        max_chunks: Optional[int] = None,
    ) -> str:
        """Recall context from master node (POST /v1/memory/recall)."""
        data = self._client.recall_memory_master(namespace=namespace, max_chunks=max_chunks)
        if isinstance(namespace, str) and namespace:
            return self._extract_context_string(data, namespace=namespace)
        return self._json(data)

    def recall_memories(
        self,
        namespace: Optional[str] = None,
        top_k: Optional[float] = None,
        min_retention: Optional[float] = None,
        as_of: Optional[float] = None,
    ) -> str:
        """Recall memories (Ebbinghaus bank) (POST /v1/memory/memories/recall)."""
        data = self._client.recall_memories(
            namespace=namespace,
            top_k=top_k,
            min_retention=min_retention,
            as_of=as_of,
        )
        memories = data.get("memories")
        if isinstance(memories, list):
            return self._json(memories)
        return self._json(data)

    def get_ingestion_job(self, job_id: str) -> str:
        """Get ingestion job status (GET /v1/memory/ingestion/jobs/:jobId)."""
        data = self._client.get_ingestion_job(job_id=job_id)
        return self._json(data)

