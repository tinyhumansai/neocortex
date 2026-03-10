"""fast_graphrag (upstream fork) adapter."""

import time

from ._base import (
  SHERLOCK_DOMAIN,
  SHERLOCK_ENTITY_TYPES,
  SHERLOCK_QUERIES,
  IndexResult,
  MethodAdapter,
  QueryResult,
  _get_cost_tracker,
)
from ..types import BenchmarkConfig, Chunk


class FastGraphRAGAdapter(MethodAdapter):
  """Adapter for the upstream fast_graphrag GraphRAG implementation."""

  name = "fast_graphrag"

  def __init__(self):
    """Initialize the fast_graphrag adapter."""
    self._grag = None
    self._tracker = _get_cost_tracker()
    self._working_dir = None
    self._query_session_open = False

  def _grag_kwargs(self):
    return dict(
      domain=SHERLOCK_DOMAIN,
      example_queries="\n".join(SHERLOCK_QUERIES),
      entity_types=SHERLOCK_ENTITY_TYPES,
    )

  async def create_index(self, chunks: list[Chunk], working_dir: str, config: BenchmarkConfig) -> IndexResult:
    """Index chunks using fast_graphrag and return timing/cost metrics."""
    from fast_graphrag import GraphRAG

    texts = [c.text for c in chunks]

    self._working_dir = working_dir
    self._tracker.install()
    self._tracker.reset()
    try:
      grag = GraphRAG(working_dir=working_dir, **self._grag_kwargs())
      start = time.perf_counter()
      await grag.async_insert(texts)
      elapsed = time.perf_counter() - start
      snap = self._tracker.snapshot()
    finally:
      self._tracker.uninstall()

    result = IndexResult(
      time_seconds=elapsed,
      cost_usd=snap["total_cost_usd"],
      tokens_input=snap["input_tokens"],
      tokens_output=snap["output_tokens"],
    )

    # Create a fresh instance for querying (same pattern as neocortex)
    await self._open_query_session(working_dir)
    return result

  async def _open_query_session(self, working_dir: str) -> None:
    """Create a fresh GraphRAG instance and open its query session."""
    from fast_graphrag import GraphRAG

    if self._query_session_open and self._grag:
      await self._grag.state_manager.query_done()
      self._query_session_open = False

    self._tracker.install()
    self._grag = GraphRAG(working_dir=working_dir, **self._grag_kwargs())
    await self._grag.state_manager.query_start()
    self._query_session_open = True

  async def load_index(self, working_dir: str, config: BenchmarkConfig) -> None:
    """Load an existing fast_graphrag workspace from disk."""
    self._working_dir = working_dir
    await self._open_query_session(working_dir)

  async def query(self, question: str, config: BenchmarkConfig) -> QueryResult:
    """Query fast_graphrag and return answer, contexts, and cost/counters."""
    from fast_graphrag import QueryParam

    self._tracker.reset()
    start = time.perf_counter()
    answer = await self._grag.async_query(question, QueryParam(only_context=False))
    elapsed = time.perf_counter() - start

    snap = self._tracker.snapshot()
    contexts = [str(chunk.content) for chunk, _ in answer.context.chunks]

    return QueryResult(
      answer=answer.response,
      contexts=contexts,
      latency_seconds=elapsed,
      tokens_input=snap["input_tokens"],
      tokens_output=snap["output_tokens"],
      cost_usd=snap["total_cost_usd"],
    )
