"""Adapter registry for generic (non-benchmark-specific) RAG method adapters.

Adapter imports are lazy so that only the dependencies for the requested
method need to be installed.
"""

from __future__ import annotations

import importlib

from ._base import IndexResult, MethodAdapter, QueryResult
from ..types import BenchmarkConfig, Chunk

# Maps method name -> (module_path, class_name, package, legacy).
# *legacy* adapters receive ``list[str]`` / ``dict`` instead of
# ``list[Chunk]`` / ``BenchmarkConfig``.
_ADAPTER_REGISTRY: dict[str, tuple[str, str, str, bool]] = {
  "vdb": (".vdb", "VDBAdapter", __name__, False),
  "directfeed": (".directfeed", "DirectFeedAdapter", __name__, False),
  "lightrag": (".lightrag_adapter", "LightRAGAdapter", __name__, False),
  "fast_graphrag": (".fast_graphrag_adapter", "FastGraphRAGAdapter", __name__, False),
  "nano_graphrag": (".nano_graphrag", "NanoGraphRAGAdapter", __name__, False),
  "graphrag": (".graphrag", "GraphRAGAdapter", __name__, False),
  "cognee": (".cognee", "CogneeAdapter", __name__, False),
  "gpt52_vdb": (".gpt52_vdb", "GPT52VDBAdapter", __name__, False),
  "gemini_vdb": (".gemini_vdb", "GeminiVDBAdapter", __name__, False),
}

ADAPTER_NAMES: list[str] = list(_ADAPTER_REGISTRY.keys())


def register_adapter(
  name: str,
  module: str,
  class_name: str,
  *,
  package: str | None = None,
  legacy: bool = False,
) -> None:
  """Register an adapter for lazy import.

  Parameters
  ----------
  name:
      Method name used on the CLI.
  module:
      Dotted module path (relative imports ok, resolved against *package*).
  class_name:
      Class to instantiate inside *module*.
  package:
      Package context for relative imports.  Defaults to this package.
  legacy:
      If ``True``, the adapter expects ``list[str]`` / ``dict`` and will be
      automatically wrapped to accept ``list[Chunk]`` / ``BenchmarkConfig``.
  """
  _ADAPTER_REGISTRY[name] = (module, class_name, package or __name__, legacy)
  if name not in ADAPTER_NAMES:
    ADAPTER_NAMES.append(name)


class _LegacyAdapterWrapper(MethodAdapter):
  """Thin shim that converts new-style args to old-style before delegating."""

  def __init__(self, inner: MethodAdapter):
    self._inner = inner
    self.name = inner.name

  async def create_index(self, chunks, working_dir, config):
    texts = [c.text if isinstance(c, Chunk) else c for c in chunks]
    cfg = config.to_dict() if isinstance(config, BenchmarkConfig) else config
    return await self._inner.create_index(texts, working_dir, cfg)

  async def query(self, question, config):
    cfg = config.to_dict() if isinstance(config, BenchmarkConfig) else config
    return await self._inner.query(question, cfg)

  async def load_index(self, working_dir, config):
    cfg = config.to_dict() if isinstance(config, BenchmarkConfig) else config
    return await self._inner.load_index(working_dir, cfg)


def get_adapter(name: str) -> MethodAdapter:
  """Get an adapter instance by name (lazy-imports the adapter module)."""
  entry = _ADAPTER_REGISTRY.get(name)
  if entry is None:
    raise ValueError(f"Unknown method: {name}. Available: {ADAPTER_NAMES}")
  module_path, class_name, package, legacy = entry
  mod = importlib.import_module(module_path, package=package)
  cls = getattr(mod, class_name)
  instance = cls()
  if legacy:
    instance = _LegacyAdapterWrapper(instance)
  return instance


__all__ = [
  "ADAPTER_NAMES",
  "get_adapter",
  "register_adapter",
  "IndexResult",
  "MethodAdapter",
  "QueryResult",
]
