"""Neocortex memory tools providing OpenAI-compatible JSON schemas for Keywords AI."""

from __future__ import annotations

import json
import os
from typing import Any, Callable, Dict, List, Optional

import httpx
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


def _fn_schema(name: str, description: str, properties: Dict[str, Any], required: Optional[List[str]] = None) -> Dict[str, Any]:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required or [],
            },
        },
    }


class NeocortexMemoryTools:
    """OpenAI/KeywordsAI tool schemas + function dispatch map for Neocortex."""

    def __init__(self, client: TinyHumanMemoryClient, default_namespace: str = "agent_memory") -> None:
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
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
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

    def _save_memory(self, key: str, content: str, namespace: Optional[str] = None, metadata_json: Optional[str] = None) -> str:
        ns = self._namespace(namespace)
        metadata = _parse_json(metadata_json, "metadata_json", {})
        try:
            self._client.ingest_memory(item=MemoryItem(key=key, content=content, namespace=ns, metadata=metadata))
            return f"Saved memory '{key}' in namespace '{ns}'."
        except TinyHumanError as exc:
            return f"Failed to save memory: {exc}"

    def _recall_memory(self, prompt: str, namespace: Optional[str] = None, num_chunks: int = 10) -> str:
        ns = self._namespace(namespace)
        try:
            resp = self._client.recall_memory(namespace=ns, prompt=prompt, num_chunks=num_chunks)
            if not resp.items:
                return f"No memories found in namespace '{ns}' for that query."
            texts = [item.content for item in resp.items if item.content.strip()]
            return "\n\n".join(texts)
        except TinyHumanError as exc:
            return f"Failed to recall memory: {exc}"

    def _delete_memory(self, namespace: Optional[str] = None) -> str:
        ns = self._namespace(namespace)
        try:
            self._client.delete_memory(namespace=ns, delete_all=True)
            return f"Deleted memories from namespace '{ns}'."
        except TinyHumanError as exc:
            return f"Failed to delete memory: {exc}"

    def _sync_memory(self, workspace_id: str, agent_id: str, files_json: str, source: Optional[str] = None) -> str:
        try:
            files = _parse_json(files_json, "files_json", [])
            data = self._request_json(method="POST", path="/v1/memory/sync", json_body={"workspaceId": workspace_id, "agentId": agent_id, "source": source, "files": files})
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to sync memory: {exc}"

    def _insert_document(self, title: str, content: str, namespace: str, document_id: str, source_type: Optional[str] = None, metadata_json: Optional[str] = None, priority: Optional[str] = None, created_at: Optional[int] = None, updated_at: Optional[int] = None) -> str:
        try:
            data = self._request_json(
                method="POST",
                path="/v1/memory/documents",
                json_body={"title": title, "content": content, "namespace": namespace, "sourceType": source_type or "doc", "metadata": _parse_json(metadata_json, "metadata_json", {}), "priority": priority, "createdAt": created_at, "updatedAt": updated_at, "document_id": document_id},
            )
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to insert document: {exc}"

    def _insert_documents_batch(self, items_json: str) -> str:
        try:
            items = _parse_json(items_json, "items_json", [])
            if not isinstance(items, list) or not items:
                return "Failed to insert documents batch: items_json must be a non-empty array."
            for item in items:
                if not isinstance(item, dict) or not item.get("document_id"):
                    return "Failed to insert documents batch: each item must include document_id."
            data = self._request_json(method="POST", path="/v1/memory/documents/batch", json_body={"items": items})
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to insert documents batch: {exc}"

    def _list_documents(self, namespace: Optional[str] = None, limit: Optional[int] = None, offset: Optional[int] = None) -> str:
        try:
            data = self._request_json(method="GET", path="/v1/memory/documents", query_params={"namespace": namespace, "limit": limit, "offset": offset})
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to list documents: {exc}"

    def _get_document(self, document_id: str, namespace: Optional[str] = None) -> str:
        try:
            data = self._request_json(method="GET", path=f"/v1/memory/documents/{document_id}", query_params={"namespace": namespace})
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to get document: {exc}"

    def _delete_document(self, document_id: str, namespace: str) -> str:
        try:
            data = self._request_json(method="DELETE", path=f"/v1/memory/documents/{document_id}", query_params={"namespace": namespace})
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to delete document: {exc}"

    def _query_memory_context(self, query: str, namespace: Optional[str] = None, include_references: Optional[bool] = None, max_chunks: Optional[int] = None, document_ids_json: Optional[str] = None, recall_only: Optional[bool] = None, llm_query: Optional[str] = None) -> str:
        try:
            data = self._request_json(method="POST", path="/v1/memory/queries", json_body={"query": query, "namespace": namespace, "includeReferences": include_references, "maxChunks": max_chunks, "documentIds": _parse_json(document_ids_json, "document_ids_json", None), "recallOnly": recall_only, "llmQuery": llm_query})
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to query memory context: {exc}"

    def _chat_memory_context(self, messages_json: str, temperature: Optional[float] = None, max_tokens: Optional[int] = None) -> str:
        try:
            data = self._request_json(method="POST", path="/v1/memory/conversations", json_body={"messages": _parse_json(messages_json, "messages_json", []), "temperature": temperature, "maxTokens": max_tokens})
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to chat memory context: {exc}"

    def _record_interactions(self, namespace: str, entity_names_json: str, description: Optional[str] = None, interaction_level: Optional[str] = None, interaction_levels_json: Optional[str] = None, timestamp: Optional[int] = None) -> str:
        try:
            body = {"namespace": namespace, "entityNames": _parse_json(entity_names_json, "entity_names_json", []), "description": description, "interactionLevel": interaction_level, "interactionLevels": _parse_json(interaction_levels_json, "interaction_levels_json", None), "timestamp": timestamp}
            data = self._request_json(method="POST", path="/v1/memory/interactions", json_body={k: v for k, v in body.items() if v is not None})
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to record interactions: {exc}"

    def _recall_thoughts(self, namespace: Optional[str] = None, max_chunks: Optional[int] = None, temperature: Optional[float] = None, randomness_seed: Optional[int] = None, persist: Optional[bool] = None, enable_prediction_check: Optional[bool] = None, thought_prompt: Optional[str] = None) -> str:
        try:
            data = self._request_json(method="POST", path="/v1/memory/memories/thoughts", json_body={"namespace": namespace, "maxChunks": max_chunks, "temperature": temperature, "randomnessSeed": randomness_seed, "persist": persist, "enablePredictionCheck": enable_prediction_check, "thoughtPrompt": thought_prompt})
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to recall thoughts: {exc}"

    def _chat_memory(self, messages_json: str, temperature: Optional[float] = None, max_tokens: Optional[int] = None) -> str:
        try:
            data = self._request_json(method="POST", path="/v1/memory/chat", json_body={"messages": _parse_json(messages_json, "messages_json", []), "temperature": temperature, "maxTokens": max_tokens})
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to chat memory: {exc}"

    def _interact_memory(self, namespace: str, entity_names_json: str, description: Optional[str] = None, interaction_level: Optional[str] = None, interaction_levels_json: Optional[str] = None, timestamp: Optional[int] = None) -> str:
        try:
            body = {"namespace": namespace, "entityNames": _parse_json(entity_names_json, "entity_names_json", []), "description": description, "interactionLevel": interaction_level, "interactionLevels": _parse_json(interaction_levels_json, "interaction_levels_json", None), "timestamp": timestamp}
            data = self._request_json(method="POST", path="/v1/memory/interact", json_body={k: v for k, v in body.items() if v is not None})
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to interact memory: {exc}"

    def _recall_memory_master(self, namespace: Optional[str] = None, max_chunks: Optional[int] = None) -> str:
        try:
            data = self._request_json(method="POST", path="/v1/memory/recall", json_body={"namespace": namespace, "maxChunks": max_chunks})
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to recall memory master: {exc}"

    def _recall_memories(self, namespace: Optional[str] = None, top_k: Optional[int] = None, min_retention: Optional[float] = None, as_of: Optional[int] = None) -> str:
        try:
            data = self._request_json(method="POST", path="/v1/memory/memories/recall", json_body={"namespace": namespace, "topK": top_k, "minRetention": min_retention, "asOf": as_of})
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to recall memories: {exc}"

    def _get_ingestion_job(self, job_id: str) -> str:
        try:
            data = self._request_json(method="GET", path=f"/v1/memory/ingestion/jobs/{job_id}")
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to get ingestion job: {exc}"

    def _get_graph_snapshot(self, namespace: Optional[str] = None, mode: Optional[str] = None, limit: Optional[int] = None, seed_limit: Optional[int] = None) -> str:
        try:
            data = self._request_json(method="GET", path="/v1/memory/admin/graph-snapshot", query_params={"namespace": namespace, "mode": mode, "limit": limit, "seed_limit": seed_limit})
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to get graph snapshot: {exc}"

    def get_tool_definitions(self) -> List[Dict[str, Any]]:
        """Return OpenAI-compatible tool definitions for KeywordsAI."""
        return [
            _fn_schema("save_memory", "Save a fact in persistent memory.", {"key": {"type": "string"}, "content": {"type": "string"}, "namespace": {"type": "string"}, "metadata_json": {"type": "string"}}, ["key", "content"]),
            _fn_schema("recall_memory", "Recall memory by query.", {"prompt": {"type": "string"}, "namespace": {"type": "string"}, "num_chunks": {"type": "integer"}}, ["prompt"]),
            _fn_schema("delete_memory", "Delete all memory in namespace.", {"namespace": {"type": "string"}}),
            _fn_schema("sync_memory", "Sync memory files.", {"workspace_id": {"type": "string"}, "agent_id": {"type": "string"}, "files_json": {"type": "string"}, "source": {"type": "string"}}, ["workspace_id", "agent_id", "files_json"]),
            _fn_schema("insert_document", "Insert one document.", {"title": {"type": "string"}, "content": {"type": "string"}, "namespace": {"type": "string"}, "document_id": {"type": "string"}, "source_type": {"type": "string"}, "metadata_json": {"type": "string"}, "priority": {"type": "string"}, "created_at": {"type": "integer"}, "updated_at": {"type": "integer"}}, ["title", "content", "namespace", "document_id"]),
            _fn_schema("insert_documents_batch", "Insert many documents.", {"items_json": {"type": "string"}}, ["items_json"]),
            _fn_schema("list_documents", "List documents.", {"namespace": {"type": "string"}, "limit": {"type": "integer"}, "offset": {"type": "integer"}}),
            _fn_schema("get_document", "Get one document.", {"document_id": {"type": "string"}, "namespace": {"type": "string"}}, ["document_id"]),
            _fn_schema("delete_document", "Delete one document.", {"document_id": {"type": "string"}, "namespace": {"type": "string"}}, ["document_id", "namespace"]),
            _fn_schema("query_memory_context", "Query memory context.", {"query": {"type": "string"}, "namespace": {"type": "string"}, "include_references": {"type": "boolean"}, "max_chunks": {"type": "integer"}, "document_ids_json": {"type": "string"}, "recall_only": {"type": "boolean"}, "llm_query": {"type": "string"}}, ["query"]),
            _fn_schema("chat_memory_context", "Chat with memory context.", {"messages_json": {"type": "string"}, "temperature": {"type": "number"}, "max_tokens": {"type": "integer"}}, ["messages_json"]),
            _fn_schema("record_interactions", "Record interactions.", {"namespace": {"type": "string"}, "entity_names_json": {"type": "string"}, "description": {"type": "string"}, "interaction_level": {"type": "string"}, "interaction_levels_json": {"type": "string"}, "timestamp": {"type": "integer"}}, ["namespace", "entity_names_json"]),
            _fn_schema("recall_thoughts", "Generate reflective thoughts.", {"namespace": {"type": "string"}, "max_chunks": {"type": "integer"}, "temperature": {"type": "number"}, "randomness_seed": {"type": "integer"}, "persist": {"type": "boolean"}, "enable_prediction_check": {"type": "boolean"}, "thought_prompt": {"type": "string"}}),
            _fn_schema("chat_memory", "Chat with memory cache.", {"messages_json": {"type": "string"}, "temperature": {"type": "number"}, "max_tokens": {"type": "integer"}}, ["messages_json"]),
            _fn_schema("interact_memory", "Record interactions in core endpoint.", {"namespace": {"type": "string"}, "entity_names_json": {"type": "string"}, "description": {"type": "string"}, "interaction_level": {"type": "string"}, "interaction_levels_json": {"type": "string"}, "timestamp": {"type": "integer"}}, ["namespace", "entity_names_json"]),
            _fn_schema("recall_memory_master", "Recall master memory context.", {"namespace": {"type": "string"}, "max_chunks": {"type": "integer"}}),
            _fn_schema("recall_memories", "Recall Ebbinghaus memories.", {"namespace": {"type": "string"}, "top_k": {"type": "integer"}, "min_retention": {"type": "number"}, "as_of": {"type": "integer"}}),
            _fn_schema("get_ingestion_job", "Get ingestion job status.", {"job_id": {"type": "string"}}, ["job_id"]),
            _fn_schema("get_graph_snapshot", "Get graph snapshot.", {"namespace": {"type": "string"}, "mode": {"type": "string"}, "limit": {"type": "integer"}, "seed_limit": {"type": "integer"}}),
        ]

    def get_tool_functions(self) -> Dict[str, Callable]:
        """Return map of tool name -> Python callable."""
        return {
            "save_memory": self._save_memory,
            "recall_memory": self._recall_memory,
            "delete_memory": self._delete_memory,
            "sync_memory": self._sync_memory,
            "insert_document": self._insert_document,
            "insert_documents_batch": self._insert_documents_batch,
            "list_documents": self._list_documents,
            "get_document": self._get_document,
            "delete_document": self._delete_document,
            "query_memory_context": self._query_memory_context,
            "chat_memory_context": self._chat_memory_context,
            "record_interactions": self._record_interactions,
            "recall_thoughts": self._recall_thoughts,
            "chat_memory": self._chat_memory,
            "interact_memory": self._interact_memory,
            "recall_memory_master": self._recall_memory_master,
            "recall_memories": self._recall_memories,
            "get_ingestion_job": self._get_ingestion_job,
            "get_graph_snapshot": self._get_graph_snapshot,
        }
