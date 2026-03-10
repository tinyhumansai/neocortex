"""Shared types for the benchmark suite."""

from __future__ import annotations

from dataclasses import dataclass, field, fields


@dataclass
class Chunk:
  """A single chunk of corpus text with positional metadata."""

  text: str
  index: int
  offset: int
  source: str = ""
  char_length: int = field(init=False)

  def __post_init__(self):
    self.char_length = len(self.text)

  def __str__(self) -> str:
    return self.text


@dataclass
class QueryResult:
  """Result from a single query."""

  answer: str = ""
  contexts: list[str] = field(default_factory=list)
  latency_seconds: float = 0.0
  tokens_input: int = 0
  tokens_output: int = 0
  cost_usd: float = 0.0


@dataclass
class IndexResult:
  """Result from indexing."""

  time_seconds: float = 0.0
  cost_usd: float = 0.0
  tokens_input: int = 0
  tokens_output: int = 0


@dataclass
class BenchmarkConfig:
  """Typed configuration for a benchmark run.

  Supports dict-like access (``get``, ``[]``, ``setdefault``, ``items``) so
  that legacy adapters using ``config.get("key", default)`` continue to work.
  """

  corpus: str = "sherlock_holmes"
  corpus_path: str = ""
  corpus_file_ext: str = ""
  _corpus_full_text: str = ""
  testset_path: str = ""
  methods: list[str] = field(default_factory=list)
  max_questions: int = 0
  top_k: int = 8
  chunk_size: int = 1200
  chunk_overlap: int = 200
  openai_model: str = "gpt-4o-mini"
  embedding_model: str = "text-embedding-3-small"
  gemini_model: str = "gemini-3.1-pro-preview"
  ragas_judge_model: str = "gpt-4o"
  ragas_metrics: list[str] = field(
    default_factory=lambda: ["faithfulness", "answer_relevancy", "context_precision", "context_recall"]
  )
  compression_backend: str = "none"
  workspace_suffix: str = ""
  max_corpus_chars: int = 0
  _extra: dict = field(default_factory=dict, repr=False)

  # -- construction helpers --------------------------------------------------

  @classmethod
  def from_dict(cls, d: dict) -> BenchmarkConfig:
    """Build from a plain dict, silently ignoring unknown keys."""
    known = {f.name for f in fields(cls) if f.name != "_extra"}
    init_kwargs: dict = {}
    extra: dict = {}
    for k, v in d.items():
      if k in known:
        init_kwargs[k] = v
      else:
        extra[k] = v
    cfg = cls(**init_kwargs)
    cfg._extra = extra
    return cfg

  def to_dict(self) -> dict:
    """Serialise to a plain dict, excluding ``_``-prefixed fields."""
    result: dict = {}
    for f in fields(self):
      if f.name.startswith("_"):
        continue
      result[f.name] = getattr(self, f.name)
    result.update(self._extra)
    return result

  # -- dict-like access for backward compatibility ---------------------------

  def get(self, key: str, default=None):
    try:
      return self[key]
    except KeyError:
      return default

  def __getitem__(self, key: str):
    for f in fields(self):
      if f.name == key:
        return getattr(self, key)
    if key in self._extra:
      return self._extra[key]
    raise KeyError(key)

  def __setitem__(self, key: str, value):
    for f in fields(self):
      if f.name == key:
        setattr(self, key, value)
        return
    self._extra[key] = value

  def __contains__(self, key: str) -> bool:
    for f in fields(self):
      if f.name == key:
        return True
    return key in self._extra

  def setdefault(self, key: str, default=None):
    try:
      return self[key]
    except KeyError:
      self[key] = default
      return default

  def items(self):
    d: dict = {}
    for f in fields(self):
      if f.name == "_extra":
        continue
      d[f.name] = getattr(self, f.name)
    d.update(self._extra)
    return d.items()
