"""Neocortex memory tools for CrewAI."""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional, Type

import httpx
from crewai.tools import BaseTool
from pydantic import BaseModel, Field, PrivateAttr
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


class NeocortexBaseTool(BaseTool):
    _client: TinyHumanMemoryClient = PrivateAttr()
    _default_namespace: str = PrivateAttr()

    def __init__(
        self,
        client: TinyHumanMemoryClient,
        default_namespace: str = "agent_memory",
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
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


class SaveMemoryInput(BaseModel):
    key: str = Field(..., description="Memory key/title.")
    content: str = Field(..., description="Content to persist.")
    namespace: Optional[str] = Field(None, description="Optional namespace override.")
    metadata: Optional[dict] = Field(None, description="Optional metadata.")


class NeocortexSaveMemoryTool(NeocortexBaseTool):
    name: str = "save_memory"
    description: str = "Save or update one memory in Neocortex."
    args_schema: Type[BaseModel] = SaveMemoryInput

    def _run(
        self,
        key: str,
        content: str,
        namespace: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> str:
        ns = self._namespace(namespace)
        try:
            print(self._client.ingest_memory(
                item=MemoryItem(key=key, content=content, namespace=ns, metadata=metadata or {})
            ))
            return f"Saved memory '{key}' in namespace '{ns}'."
            
        except TinyHumanError as exc:
            return f"Failed to save memory: {exc}"


class RecallMemoryInput(BaseModel):
    prompt: str = Field(..., description="Natural language query.")
    namespace: Optional[str] = Field(None, description="Optional namespace override.")
    num_chunks: int = Field(10, description="Max chunks to return.")


class NeocortexRecallMemoryTool(NeocortexBaseTool):
    name: str = "recall_memory"
    description: str = "Recall relevant memories from Neocortex."
    args_schema: Type[BaseModel] = RecallMemoryInput

    def _run(self, prompt: str, namespace: Optional[str] = None, num_chunks: int = 10) -> str:
        ns = self._namespace(namespace)
        try:
            resp = self._client.recall_memory(namespace=ns, prompt=prompt, num_chunks=num_chunks)
            print(resp)
            if not resp.items:
                return f"No memories found in namespace '{ns}' for that query."
            texts = [item.content for item in resp.items if item.content.strip()]
            return "\n\n".join(texts)
        except TinyHumanError as exc:
            return f"Failed to recall memory: {exc}"


class DeleteMemoryInput(BaseModel):
    namespace: Optional[str] = Field(None, description="Namespace to clear.")


class NeocortexDeleteMemoryTool(NeocortexBaseTool):
    name: str = "delete_memory"
    description: str = "Delete all memories in a namespace."
    args_schema: Type[BaseModel] = DeleteMemoryInput

    def _run(self, namespace: Optional[str] = None) -> str:
        ns = self._namespace(namespace)
        try:
            self._client.delete_memory(namespace=ns, delete_all=True)
            return f"Deleted memories from namespace '{ns}'."
        except TinyHumanError as exc:
            return f"Failed to delete memory: {exc}"


class SyncMemoryInput(BaseModel):
    workspace_id: str
    agent_id: str
    files_json: str
    source: Optional[str] = None


class NeocortexSyncMemoryTool(NeocortexBaseTool):
    name: str = "sync_memory"
    description: str = "Sync memory files (POST /v1/memory/sync)."
    args_schema: Type[BaseModel] = SyncMemoryInput

    def _run(self, workspace_id: str, agent_id: str, files_json: str, source: Optional[str] = None) -> str:
        try:
            files = _parse_json(files_json, "files_json", [])
            data = self._request_json(
                method="POST",
                path="/v1/memory/sync",
                json_body={"workspaceId": workspace_id, "agentId": agent_id, "source": source, "files": files},
            )
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to sync memory: {exc}"


class InsertDocumentInput(BaseModel):
    title: str
    content: str
    namespace: str
    source_type: Optional[str] = None
    metadata_json: Optional[str] = None
    priority: Optional[str] = None
    created_at: Optional[int] = None
    updated_at: Optional[int] = None
    document_id: str


class NeocortexInsertDocumentTool(NeocortexBaseTool):
    name: str = "insert_document"
    description: str = "Insert one document (POST /v1/memory/documents)."
    args_schema: Type[BaseModel] = InsertDocumentInput

    def _run(
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


class InsertDocumentsBatchInput(BaseModel):
    items_json: str


class NeocortexInsertDocumentsBatchTool(NeocortexBaseTool):
    name: str = "insert_documents_batch"
    description: str = "Insert multiple documents (POST /v1/memory/documents/batch)."
    args_schema: Type[BaseModel] = InsertDocumentsBatchInput

    def _run(self, items_json: str) -> str:
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


class ListDocumentsInput(BaseModel):
    namespace: Optional[str] = None
    limit: Optional[int] = None
    offset: Optional[int] = None


class NeocortexListDocumentsTool(NeocortexBaseTool):
    name: str = "list_documents"
    description: str = "List documents (GET /v1/memory/documents)."
    args_schema: Type[BaseModel] = ListDocumentsInput

    def _run(self, namespace: Optional[str] = None, limit: Optional[int] = None, offset: Optional[int] = None) -> str:
        try:
            data = self._request_json(
                method="GET",
                path="/v1/memory/documents",
                query_params={"namespace": namespace, "limit": limit, "offset": offset},
            )
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to list documents: {exc}"


class GetDocumentInput(BaseModel):
    document_id: str
    namespace: Optional[str] = None


class NeocortexGetDocumentTool(NeocortexBaseTool):
    name: str = "get_document"
    description: str = "Get one document by id."
    args_schema: Type[BaseModel] = GetDocumentInput

    def _run(self, document_id: str, namespace: Optional[str] = None) -> str:
        try:
            data = self._request_json(
                method="GET",
                path=f"/v1/memory/documents/{document_id}",
                query_params={"namespace": namespace},
            )
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to get document: {exc}"


class DeleteDocumentInput(BaseModel):
    document_id: str
    namespace: str


class NeocortexDeleteDocumentTool(NeocortexBaseTool):
    name: str = "delete_document"
    description: str = "Delete one document by id."
    args_schema: Type[BaseModel] = DeleteDocumentInput

    def _run(self, document_id: str, namespace: str) -> str:
        try:
            data = self._request_json(
                method="DELETE",
                path=f"/v1/memory/documents/{document_id}",
                query_params={"namespace": namespace},
            )
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to delete document: {exc}"


class QueryMemoryContextInput(BaseModel):
    query: str
    namespace: Optional[str] = None
    include_references: Optional[bool] = None
    max_chunks: Optional[int] = None
    document_ids_json: Optional[str] = None
    recall_only: Optional[bool] = None
    llm_query: Optional[str] = None


class NeocortexQueryMemoryContextTool(NeocortexBaseTool):
    name: str = "query_memory_context"
    description: str = "Query memory context (POST /v1/memory/queries)."
    args_schema: Type[BaseModel] = QueryMemoryContextInput

    def _run(
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


class ChatMemoryContextInput(BaseModel):
    messages_json: str
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None


class NeocortexChatMemoryContextTool(NeocortexBaseTool):
    name: str = "chat_memory_context"
    description: str = "Chat with memory context (POST /v1/memory/conversations)."
    args_schema: Type[BaseModel] = ChatMemoryContextInput

    def _run(self, messages_json: str, temperature: Optional[float] = None, max_tokens: Optional[int] = None) -> str:
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


class RecordInteractionsInput(BaseModel):
    namespace: str
    entity_names_json: str
    description: Optional[str] = None
    interaction_level: Optional[str] = None
    interaction_levels_json: Optional[str] = None
    timestamp: Optional[int] = None


class NeocortexRecordInteractionsTool(NeocortexBaseTool):
    name: str = "record_interactions"
    description: str = "Record interactions (POST /v1/memory/interactions)."
    args_schema: Type[BaseModel] = RecordInteractionsInput

    def _run(
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
            interaction_levels = _parse_json(interaction_levels_json, "interaction_levels_json", None)
            body = {
                "namespace": namespace,
                "entityNames": entity_names,
                "description": description,
                "interactionLevel": interaction_level,
                "interactionLevels": interaction_levels,
                "timestamp": timestamp,
            }
            data = self._request_json(
                method="POST",
                path="/v1/memory/interactions",
                json_body={k: v for k, v in body.items() if v is not None},
            )
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to record interactions: {exc}"


class RecallThoughtsInput(BaseModel):
    namespace: Optional[str] = None
    max_chunks: Optional[int] = None
    temperature: Optional[float] = None
    randomness_seed: Optional[int] = None
    persist: Optional[bool] = None
    enable_prediction_check: Optional[bool] = None
    thought_prompt: Optional[str] = None


class NeocortexRecallThoughtsTool(NeocortexBaseTool):
    name: str = "recall_thoughts"
    description: str = "Generate reflective thoughts (POST /v1/memory/memories/thoughts)."
    args_schema: Type[BaseModel] = RecallThoughtsInput

    def _run(
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


class ChatMemoryInput(BaseModel):
    messages_json: str
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None


class NeocortexChatMemoryTool(NeocortexBaseTool):
    name: str = "chat_memory"
    description: str = "Chat with memory cache (POST /v1/memory/chat)."
    args_schema: Type[BaseModel] = ChatMemoryInput

    def _run(self, messages_json: str, temperature: Optional[float] = None, max_tokens: Optional[int] = None) -> str:
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


class InteractMemoryInput(BaseModel):
    namespace: str
    entity_names_json: str
    description: Optional[str] = None
    interaction_level: Optional[str] = None
    interaction_levels_json: Optional[str] = None
    timestamp: Optional[int] = None


class NeocortexInteractMemoryTool(NeocortexBaseTool):
    name: str = "interact_memory"
    description: str = "Record interactions (core) (POST /v1/memory/interact)."
    args_schema: Type[BaseModel] = InteractMemoryInput

    def _run(
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
            interaction_levels = _parse_json(interaction_levels_json, "interaction_levels_json", None)
            body = {
                "namespace": namespace,
                "entityNames": entity_names,
                "description": description,
                "interactionLevel": interaction_level,
                "interactionLevels": interaction_levels,
                "timestamp": timestamp,
            }
            data = self._request_json(
                method="POST",
                path="/v1/memory/interact",
                json_body={k: v for k, v in body.items() if v is not None},
            )
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to interact memory: {exc}"


class RecallMemoryMasterInput(BaseModel):
    namespace: Optional[str] = None
    max_chunks: Optional[int] = None


class NeocortexRecallMemoryMasterTool(NeocortexBaseTool):
    name: str = "recall_memory_master"
    description: str = "Recall context from master node (POST /v1/memory/recall)."
    args_schema: Type[BaseModel] = RecallMemoryMasterInput

    def _run(self, namespace: Optional[str] = None, max_chunks: Optional[int] = None) -> str:
        try:
            data = self._request_json(
                method="POST",
                path="/v1/memory/recall",
                json_body={"namespace": namespace, "maxChunks": max_chunks},
            )
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to recall memory master: {exc}"


class RecallMemoriesInput(BaseModel):
    namespace: Optional[str] = None
    top_k: Optional[int] = None
    min_retention: Optional[float] = None
    as_of: Optional[int] = None


class NeocortexRecallMemoriesTool(NeocortexBaseTool):
    name: str = "recall_memories"
    description: str = "Recall memories from Ebbinghaus bank (POST /v1/memory/memories/recall)."
    args_schema: Type[BaseModel] = RecallMemoriesInput

    def _run(
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
                json_body={"namespace": namespace, "topK": top_k, "minRetention": min_retention, "asOf": as_of},
            )
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to recall memories: {exc}"


class GetIngestionJobInput(BaseModel):
    job_id: str


class NeocortexGetIngestionJobTool(NeocortexBaseTool):
    name: str = "get_ingestion_job"
    description: str = "Get ingestion job status."
    args_schema: Type[BaseModel] = GetIngestionJobInput

    def _run(self, job_id: str) -> str:
        try:
            data = self._request_json(method="GET", path=f"/v1/memory/ingestion/jobs/{job_id}")
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to get ingestion job: {exc}"


class GetGraphSnapshotInput(BaseModel):
    namespace: Optional[str] = None
    mode: Optional[str] = None
    limit: Optional[int] = None
    seed_limit: Optional[int] = None


class NeocortexGetGraphSnapshotTool(NeocortexBaseTool):
    name: str = "get_graph_snapshot"
    description: str = "Get admin graph snapshot (GET /v1/memory/admin/graph-snapshot)."
    args_schema: Type[BaseModel] = GetGraphSnapshotInput

    def _run(
        self,
        namespace: Optional[str] = None,
        mode: Optional[str] = None,
        limit: Optional[int] = None,
        seed_limit: Optional[int] = None,
    ) -> str:
        try:
            data = self._request_json(
                method="GET",
                path="/v1/memory/admin/graph-snapshot",
                query_params={"namespace": namespace, "mode": mode, "limit": limit, "seed_limit": seed_limit},
            )
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return f"Failed to get graph snapshot: {exc}"


def create_neocortex_tools(
    client: TinyHumanMemoryClient,
    default_namespace: str = "agent_memory",
) -> List[BaseTool]:
    return [
        NeocortexSaveMemoryTool(client=client, default_namespace=default_namespace),
        NeocortexRecallMemoryTool(client=client, default_namespace=default_namespace),
        NeocortexDeleteMemoryTool(client=client, default_namespace=default_namespace),
        NeocortexSyncMemoryTool(client=client, default_namespace=default_namespace),
        NeocortexInsertDocumentTool(client=client, default_namespace=default_namespace),
        NeocortexInsertDocumentsBatchTool(client=client, default_namespace=default_namespace),
        NeocortexListDocumentsTool(client=client, default_namespace=default_namespace),
        NeocortexGetDocumentTool(client=client, default_namespace=default_namespace),
        NeocortexDeleteDocumentTool(client=client, default_namespace=default_namespace),
        NeocortexQueryMemoryContextTool(client=client, default_namespace=default_namespace),
        NeocortexChatMemoryContextTool(client=client, default_namespace=default_namespace),
        NeocortexRecordInteractionsTool(client=client, default_namespace=default_namespace),
        NeocortexRecallThoughtsTool(client=client, default_namespace=default_namespace),
        NeocortexChatMemoryTool(client=client, default_namespace=default_namespace),
        NeocortexInteractMemoryTool(client=client, default_namespace=default_namespace),
        NeocortexRecallMemoryMasterTool(client=client, default_namespace=default_namespace),
        NeocortexRecallMemoriesTool(client=client, default_namespace=default_namespace),
        NeocortexGetIngestionJobTool(client=client, default_namespace=default_namespace),
        NeocortexGetGraphSnapshotTool(client=client, default_namespace=default_namespace),
    ]
