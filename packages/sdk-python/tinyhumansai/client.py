"""TinyHumans memory client for Python."""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Optional, Sequence, Union
from urllib.parse import quote

import httpx

from .llm import recall_with_llm as _query_llm_func
from .types import (
    BASE_URL_ENV,
    TinyHumansError,
    DEFAULT_BASE_URL,
    DeleteMemoryResponse,
    GetContextResponse,
    IngestMemoryResponse,
    LLMQueryResponse,
    MemoryItem,
    ReadMemoryItem,
)


logger = logging.getLogger("tinyhumansai")

INSERT_PATH = "/memory/insert"
QUERY_PATH = "/memory/query"
DELETE_PATH = "/memory/admin/delete"

# --- Newer endpoints (documents, mirrored context, admin graph, etc.) ---
CHAT_PATH = "/memory/chat"
INTERACT_PATH = "/memory/interact"
RECALL_MASTER_PATH = "/memory/recall"
RECALL_MEMORIES_PATH = "/memory/memories/recall"

DOCUMENTS_INSERT_PATH = "/memory/documents"
DOCUMENTS_BATCH_PATH = "/memory/documents/batch"
DOCUMENTS_LIST_PATH = "/memory/documents"
DOCUMENTS_GRAPH_SNAPSHOT_PATH = "/memory/admin/graph-snapshot"
MEMORY_QUERIES_PATH = "/memory/queries"
MEMORY_CONVERSATIONS_PATH = "/memory/conversations"
MEMORY_INTERACTIONS_PATH = "/memory/interactions"
MEMORY_THOUGHTS_PATH = "/memory/memories/thoughts"
INGESTION_JOB_PATH_PREFIX = "/memory/ingestion/jobs"


def _validate_timestamp(value: Optional[float], name: str) -> None:
    """Validate a Unix timestamp (seconds).

    Args:
        value: Timestamp to validate (None is allowed).
        name: Field name for error messages.

    Raises:
        ValueError: If timestamp is invalid.
    """
    if value is None:
        return
    if not isinstance(value, (int, float)):
        raise ValueError(
            f"{name} must be a number (Unix timestamp in seconds), got {type(value).__name__}"
        )
    if value < 0:
        raise ValueError(
            f"{name} must be non-negative (Unix timestamp in seconds), got {value}"
        )
    # Reject timestamps that are too far in the future (e.g., > 100 years from now)
    max_future = time.time() + (100 * 365 * 24 * 60 * 60)
    if value > max_future:
        raise ValueError(
            f"{name} is too far in the future (max ~100 years), got {value}"
        )


def _validate_timestamps(
    created_at: Optional[float], updated_at: Optional[float]
) -> None:
    """Validate created_at and updated_at timestamps together.

    Args:
        created_at: Creation timestamp (None is allowed).
        updated_at: Update timestamp (None is allowed).

    Raises:
        ValueError: If timestamps are invalid or inconsistent.
    """
    _validate_timestamp(created_at, "created_at")
    _validate_timestamp(updated_at, "updated_at")
    if created_at is not None and updated_at is not None:
        if updated_at < created_at:
            raise ValueError(
                f"updated_at ({updated_at}) must be >= created_at ({created_at})"
            )


