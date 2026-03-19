#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Keep PNG figures in sync with SVG sources before compiling.
"$ROOT_DIR/scripts/export-svgs-to-png.sh"

if command -v latexmk >/dev/null 2>&1; then
  latexmk -pdf -interaction=nonstopmode -halt-on-error -output-directory=out main.tex
  echo "Build complete via latexmk: $ROOT_DIR/out/main.pdf"
  exit 0
fi

if command -v tectonic >/dev/null 2>&1; then
  tectonic --outdir out main.tex
  echo "Build complete via tectonic: $ROOT_DIR/out/main.pdf"
  exit 0
fi

echo "No LaTeX builder found. Install one of:"
echo "  - latexmk (MacTeX/TeX Live)"
echo "  - tectonic (brew install tectonic)"
exit 1
