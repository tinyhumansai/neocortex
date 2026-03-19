#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p out

if ! command -v pandoc >/dev/null 2>&1; then
  echo "pandoc is required for Markdown rendering. Install it (e.g. brew install pandoc)." >&2
  exit 1
fi

TITLE="$(sed -n 's/^\\title{\(.*\)}/\1/p' main.tex | sed -n '1p')"
AUTHOR="$(sed -n 's/^\\author{\(.*\)}/\1/p' main.tex | sed -n '1p')"
TITLE_CLEAN="$(printf '%s' "$TITLE" | sed -E 's/\\large[[:space:]]*//g; s/\\\\/ /g; s/[[:space:]]+/ /g; s/^[[:space:]]+|[[:space:]]+$//g')"
AUTHOR_CLEAN="$(printf '%s' "$AUTHOR" | sed 's/\\\\/ /g')"

TMP_BODY="$(mktemp)"
TMP_MD="$(mktemp)"
trap 'rm -f "$TMP_BODY" "$TMP_MD"' EXIT

awk '/\\begin\{document\}/{in_doc=1; next} /\\end\{document\}/{in_doc=0} in_doc' main.tex > "$TMP_BODY"

# Convert LaTeX body to GitHub-flavored Markdown.
pandoc \
  "$TMP_BODY" \
  --from=latex \
  --to=gfm+tex_math_dollars \
  --wrap=none \
  --citeproc \
  --bibliography=references.bib \
  --output="$TMP_MD"

{
  if [ -n "$TITLE_CLEAN" ]; then
    echo "# $TITLE_CLEAN"
    echo
  fi
  if [ -n "$AUTHOR_CLEAN" ]; then
    echo "_Author: $AUTHOR_CLEAN_"
    echo
  fi

  cat "$TMP_MD"
} | sed '/^[[:space:]]*$/N;/^\n$/D' > README.md

rm -f out/main.md

echo "Markdown render complete: $ROOT_DIR/README.md"
