"""Microsoft GraphRAG v3 adapter."""

import os
import threading
import time

import pandas as pd
import yaml

from ._base import IndexResult, MethodAdapter, QueryResult
from ..types import BenchmarkConfig, Chunk


class _LiteLLMCostTracker:
  """Track token usage and cost via litellm's _async_success_callback.

  litellm skips sync callable callbacks for async calls (acompletion,
  aembedding), so we must register an async callback on
  ``_async_success_callback``.
  """

  def __init__(self):
    self._lock = threading.Lock()
    self.input_tokens = 0
    self.output_tokens = 0
    self.cost_usd = 0.0

  async def _async_callback(self, kwargs, completion_response, start_time, end_time):
    """Async callback invoked by litellm after every successful LLM call."""
    try:
      import litellm

      cost = litellm.completion_cost(completion_response=completion_response)
    except Exception:
      cost = 0.0

    usage = getattr(completion_response, "usage", None)
    prompt = getattr(usage, "prompt_tokens", 0) or 0
    completion = getattr(usage, "completion_tokens", 0) or 0

    with self._lock:
      self.input_tokens += prompt
      self.output_tokens += completion
      self.cost_usd += cost

  def install(self):
    import litellm

    self.input_tokens = 0
    self.output_tokens = 0
    self.cost_usd = 0.0
    litellm._async_success_callback.append(self._async_callback)

  def uninstall(self):
    import litellm

    try:
      litellm._async_success_callback.remove(self._async_callback)
    except ValueError:
      pass

  def snapshot(self):
    with self._lock:
      return {
        "input_tokens": self.input_tokens,
        "output_tokens": self.output_tokens,
        "total_cost_usd": self.cost_usd,
      }


