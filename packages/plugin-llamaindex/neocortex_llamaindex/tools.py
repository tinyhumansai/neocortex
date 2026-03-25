"""Neocortex memory tools as a LlamaIndex ToolSpec."""

from __future__ import annotations

import json
import os
from typing import Any, List, Optional

import httpx
from llama_index.core.tools.tool_spec.base import BaseToolSpec
from tinyhumansai import TinyHumanMemoryClient, MemoryItem, TinyHumanError
from tinyhumansai.types import BASE_URL_ENV, DEFAULT_BASE_URL


def _parse_json(value: Any, field_name: str, default: Any = None) -> Any:
    if value is None:
        return default
    if isinstance(value, (dict, list)):
        return value
    if not isinstance(value, str):
        raise ValueError(f"{field_name} must be a JSON string")
    raw = value.strip()
    if not raw:
        return default
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"{field_name} is not valid JSON: {exc}") from exc

class NeocortexToolSpec(BaseToolSpec):
    """NeocortexToolSpec.

    Provides explicit save/recall/delete memory tools for LlamaIndex agents.
    """

    spec_functions: List[str] = [
        "save_memory",
        "recall_memory",
        "delete_memory",
        "sync_memory",
        "insert_document",
        "insert_documents_batch",
        "list_documents",
        "get_document",
        "delete_document",
        "query_memory_context",
        "chat_memory_context",
        "record_interactions",
        "recall_thoughts",
        "chat_memory",
        "interact_memory",
        "recall_memory_master",
        "recall_memories",
        "get_ingestion_job",
    ]

    def __init__(self, client: TinyHumanMemoryClient, default_namespace: str = "agent_memory") -> None:
        """Initialize with a TinyHumanMemoryClient."""
        self._client = client
        self._default_namespace = default_namespace

    def _client_token_and_base_url(self) -> tuple[Optional[str], str]:
        token = getattr(self._client, "_token", None)
        base_url = getattr(self._client, "_base_url", None)
        if not isinstance(base_url, str) or not base_url:
            base_url = os.environ.get(BASE_URL_ENV, DEFAULT_BASE_URL)
        return token, str(base_url).rstrip("/")

    def _request_json(
        self,
        *,
        method: str,
        path: str,
        json_body: Any = None,
        query_params: Optional[dict[str, Any]] = None,
    ) -> Any:
        token, base_url = self._client_token_and_base_url()
        if not token:
            raise RuntimeError("Missing API token on TinyHumanMemoryClient")
        url = f"{base_url}{path}"
        with httpx.Client(timeout=30) as client:
            res = client.request(
                method=method.upper(),
                url=url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                params=query_params,
                json=json_body,
            )
        try:
            payload = res.json()
        except Exception:
            payload = {"raw": res.text}
        if res.status_code >= 400:
            raise RuntimeError(f"HTTP {res.status_code}: {payload}")
        if isinstance(payload, dict) and payload.get("success") is False:
            raise RuntimeError(str(payload.get("error") or "Request failed"))
        if isinstance(payload, dict) and "data" in payload:
            return payload["data"]
        return payload

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

    def sync_memory(
        self,
        workspace_id: str,
        agent_id: str,
        files_json: str,
        source: Optional[str] = None,
    ) -> str:
        """Sync memory files (POST /v1/memory/sync)."""
        try:
            files = _parse_json(files_json, "files_json", [])
            data = self._request_json(
                method="POST",
                path="/v1/memory/sync",
                json_body={
                    "workspaceId": workspace_id,
                    "agentId": agent_id,
                    "source": source,
                    "files": files,
                },
            )
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to sync memory: {exc}"

    def insert_document(
        self,
        title: str,
        content: str,
        namespace: str,
        document_id: str,
        source_type: Optional[str] = None,
        metadata_json: Optional[str] = None,
        priority: Optional[str] = None,
        created_at: Optional[float] = None,
        updated_at: Optional[float] = None,
    ) -> str:
        """Insert one document (POST /v1/memory/documents)."""
        try:
            metadata = _parse_json(metadata_json, "metadata_json", {})
            data = self._request_json(
                method="POST",
                path="/v1/memory/documents",
                json_body={
                    "title": title,
                    "content": content,
                    "namespace": namespace,
                    "sourceType": source_type or "doc",
                    "metadata": metadata,
                    "priority": priority,
                    "createdAt": created_at,
                    "updatedAt": updated_at,
                    "document_id": document_id,
                },
            )
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to insert document: {exc}"

    def insert_documents_batch(self, items_json: str) -> str:
        """Insert multiple documents (POST /v1/memory/documents/batch)."""
        try:
            items = _parse_json(items_json, "items_json", [])
            if not isinstance(items, list) or not items:
                return "Failed to insert documents batch: items_json must be a non-empty array."
            for item in items:
                if not isinstance(item, dict) or not item.get("document_id"):
                    return "Failed to insert documents batch: each item must include document_id."
            data = self._request_json(
                method="POST",
                path="/v1/memory/documents/batch",
                json_body={"items": items},
            )
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to insert documents batch: {exc}"

    def list_documents(
        self,
        namespace: Optional[str] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> str:
        """List documents (GET /v1/memory/documents)."""
        try:
            data = self._request_json(
                method="GET",
                path="/v1/memory/documents",
                query_params={"namespace": namespace, "limit": limit, "offset": offset},
            )
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to list documents: {exc}"

    def get_document(self, document_id: str, namespace: Optional[str] = None) -> str:
        """Get one document (GET /v1/memory/documents/:documentId)."""
        try:
            data = self._request_json(
                method="GET",
                path=f"/v1/memory/documents/{document_id}",
                query_params={"namespace": namespace},
            )
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to get document: {exc}"

    def delete_document(self, document_id: str, namespace: str) -> str:
        """Delete one document (DELETE /v1/memory/documents/:documentId)."""
        try:
            data = self._request_json(
                method="DELETE",
                path=f"/v1/memory/documents/{document_id}",
                query_params={"namespace": namespace},
            )
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to delete document: {exc}"

    def query_memory_context(
        self,
        query: str,
        namespace: Optional[str] = None,
        include_references: Optional[bool] = None,
        max_chunks: Optional[int] = None,
        document_ids_json: Optional[str] = None,
        recall_only: Optional[bool] = None,
        llm_query: Optional[str] = None,
    ) -> str:
        """Query memory context (POST /v1/memory/queries)."""
        try:
            document_ids = _parse_json(document_ids_json, "document_ids_json", None)
            data = self._request_json(
                method="POST",
                path="/v1/memory/queries",
                json_body={
                    "query": query,
                    "namespace": namespace,
                    "includeReferences": include_references,
                    "maxChunks": max_chunks,
                    "documentIds": document_ids,
                    "recallOnly": recall_only,
                    "llmQuery": llm_query,
                },
            )
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to query memory context: {exc}"

    def chat_memory_context(
        self,
        messages_json: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> str:
        """Chat with context (POST /v1/memory/conversations)."""
        try:
            messages = _parse_json(messages_json, "messages_json", [])
            data = self._request_json(
                method="POST",
                path="/v1/memory/conversations",
                json_body={"messages": messages, "temperature": temperature, "maxTokens": max_tokens},
            )
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to chat memory context: {exc}"

    def record_interactions(
        self,
        namespace: str,
        entity_names_json: str,
        description: Optional[str] = None,
        interaction_level: Optional[str] = None,
        interaction_levels_json: Optional[str] = None,
        timestamp: Optional[float] = None,
    ) -> str:
        """Record interactions (POST /v1/memory/interactions)."""
        try:
            entity_names = _parse_json(entity_names_json, "entity_names_json", [])
            interaction_levels = _parse_json(interaction_levels_json, "interaction_levels_json", None)
            data = self._request_json(
                method="POST",
                path="/v1/memory/interactions",
                json_body={
                    "namespace": namespace,
                    "entityNames": entity_names,
                    "description": description,
                    "interactionLevel": interaction_level,
                    "interactionLevels": interaction_levels,
                    "timestamp": timestamp,
                },
            )
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to record interactions: {exc}"

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
        """Recall thoughts (POST /v1/memory/memories/thoughts)."""
        try:
            data = self._request_json(
                method="POST",
                path="/v1/memory/memories/thoughts",
                json_body={
                    "namespace": namespace,
                    "maxChunks": max_chunks,
                    "temperature": temperature,
                    "randomnessSeed": randomness_seed,
                    "persist": persist,
                    "enablePredictionCheck": enable_prediction_check,
                    "thoughtPrompt": thought_prompt,
                },
            )
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to recall thoughts: {exc}"

    def chat_memory(
        self,
        messages_json: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> str:
        """Chat memory (POST /v1/memory/chat)."""
        try:
            messages = _parse_json(messages_json, "messages_json", [])
            data = self._request_json(
                method="POST",
                path="/v1/memory/chat",
                json_body={"messages": messages, "temperature": temperature, "maxTokens": max_tokens},
            )
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to chat memory: {exc}"

    def interact_memory(
        self,
        namespace: str,
        entity_names_json: str,
        description: Optional[str] = None,
        interaction_level: Optional[str] = None,
        interaction_levels_json: Optional[str] = None,
        timestamp: Optional[float] = None,
    ) -> str:
        """Interact memory (POST /v1/memory/interact)."""
        try:
            entity_names = _parse_json(entity_names_json, "entity_names_json", [])
            interaction_levels = _parse_json(interaction_levels_json, "interaction_levels_json", None)
            data = self._request_json(
                method="POST",
                path="/v1/memory/interact",
                json_body={
                    "namespace": namespace,
                    "entityNames": entity_names,
                    "description": description,
                    "interactionLevel": interaction_level,
                    "interactionLevels": interaction_levels,
                    "timestamp": timestamp,
                },
            )
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to interact memory: {exc}"

    def recall_memory_master(
        self,
        namespace: Optional[str] = None,
        max_chunks: Optional[int] = None,
    ) -> str:
        """Recall master memory (POST /v1/memory/recall)."""
        try:
            data = self._request_json(
                method="POST",
                path="/v1/memory/recall",
                json_body={"namespace": namespace, "maxChunks": max_chunks},
            )
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to recall memory master: {exc}"

    def recall_memories(
        self,
        namespace: Optional[str] = None,
        top_k: Optional[int] = None,
        min_retention: Optional[float] = None,
        as_of: Optional[int] = None,
    ) -> str:
        """Recall memories (POST /v1/memory/memories/recall)."""
        try:
            data = self._request_json(
                method="POST",
                path="/v1/memory/memories/recall",
                json_body={"namespace": namespace, "topK": top_k, "minRetention": min_retention, "asOf": as_of},
            )
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to recall memories: {exc}"

    def get_ingestion_job(self, job_id: str) -> str:
        """Get ingestion job (GET /v1/memory/ingestion/jobs/:jobId)."""
        try:
            data = self._request_json(method="GET", path=f"/v1/memory/ingestion/jobs/{job_id}")
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to get ingestion job: {exc}"
