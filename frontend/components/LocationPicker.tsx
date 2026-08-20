'use client';

/**
 * LocationPicker — a small map you tap to drop a pin. Used inside AddressField
 * so a start/destination can be chosen straight off the map instead of typed.
 *
 * On tap it drops/moves a marker and calls onPick(lng, lat); the parent reverse-
 * geocodes that point into an address. If `marker` later changes (e.g. the
 * resolved address snaps the point), the pin follows. Reuses the shared PMTiles
 * basemap. Load via next/dynamic with ssr:false so MapLibre only runs client-side.
 */

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';
import { REGION_CENTER, REGION_ZOOM, buildBaseStyle } from '@/lib/map/basemap';

const RADIUS_SOURCE = 'flex-area';

function setMarker(
  map: maplibregl.Map,
  ref: { current: maplibregl.Marker | null },
  lngLat: [number, number]
) {
  if (ref.current) {
    ref.current.setLngLat(lngLat);
    return;
  }
  const el = document.createElement('div');
  el.style.cssText =
    'width:20px;height:20px;border-radius:9999px;background:#0a0a0a;' +
    'border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);';
  ref.current = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
}

/** A geodesic circle (approx.) around a point, for the ±radius flexible area. */
function circleFeature(
  center: [number, number],
  radiusKm: number
): GeoJSON.Feature<GeoJSON.Polygon> {
  const [lng, lat] = center;
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const ring: [number, number][] = [];
  const steps = 64;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    ring.push([lng + dLng * Math.cos(t), lat + dLat * Math.sin(t)]);
  }
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
}

export function LocationPicker({
  marker,
  onPick,
  flexible = false,
  radiusKm = 1,
}: {
  marker: [number, number] | null; // [lng, lat]
  onPick: (lng: number, lat: number) => void;
  flexible?: boolean;
  radiusKm?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onPickRef = useRef(onPick);
  const initialMarker = useRef(marker);
  const [loaded, setLoaded] = useState(false);

  // Keep the latest onPick without re-running the init effect / click binding.
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  // Init once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);

    const start = initialMarker.current;
    const map = new maplibregl.Map({
      container: containerRef.current,
      center: start ?? REGION_CENTER,
      zoom: start ? 13 : REGION_ZOOM,
      style: buildBaseStyle(),
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.on('load', () => {
      if (initialMarker.current) setMarker(map, markerRef, initialMarker.current);
      setLoaded(true);
    });
    map.on('click', (e) => {
      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      setMarker(map, markerRef, lngLat);
      onPickRef.current(e.lngLat.lng, e.lngLat.lat);
    });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      maplibregl.removeProtocol('pmtiles');
    };
  }, []);

  // Follow the external marker (e.g. when the resolved address snaps the point).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !marker) return;
    setMarker(map, markerRef, marker);
  }, [marker]);

  // Draw / update / clear the ±radius flexible area.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    if (flexible && marker) {
      const data = circleFeature(marker, radiusKm);
      const src = map.getSource(RADIUS_SOURCE) as
        | maplibregl.GeoJSONSource
        | undefined;
      if (src) {
        src.setData(data);
      } else {
        map.addSource(RADIUS_SOURCE, { type: 'geojson', data });
        map.addLayer({
          id: `${RADIUS_SOURCE}-fill`,
          type: 'fill',
          source: RADIUS_SOURCE,
          paint: { 'fill-color': '#2b6b80', 'fill-opacity': 0.12 },
        });
        map.addLayer({
          id: `${RADIUS_SOURCE}-line`,
          type: 'line',
          source: RADIUS_SOURCE,
          paint: {
            'line-color': '#2b6b80',
            'line-opacity': 0.5,
            'line-width': 1.5,
          },
        });
      }
    } else {
      if (map.getLayer(`${RADIUS_SOURCE}-line`)) {
        map.removeLayer(`${RADIUS_SOURCE}-line`);
      }
      if (map.getLayer(`${RADIUS_SOURCE}-fill`)) {
        map.removeLayer(`${RADIUS_SOURCE}-fill`);
      }
      if (map.getSource(RADIUS_SOURCE)) map.removeSource(RADIUS_SOURCE);
    }
  }, [marker, flexible, radiusKm, loaded]);

  return (
    <div className="relative mt-1 h-64 w-full overflow-hidden rounded-md border border-neutral-300">
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-white/85 px-2 py-1 text-xs text-neutral-600 shadow-sm">
        Karte antippen
      </div>
    </div>
  );
}
