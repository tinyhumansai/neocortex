#!/usr/bin/env bash
# Convert paper/figures/*.svg to same-named PNG (rsvg-convert; brew: librsvg).
# Export width = 2 × SVG width="..." for sharper PDF inclusion.
#
#   ./scripts/export-svgs-to-png.sh              # all figures/*.svg
#   ./scripts/export-svgs-to-png.sh stem-name    # optional stems (no .svg)
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIG_DIR="$ROOT_DIR/figures"

if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo "error: rsvg-convert not found. Install librsvg (e.g. brew install librsvg)." >&2
  exit 1
fi

svg_intrinsic_width() {
  local svg="$1"
  local w
  w=$(head -n 12 "$svg" | sed -n 's/.*width="\([0-9][0-9]*\)".*/\1/p' | head -1)
  if [[ -z "$w" ]]; then
    echo 800
  else
    echo "$w"
  fi
}

convert_one() {
  local stem="$1"
  local svg="$FIG_DIR/${stem}.svg"
  local png="$FIG_DIR/${stem}.png"
  if [[ ! -f "$svg" ]]; then
    echo "error: missing $svg" >&2
    return 1
  fi
  local iw out_w
  iw="$(svg_intrinsic_width "$svg")"
  out_w=$((iw * 2))
  rsvg-convert -w "$out_w" -o "$png" "$svg"
  echo "  $stem.svg → $stem.png (${out_w}px)"
}

if [[ "$#" -gt 0 ]]; then
  for arg in "$@"; do
    stem="${arg%.svg}"
    stem="${stem##*/}"
    convert_one "$stem"
  done
else
  shopt -s nullglob
  svgs=("$FIG_DIR"/*.svg)
  if [[ ${#svgs[@]} -eq 0 ]]; then
    echo "No SVG files in $FIG_DIR"
    exit 0
  fi
  echo "Exporting SVG → PNG in $FIG_DIR ..."
  for svg in "${svgs[@]}"; do
    stem="$(basename "$svg" .svg)"
    convert_one "$stem"
  done
fi
