"""Neocortex memory tools for Microsoft AutoGen."""

from __future__ import annotations

import json
import os
import inspect
import functools
from typing import Any, Dict, Optional

import httpx
from autogen import ConversableAgent, register_function
from tinyhumansai import MemoryItem, TinyHumanError, TinyHumanMemoryClient
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


class NeocortexMemoryTools:
    """Wrapper class providing memory tools for AutoGen agents."""

    def __init__(
        self, client: TinyHumanMemoryClient, default_namespace: str = "agent_memory"
    ) -> None:
        self._client = client
        self._default_namespace = default_namespace

    def _namespace(self, namespace: Optional[str]) -> str:
        return namespace or self._default_namespace

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
            return payload.get("data")
        return payload

    def save_memory(
        self,
        key: str,
        content: str,
        namespace: Optional[str] = None,
        metadata_json: Optional[str] = None,
    ) -> str:
        ns = self._namespace(namespace)
        metadata: Dict[str, Any] = {}
        if metadata_json:
            try:
                metadata = _parse_json(metadata_json, "metadata_json", {})
            except Exception:
                metadata = {}
        try:
            self._client.ingest_memory(
                item=MemoryItem(key=key, content=content, namespace=ns, metadata=metadata)
            )
            return f"Saved memory '{key}' in namespace '{ns}'."
        except TinyHumanError as exc:
            return f"Failed to save memory: {exc}"

    def recall_memory(
        self, prompt: str, namespace: Optional[str] = None, num_chunks: int = 10
    ) -> str:
        ns = self._namespace(namespace)
        try:
            resp = self._client.recall_memory(
                namespace=ns, prompt=prompt, num_chunks=num_chunks
            )
            if not resp.items:
                return f"No memories found in namespace '{ns}' for that query."
            texts = [item.content for item in resp.items if item.content.strip()]
            return "\n\n".join(texts)
        except TinyHumanError as exc:
            return f"Failed to recall memory: {exc}"

    def delete_memory(self, namespace: Optional[str] = None) -> str:
        ns = self._namespace(namespace)
        try:
            self._client.delete_memory(namespace=ns, delete_all=True)
            return f"Deleted memories from namespace '{ns}'."
        except TinyHumanError as exc:
            return f"Failed to delete memory: {exc}"

    # ---- Mastra-aligned newer tools ----
    def sync_memory(
        self,
        workspace_id: str,
        agent_id: str,
        files_json: str,
        source: Optional[str] = None,
    ) -> str:
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
        created_at: Optional[int] = None,
        updated_at: Optional[int] = None,
    ) -> str:
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
        self, namespace: Optional[str] = None, limit: Optional[int] = None, offset: Optional[int] = None
    ) -> str:
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
        self, messages_json: str, temperature: Optional[float] = None, max_tokens: Optional[int] = None
    ) -> str:
        try:
            messages = _parse_json(messages_json, "messages_json", [])
            data = self._request_json(
                method="POST",
                path="/v1/memory/conversations",
                json_body={
                    "messages": messages,
                    "temperature": temperature,
                    "maxTokens": max_tokens,
                },
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
        timestamp: Optional[int] = None,
    ) -> str:
        try:
            entity_names = _parse_json(entity_names_json, "entity_names_json", [])
            interaction_levels = _parse_json(
                interaction_levels_json, "interaction_levels_json", None
            )
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
        self, messages_json: str, temperature: Optional[float] = None, max_tokens: Optional[int] = None
    ) -> str:
        try:
            messages = _parse_json(messages_json, "messages_json", [])
            data = self._request_json(
                method="POST",
                path="/v1/memory/chat",
                json_body={
                    "messages": messages,
                    "temperature": temperature,
                    "maxTokens": max_tokens,
                },
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
        timestamp: Optional[int] = None,
    ) -> str:
        try:
            entity_names = _parse_json(entity_names_json, "entity_names_json", [])
            interaction_levels = _parse_json(
                interaction_levels_json, "interaction_levels_json", None
            )
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
        self, namespace: Optional[str] = None, max_chunks: Optional[int] = None
    ) -> str:
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
        try:
            data = self._request_json(
                method="POST",
                path="/v1/memory/memories/recall",
                json_body={
                    "namespace": namespace,
                    "topK": top_k,
                    "minRetention": min_retention,
                    "asOf": as_of,
                },
            )
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to recall memories: {exc}"

    def get_ingestion_job(self, job_id: str) -> str:
        try:
            data = self._request_json(
                method="GET",
                path=f"/v1/memory/ingestion/jobs/{job_id}",
            )
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to get ingestion job: {exc}"


def register_neocortex_tools(
    tools: NeocortexMemoryTools, caller: ConversableAgent, executor: ConversableAgent
) -> None:
    """Register all Neocortex tools to an AutoGen caller/executor pair."""
    registrations = [
        (tools.save_memory, "save_memory", "Save a fact into persistent memory."),
        (tools.recall_memory, "recall_memory", "Recall memory by natural-language query."),
        (tools.delete_memory, "delete_memory", "Delete all memory in a namespace."),
        (tools.sync_memory, "sync_memory", "Sync memory files (workspace/agent/file payload)."),
        (tools.insert_document, "insert_document", "Insert one memory document."),
        (tools.insert_documents_batch, "insert_documents_batch", "Insert multiple memory documents."),
        (tools.list_documents, "list_documents", "List memory documents."),
        (tools.get_document, "get_document", "Get one memory document by id."),
        (tools.delete_document, "delete_document", "Delete one memory document by id."),
        (tools.query_memory_context, "query_memory_context", "Query memory context for a question."),
        (tools.chat_memory_context, "chat_memory_context", "Chat using memory context endpoint."),
        (tools.record_interactions, "record_interactions", "Record interaction events."),
        (tools.recall_thoughts, "recall_thoughts", "Generate reflective thoughts."),
        (tools.chat_memory, "chat_memory", "Chat with memory cache endpoint."),
        (tools.interact_memory, "interact_memory", "Record interactions in core interact endpoint."),
        (tools.recall_memory_master, "recall_memory_master", "Recall context from master node."),
        (tools.recall_memories, "recall_memories", "Recall memories from Ebbinghaus bank."),
        (tools.get_ingestion_job, "get_ingestion_job", "Get ingestion job status."),
    ]
    for fn, name, description in registrations:
        # AutoGen mutates function objects during registration (e.g., sets _name).
        # Bound methods don't allow this, so we wrap each method into a plain function.
        @functools.wraps(fn)
        def wrapped(*args, __fn=fn, **kwargs):
            return __fn(*args, **kwargs)

        wrapped.__signature__ = inspect.signature(fn)
        register_function(
            wrapped, caller=caller, executor=executor, name=name, description=description
        )
