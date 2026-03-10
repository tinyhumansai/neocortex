"""Vector Database RAG adapter."""

import asyncio
import os
import time
from typing import Any

from ._base import IndexResult, MethodAdapter, QueryResult
from ..types import BenchmarkConfig, Chunk


class VDBAdapter(MethodAdapter):
  """Adapter for the Vector Database RAG implementation."""

  name = "vdb"

  def __init__(self):
    """Initialize the VDB adapter."""
    self._storage = None
    self._workspace = None
    self._working_dir = None
    self._query_session_open = False

  async def create_index(self, chunks: list[Chunk], working_dir: str, config: BenchmarkConfig) -> IndexResult:
    """Build a simple vector database over the chunks and return indexing metrics."""
    import xxhash

    from neocortex._llm._base import token_tracker
    from neocortex._storage._namespace import Workspace

    texts = [c.text for c in chunks]

    self._working_dir = working_dir
    os.makedirs(working_dir, exist_ok=True)
    token_tracker.reset()

    workspace = Workspace(working_dir)
    storage = self._make_storage(workspace)

    start = time.perf_counter()
    await storage.insert_start()
    ids = [xxhash.xxh64(t.encode()).intdigest() for t in texts]
    data = [(t[:80], t) for t in texts]
    embeddings = await storage.embedder.encode([f"{t}\n\n{c}" for t, c in data])
    await storage.ikv.upsert([int(i) for i in ids], data)
    await storage.vdb.upsert(ids, embeddings)
    await storage.insert_done()
    elapsed = time.perf_counter() - start

    result = IndexResult(
      time_seconds=elapsed,
      cost_usd=token_tracker.total_cost,
      tokens_input=token_tracker.llm_input_tokens + token_tracker.embedding_input_tokens,
      tokens_output=token_tracker.llm_output_tokens,
    )

    # Create a fresh instance for querying (like neocortex pattern)
    await self._open_query_session(working_dir)
    return result

  def _make_storage(self, workspace):
    """Construct a small helper object that owns VDB, embeddings, and IKV stores."""
    from neocortex._llm._llm_openai import OpenAIEmbeddingService
    from neocortex._storage._ikv_pickle import PickleIndexedKeyValueStorage
    from neocortex._storage._vdb_hnswlib import HNSWVectorStorage, HNSWVectorStorageConfig

    class _Storage:
      def __init__(self, ws):
        self.workspace = ws
        self.vdb = HNSWVectorStorage[int, Any](
          config=HNSWVectorStorageConfig(ef_construction=96, ef_search=48),
          namespace=ws.make_for("vdb"),
          embedding_dim=1536,
        )
        self.embedder = OpenAIEmbeddingService()
        self.ikv = PickleIndexedKeyValueStorage[int, Any](config=None, namespace=ws.make_for("ikv"))

      async def insert_start(self):
        storages = [self.ikv, self.vdb]

        async def _fn():
          return await asyncio.gather(*[s.insert_start() for s in storages])

        await self.workspace.with_checkpoints(_fn)
        for s in storages:
          s.set_in_progress(True)

      async def insert_done(self):
        storages = [self.ikv, self.vdb]
        await asyncio.gather(*[s.insert_done() for s in storages])
        for s in storages:
          s.set_in_progress(False)

      async def query_start(self):
        storages = [self.ikv, self.vdb]

        async def _fn():
          return await asyncio.gather(*[s.query_start() for s in storages])

        await self.workspace.with_checkpoints(_fn)
        for s in storages:
          s.set_in_progress(True)

      async def query_done(self):
        storages = [self.ikv, self.vdb]
        await asyncio.gather(*[s.query_done() for s in storages])
        for s in storages:
          s.set_in_progress(False)

      async def get_context(self, query_text: str, top_k: int):
        import numpy as np

        embedding = await self.embedder.encode([query_text])
        ids, _ = await self.vdb.get_knn(embedding, top_k)
        return [c for c in await self.ikv.get([int(i) for i in np.array(ids).flatten()]) if c is not None]

    return _Storage(workspace)

  async def _open_query_session(self, working_dir: str) -> None:
    """Create a fresh workspace/storage and open query session once."""
    from neocortex._storage._namespace import Workspace

    if self._query_session_open and self._storage:
      await self._storage.query_done()
      self._query_session_open = False

    self._workspace = Workspace(working_dir)
    self._storage = self._make_storage(self._workspace)
    await self._storage.query_start()
    self._query_session_open = True

  async def load_index(self, working_dir: str, config: BenchmarkConfig) -> None:
    self._working_dir = working_dir
    await self._open_query_session(working_dir)

  async def query(self, question: str, config: BenchmarkConfig) -> QueryResult:
    """Retrieve context from the VDB and answer using the Neocortex OpenAI LLM service."""
    from neocortex._llm._base import token_tracker
    from neocortex._llm._llm_openai import OpenAILLMService
    from neocortex._models import TAnswer

    top_k = config.top_k
    model = config.openai_model
    token_tracker.reset()

    start = time.perf_counter()
    chunks = await self._storage.get_context(question, top_k)

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

    llm = OpenAILLMService(model=model)
    response, _ = await llm.send_message(prompt=prompt, response_model=TAnswer)
    elapsed = time.perf_counter() - start

    contexts = [content for _, content in chunks]
    return QueryResult(
      answer=response.answer,
      contexts=contexts,
      latency_seconds=elapsed,
      tokens_input=token_tracker.llm_input_tokens + token_tracker.embedding_input_tokens,
      tokens_output=token_tracker.llm_output_tokens,
      cost_usd=token_tracker.total_cost,
    )