class GraphRAGAdapter(MethodAdapter):
  """Adapter for the Microsoft GraphRAG reference implementation (v3.x)."""

  name = "graphrag"

  def __init__(self):
    self._working_dir = None
    self._config = None
    # Cached DataFrames for querying
    self._entities = None
    self._communities = None
    self._community_reports = None
    self._text_units = None
    self._relationships = None
    self._covariates = None

  def _write_settings(self, working_dir: str, config: BenchmarkConfig) -> None:
    """Write a settings.yaml compatible with GraphRAG v3."""
    api_key = os.environ.get("GRAPHRAG_API_KEY") or os.environ.get("OPENAI_API_KEY", "")
    os.environ.setdefault("GRAPHRAG_API_KEY", api_key)

    # GraphRAG v3 internally does f"{model_provider}/{model}" to build
    # the litellm model string.  So model_provider must be the litellm
    # provider prefix (e.g. "openai") and model must be the bare name
    # (e.g. "gpt-4o-mini").  If the user already passes "openai/gpt-4o-mini"
    # we split it; otherwise we default to the "openai" provider.
    raw_model = config.openai_model
    raw_embed = config.embedding_model

    if "/" in raw_model:
      model_provider, model = raw_model.split("/", 1)
    else:
      model_provider, model = "openai", raw_model

    if "/" in raw_embed:
      embed_provider, embed_model = raw_embed.split("/", 1)
    else:
      embed_provider, embed_model = "openai", raw_embed

    # Embedding dimension lookup -- GraphRAG defaults to 3072 which only
    # matches text-embedding-3-large.  We must set it explicitly.
    _EMBED_DIMS = {
      "text-embedding-3-small": 1536,
      "text-embedding-3-large": 3072,
      "text-embedding-ada-002": 1536,
      "BAAI/bge-small-en-v1.5": 384,
      "BAAI/bge-base-en-v1.5": 768,
      "BAAI/bge-large-en-v1.5": 1024,
    }
    vector_size = _EMBED_DIMS.get(embed_model, 1536)

    # Build an index_schema entry for each embedding the pipeline creates
    _schema = {"vector_size": vector_size}
    vector_store_cfg = {
      "type": "lancedb",
      "db_uri": os.path.join("output", "lancedb"),
      "index_schema": {
        "entity_description": _schema,
        "community_full_content": _schema,
        "text_unit_text": _schema,
      },
    }

    settings = {
      "async_mode": "asyncio",
      "completion_models": {
        "default_completion_model": {
          "model_provider": model_provider,
          "model": model,
          "auth_method": "api_key",
          "api_key": "${GRAPHRAG_API_KEY}",
        },
      },
      "embedding_models": {
        "default_embedding_model": {
          "model_provider": embed_provider,
          "model": embed_model,
          "auth_method": "api_key",
          "api_key": "${GRAPHRAG_API_KEY}",
        },
      },
      "vector_store": vector_store_cfg,
      "input": {"type": "text"},
      "input_storage": {"type": "file", "base_dir": "input"},
      "output_storage": {"type": "file", "base_dir": "output"},
      "reporting": {"type": "file", "base_dir": "logs"},
      "cache": {
        "type": "json",
        "storage": {"type": "file", "base_dir": "cache"},
      },
      "chunking": {
        "type": "tokens",
        "size": config.chunk_size,
        "overlap": config.chunk_overlap,
      },
      "extract_graph": {
        "completion_model_id": "default_completion_model",
        "entity_types": ["organization", "person", "geo", "event"],
        "max_gleanings": 1,
      },
      "community_reports": {
        "completion_model_id": "default_completion_model",
        "max_length": 2000,
        "max_input_length": 8000,
      },
      "local_search": {
        "completion_model_id": "default_completion_model",
        "embedding_model_id": "default_embedding_model",
      },
      "global_search": {
        "completion_model_id": "default_completion_model",
      },
    }

    settings_path = os.path.join(working_dir, "settings.yaml")
    with open(settings_path, "w") as f:
      yaml.dump(settings, f, default_flow_style=False)

  async def _load_output_tables(self) -> None:
    """Load parquet output tables from the index for querying."""
    from graphrag.data_model.data_reader import DataReader
    from graphrag_storage import create_storage
    from graphrag_storage.tables.table_provider_factory import create_table_provider

    storage_obj = create_storage(self._config.output_storage)
    table_provider = create_table_provider(self._config.table_provider, storage=storage_obj)
    reader = DataReader(table_provider)

    self._entities = await reader.entities()
    self._communities = await reader.communities()
    self._community_reports = await reader.community_reports()
    self._text_units = await reader.text_units()
    self._relationships = await reader.relationships()

    has_covariates = await table_provider.has("covariates")
    self._covariates = await reader.covariates() if has_covariates else None

  async def create_index(self, chunks: list[Chunk], working_dir: str, config: BenchmarkConfig) -> IndexResult:
    """Write the corpus and run the GraphRAG v3 indexing pipeline.

    GraphRAG does its own token-based chunking internally, so we join the
    pre-split chunks back into a single document and let the pipeline handle it.
    """
    from graphrag.api import build_index
    from graphrag.config.load_config import load_config

    texts = [c.text for c in chunks]

    self._working_dir = working_dir

    # Write the full corpus as a single input file -- GraphRAG does its own chunking
    input_dir = os.path.join(working_dir, "input")
    os.makedirs(input_dir, exist_ok=True)
    with open(os.path.join(input_dir, "corpus.txt"), "w") as f:
      f.write("\n\n".join(texts))

    # Write settings.yaml
    self._write_settings(working_dir, config)

    tracker = _LiteLLMCostTracker()
    tracker.install()
    try:
      self._config = load_config(root_dir=working_dir)
      start = time.perf_counter()
      results = await build_index(self._config)
      elapsed = time.perf_counter() - start
      snap = tracker.snapshot()
    finally:
      tracker.uninstall()

    # Check for pipeline errors
    for r in results:
      if r.error:
        print(f"    [graphrag] Pipeline error in {r.workflow}: {r.error}")

    # Load output tables for querying
    await self._load_output_tables()

    return IndexResult(
      time_seconds=elapsed,
      cost_usd=snap["total_cost_usd"],
      tokens_input=snap["input_tokens"],
      tokens_output=snap["output_tokens"],
    )

  async def load_index(self, working_dir: str, config: BenchmarkConfig) -> None:
    """Load an existing GraphRAG workspace from disk."""
    from graphrag.config.load_config import load_config

    self._working_dir = working_dir
    if not os.environ.get("GRAPHRAG_API_KEY"):
      os.environ["GRAPHRAG_API_KEY"] = os.environ.get("OPENAI_API_KEY", "")

    self._config = load_config(root_dir=working_dir)
    await self._load_output_tables()

  async def query(self, question: str, config: BenchmarkConfig) -> QueryResult:
    """Query using GraphRAG local search."""
    from graphrag.api import local_search

    tracker = _LiteLLMCostTracker()
    tracker.install()
    try:
      start = time.perf_counter()
      response, context_data = await local_search(
        config=self._config,
        entities=self._entities,
        communities=self._communities,
        community_reports=self._community_reports,
        text_units=self._text_units,
        relationships=self._relationships,
        covariates=self._covariates,
        community_level=2,
        response_type="multiple paragraphs",
        query=question,
      )
      elapsed = time.perf_counter() - start
      snap = tracker.snapshot()
    finally:
      tracker.uninstall()

    answer_text = response if isinstance(response, str) else str(response)

    # Extract context strings from context_data
    contexts = []
    if isinstance(context_data, dict):
      for key, val in context_data.items():
        if isinstance(val, pd.DataFrame) and not val.empty:
          contexts.append(val.to_string(max_rows=20))
        elif isinstance(val, str):
          contexts.append(val)
    elif isinstance(context_data, str):
      contexts = [context_data]

    return QueryResult(
      answer=answer_text,
      contexts=contexts[:5],
      latency_seconds=elapsed,
      tokens_input=snap["input_tokens"],
      tokens_output=snap["output_tokens"],
      cost_usd=snap["total_cost_usd"],
    )
