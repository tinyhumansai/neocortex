"""GPT-5.2 VDB adapter -- VDB retrieval + GPT-5.2 answers."""

from ._base import IndexResult, MethodAdapter, QueryResult
from ..types import BenchmarkConfig, Chunk
from .vdb import VDBAdapter


class GPT52VDBAdapter(MethodAdapter):
  """Adapter for VDB retrieval with GPT-5.2 as the answering model."""

  name = "gpt52_vdb"

  def __init__(self):
    """Initialize the GPT-5.2 VDB adapter."""
    self._vdb = VDBAdapter()

  async def create_index(self, chunks: list[Chunk], working_dir: str, config: BenchmarkConfig) -> IndexResult:
    """Delegate indexing to the shared VDB adapter."""
    return await self._vdb.create_index(chunks, working_dir, config)

  async def load_index(self, working_dir: str, config: BenchmarkConfig) -> None:
    """Load an existing VDB index via the shared VDB adapter."""
    await self._vdb.load_index(working_dir, config)

  async def query(self, question: str, config: BenchmarkConfig) -> QueryResult:
    """Retrieve context from VDB and answer using GPT-5.2."""
    from dataclasses import replace

    gpt52_config = replace(config, openai_model=config.get("openai_model", "gpt-5.2"))
    return await self._vdb.query(question, gpt52_config)
