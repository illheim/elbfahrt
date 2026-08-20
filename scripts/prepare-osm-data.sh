#!/usr/bin/env bash
# =============================================================================
#  prepare-osm-data.sh
#  Lädt Niedersachsen + Hamburg + Schleswig-Holstein von Geofabrik herunter,
#  führt sie zusammen und schneidet auf einen 100-km-Radius um PLZ 21423
#  (Winsen/Luhe) zu — Eingabe für Nominatim und OSRM.
#
#  Voraussetzung: osmium-tool (macOS: brew install osmium-tool)
#                 Docker (für OSRM-Preprocessing)
#
#  Laufzeit: ~10–15 Min beim ersten Mal (Download + Merge + OSRM-Prep)
# =============================================================================
set -euo pipefail

# Skript läuft relativ zum Projekt-Root (elbfahrt.xyz/)
cd "$(dirname "$0")/.."

OSM_DIR="osrm-data"
mkdir -p "$OSM_DIR"
cd "$OSM_DIR"

# -----------------------------------------------------------------------------
# 1) Geofabrik-Extracts herunterladen (nur falls noch nicht vorhanden)
# -----------------------------------------------------------------------------
download_if_missing() {
  local file="$1"
  local url="$2"
  if [[ -f "$file" ]]; then
    echo "✓ $file existiert bereits — überspringe Download"
  else
    echo "↓ Lade $file …"
    curl -L --fail -o "$file" "$url"
  fi
}

download_if_missing niedersachsen-latest.osm.pbf \
  https://download.geofabrik.de/europe/germany/niedersachsen-latest.osm.pbf
download_if_missing hamburg-latest.osm.pbf \
  https://download.geofabrik.de/europe/germany/hamburg-latest.osm.pbf
download_if_missing schleswig-holstein-latest.osm.pbf \
  https://download.geofabrik.de/europe/germany/schleswig-holstein-latest.osm.pbf

# -----------------------------------------------------------------------------
# 2) Mergen
# -----------------------------------------------------------------------------
echo "⊕ Merge Niedersachsen + Hamburg + Schleswig-Holstein …"
osmium merge \
  niedersachsen-latest.osm.pbf \
  hamburg-latest.osm.pbf \
  schleswig-holstein-latest.osm.pbf \
  --overwrite \
  -o north-germany.osm.pbf

# -----------------------------------------------------------------------------
# 3) Auf 100-km-Bounding-Box um 21423 Winsen (Luhe) zuschneiden
#    Zentrum: 53.357° N, 10.213° E
#    Bbox:    lon 8.71 / lat 52.46 / lon 11.71 / lat 54.26
# -----------------------------------------------------------------------------
echo "✂  Schneide auf 100-km-Bbox um 21423 zu …"
osmium extract \
  -b 8.71,52.46,11.71,54.26 \
  --overwrite \
  north-germany.osm.pbf \
  -o elbfahrt-region.osm.pbf

echo "✓ elbfahrt-region.osm.pbf erstellt — $(du -h elbfahrt-region.osm.pbf | cut -f1)"

# -----------------------------------------------------------------------------
# 4) OSRM-Preprocessing (extract / partition / customize)
# -----------------------------------------------------------------------------
echo "⚙  OSRM-Preprocessing (Docker, ~5 Min) …"
docker run --rm -t -v "$(pwd):/data" osrm/osrm-backend \
  osrm-extract -p /opt/car.lua /data/elbfahrt-region.osm.pbf
docker run --rm -t -v "$(pwd):/data" osrm/osrm-backend \
  osrm-partition /data/elbfahrt-region.osrm
docker run --rm -t -v "$(pwd):/data" osrm/osrm-backend \
  osrm-customize /data/elbfahrt-region.osrm

echo "✓ Fertig. OSRM- und Nominatim-Daten liegen unter $OSM_DIR/elbfahrt-region.*"
