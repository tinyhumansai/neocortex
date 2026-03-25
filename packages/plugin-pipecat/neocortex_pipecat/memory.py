from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence
import os
from urllib.parse import quote

import requests
from loguru import logger
from pydantic import BaseModel, Field

from pipecat.frames.frames import Frame, LLMContextFrame, LLMMessagesFrame
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.openai_llm_context import (
    OpenAILLMContext,
    OpenAILLMContextFrame,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor


class NeocortexParams(BaseModel):
  """
  Configuration parameters for Neocortex memory service.

  Parameters:
      search_limit: Maximum number of memory chunks to retrieve per query.
      system_prompt: Prefix text for memory context messages.
      add_as_system_message: Whether to add memories as system messages.
      position: Position to insert memory messages in context (reserved for future use).
  """

  search_limit: int = Field(default=10, ge=1)
  system_prompt: str = Field(default="Based on previous conversations, I recall:\n\n")
  add_as_system_message: bool = Field(default=True)
  position: int = Field(default=1)


class NeocortexMemoryService(FrameProcessor):
  """
  A standalone memory service that integrates with Neocortex.

  This service intercepts message frames in the pipeline, stores user messages in
  Neocortex, and enhances context with relevant memories before passing them downstream.
  """

  def __init__(
    self,
    *,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    user_id: Optional[str] = None,
    agent_id: Optional[str] = None,
    run_id: Optional[str] = None,
    params: Optional[NeocortexParams] = None,
  ) -> None:
    super().__init__()

    token = (api_key or os.getenv("TINYHUMANS_API_KEY") or "").strip()
    if not token:
      logger.error("NeocortexMemoryService: missing Neocortex API key (TINYHUMANS_API_KEY).")
      raise ValueError("Neocortex API key is required.")

    self._token = token
    self._base_url = (base_url or os.getenv("TINYHUMANS_BASE_URL") or "https://api.tinyhumans.ai").rstrip("/")

    if not any([user_id, agent_id, run_id]):
      raise ValueError("At least one of user_id, agent_id, or run_id must be provided")

    self.user_id = user_id
    self.agent_id = agent_id
    self.run_id = run_id

    cfg = params or NeocortexParams()
    self.search_limit = cfg.search_limit
    self.system_prompt = cfg.system_prompt
    self.add_as_system_message = cfg.add_as_system_message
    self.position = cfg.position

    self._last_query: Optional[str] = None

    logger.info(
      "Initialized NeocortexMemoryService with "
      f"user_id={self.user_id}, agent_id={self.agent_id}, run_id={self.run_id}"
    )

  # ---------------------------
  # Low-level Neocortex client
  # ---------------------------

  def _headers(self) -> Dict[str, str]:
    return {
      "Authorization": f"Bearer {self._token}",
      "Content-Type": "application/json",
    }

  def _post(self, path: str, body: Dict[str, Any]) -> Dict[str, Any]:
    url = f"{self._base_url}{path}"
    resp = requests.post(url, json=body, headers=self._headers(), timeout=30)
    return self._handle_response(resp)

  def _get(self, path: str, query_params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    url = f"{self._base_url}{path}"
    params = {k: v for k, v in (query_params or {}).items() if v is not None}
    resp = requests.get(url, params=params, headers=self._headers(), timeout=30)
    return self._handle_response(resp)

  def _delete(self, path: str, query_params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    url = f"{self._base_url}{path}"
    params = {k: v for k, v in (query_params or {}).items() if v is not None}
    resp = requests.delete(url, params=params, headers=self._headers(), timeout=30)
    return self._handle_response(resp)

  def _handle_response(self, resp: requests.Response) -> Dict[str, Any]:
    try:
      data = resp.json() if resp.text else {}
    except Exception:
      resp.raise_for_status()
      return {}

    if not resp.ok or data.get("success") is False:
      msg = data.get("error") or f"HTTP {resp.status_code}"
      logger.error(f"Neocortex API error: {msg}")
      raise RuntimeError(msg)

    return data

  def _insert_memory(
    self,
    title: str,
    content: str,
    namespace: str,
    document_id: str,
    metadata: Optional[Dict[str, Any]] = None,
  ) -> Dict[str, Any]:
    body: Dict[str, Any] = {
      "title": title,
      "content": content,
      "namespace": namespace,
      "sourceType": "chat",
      "document_id": document_id,
      "metadata": metadata or {},
    }
    return self._post("/v1/memory/insert", body)

  def _query_memory(self, query: str, namespace: str, max_chunks: int) -> Dict[str, Any]:
    body: Dict[str, Any] = {
      "query": query,
      "namespace": namespace,
      "maxChunks": max_chunks,
    }
    return self._post("/v1/memory/query", body)

  def _delete_memory(self, namespace: Optional[str]) -> Dict[str, Any]:
    body: Dict[str, Any] = {
      "namespace": namespace,
    }
    return self._post("/v1/memory/admin/delete", body)

  # --- Legacy/core endpoints ---
  def _sync_memory(
    self,
    workspace_id: str,
    agent_id: str,
    files: Sequence[Dict[str, Any]],
    source: Optional[str] = None,
  ) -> Dict[str, Any]:
    body: Dict[str, Any] = {
      "workspaceId": workspace_id,
      "agentId": agent_id,
      "source": source,
      "files": [
        {
          "filePath": f.get("file_path") or f.get("filePath"),
          "content": f.get("content"),
          "timestamp": f.get("timestamp"),
          "hash": f.get("hash"),
        }
        for f in files
      ],
    }
    return self._post("/v1/memory/sync", body)

  def _recall_memory(self, namespace: Optional[str], max_chunks: Optional[int] = None) -> Dict[str, Any]:
    return self._post("/v1/memory/recall", {"namespace": namespace, "maxChunks": max_chunks})

  def _recall_memories(
    self,
    namespace: Optional[str],
    top_k: Optional[int] = None,
    min_retention: Optional[float] = None,
    as_of: Optional[float] = None,
  ) -> Dict[str, Any]:
    return self._post(
      "/v1/memory/memories/recall",
      {
        "namespace": namespace,
        "topK": top_k,
        "minRetention": min_retention,
        "asOf": as_of,
      },
    )

  def _chat_memory(
    self,
    messages: Sequence[Dict[str, Any]],
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
  ) -> Dict[str, Any]:
    return self._post(
      "/v1/memory/chat",
      {"messages": list(messages), "temperature": temperature, "maxTokens": max_tokens},
    )

  def _interact_memory(self, payload: Dict[str, Any]) -> Dict[str, Any]:
    return self._post("/v1/memory/interact", payload)

  # --- Documents & mirrored endpoints ---
  def _insert_document(
    self,
    title: str,
    content: str,
    namespace: str,
    document_id: str,
    source_type: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    priority: Optional[str] = None,
    created_at: Optional[float] = None,
    updated_at: Optional[float] = None,
  ) -> Dict[str, Any]:
    body: Dict[str, Any] = {
      "title": title,
      "content": content,
      "namespace": namespace,
      "sourceType": source_type or "doc",
      "metadata": metadata or {},
      "priority": priority,
      "createdAt": created_at,
      "updatedAt": updated_at,
      "document_id": document_id,
    }
    return self._post("/v1/memory/documents", body)

  def _insert_documents_batch(self, items: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    return self._post("/v1/memory/documents/batch", {"items": list(items)})

  def _list_documents(
    self,
    namespace: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
  ) -> Dict[str, Any]:
    return self._get("/v1/memory/documents", {"namespace": namespace, "limit": limit, "offset": offset})

  def _get_document(self, document_id: str, namespace: Optional[str] = None) -> Dict[str, Any]:
    return self._get(
      f"/v1/memory/documents/{quote(document_id, safe='')}",
      {"namespace": namespace},
    )

  def _delete_document(self, document_id: str, namespace: str) -> Dict[str, Any]:
    return self._delete(
      f"/v1/memory/documents/{quote(document_id, safe='')}",
      {"namespace": namespace},
    )

  def _query_memory_context(
    self,
    query: str,
    namespace: Optional[str] = None,
    include_references: Optional[bool] = None,
    max_chunks: Optional[int] = None,
    document_ids: Optional[Sequence[str]] = None,
    recall_only: Optional[bool] = None,
    llm_query: Optional[str] = None,
  ) -> Dict[str, Any]:
    return self._post(
      "/v1/memory/queries",
      {
        "query": query,
        "includeReferences": include_references,
        "namespace": namespace,
        "maxChunks": max_chunks,
        "documentIds": list(document_ids) if document_ids is not None else None,
        "recallOnly": recall_only,
        "llmQuery": llm_query,
      },
    )

  def _chat_memory_context(
    self,
    messages: Sequence[Dict[str, Any]],
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
  ) -> Dict[str, Any]:
    return self._post(
      "/v1/memory/conversations",
      {"messages": list(messages), "temperature": temperature, "maxTokens": max_tokens},
    )

  def _record_interactions(self, payload: Dict[str, Any]) -> Dict[str, Any]:
    return self._post("/v1/memory/interactions", payload)

  def _recall_thoughts(
    self,
    namespace: Optional[str] = None,
    max_chunks: Optional[int] = None,
    temperature: Optional[float] = None,
    randomness_seed: Optional[int] = None,
    persist: Optional[bool] = None,
    enable_prediction_check: Optional[bool] = None,
    thought_prompt: Optional[str] = None,
  ) -> Dict[str, Any]:
    return self._post(
      "/v1/memory/memories/thoughts",
      {
        "namespace": namespace,
        "maxChunks": max_chunks,
        "temperature": temperature,
        "randomnessSeed": randomness_seed,
        "persist": persist,
        "enablePredictionCheck": enable_prediction_check,
        "thoughtPrompt": thought_prompt,
      },
    )

  def _get_ingestion_job(self, job_id: str) -> Dict[str, Any]:
    return self._get(f"/v1/memory/ingestion/jobs/{quote(job_id, safe='')}")

  # ---------------------------
  # Memory helpers
  # ---------------------------

  def _namespace_for(self) -> str:
    # Simple strategy: prefer run_id, then user_id, then agent_id, otherwise "default"
    if self.run_id:
      return f"pipecat-run-{self.run_id}"
    if self.user_id:
      return f"pipecat-user-{self.user_id}"
    if self.agent_id:
      return f"pipecat-agent-{self.agent_id}"
    return "pipecat-default"

  def _store_messages(self, messages: List[Dict[str, Any]]) -> None:
    """
    Store the latest user message as a Neocortex memory.
    """
    try:
      latest_user: Optional[Dict[str, Any]] = None
      for message in reversed(messages):
        if message.get("role") == "user" and isinstance(message.get("content"), str):
          latest_user = message
          break

      if not latest_user:
        return

      text = str(latest_user.get("content", "")).strip()
      if not text:
        return

      title = text[:64] + ("..." if len(text) > 64 else "")
      namespace = self._namespace_for()
      document_id = f"pipecat-{abs(hash((namespace, text))) % 1_000_000_000}"

      metadata: Dict[str, Any] = {
        "platform": "pipecat",
        "user_id": self.user_id,
        "agent_id": self.agent_id,
        "run_id": self.run_id,
      }

      logger.debug(f"NeocortexMemoryService: inserting memory in namespace={namespace}")
      self._insert_memory(
        title=title,
        content=text,
        namespace=namespace,
        document_id=document_id,
        metadata=metadata,
      )
    except Exception as e:
      logger.error(f"Error storing messages in Neocortex: {e}")

  def _retrieve_memories(self, query: str) -> str:
    """
    Retrieve relevant memories from Neocortex and format them as a context string.
    """
    try:
      namespace = self._namespace_for()
      logger.debug(f"NeocortexMemoryService: querying memories for namespace={namespace}")
      res = self._query_memory(query=query, namespace=namespace, max_chunks=self.search_limit)
      data = res.get("data") or {}

      direct = data.get("llmContextMessage") or data.get("response")
      if isinstance(direct, str) and direct.strip():
        return direct.strip()

      chunks = ((data.get("context") or {}).get("chunks")) or []
      texts: List[str] = []
      for chunk in chunks:
        if isinstance(chunk, dict):
          text = chunk.get("content") or chunk.get("text") or chunk.get("body") or ""
          if isinstance(text, str) and text.strip():
            texts.append(text.strip())

      return "\n\n".join(texts)
    except Exception as e:
      logger.error(f"Error retrieving memories from Neocortex: {e}")
      return ""

  def _enhance_context_with_memories(self, context: LLMContext | OpenAILLMContext, query: str) -> None:
    """
    Enhance the LLM context with relevant memories.
    """
    if self._last_query == query:
      return

    self._last_query = query

    memory_text = self._retrieve_memories(query)
    if not memory_text:
      return

    full_text = f"{self.system_prompt}\n{memory_text}".strip()

    if not full_text:
      return

    if self.add_as_system_message:
      context.add_message({"role": "system", "content": full_text})
    else:
      context.add_message({"role": "user", "content": full_text})

    logger.debug("NeocortexMemoryService: enhanced context with Neocortex memories")

  # ---------------------------
  # Public wrappers (Mastra-like endpoint surface)
  # ---------------------------
  def sync_memory(
    self,
    workspace_id: str,
    agent_id: str,
    files: Sequence[Dict[str, Any]],
    source: Optional[str] = None,
  ) -> Dict[str, Any]:
    return self._sync_memory(workspace_id=workspace_id, agent_id=agent_id, files=files, source=source)

  def recall_memory_master(self, max_chunks: Optional[int] = None) -> Dict[str, Any]:
    return self._recall_memory(namespace=self._namespace_for(), max_chunks=max_chunks)

  def recall_memories(
    self,
    top_k: Optional[int] = None,
    min_retention: Optional[float] = None,
    as_of: Optional[float] = None,
  ) -> Dict[str, Any]:
    return self._recall_memories(
      namespace=self._namespace_for(),
      top_k=top_k,
      min_retention=min_retention,
      as_of=as_of,
    )

  def chat_memory(
    self,
    messages: Sequence[Dict[str, Any]],
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
  ) -> Dict[str, Any]:
    return self._chat_memory(messages=messages, temperature=temperature, max_tokens=max_tokens)

  def interact_memory(self, payload: Dict[str, Any]) -> Dict[str, Any]:
    return self._interact_memory(payload)

  def insert_document(
    self,
    title: str,
    content: str,
    document_id: str,
    source_type: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    priority: Optional[str] = None,
    created_at: Optional[float] = None,
    updated_at: Optional[float] = None,
  ) -> Dict[str, Any]:
    return self._insert_document(
      title=title,
      content=content,
      namespace=self._namespace_for(),
      document_id=document_id,
      source_type=source_type,
      metadata=metadata,
      priority=priority,
      created_at=created_at,
      updated_at=updated_at,
    )

  def insert_documents_batch(self, items: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    for item in items:
      if not isinstance(item, dict) or not item.get("document_id"):
        raise ValueError("each item in items must include document_id")
    return self._insert_documents_batch(items)

  def list_documents(self, limit: Optional[int] = None, offset: Optional[int] = None) -> Dict[str, Any]:
    return self._list_documents(namespace=self._namespace_for(), limit=limit, offset=offset)

  def get_document(self, document_id: str) -> Dict[str, Any]:
    return self._get_document(document_id=document_id, namespace=self._namespace_for())

  def delete_document(self, document_id: str) -> Dict[str, Any]:
    return self._delete_document(document_id=document_id, namespace=self._namespace_for())

  def query_memory_context(
    self,
    query: str,
    include_references: Optional[bool] = None,
    max_chunks: Optional[int] = None,
    document_ids: Optional[Sequence[str]] = None,
    recall_only: Optional[bool] = None,
    llm_query: Optional[str] = None,
  ) -> Dict[str, Any]:
    return self._query_memory_context(
      query=query,
      namespace=self._namespace_for(),
      include_references=include_references,
      max_chunks=max_chunks,
      document_ids=document_ids,
      recall_only=recall_only,
      llm_query=llm_query,
    )

  def chat_memory_context(
    self,
    messages: Sequence[Dict[str, Any]],
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
  ) -> Dict[str, Any]:
    return self._chat_memory_context(messages=messages, temperature=temperature, max_tokens=max_tokens)

  def record_interactions(self, payload: Dict[str, Any]) -> Dict[str, Any]:
    return self._record_interactions(payload)

  def recall_thoughts(
    self,
    max_chunks: Optional[int] = None,
    temperature: Optional[float] = None,
    randomness_seed: Optional[int] = None,
    persist: Optional[bool] = None,
    enable_prediction_check: Optional[bool] = None,
    thought_prompt: Optional[str] = None,
  ) -> Dict[str, Any]:
    return self._recall_thoughts(
      namespace=self._namespace_for(),
      max_chunks=max_chunks,
      temperature=temperature,
      randomness_seed=randomness_seed,
      persist=persist,
      enable_prediction_check=enable_prediction_check,
      thought_prompt=thought_prompt,
    )

  def get_ingestion_job(self, job_id: str) -> Dict[str, Any]:
    return self._get_ingestion_job(job_id=job_id)

  # ---------------------------
  # FrameProcessor implementation
  # ---------------------------

  async def process_frame(self, frame: Frame, direction: FrameDirection):  # type: ignore[override]
    """
    Process incoming frames, intercept context frames for memory integration.
    """
    await super().process_frame(frame, direction)

    context: Optional[LLMContext | OpenAILLMContext] = None
    messages: Optional[List[Dict[str, Any]]] = None

    if isinstance(frame, (LLMContextFrame, OpenAILLMContextFrame)):
      context = frame.context
    elif isinstance(frame, LLMMessagesFrame):
      messages = frame.messages
      context = LLMContext(messages)

    if context:
      try:
        context_messages = context.get_messages()
        latest_user_message = None

        for message in reversed(context_messages):
          if message.get("role") == "user" and isinstance(message.get("content"), str):
            latest_user_message = message.get("content")
            break

        if isinstance(latest_user_message, str) and latest_user_message.strip():
          # Enhance context and then store messages
          self._enhance_context_with_memories(context, latest_user_message)
          self._store_messages(context_messages)

        if messages is not None:
          # Re-emit messages with enhanced context
          await self.push_frame(LLMMessagesFrame(context.get_messages()))
        else:
          await self.push_frame(frame)
      except Exception as e:
        await self.push_error(
          error_msg=f"Error processing with NeocortexMemoryService: {str(e)}", exception=e
        )
        await self.push_frame(frame)
    else:
      await self.push_frame(frame, direction)

