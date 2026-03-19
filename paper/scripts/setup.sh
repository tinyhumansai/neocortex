#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$ROOT_DIR/out" "$ROOT_DIR/figures"

if ! command -v latexmk >/dev/null 2>&1; then
  echo "latexmk is not installed."
else
  echo "latexmk found: $(command -v latexmk)"
fi

if ! command -v tectonic >/dev/null 2>&1; then
  echo "tectonic is not installed. Install with: brew install tectonic"
else
  echo "tectonic found: $(command -v tectonic)"
fi

if ! command -v pandoc >/dev/null 2>&1; then
  echo "pandoc is not installed. Install with: brew install pandoc"
else
  echo "pandoc found: $(command -v pandoc)"
fi

if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo "rsvg-convert is not installed (needed for SVG→PNG figures). Install with: brew install librsvg"
else
  echo "rsvg-convert found: $(command -v rsvg-convert)"
fi

echo "Paper workspace initialized at: $ROOT_DIR"
