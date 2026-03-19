#!/usr/bin/env python3
"""
Emit a GitHub-flavored Markdown TOC (nested bullets + anchors) for paper/README.md.
Anchor slugs approximate github.com heading IDs (ASCII titles).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path


def slugify(text: str) -> str:
    text = text.strip()
    text = re.sub(r"<[^>]+>", "", text)
    text = text.lower()
    text = re.sub(r"[''`]", "", text)
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-") or "section"


def unique_slug(title: str, counts: dict[str, int]) -> str:
    base = slugify(title)
    n = counts.get(base, 0)
    counts[base] = n + 1
    if n == 0:
        return base
    return f"{base}-{n}"


def parse_headings(md: str) -> list[tuple[int, str]]:
    entries: list[tuple[int, str]] = []
    for line in md.splitlines():
        m = re.match(r"^(#{1,6})\s+(.+?)\s*$", line)
        if not m:
            continue
        level = len(m.group(1))
        title = m.group(2).strip()
        title = re.sub(r"\s*\{#[^}]+\}\s*$", "", title)
        title = re.sub(r"\s+\{#[^}]+$", "", title)
        if title:
            entries.append((level, title))
    return entries


def main() -> None:
    argv = [a for a in sys.argv[1:] if a]
    include_abstract = False
    paths: list[str] = []
    for a in argv:
        if a == "--include-abstract":
            include_abstract = True
        else:
            paths.append(a)
    if len(paths) != 1:
        print(
            "Usage: markdown_toc.py [--include-abstract] body.md",
            file=sys.stderr,
        )
        sys.exit(1)
    path = Path(paths[0])
    text = path.read_text(encoding="utf-8")
    entries: list[tuple[int, str]] = []
    if include_abstract:
        entries.append((1, "Abstract"))
    entries.extend(parse_headings(text))
    counts: dict[str, int] = {}
    for level, title in entries:
        aid = unique_slug(title, counts)
        safe = title.replace("]", "\\]")
        indent = "  " * (level - 1)
        print(f"{indent}- [{safe}](#{aid})")


if __name__ == "__main__":
    main()
