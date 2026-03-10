"""Corpus chunking utilities."""

from __future__ import annotations

from .types import Chunk


def chunk_corpus(
  text: str,
  chunk_size: int = 1200,
  chunk_overlap: int = 200,
  source: str = "",
) -> list[Chunk]:
  """Split *text* into overlapping :class:`Chunk` objects."""
  chunks: list[Chunk] = []
  start = 0
  idx = 0
  while start < len(text):
    end = start + chunk_size
    piece = text[start:end].strip()
    if piece:
      chunks.append(Chunk(text=piece, index=idx, offset=start, source=source))
      idx += 1
    start += chunk_size - chunk_overlap
  return chunks
