"""LightRAG adapter."""

import os
import re
import time

from ._base import IndexResult, MethodAdapter, QueryResult, _get_cost_tracker
from ..types import BenchmarkConfig, Chunk


class LightRAGAdapter(MethodAdapter):
  """Adapter for the LightRAG graph-based RAG implementation."""

  name = "lightrag"

  def __init__(self):
    """Initialize the LightRAG adapter."""
    self._grag = None
    self._working_dir = None

  async def create_index(self, chunks: list[Chunk], working_dir: str, config: BenchmarkConfig) -> IndexResult:
    """Index chunks using LightRAG and return timing/cost metrics."""
    from lightrag import LightRAG
    from lightrag.llm.openai import gpt_4o_mini_complete, openai_embed

    texts = [c.text for c in chunks]

    self._working_dir = working_dir
    os.makedirs(working_dir, exist_ok=True)

    tracker = _get_cost_tracker()
    tracker.install()
    try:
      self._grag = LightRAG(
        working_dir=working_dir,
        llm_model_func=gpt_4o_mini_complete,
        embedding_func=openai_embed,
      )
      await self._grag.initialize_storages()
      start = time.perf_counter()
      await self._grag.ainsert(texts)
      elapsed = time.perf_counter() - start
      snap = tracker.snapshot()
    finally:
      tracker.uninstall()

    return IndexResult(
      time_seconds=elapsed,
      cost_usd=snap["total_cost_usd"],
      tokens_input=snap["input_tokens"],
      tokens_output=snap["output_tokens"],
    )

  async def load_index(self, working_dir: str, config: BenchmarkConfig) -> None:
    """Load an existing LightRAG workspace from disk."""
    from lightrag import LightRAG
    from lightrag.llm.openai import gpt_4o_mini_complete, openai_embed

    self._working_dir = working_dir
    self._grag = LightRAG(
      working_dir=working_dir,
      llm_model_func=gpt_4o_mini_complete,
      embedding_func=openai_embed,
    )
    await self._grag.initialize_storages()

  async def query(self, question: str, config: BenchmarkConfig) -> QueryResult:
    """Query LightRAG and return answer text, contexts, and token/cost metrics."""
    from lightrag import QueryParam

    tracker = _get_cost_tracker()
    tracker.install()
    try:
      start = time.perf_counter()
      answer = await self._grag.aquery(
        question,
        QueryParam(mode="local", only_need_context=False, max_token_for_text_unit=9000),
      )
      elapsed = time.perf_counter() - start
      snap = tracker.snapshot()
    finally:
      tracker.uninstall()

    contexts = []
    source_match = re.findall(r"\n-----Sources-----\n```csv\n(.*?)\n```", answer, re.DOTALL)
    if source_match:
      for line in source_match[0].split("\n")[1:]:
        line = line.strip()
        if line:
          contexts.append(line)

    answer_text = answer.split("-----Sources-----")[0].strip() if "-----Sources-----" in answer else answer

    return QueryResult(
      answer=answer_text,
      contexts=contexts[: config.top_k],
      latency_seconds=elapsed,
      tokens_input=snap["input_tokens"],
      tokens_output=snap["output_tokens"],
      cost_usd=snap["total_cost_usd"],
    )
