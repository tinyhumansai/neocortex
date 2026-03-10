"""Gemini VDB adapter -- VDB retrieval + Google Gemini answers."""

import os
import time

from ._base import IndexResult, MethodAdapter, QueryResult
from ..types import BenchmarkConfig, Chunk
from .vdb import VDBAdapter

# Per-million-token pricing (input, output) for known Gemini models.
_GEMINI_PRICING: dict[str, tuple[float, float]] = {
  "gemini-2.0-flash": (0.10, 0.40),
  "gemini-2.5-flash-lite": (0.10, 0.40),
  "gemini-2.5-pro": (1.25, 10.00),
  "gemini-2.5-flash": (0.15, 0.60),
}


def _estimate_gemini_cost(model: str, tokens_in: int, tokens_out: int) -> float:
  """Estimate USD cost from token counts using known pricing tables."""
  # Try exact match first, then prefix match
  pricing = _GEMINI_PRICING.get(model)
  if pricing is None:
    for key, val in _GEMINI_PRICING.items():
      if model.startswith(key):
        pricing = val
        break
  if pricing is None:
    # Default to flash pricing as conservative estimate
    pricing = (0.10, 0.40)
  cost_in, cost_out = pricing
  return (tokens_in * cost_in + tokens_out * cost_out) / 1_000_000


class GeminiVDBAdapter(MethodAdapter):
  """Adapter for VDB retrieval with Gemini as the answering model."""

  name = "gemini_vdb"

  def __init__(self):
    """Initialize the Gemini VDB adapter."""
    self._vdb_adapter = VDBAdapter()

  async def create_index(self, chunks: list[Chunk], working_dir: str, config: BenchmarkConfig) -> IndexResult:
    """Delegate indexing to the shared VDB adapter."""
    return await self._vdb_adapter.create_index(chunks, working_dir, config)

  async def load_index(self, working_dir: str, config: BenchmarkConfig) -> None:
    """Load an existing VDB index via the shared VDB adapter."""
    await self._vdb_adapter.load_index(working_dir, config)

  async def query(self, question: str, config: BenchmarkConfig) -> QueryResult:
    """Retrieve context from VDB and answer using a Gemini model."""
    from google import genai

    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
      raise RuntimeError("GOOGLE_API_KEY or GEMINI_API_KEY environment variable is not set")

    model_name = config.gemini_model
    top_k = config.top_k

    # Query session is already open from create_index/load_index
    chunks = await self._vdb_adapter._storage.get_context(question, top_k)

    context_parts = [f"[{i + 1}]  {content}" for i, (_, content) in enumerate(chunks)]
    context_str = "\n=====\n\n".join(context_parts)
    prompt = (
      "You are a helpful assistant analyzing the given input data to provide "
      "a helpful response to the user query.\n\n"
      f"# INPUT DATA\n{context_str}\n\n"
      f"# USER QUERY\n{question}\n\n"
      "# INSTRUCTIONS\n"
      "Provide a concise response using the input data. If the answer cannot be "
      "inferred from the data, say so.\n\nAnswer:"
    )

    client = genai.Client(api_key=api_key)
    start = time.perf_counter()
    response = await client.aio.models.generate_content(
      model=model_name,
      contents=prompt,
    )
    elapsed = time.perf_counter() - start

    tokens_in = 0
    tokens_out = 0
    if response.usage_metadata:
      tokens_in = response.usage_metadata.prompt_token_count or 0
      tokens_out = response.usage_metadata.candidates_token_count or 0

    contexts = [content for _, content in chunks]
    return QueryResult(
      answer=response.text or "",
      contexts=contexts,
      latency_seconds=elapsed,
      tokens_input=tokens_in,
      tokens_output=tokens_out,
      cost_usd=_estimate_gemini_cost(model_name, tokens_in, tokens_out),
    )
