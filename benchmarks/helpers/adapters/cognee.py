"""Cognee adapter."""

import os
import time

from ._base import IndexResult, MethodAdapter, QueryResult, _get_cost_tracker
from ..types import BenchmarkConfig, Chunk


class CogneeAdapter(MethodAdapter):
  """Adapter for the Cognee graph-based RAG system."""

  name = "cognee"

  def __init__(self):
    """Initialize the Cognee adapter."""
    pass

  async def create_index(self, chunks: list[Chunk], working_dir: str, config: BenchmarkConfig) -> IndexResult:
    """Index corpus chunks into Cognee and return indexing metrics."""
    import cognee

    texts = [c.text for c in chunks]

    api_key = os.environ.get("OPENAI_API_KEY")
    if api_key:
      cognee.config.set_llm_api_key(api_key)

    tracker = _get_cost_tracker()
    tracker.install()
    try:
      await cognee.prune.prune_data()
      await cognee.prune.prune_system(metadata=True)
      for text in texts:
        await cognee.add(text)
      start = time.perf_counter()
      await cognee.cognify()
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
    """Configure Cognee to use the current API key and existing storage."""
    import cognee

    api_key = os.environ.get("OPENAI_API_KEY")
    if api_key:
      cognee.config.set_llm_api_key(api_key)

  async def query(self, question: str, config: BenchmarkConfig) -> QueryResult:
    """Run a Cognee search query and return answer text, contexts, and cost."""
    import cognee
    from cognee.api.v1.search import SearchType

    tracker = _get_cost_tracker()
    tracker.install()
    try:
      start = time.perf_counter()
      search_results = await cognee.search(SearchType.INSIGHTS, query_text=question)
      elapsed = time.perf_counter() - start
      snap = tracker.snapshot()
    finally:
      tracker.uninstall()

    answer_text = str(search_results[0]) if search_results else ""
    contexts = [str(r) for r in search_results] if search_results else []

    return QueryResult(
      answer=answer_text,
      contexts=contexts[: config.top_k],
      latency_seconds=elapsed,
      tokens_input=snap["input_tokens"],
      tokens_output=snap["output_tokens"],
      cost_usd=snap["total_cost_usd"],
    )
