"""Neocortex memory tools providing @tool decorated functions for Vercel AI SDK."""

import json
from typing import Optional, Dict, Any, List

# The Vercel AI SDK uses ai_sdk in Python
from ai_sdk import tool
from tinyhumansai import TinyHumanMemoryClient, MemoryItem, TinyHumanError

from ._helpers import _client_token_and_base_url, parse_bool, parse_json, request_json

# JSON schemas for ai_sdk @tool (required: name, description, parameters)
_TOOL_SCHEMAS: Dict[str, Dict[str, Any]] = {
    "save_memory": {
        "type": "object",
        "properties": {
            "key": {"type": "string", "description": "Unique key for the memory"},
            "content": {"type": "string", "description": "Content to store"},
            "namespace": {"type": "string", "description": "Namespace (optional)"},
            "metadata_json": {"type": "string", "description": "JSON metadata (optional)"},
        },
        "required": ["key", "content"],
    },
    "recall_memory": {
        "type": "object",
        "properties": {
            "prompt": {"type": "string", "description": "Query to search memories"},
            "namespace": {"type": "string", "description": "Namespace (optional)"},
            "num_chunks": {"type": "integer", "description": "Max chunks to return", "default": 10},
        },
        "required": ["prompt"],
    },
    "delete_memory": {
        "type": "object",
        "properties": {"namespace": {"type": "string", "description": "Namespace to delete (optional)"}},
        "required": [],
    },
    "sync_memory": {
        "type": "object",
        "properties": {
            "workspace_id": {"type": "string", "description": "Workspace ID"},
            "agent_id": {"type": "string", "description": "Agent ID"},
            "source": {"type": "string", "description": "Source (optional)"},
            "files_json": {"type": "string", "description": "JSON array of files (optional)"},
        },
        "required": ["workspace_id", "agent_id"],
    },
    "insert_document": {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "content": {"type": "string"},
            "namespace": {"type": "string"},
            "source_type": {"type": "string"},
            "metadata_json": {"type": "string"},
            "priority": {"type": "string"},
            "created_at": {"type": "number"},
            "updated_at": {"type": "number"},
            "document_id": {"type": "string"},
        },
        "required": ["title", "content", "namespace", "document_id"],
    },
    "insert_documents_batch": {
        "type": "object",
        "properties": {"items_json": {"type": "string", "description": "JSON array of document items"}},
        "required": ["items_json"],
    },
    "list_documents": {
        "type": "object",
        "properties": {
            "namespace": {"type": "string"},
            "limit": {"type": "integer"},
            "offset": {"type": "integer"},
        },
        "required": [],
    },
    "get_document": {
        "type": "object",
        "properties": {
            "document_id": {"type": "string"},
            "namespace": {"type": "string"},
        },
        "required": ["document_id"],
    },
    "delete_document": {
        "type": "object",
        "properties": {
            "document_id": {"type": "string"},
            "namespace": {"type": "string"},
        },
        "required": ["document_id", "namespace"],
    },
    "query_memory_context": {
        "type": "object",
        "properties": {
            "query": {"type": "string"},
            "namespace": {"type": "string"},
            "include_references": {"type": "boolean"},
            "max_chunks": {"type": "integer"},
            "document_ids_json": {"type": "string"},
            "recall_only": {"type": "boolean"},
            "llm_query": {"type": "string"},
        },
        "required": ["query"],
    },
    "chat_memory_context": {
        "type": "object",
        "properties": {
            "messages_json": {"type": "string", "description": "JSON array of message objects"},
            "temperature": {"type": "number"},
            "max_tokens": {"type": "integer"},
        },
        "required": ["messages_json"],
    },
    "record_interactions": {
        "type": "object",
        "properties": {
            "namespace": {"type": "string"},
            "entity_names_json": {"type": "string"},
            "description": {"type": "string"},
            "interaction_level": {"type": "string"},
            "interaction_levels_json": {"type": "string"},
            "timestamp": {"type": "number"},
        },
        "required": ["namespace", "entity_names_json"],
    },
    "recall_thoughts": {
        "type": "object",
        "properties": {
            "namespace": {"type": "string"},
            "max_chunks": {"type": "integer"},
            "temperature": {"type": "number"},
            "randomness_seed": {"type": "integer"},
            "persist": {"type": "boolean"},
            "enable_prediction_check": {"type": "boolean"},
            "thought_prompt": {"type": "string"},
        },
        "required": [],
    },
    "chat_memory": {
        "type": "object",
        "properties": {
            "messages_json": {"type": "string"},
            "temperature": {"type": "number"},
            "max_tokens": {"type": "integer"},
        },
        "required": ["messages_json"],
    },
    "interact_memory": {
        "type": "object",
        "properties": {
            "namespace": {"type": "string"},
            "entity_names_json": {"type": "string"},
            "description": {"type": "string"},
            "interaction_level": {"type": "string"},
            "interaction_levels_json": {"type": "string"},
            "timestamp": {"type": "number"},
        },
        "required": ["namespace", "entity_names_json"],
    },
    "recall_memory_master": {
        "type": "object",
        "properties": {"namespace": {"type": "string"}, "max_chunks": {"type": "integer"}},
        "required": [],
    },
    "recall_memories": {
        "type": "object",
        "properties": {
            "namespace": {"type": "string"},
            "top_k": {"type": "number"},
            "min_retention": {"type": "number"},
            "as_of": {"type": "number"},
        },
        "required": [],
    },
    "get_ingestion_job": {
        "type": "object",
        "properties": {"job_id": {"type": "string"}},
        "required": ["job_id"],
    },
}


