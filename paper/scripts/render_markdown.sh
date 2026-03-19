#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p out

if ! command -v pandoc >/dev/null 2>&1; then
  echo "pandoc is required for Markdown rendering. Install it (e.g. brew install pandoc)." >&2
  exit 1
fi

TITLE_RAW="$(sed -n 's/^\\title{\(.*\)}/\1/p' main.tex | sed -n '1p')"
TITLE_MAIN="$(printf '%s' "$TITLE_RAW" | sed -E 's/\\\\\\large.*$//; s/\\\\/ /g; s/[[:space:]]+/ /g; s/^[[:space:]]+|[[:space:]]+$//g')"
TITLE_SUB="$(printf '%s' "$TITLE_RAW" | sed -n -E 's/^.*\\\\\\large[[:space:]]*//p' | sed -E 's/\\\\/ /g; s/[[:space:]]+/ /g; s/^[[:space:]]+|[[:space:]]+$//g')"
AUTHOR_BLOCK="$(awk '/^\\author\{/{in_author=1; next} in_author && /^\}/{in_author=0; exit} in_author {print}' main.tex)"
AUTHORS_LINES="$(printf '%s\n' "$AUTHOR_BLOCK" | sed -E 's/\\texttt\{([^}]*)\}/\1/g; s/[[:space:]]*\\\\[[:space:]]*$//g; s/^[[:space:]]+|[[:space:]]+$//g' | awk 'NF')"
AUTHORS_HTML="$(printf '%s\n' "$AUTHORS_LINES" | awk '
  {
    line[NR % 3] = $0
    if (NR % 3 == 0) {
      name = line[1]
      company = line[2]
      email = line[0]
      printf "<a href=\"mailto:%s\">%s (%s)</a>\n", email, name, company
    }
  }
')"

TMP_BODY="$(mktemp)"
TMP_MD="$(mktemp)"
TMP_ABSTRACT_TEX="$(mktemp)"
TMP_ABSTRACT_MD="$(mktemp)"
trap 'rm -f "$TMP_BODY" "$TMP_MD" "$TMP_ABSTRACT_TEX" "$TMP_ABSTRACT_MD"' EXIT

awk '/\\begin\{document\}/{in_doc=1; next} /\\end\{document\}/{in_doc=0} in_doc' main.tex > "$TMP_BODY"

# Extract and convert abstract separately so README has a clean metadata block.
awk '/\\begin\{abstract\}/{in_abs=1; next} /\\end\{abstract\}/{in_abs=0} in_abs' main.tex > "$TMP_ABSTRACT_TEX"
if [ -s "$TMP_ABSTRACT_TEX" ]; then
  perl -0777 -i -pe 's/\{\\small\s*//g; s/\\begin\{minipage\}\{[^}]*\}//g; s/\\end\{minipage\}//g; s/\\noindent\s*//g; s/\\\\\s*/\n\n/g;' "$TMP_ABSTRACT_TEX"
  sed -i '' '/^[[:space:]]*}[[:space:]]*$/d' "$TMP_ABSTRACT_TEX"
  pandoc \
    "$TMP_ABSTRACT_TEX" \
    --from=latex \
    --to=gfm+tex_math_dollars \
    --wrap=none \
    --output="$TMP_ABSTRACT_MD"
fi

# Keep only the main body; drop title/abstract commands from conversion input.
perl -0777 -i -pe 's/\\maketitle\s*//g; s/\\begin\{abstract\}.*?\\end\{abstract\}\s*//gs' "$TMP_BODY"

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
  if [ -n "$TITLE_MAIN" ]; then
    echo "# $TITLE_MAIN"
    echo
  fi
  if [ -n "$TITLE_SUB" ]; then
    echo "$TITLE_SUB"
    echo
  fi
  if [ -n "$AUTHORS_HTML" ]; then
    echo "### Authors"
    echo
    printf '%s\n' "$AUTHORS_HTML" | sed 's/^/- /'
    echo
  fi
  echo "### Table of contents"
  echo
  TOC_FLAGS=()
  if [ -s "$TMP_ABSTRACT_MD" ]; then
    TOC_FLAGS+=(--include-abstract)
  fi
  python3 "$ROOT_DIR/scripts/markdown_toc.py" "${TOC_FLAGS[@]}" "$TMP_MD"
  echo
  if [ -s "$TMP_ABSTRACT_MD" ]; then
    echo "# Abstract"
    echo
    cat "$TMP_ABSTRACT_MD"
    echo
  fi

  cat "$TMP_MD"
} | sed '/^[[:space:]]*$/N;/^\n$/D' > README.md

rm -f out/main.md

echo "Markdown render complete: $ROOT_DIR/README.md"
