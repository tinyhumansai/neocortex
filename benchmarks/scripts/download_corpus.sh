#!/usr/bin/env bash
# Download "The Adventures of Sherlock Holmes" from Project Gutenberg
# and strip the Gutenberg header/footer.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORPUS_DIR="$SCRIPT_DIR/corpus"
OUTPUT="$CORPUS_DIR/adventures_of_sherlock_holmes.txt"
URL="https://www.gutenberg.org/cache/epub/1661/pg1661.txt"

mkdir -p "$CORPUS_DIR"

echo "Downloading The Adventures of Sherlock Holmes..."
curl -sL "$URL" -o "$CORPUS_DIR/_raw.txt"

echo "Stripping Gutenberg header and footer..."
# Extract text between the START and END markers, dropping both marker lines.
# Uses awk for portability (BSD head doesn't support negative line counts).
awk '
  /^\*\*\* END OF THE PROJECT GUTENBERG EBOOK/ { found_end=1; next }
  found_end { next }
  printing { print }
  /^\*\*\* START OF THE PROJECT GUTENBERG EBOOK/ { printing=1 }
' "$CORPUS_DIR/_raw.txt" > "$OUTPUT"

rm -f "$CORPUS_DIR/_raw.txt"

LINES=$(wc -l < "$OUTPUT")
WORDS=$(wc -w < "$OUTPUT")
echo "Done: $OUTPUT ($LINES lines, $WORDS words)"