class TinyHumansMemoryClient:
    """Synchronous client for the TinyHumans memory API.

    Args:
        token: API token.
        model_id: Model identifier sent with every request. Defaults to "neocortex-mk1".
        base_url: Optional API base URL override.
    """

    def __init__(
        self,
        token: str,
        model_id: str = "neocortex-mk1",
        base_url: Optional[str] = None,
    ) -> None:
        if not token or not token.strip():
            raise ValueError("token is required")
        if not model_id or not model_id.strip():
            raise ValueError("model_id is required")
        resolved_base_url = (
            base_url or os.environ.get(BASE_URL_ENV) or DEFAULT_BASE_URL
        )
        self._base_url = resolved_base_url.rstrip("/")
        self._token = token
        self._model_id = model_id
        logger.debug(
            "Initializing TinyHumansMemoryClient base_url=%s model_id=%s",
            self._base_url,
            self._model_id,
        )
        self._http = httpx.Client(
            base_url=self._base_url,
            headers={
                "Authorization": f"Bearer {self._token}",
                "X-Model-Id": self._model_id,
            },
            timeout=30,
        )

    def close(self) -> None:
        """Close the underlying HTTP client and release connections."""
        logger.debug("Closing TinyHumansMemoryClient HTTP session")
        self._http.close()

    def __enter__(self) -> "TinyHumansMemoryClient":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def insert_memory(
        self,
        *,
        item: Union[MemoryItem, dict[str, Any]],
    ) -> IngestMemoryResponse:
        """Insert (upsert) a single memory item.

        The item is deduped by (namespace, key). If a matching item already
        exists its content and metadata are updated; otherwise a new item is created.

        Args:
            item: A `MemoryItem` or a dict with keys: `key` (str), `content` (str),
                `namespace` (str, required), optional `metadata` (dict),
                optional `created_at` (float, Unix seconds), optional `updated_at` (float, Unix seconds).

        Returns:
            Counts of ingested, updated, and errored items (ingested + updated <= 1).

        Raises:
            TinyHumansError: On API errors.
        """
        return self.insert_memories(items=[item])

    def insert_memories(
        self,
        *,
        items: Sequence[Union[MemoryItem, dict[str, Any]]],
    ) -> IngestMemoryResponse:
        """Insert (upsert) one or more memory items.

        Items are deduped by (namespace, key). If a matching item already
        exists its content and metadata are updated; otherwise a new item
        is created.

        Args:
            items: Items to upsert. Each item can be a `MemoryItem` or a dict with
                keys: `key` (str), `content` (str), `namespace` (str, required),
                optional `metadata` (dict), optional `created_at` (float, Unix seconds),
                optional `updated_at` (float, Unix seconds).

        Returns:
            Counts of ingested, updated, and errored items.

        Raises:
            ValueError: If items list is empty.
            TinyHumansError: On API errors.
        """
        if not items:
            raise ValueError("items must be a non-empty list")

        normalized: list[dict[str, Any]] = []
        logger.debug("Normalizing %d memory item(s) for ingest", len(items))
        for item in items:
            if isinstance(item, MemoryItem):
                _validate_timestamps(item.created_at, item.updated_at)
                item_dict: dict[str, Any] = {
                    "key": item.key,
                    "content": item.content,
                    "namespace": item.namespace,
                    "metadata": item.metadata,
                }
                if item.created_at is not None:
                    item_dict["createdAt"] = item.created_at
                if item.updated_at is not None:
                    item_dict["updatedAt"] = item.updated_at
                normalized.append(item_dict)
            elif isinstance(item, dict):
                created_at = item.get("createdAt") or item.get("created_at")
                updated_at = item.get("updatedAt") or item.get("updated_at")
                _validate_timestamps(created_at, updated_at)
                if "namespace" not in item:
                    raise ValueError("items: each dict must include 'namespace'")
                item_dict = {
                    "key": item["key"],
                    "content": item["content"],
                    "namespace": item["namespace"],
                    "metadata": item.get("metadata", {}),
                }
                if created_at is not None:
                    item_dict["createdAt"] = created_at
                if updated_at is not None:
                    item_dict["updatedAt"] = updated_at
                normalized.append(item_dict)
            else:
                raise TypeError("items must be MemoryItem or dict")
        ingested = 0
        updated = 0
        for item_dict in normalized:
            body = self._build_insert_body(item_dict)
            logger.debug(
                "Sending ingest request namespace=%s key=%s",
                item_dict["namespace"],
                item_dict["key"],
            )
            data = self._send("POST", INSERT_PATH, body)
            status = str(data.get("status", "")).lower()
            if "updat" in status:
                updated += 1
            else:
                ingested += 1
        return IngestMemoryResponse(ingested=ingested, updated=updated, errors=0)

    def recall_memory(
        self,
        *,
        namespace: str,
        prompt: str,
        num_chunks: int = 10,
        key: Optional[str] = None,
        keys: Optional[Sequence[str]] = None,
    ) -> GetContextResponse:
        """Get an LLM-friendly context string from stored memory.

        Uses the given prompt to fetch relevant memory chunks from the namespace,
        then formats them into a single context string for use in an LLM prompt.

        Args:
            namespace: Namespace scope (required).
            prompt: Query used to retrieve relevant chunks (required).
            num_chunks: Maximum number of chunks to retrieve (default 10).
            key: Optional single key to include (bypasses prompt-based retrieval).
            keys: Optional list of keys to include (bypasses prompt-based retrieval).

        Returns:
            Context string and the source memory items.

        Raises:
            ValueError: If num_chunks is not positive.
            TinyHumansError: On API errors.
        """
        if num_chunks < 1:
            raise ValueError("num_chunks must be >= 1")
        logger.debug(
            "Recalling memory namespace=%s prompt=%s num_chunks=%d key=%s keys_count=%s",
            namespace,
            (prompt[:100] + "…") if len(prompt) > 100 else prompt,
            num_chunks,
            key,
            len(keys) if keys else 0,
        )
        body: dict[str, Any] = {
            "query": prompt,
            "namespace": namespace,
            "maxChunks": num_chunks,
        }
        if key:
            body["documentIds"] = [key]
        elif keys:
            body["documentIds"] = list(keys)

        data = self._send("POST", QUERY_PATH, body)
        items = self._extract_read_items(data, namespace)
        context = self._extract_context_string(data, items)
        return GetContextResponse(context=context, items=items, count=len(items))

    def delete_memory(
        self,
        *,
        namespace: str,
        key: Optional[str] = None,
        keys: Optional[Sequence[str]] = None,
        delete_all: bool = False,
    ) -> DeleteMemoryResponse:
        """Delete memory items by key, keys, or delete all.

        Args:
            namespace: Namespace scope (required).
            key: Optional single key to delete.
            keys: Optional array of keys to delete.
            delete_all: If true, delete all memory in this namespace.

        Returns:
            Count of deleted items.

        Raises:
            ValueError: If no deletion target is specified.
            TinyHumansError: On API errors.
        """
        has_key = isinstance(key, str) and len(key) > 0
        has_keys = isinstance(keys, (list, tuple)) and len(keys) > 0
        if has_key or has_keys:
            raise ValueError(
                "The current TinyHumans API only supports namespace-wide deletion. "
                "Pass delete_all=True to delete the namespace."
            )
        if not delete_all:
            raise ValueError('Set delete_all=True to confirm namespace deletion')

        body: dict[str, Any] = {"namespace": namespace}

        logger.debug(
            "Deleting memory namespace=%s key=%s keys_count=%s delete_all=%s",
            namespace,
            key,
            len(keys) if keys else 0,
            delete_all,
        )
        data = self._send("POST", DELETE_PATH, body)
        return DeleteMemoryResponse(deleted=int(data.get("nodesDeleted", 0)))

    def recall_with_llm(
        self,
        *,
        prompt: str,
        provider: str = "openai",
        model: str = "gpt-4o-mini",
        api_key: str,
        context: str = "",
        namespace: Optional[str] = None,
        num_chunks: int = 10,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        url: Optional[str] = None,
    ) -> LLMQueryResponse:
        """Optional: run a prompt through a supported LLM with optional context.

        If context is not provided, calls recall_memory(namespace=..., prompt=prompt, num_chunks=...)
        to fetch relevant chunks from memory. In that case namespace (and optionally num_chunks)
        must be provided.

        Uses the provider's REST API (no extra SDK deps). Requires a separate
        API key from the LLM provider.

        Supported built-in providers: ``openai``, ``anthropic``, ``google`` (Gemini).
        For custom providers, pass ``url`` to use an OpenAI-compatible API endpoint.

        Args:
            prompt: User prompt to send.
            provider: Provider name. For built-in: "openai", "anthropic", "google".
                For custom: any name (ignored if url is provided).
            model: Model name (e.g. "gpt-4o-mini", "claude-3-5-sonnet-20241022", "gemini-1.5-flash").
            api_key: Provider API key (not the TinyHumans token).
            context: Optional context string. If not provided and namespace is given,
                context is fetched via recall_memory(namespace=namespace, prompt=prompt, num_chunks=num_chunks).
            namespace: Optional namespace; used to fetch context when context is not provided.
            num_chunks: Number of chunks to fetch when context is auto-fetched (default 10).
            max_tokens: Optional max tokens to generate.
            temperature: Optional sampling temperature.
            url: Optional custom API endpoint URL. If provided, uses OpenAI-compatible format
                (POST with JSON body: {"model": ..., "messages": [{"role": "system/user", "content": ...}]}).
                Response expected: {"choices": [{"message": {"content": "..."}}]}.

        Returns:
            LLMQueryResponse with the model reply text.

        Raises:
            ValueError: If context is not provided and namespace is not provided; or provider/api_key invalid.
            TinyHumansError: On provider API errors.
        """
        if not context.strip():
            if not namespace:
                raise ValueError(
                    "When context is not provided, pass namespace (and optionally num_chunks) "
                    "so context can be fetched from memory via recall_memory."
                )
            ctx = self.recall_memory(
                namespace=namespace,
                prompt=prompt,
                num_chunks=num_chunks,
            )
            context = ctx.context
        logger.debug(
            "Calling recall_with_llm provider=%s model=%s namespace=%s "
            "has_context=%s max_tokens=%s temperature=%s url=%s",
            provider,
            model,
            namespace,
            bool(context),
            max_tokens,
            temperature,
            url,
        )
        return _query_llm_func(
            prompt=prompt,
            provider=provider,
            model=model,
            api_key=api_key,
            context=context,
            max_tokens=max_tokens,
            temperature=temperature,
            url=url,
        )

    def chat_memory(
        self,
        *,
        messages: Sequence[dict[str, Any]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> dict[str, Any]:
        """Chat with memory context (TS: chatMemory).

        Sends POST /memory/chat.
        """
        if not messages or not isinstance(messages, (list, tuple)):
            raise ValueError("messages must be a non-empty list of {role, content} dicts")
        for m in messages:
            if not isinstance(m, dict):
                raise ValueError("messages must be dictionaries")
            if not isinstance(m.get("role"), str) or not m.get("role"):
                raise ValueError("each message requires role (string)")
            if not isinstance(m.get("content"), str) or not m.get("content"):
                raise ValueError("each message requires content (string)")

        body: dict[str, Any] = {"messages": list(messages)}
        if temperature is not None:
            body["temperature"] = temperature
        if max_tokens is not None:
            body["maxTokens"] = max_tokens

        return self._send("POST", CHAT_PATH, body)

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
        """Record entity interaction signals (TS: interactMemory).

        Sends POST /memory/interact.
        """
        if not namespace or not isinstance(namespace, str):
            raise ValueError("namespace is required and must be a string")
        if not entity_names or not isinstance(entity_names, (list, tuple)):
            raise ValueError("entity_names must be a non-empty list of strings")

        body: dict[str, Any] = {"namespace": namespace, "entityNames": list(entity_names)}
        if description is not None:
            body["description"] = description
        if interaction_level is not None:
            body["interactionLevel"] = interaction_level
        if interaction_levels is not None:
            body["interactionLevels"] = list(interaction_levels)
        if timestamp is not None:
            body["timestamp"] = timestamp

        return self._send("POST", INTERACT_PATH, body)

    def recall_memory_master(
        self,
        *,
        namespace: str,
        max_chunks: Optional[int] = None,
    ) -> GetContextResponse:
        """Recall context from the master node (TS: recallMemory).

        Sends POST /memory/recall and parses returned context chunks
        into the same GetContextResponse shape as recall_memory().
        """
        if not namespace or not isinstance(namespace, str):
            raise ValueError("namespace is required and must be a string")
        if max_chunks is not None and (not isinstance(max_chunks, int) or max_chunks < 1):
            raise ValueError("max_chunks must be an integer >= 1")

        body: dict[str, Any] = {"namespace": namespace}
        if max_chunks is not None:
            body["maxChunks"] = max_chunks

        data = self._send("POST", RECALL_MASTER_PATH, body)
        items = self._extract_read_items(data, namespace)
        context = self._extract_context_string(data, items)
        return GetContextResponse(context=context, items=items, count=len(items))

    def recall_memories(
        self,
        *,
        namespace: Optional[str] = None,
        top_k: Optional[float] = None,
        min_retention: Optional[float] = None,
        as_of: Optional[float] = None,
    ) -> dict[str, Any]:
        """Recall memories from Ebbinghaus bank (TS: recallMemories).

        Sends POST /memory/memories/recall.
        Returns raw backend `data` dict.
        """
        body: dict[str, Any] = {}
        if namespace is not None:
            if not isinstance(namespace, str) or not namespace:
                raise ValueError("namespace must be a non-empty string")
            body["namespace"] = namespace

        if top_k is not None:
            if not isinstance(top_k, (int, float)) or not float(top_k) or float(top_k) <= 0:
                raise ValueError("top_k must be a positive number")
            body["topK"] = top_k

        if min_retention is not None:
            if not isinstance(min_retention, (int, float)) or float(min_retention) < 0:
                raise ValueError("min_retention must be a non-negative number")
            body["minRetention"] = min_retention

        if as_of is not None:
            body["asOf"] = as_of

        return self._send("POST", RECALL_MEMORIES_PATH, body)

    # ------------------------------------------------------------------
    # Documents & mirrored endpoints (aligned with TypeScript SDK)
    # ------------------------------------------------------------------

    def insert_document(
        self,
        *,
        title: str,
        content: str,
        namespace: str,
        document_id: str,
        source_type: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        priority: Optional[str] = None,
        created_at: Optional[float] = None,
        updated_at: Optional[float] = None
    ) -> dict[str, Any]:
        """Ingest a single document into the documents backend."""
        if not title or not isinstance(title, str):
            raise ValueError("title is required and must be a string")
        if not content or not isinstance(content, str):
            raise ValueError("content is required and must be a string")
        if not namespace or not isinstance(namespace, str):
            raise ValueError("namespace is required and must be a string")
        if not document_id or not isinstance(document_id, str):
            raise ValueError("document_id is required and must be a string")

        _validate_timestamps(created_at, updated_at)

        body: dict[str, Any] = {
            "title": title,
            "content": content,
            "namespace": namespace,
            "document_id": document_id,
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

        return self._send("POST", DOCUMENTS_INSERT_PATH, body)

    def insert_documents_batch(
        self,
        *,
        items: Sequence[dict[str, Any]],
    ) -> dict[str, Any]:
        """Ingest multiple documents in one batch call."""
        if not items:
            raise ValueError("items must be a non-empty list")

        normalized_items: list[dict[str, Any]] = []
        for item in items:
            title = item.get("title")
            content = item.get("content")
            namespace = item.get("namespace")
            if not isinstance(title, str) or not title:
                raise ValueError("each item requires string 'title'")
            if not isinstance(content, str) or not content:
                raise ValueError("each item requires string 'content'")
            if not isinstance(namespace, str) or not namespace:
                raise ValueError("each item requires string 'namespace'")

            doc_id = item.get("documentId", item.get("document_id"))
            if not isinstance(doc_id, str) or not doc_id:
                raise ValueError("each item requires string 'documentId' (or 'document_id')")

            created_at = item.get("createdAt", item.get("created_at"))
            updated_at = item.get("updatedAt", item.get("updated_at"))
            _validate_timestamps(created_at, updated_at)

            body_item: dict[str, Any] = {
                "title": title,
                "content": content,
                "namespace": namespace,
                "document_id": doc_id,
            }
            if "sourceType" in item or "source_type" in item:
                body_item["sourceType"] = item.get("sourceType", item.get("source_type"))
            if "metadata" in item and item.get("metadata") is not None:
                body_item["metadata"] = item.get("metadata")
            if "priority" in item and item.get("priority") is not None:
                body_item["priority"] = item.get("priority")
            if created_at is not None:
                body_item["createdAt"] = created_at
            if updated_at is not None:
                body_item["updatedAt"] = updated_at

            normalized_items.append(body_item)

        return self._send(
            "POST",
            DOCUMENTS_BATCH_PATH,
            {"items": normalized_items},
        )

    def list_documents(
        self,
        *,
        namespace: Optional[str] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> dict[str, Any]:
        """List ingested documents."""
        params: dict[str, Any] = {}
        if namespace:
            params["namespace"] = namespace
        if limit is not None:
            params["limit"] = limit
        if offset is not None:
            params["offset"] = offset
        return self._send_get(DOCUMENTS_LIST_PATH, params if params else None)

    def get_document(
        self,
        *,
        document_id: str,
        namespace: Optional[str] = None,
    ) -> dict[str, Any]:
        """Get document details for a single document id."""
        if not document_id or not isinstance(document_id, str):
            raise ValueError("document_id is required and must be a string")
        params: dict[str, Any] = {}
        if namespace:
            params["namespace"] = namespace
        path = f"{DOCUMENTS_LIST_PATH}/{quote(document_id, safe='')}"
        return self._send_get(path, params if params else None)

    def delete_document(
        self,
        *,
        document_id: str,
        namespace: str,
    ) -> dict[str, Any]:
        """Delete a single ingested document."""
        if not document_id or not isinstance(document_id, str):
            raise ValueError("document_id is required and must be a string")
        if not namespace or not isinstance(namespace, str):
            raise ValueError("namespace is required and must be a string")

        path = f"{DOCUMENTS_LIST_PATH}/{quote(document_id, safe='')}"
        return self._send_delete(path, {"namespace": namespace})

    def get_graph_snapshot(
        self,
        *,
        namespace: Optional[str] = None,
        mode: Optional[str] = None,
        limit: Optional[int] = None,
        seed_limit: Optional[int] = None,
    ) -> dict[str, Any]:
        """Get admin graph snapshot (backend-specific)."""
        params: dict[str, Any] = {}
        if namespace:
            params["namespace"] = namespace
        if mode:
            params["mode"] = mode
        if limit is not None:
            params["limit"] = limit
        if seed_limit is not None:
            params["seed_limit"] = seed_limit
        return self._send_get(
            DOCUMENTS_GRAPH_SNAPSHOT_PATH,
            params if params else None,
        )

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
        """Query memory context via the mirrored /memory/queries endpoint."""
        if not query or not isinstance(query, str):
            raise ValueError("query is required and must be a string")

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

        return self._send("POST", MEMORY_QUERIES_PATH, body)

    def chat_memory_context(
        self,
        *,
        messages: Sequence[dict[str, Any]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> dict[str, Any]:
        """Chat with memory context via the mirrored /memory/conversations endpoint."""
        if not messages or not isinstance(messages, (list, tuple)):
            raise ValueError("messages must be a non-empty list of {role, content} dicts")
        # Keep request shape aligned with the backend/TS SDK.
        body: dict[str, Any] = {"messages": list(messages)}
        if temperature is not None:
            body["temperature"] = temperature
        if max_tokens is not None:
            body["maxTokens"] = max_tokens
        return self._send("POST", MEMORY_CONVERSATIONS_PATH, body)

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
        """Record entity interaction signals."""
        if not namespace:
            raise ValueError("namespace is required")
        if not entity_names or not isinstance(entity_names, (list, tuple)):
            raise ValueError("entity_names must be a non-empty list")

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

        return self._send("POST", MEMORY_INTERACTIONS_PATH, body)

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
        """Generate reflective thoughts."""
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
        return self._send("POST", MEMORY_THOUGHTS_PATH, body)

    def get_ingestion_job(self, *, job_id: str) -> dict[str, Any]:
        """Get memory ingestion job status by job id."""
        if not job_id or not isinstance(job_id, str):
            raise ValueError("job_id is required and must be a string")
        path = f"{INGESTION_JOB_PATH_PREFIX}/{quote(job_id, safe='')}"
        return self._send_get(path, None)

    def wait_for_ingestion_job(
        self,
        *,
        job_id: str,
        timeout_seconds: float = 30.0,
        poll_interval_seconds: float = 1.0,
    ) -> dict[str, Any]:
        """Poll an ingestion job until it reaches a terminal state."""
        if not job_id or not isinstance(job_id, str):
            raise ValueError("job_id is required and must be a string")
        if timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be > 0")
        if poll_interval_seconds <= 0:
            raise ValueError("poll_interval_seconds must be > 0")

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

        deadline = time.time() + timeout_seconds
        last_job: dict[str, Any] | None = None

        while time.time() < deadline:
            job = self.get_ingestion_job(job_id=job_id)
            last_job = job
            state_raw = job.get("state") or job.get("status") or job.get("jobState")
            if isinstance(state_raw, str):
                state = state_raw.strip().lower()
                if state in completed_states:
                    return job
                if state in failed_states:
                    raise TinyHumansError(
                        f"Ingestion job {job_id} failed (state={state_raw})",
                        500,
                        job,
                    )
                if state not in pending_states:
                    return job
            time.sleep(poll_interval_seconds)

        raise TinyHumansError(
            f"Ingestion job {job_id} timed out after {timeout_seconds}s",
            408,
            last_job,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _send(self, method: str, path: str, body: dict[str, Any]) -> dict[str, Any]:
        request = self._http.build_request(method, path, json=body)
        logger.debug(
            "HTTP %s %s headers=%s json=%s",
            method,
            request.url,
            self._debug_headers(),
            body,
        )
        response = self._http.send(request)
        return self._parse_response(response)

    def _send_get(
        self, path: str, params: Optional[dict[str, Any]] = None
    ) -> dict[str, Any]:
        request = self._http.build_request("GET", path, params=params)
        logger.debug(
            "HTTP GET %s headers=%s json=<none>",
            request.url,
            self._debug_headers(),
        )
        response = self._http.send(request)
        return self._parse_response(response)

    def _send_delete(
        self, path: str, params: Optional[dict[str, Any]] = None
    ) -> dict[str, Any]:
        request = self._http.build_request("DELETE", path, params=params)
        logger.debug(
            "HTTP DELETE %s headers=%s json=<none>",
            request.url,
            self._debug_headers(),
        )
        response = self._http.send(request)
        return self._parse_response(response)

    def _build_insert_body(self, item: dict[str, Any]) -> dict[str, Any]:
        body: dict[str, Any] = {
            "title": item["key"],
            "content": item["content"],
            "namespace": item["namespace"],
            "documentId": item["key"],
        }
        if item.get("metadata"):
            body["metadata"] = item["metadata"]
        if item.get("createdAt") is not None:
            body["createdAt"] = item["createdAt"]
        if item.get("updatedAt") is not None:
            body["updatedAt"] = item["updatedAt"]
        return body

    def _extract_read_items(
        self, data: dict[str, Any], namespace: str
    ) -> list[ReadMemoryItem]:
        context = data.get("context")
        if not isinstance(context, dict):
            return []

        chunks = context.get("chunks")
        if not isinstance(chunks, list):
            return []

        items: list[ReadMemoryItem] = []
        for chunk in chunks:
            if not isinstance(chunk, dict):
                continue
            content = self._first_str(
                chunk,
                "content",
                "text",
                "chunkText",
                "body",
            )
            key = self._first_str(
                chunk,
                "documentId",
                "title",
                "id",
                default="",
            )
            item_namespace = self._first_str(
                chunk,
                "namespace",
                default=namespace,
            )
            metadata = {
                k: v
                for k, v in chunk.items()
                if k
                not in {
                    "content",
                    "text",
                    "chunkText",
                    "body",
                    "documentId",
                    "title",
                    "id",
                    "namespace",
                    "createdAt",
                    "updatedAt",
                }
            }
            items.append(
                ReadMemoryItem(
                    key=key,
                    content=content,
                    namespace=item_namespace,
                    metadata=metadata,
                    created_at=str(chunk.get("createdAt", "")),
                    updated_at=str(chunk.get("updatedAt", "")),
                )
            )
        return items

    def _extract_context_string(
        self, data: dict[str, Any], items: Sequence[ReadMemoryItem]
    ) -> str:
        llm_context = data.get("llmContextMessage")
        if isinstance(llm_context, str) and llm_context.strip():
            return llm_context

        context_parts: list[str] = []
        for item in items:
            header = f"[{item.namespace}:{item.key}]" if item.key else f"[{item.namespace}]"
            if item.content:
                context_parts.append(f"{header}\n{item.content}")
        return "\n\n".join(context_parts)

    def _debug_headers(self) -> dict[str, str]:
        return {
            "Authorization": "Bearer ***",
            "X-Model-Id": self._model_id,
            "Content-Type": "application/json",
        }

    def _first_str(
        self, payload: dict[str, Any], *keys: str, default: str = ""
    ) -> str:
        for key in keys:
            value = payload.get(key)
            if isinstance(value, str) and value:
                return value
        return default

    def _parse_response(self, response: httpx.Response) -> dict[str, Any]:
        response_text = response.text
        logger.debug(
            "HTTP response status=%s url=%s body=%s",
            response.status_code,
            response.url,
            response_text[:500].replace("\n", " "),
        )
        try:
            payload = response.json()
        except Exception:
            raise TinyHumansError(
                f"HTTP {response.status_code} {response.request.method} {response.url}: non-JSON response",
                response.status_code,
                response_text,
            )
        if not response.is_success:
            message = payload.get("error", f"HTTP {response.status_code}")
            raise TinyHumansError(message, response.status_code, payload)
        return payload["data"]
