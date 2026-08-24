#!/usr/bin/env bash
#
# Self-host the Protomaps basemap glyphs (label fonts) + sprite (icons) so the
# map makes zero third-party requests. Downloads into
# frontend/public/basemaps-assets/, which is committed to the repo and baked
# into the frontend image at build time.
#
# Run once (and again only if the map style's font stacks change):
#   ./scripts/fetch-basemap-assets.sh
#
# The tiles themselves (frontend/public/region.pmtiles) are handled separately
# by the pmtiles CLI — see the README.

set -euo pipefail

BASE="https://protomaps.github.io/basemaps-assets"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="$SCRIPT_DIR/../frontend/public/basemaps-assets"

# Font stacks the Protomaps "light" flavor requests (see lib/map/basemap.ts).
FONTSTACKS=("Noto Sans Regular" "Noto Sans Medium" "Noto Sans Italic")

# Unicode ranges to mirror per stack. 0-255 = Basic Latin + Latin-1 (covers
# äöüß); 256-511 = Latin Extended-A; 8192-8447 = General Punctuation (typographic
# quotes/dashes). Enough for German place labels; add more here if a glyph is
# ever missing — MapLibre just skips ranges it can't fetch.
RANGES=("0-255" "256-511" "8192-8447")

echo "Downloading glyphs → $DEST/fonts"
for stack in "${FONTSTACKS[@]}"; do
  enc="${stack// /%20}"                 # URL-encode the spaces for the request
  mkdir -p "$DEST/fonts/$stack"         # keep the literal spaces on disk
  for range in "${RANGES[@]}"; do
    url="$BASE/fonts/$enc/$range.pbf"
    out="$DEST/fonts/$stack/$range.pbf"
    if curl -fsSL "$url" -o "$out"; then
      echo "  ✓ $stack/$range.pbf"
    else
      echo "  – skip $stack/$range.pbf (not published)"
      rm -f "$out"
    fi
  done
done

echo "Downloading sprite → $DEST/sprites/v4"
mkdir -p "$DEST/sprites/v4"
for f in light.json light.png light@2x.json light@2x.png; do
  if curl -fsSL "$BASE/sprites/v4/$f" -o "$DEST/sprites/v4/$f"; then
    echo "  ✓ $f"
  else
    echo "  ✗ FAILED $f" >&2
  fi
done

echo
echo "Done. Assets in frontend/public/basemaps-assets/ — commit them, then"
echo "rebuild the frontend. The map now serves fonts + sprite from your origin."