class NeocortexMemoryTools:
    """Wrapper class providing Vercel AI SDK decorated tools for memory operations."""

    def __init__(self, client: TinyHumanMemoryClient, default_namespace: str = "agent_memory") -> None:
        """Initialize the tools wrapper.

        Args:
            client (TinyHumanMemoryClient): Configured Neocortex memory client.
            default_namespace (str): Fallback namespace if none is provided in calls.
        """
        self._client = client
        self._default_namespace = default_namespace

    def get_tools(self) -> Dict:
        """Return a dictionary of configured tools ready for generate_text/stream_text."""
        
        @tool(
            name="save_memory",
            description="Save or update a single memory in Neocortex. Use this when you learn a fact (e.g. user preference, context) that should persist.",
            parameters=_TOOL_SCHEMAS["save_memory"],
        )
        def save_memory(
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

        @tool(
            name="recall_memory",
            description="Recall relevant memories from Neocortex for a given question or topic. Use this to look up past facts before answering.",
            parameters=_TOOL_SCHEMAS["recall_memory"],
        )
        def recall_memory(
            prompt: str,
            namespace: Optional[str] = None,
            num_chunks: int = 10,
        ) -> str:
            ns = namespace or self._default_namespace
            token, base_url = _client_token_and_base_url(self._client)
            if not token:
                return "Error: missing alphahuman_api_key credential."
            try:
                data = request_json(
                    token=token,
                    base_url=base_url,
                    method="POST",
                    path="/v1/memory/query",
                    json_body={
                        "query": prompt,
                        "namespace": ns,
                        "maxChunks": num_chunks,
                        "includeReferences": False,
                    },
                )
                llm_msg = (data or {}).get("llmContextMessage") or (data or {}).get("response")
                if isinstance(llm_msg, str) and llm_msg.strip():
                    return llm_msg.strip()
                chunks = (data or {}).get("context", {}).get("chunks") or []
                texts = []
                for ch in chunks:
                    if ch and isinstance(ch, dict):
                        t = ch.get("content") or ch.get("text") or ch.get("body") or ""
                        if isinstance(t, str) and t.strip():
                            texts.append(t.strip())
                return "\n\n".join(texts) if texts else f"No memories found in namespace '{ns}' for that query."
            except Exception as exc:
                return f"Failed to recall memory: {exc}"

        @tool(
            name="delete_memory",
            description="Delete all memories in a given namespace from Neocortex.",
            parameters=_TOOL_SCHEMAS["delete_memory"],
        )
        def delete_memory(namespace: Optional[str] = None) -> str:
            ns = namespace or self._default_namespace
            token, base_url = _client_token_and_base_url(self._client)
            if not token:
                return "Error: missing alphahuman_api_key credential."
            try:
                request_json(
                    token=token,
                    base_url=base_url,
                    method="POST",
                    path="/v1/memory/admin/delete",
                    json_body={"namespace": ns},
                )
                return f"Deleted memories from namespace '{ns}'."
            except Exception as exc:
                return f"Failed to delete memory: {exc}"

        @tool(
            name="sync_memory",
            description="Sync OpenClaw memory files (workspace/agent + file objects).",
            parameters=_TOOL_SCHEMAS["sync_memory"],
        )
        def sync_memory(
            workspace_id: str,
            agent_id: str,
            source: Optional[str] = None,
            files_json: Optional[str] = None,
        ) -> str:
            token, base_url = _client_token_and_base_url(self._client)
            if not token:
                return "Error: missing alphahuman_api_key credential."

            if not workspace_id or not agent_id:
                return "Error: workspace_id and agent_id are required."

            files = []
            if files_json:
                try:
                    parsed = parse_json(files_json, field_name="files_json", default=[])
                    if isinstance(parsed, list):
                        files = parsed
                except ValueError as e:
                    return f"Error: {e}"

            payload_files: List[dict[str, Any]] = []
            for f in files:
                if not isinstance(f, dict):
                    continue
                file_path = f.get("file_path") or f.get("filePath")
                content = f.get("content")
                timestamp = f.get("timestamp")
                hash_val = f.get("hash")
                if file_path is None or content is None or hash_val is None:
                    continue
                payload_files.append(
                    {
                        "filePath": file_path,
                        "content": content,
                        "timestamp": str(timestamp or ""),
                        "hash": hash_val,
                    }
                )

            body: dict[str, Any] = {
                "workspaceId": workspace_id,
                "agentId": agent_id,
                "source": source,
                "files": payload_files,
            }
            if source is None:
                body.pop("source", None)

            try:
                res = request_json(
                    token=token,
                    base_url=base_url,
                    method="POST",
                    path="/v1/memory/sync",
                    json_body=body,
                )
                return f"Sync complete: {res}"
            except Exception as e:
                return f"Failed to sync memory: {e}"

        @tool(
            name="insert_document",
            description="Insert a single memory document (title/content/namespace).",
            parameters=_TOOL_SCHEMAS["insert_document"],
        )
        def insert_document(
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
            token, base_url = _client_token_and_base_url(self._client)
            if not token:
                return "Error: missing alphahuman_api_key credential."

            metadata: Dict[str, Any] = {}
            if metadata_json:
                try:
                    parsed = parse_json(
                        metadata_json, field_name="metadata_json", default={}
                    )
                    if isinstance(parsed, dict):
                        metadata = parsed
                except ValueError as e:
                    return f"Error: {e}"

            body: Dict[str, Any] = {
                "title": title,
                "content": content,
                "namespace": namespace,
                "sourceType": source_type or "doc",
                "metadata": metadata,
            }
            if priority is not None:
                body["priority"] = priority
            if created_at is not None:
                body["createdAt"] = created_at
            if updated_at is not None:
                body["updatedAt"] = updated_at
            body["document_id"] = document_id

            try:
                res = request_json(
                    token=token,
                    base_url=base_url,
                    method="POST",
                    path="/v1/memory/documents",
                    json_body=body,
                )
                return f"Inserted document: {res}"
            except Exception as e:
                return f"Failed to insert document: {e}"

        @tool(
            name="insert_documents_batch",
            description="Insert multiple memory documents in one call (batch).",
            parameters=_TOOL_SCHEMAS["insert_documents_batch"],
        )
        def insert_documents_batch(items_json: str) -> str:
            token, base_url = _client_token_and_base_url(self._client)
            if not token:
                return "Error: missing alphahuman_api_key credential."

            try:
                items = parse_json(items_json, field_name="items_json", default=[])
            except ValueError as e:
                return f"Error: {e}"

            if not isinstance(items, list) or not items:
                return "Error: items_json must decode to a non-empty JSON array."

            payload_items: list[dict[str, Any]] = []
            for it in items:
                if not isinstance(it, dict):
                    continue
                title = it.get("title")
                content = it.get("content")
                namespace = it.get("namespace")
                document_id = it.get("document_id") if "document_id" in it else it.get("documentId")
                if not title or content is None or not namespace or not document_id:
                    continue
                payload_items.append(
                    {
                        "title": title,
                        "content": content,
                        "namespace": namespace,
                        "sourceType": it.get("source_type") or it.get("sourceType") or "doc",
                        "metadata": it.get("metadata") or {},
                        "priority": it.get("priority"),
                        "createdAt": it.get("created_at") if "created_at" in it else it.get("createdAt"),
                        "updatedAt": it.get("updated_at") if "updated_at" in it else it.get("updatedAt"),
                        "documentId": document_id,
                        "document_id": document_id,
                    }
                )

            # Remove nulls.
            for pi in payload_items:
                for k in list(pi.keys()):
                    if pi[k] is None:
                        pi.pop(k)

            if not payload_items:
                return "Error: each batch item must include title, content, namespace, and document_id."

            try:
                res = request_json(
                    token=token,
                    base_url=base_url,
                    method="POST",
                    path="/v1/memory/documents/batch",
                    json_body={"items": payload_items},
                )
                return f"Inserted documents batch: {res}"
            except Exception as e:
                return f"Failed to insert documents batch: {e}"

        @tool(
            name="list_documents",
            description="List ingested documents in a namespace.",
            parameters=_TOOL_SCHEMAS["list_documents"],
        )
        def list_documents(
            namespace: Optional[str] = None,
            limit: Optional[int] = None,
            offset: Optional[int] = None,
        ) -> str:
            token, base_url = _client_token_and_base_url(self._client)
            if not token:
                return "Error: missing alphahuman_api_key credential."

            query_params: dict[str, Any] = {}
            if namespace is not None:
                query_params["namespace"] = namespace
            if limit is not None:
                query_params["limit"] = limit
            if offset is not None:
                query_params["offset"] = offset

            try:
                res = request_json(
                    token=token,
                    base_url=base_url,
                    method="GET",
                    path="/v1/memory/documents",
                    query_params=query_params or None,
                )
                return f"Documents: {res}"
            except Exception as e:
                return f"Failed to list documents: {e}"

        @tool(
            name="get_document",
            description="Get a specific memory document by document_id.",
            parameters=_TOOL_SCHEMAS["get_document"],
        )
        def get_document(document_id: str, namespace: Optional[str] = None) -> str:
            token, base_url = _client_token_and_base_url(self._client)
            if not token:
                return "Error: missing alphahuman_api_key credential."

            try:
                res = request_json(
                    token=token,
                    base_url=base_url,
                    method="GET",
                    path=f"/v1/memory/documents/{document_id}",
                    query_params={"namespace": namespace} if namespace else None,
                )
                return f"Document: {res}"
            except Exception as e:
                return f"Failed to get document: {e}"

        @tool(
            name="delete_document",
            description="Delete a memory document by document_id and namespace.",
            parameters=_TOOL_SCHEMAS["delete_document"],
        )
        def delete_document(document_id: str, namespace: str) -> str:
            token, base_url = _client_token_and_base_url(self._client)
            if not token:
                return "Error: missing alphahuman_api_key credential."

            try:
                res = request_json(
                    token=token,
                    base_url=base_url,
                    method="DELETE",
                    path=f"/v1/memory/documents/{document_id}",
                    query_params={"namespace": namespace},
                )
                return f"Deleted document: {res}"
            except Exception as e:
                return f"Failed to delete document: {e}"

        @tool(
            name="query_memory_context",
            description="Query mirrored memory context via /v1/memory/queries.",
            parameters=_TOOL_SCHEMAS["query_memory_context"],
        )
        def query_memory_context(
            query: str,
            namespace: Optional[str] = None,
            include_references: Optional[bool] = None,
            max_chunks: Optional[int] = None,
            document_ids_json: Optional[str] = None,
            recall_only: Optional[bool] = None,
            llm_query: Optional[str] = None,
        ) -> str:
            token, base_url = _client_token_and_base_url(self._client)
            if not token:
                return "Error: missing alphahuman_api_key credential."

            payload: Dict[str, Any] = {"query": query}
            if namespace is not None:
                payload["namespace"] = namespace
            if include_references is not None:
                payload["includeReferences"] = include_references
            if max_chunks is not None:
                payload["maxChunks"] = max_chunks
            if recall_only is not None:
                payload["recallOnly"] = recall_only
            if llm_query is not None:
                payload["llmQuery"] = llm_query
            if document_ids_json:
                try:
                    ids = parse_json(
                        document_ids_json,
                        field_name="document_ids_json",
                        default=[],
                    )
                    if isinstance(ids, list) and ids:
                        payload["documentIds"] = ids
                except ValueError as e:
                    return f"Error: {e}"

            try:
                res = request_json(
                    token=token,
                    base_url=base_url,
                    method="POST",
                    path="/v1/memory/queries",
                    json_body=payload,
                )
                return f"Query result: {res}"
            except Exception as e:
                return f"Failed to query memory context: {e}"

        @tool(
            name="chat_memory_context",
            description="Chat with memory context via /v1/memory/conversations.",
            parameters=_TOOL_SCHEMAS["chat_memory_context"],
        )
        def chat_memory_context(
            messages_json: str,
            temperature: Optional[float] = None,
            max_tokens: Optional[int] = None,
        ) -> str:
            token, base_url = _client_token_and_base_url(self._client)
            if not token:
                return "Error: missing alphahuman_api_key credential."

            try:
                messages = parse_json(messages_json, field_name="messages_json", default=[])
            except ValueError as e:
                return f"Error: {e}"
            if not isinstance(messages, list) or not messages:
                return "Error: messages_json must decode to a non-empty JSON array."

            payload: Dict[str, Any] = {"messages": messages}
            if temperature is not None:
                payload["temperature"] = temperature
            if max_tokens is not None:
                payload["maxTokens"] = max_tokens

            try:
                res = request_json(
                    token=token,
                    base_url=base_url,
                    method="POST",
                    path="/v1/memory/conversations",
                    json_body=payload,
                )
                return f"Chat context result: {res}"
            except Exception as e:
                return f"Failed to chat memory context: {e}"

        @tool(
            name="record_interactions",
            description="Record interaction signals via /v1/memory/interactions.",
            parameters=_TOOL_SCHEMAS["record_interactions"],
        )
        def record_interactions(
            namespace: str,
            entity_names_json: str,
            description: Optional[str] = None,
            interaction_level: Optional[str] = None,
            interaction_levels_json: Optional[str] = None,
            timestamp: Optional[float] = None,
        ) -> str:
            token, base_url = _client_token_and_base_url(self._client)
            if not token:
                return "Error: missing alphahuman_api_key credential."

            try:
                entity_names = parse_json(
                    entity_names_json,
                    field_name="entity_names_json",
                    default=[],
                )
            except ValueError as e:
                return f"Error: {e}"

            if not isinstance(entity_names, list) or not entity_names:
                return "Error: entity_names_json must decode to a non-empty JSON array."

            interaction_levels = None
            if interaction_levels_json:
                try:
                    parsed = parse_json(
                        interaction_levels_json,
                        field_name="interaction_levels_json",
                        default=[],
                    )
                    if isinstance(parsed, list) and parsed:
                        interaction_levels = parsed
                except ValueError as e:
                    return f"Error: {e}"

            payload: Dict[str, Any] = {
                "namespace": namespace,
                "entityNames": entity_names,
            }
            if description is not None:
                payload["description"] = description
            if interaction_level is not None:
                payload["interactionLevel"] = interaction_level
            if interaction_levels is not None:
                payload["interactionLevels"] = interaction_levels
            if timestamp is not None:
                payload["timestamp"] = timestamp

            try:
                res = request_json(
                    token=token,
                    base_url=base_url,
                    method="POST",
                    path="/v1/memory/interactions",
                    json_body=payload,
                )
                return f"Interactions recorded: {res}"
            except Exception as e:
                return f"Failed to record interactions: {e}"

        @tool(
            name="recall_thoughts",
            description="Generate reflective thoughts via /v1/memory/memories/thoughts.",
            parameters=_TOOL_SCHEMAS["recall_thoughts"],
        )
        def recall_thoughts(
            namespace: Optional[str] = None,
            max_chunks: Optional[int] = None,
            temperature: Optional[float] = None,
            randomness_seed: Optional[int] = None,
            persist: Optional[bool] = None,
            enable_prediction_check: Optional[bool] = None,
            thought_prompt: Optional[str] = None,
        ) -> str:
            token, base_url = _client_token_and_base_url(self._client)
            if not token:
                return "Error: missing alphahuman_api_key credential."

            payload: Dict[str, Any] = {}
            if namespace is not None:
                payload["namespace"] = namespace
            if max_chunks is not None:
                payload["maxChunks"] = max_chunks
            if temperature is not None:
                payload["temperature"] = temperature
            if randomness_seed is not None:
                payload["randomnessSeed"] = randomness_seed
            if persist is not None:
                payload["persist"] = persist
            if enable_prediction_check is not None:
                payload["enablePredictionCheck"] = enable_prediction_check
            if thought_prompt is not None:
                payload["thoughtPrompt"] = thought_prompt

            try:
                res = request_json(
                    token=token,
                    base_url=base_url,
                    method="POST",
                    path="/v1/memory/memories/thoughts",
                    json_body=payload,
                )
                return f"Thoughts: {res}"
            except Exception as e:
                return f"Failed to recall thoughts: {e}"

        @tool(
            name="chat_memory",
            description="Chat with memory cache via /v1/memory/chat.",
            parameters=_TOOL_SCHEMAS["chat_memory"],
        )
        def chat_memory(
            messages_json: str,
            temperature: Optional[float] = None,
            max_tokens: Optional[int] = None,
        ) -> str:
            token, base_url = _client_token_and_base_url(self._client)
            if not token:
                return "Error: missing alphahuman_api_key credential."

            try:
                messages = parse_json(messages_json, field_name="messages_json", default=[])
            except ValueError as e:
                return f"Error: {e}"
            if not isinstance(messages, list) or not messages:
                return "Error: messages_json must decode to a non-empty JSON array."

            payload: Dict[str, Any] = {"messages": messages}
            if temperature is not None:
                payload["temperature"] = temperature
            if max_tokens is not None:
                payload["maxTokens"] = max_tokens

            try:
                res = request_json(
                    token=token,
                    base_url=base_url,
                    method="POST",
                    path="/v1/memory/chat",
                    json_body=payload,
                )
                return f"Chat result: {res}"
            except Exception as e:
                return f"Failed to chat memory: {e}"

        @tool(
            name="interact_memory",
            description="Record entity interactions via /v1/memory/interact.",
            parameters=_TOOL_SCHEMAS["interact_memory"],
        )
        def interact_memory(
            namespace: str,
            entity_names_json: str,
            description: Optional[str] = None,
            interaction_level: Optional[str] = None,
            interaction_levels_json: Optional[str] = None,
            timestamp: Optional[float] = None,
        ) -> str:
            token, base_url = _client_token_and_base_url(self._client)
            if not token:
                return "Error: missing alphahuman_api_key credential."

            try:
                entity_names = parse_json(
                    entity_names_json,
                    field_name="entity_names_json",
                    default=[],
                )
            except ValueError as e:
                return f"Error: {e}"
            if not isinstance(entity_names, list) or not entity_names:
                return "Error: entity_names_json must decode to a non-empty JSON array."

            interaction_levels = None
            if interaction_levels_json:
                try:
                    parsed = parse_json(
                        interaction_levels_json,
                        field_name="interaction_levels_json",
                        default=[],
                    )
                    if isinstance(parsed, list) and parsed:
                        interaction_levels = parsed
                except ValueError as e:
                    return f"Error: {e}"

            payload: Dict[str, Any] = {
                "namespace": namespace,
                "entityNames": entity_names,
            }
            if description is not None:
                payload["description"] = description
            if interaction_level is not None:
                payload["interactionLevel"] = interaction_level
            if interaction_levels is not None:
                payload["interactionLevels"] = interaction_levels
            if timestamp is not None:
                payload["timestamp"] = timestamp

            try:
                res = request_json(
                    token=token,
                    base_url=base_url,
                    method="POST",
                    path="/v1/memory/interact",
                    json_body=payload,
                )
                return f"Interaction recorded: {res}"
            except Exception as e:
                return f"Failed to interact memory: {e}"

        @tool(
            name="recall_memory_master",
            description="Recall context from master node via /v1/memory/recall.",
            parameters=_TOOL_SCHEMAS["recall_memory_master"],
        )
        def recall_memory_master(
            namespace: Optional[str] = None,
            max_chunks: Optional[int] = None,
        ) -> str:
            token, base_url = _client_token_and_base_url(self._client)
            if not token:
                return "Error: missing alphahuman_api_key credential."
            payload: Dict[str, Any] = {}
            if namespace is not None:
                payload["namespace"] = namespace
            if max_chunks is not None:
                payload["maxChunks"] = max_chunks

            try:
                res = request_json(
                    token=token,
                    base_url=base_url,
                    method="POST",
                    path="/v1/memory/recall",
                    json_body=payload,
                )
                return f"Recall master result: {res}"
            except Exception as e:
                return f"Failed to recall memory master: {e}"

        @tool(
            name="recall_memories",
            description="Recall memories from the Ebbinghaus bank via /v1/memory/memories/recall.",
            parameters=_TOOL_SCHEMAS["recall_memories"],
        )
        def recall_memories(
            namespace: Optional[str] = None,
            top_k: Optional[float] = None,
            min_retention: Optional[float] = None,
            as_of: Optional[float] = None,
        ) -> str:
            token, base_url = _client_token_and_base_url(self._client)
            if not token:
                return "Error: missing alphahuman_api_key credential."

            payload: Dict[str, Any] = {}
            if namespace is not None:
                payload["namespace"] = namespace
            if top_k is not None:
                payload["topK"] = top_k
            if min_retention is not None:
                payload["minRetention"] = min_retention
            if as_of is not None:
                payload["asOf"] = as_of

            try:
                res = request_json(
                    token=token,
                    base_url=base_url,
                    method="POST",
                    path="/v1/memory/memories/recall",
                    json_body=payload,
                )
                return f"Recall memories result: {res}"
            except Exception as e:
                return f"Failed to recall memories: {e}"

        @tool(
            name="get_ingestion_job",
            description="Get ingestion job status via /v1/memory/ingestion/jobs/:jobId.",
            parameters=_TOOL_SCHEMAS["get_ingestion_job"],
        )
        def get_ingestion_job(job_id: str) -> str:
            token, base_url = _client_token_and_base_url(self._client)
            if not token:
                return "Error: missing alphahuman_api_key credential."
            if not job_id:
                return "Error: job_id is required."
            try:
                res = request_json(
                    token=token,
                    base_url=base_url,
                    method="GET",
                    path=f"/v1/memory/ingestion/jobs/{job_id}",
                )
                return f"Ingestion job result: {res}"
            except Exception as e:
                return f"Failed to get ingestion job: {e}"

        return {
            "save_memory": save_memory,
            "recall_memory": recall_memory,
            "delete_memory": delete_memory,
            "sync_memory": sync_memory,
            "insert_document": insert_document,
            "insert_documents_batch": insert_documents_batch,
            "list_documents": list_documents,
            "get_document": get_document,
            "delete_document": delete_document,
            "query_memory_context": query_memory_context,
            "chat_memory_context": chat_memory_context,
            "record_interactions": record_interactions,
            "recall_thoughts": recall_thoughts,
            "chat_memory": chat_memory,
            "interact_memory": interact_memory,
            "recall_memory_master": recall_memory_master,
            "recall_memories": recall_memories,
            "get_ingestion_job": get_ingestion_job,
        }
