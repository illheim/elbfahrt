'use client';

/**
 * RoutePreview — a small read-only map that draws a single route through
 * origin → waypoints → destination for the ride composer. Markers are labelled
 * A (start), 1…n (stops), B (destination); the line is the real OSRM driving
 * route with a straight-segment fallback. Reuses the shared PMTiles basemap.
 */

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';
import { REGION_CENTER, REGION_ZOOM, buildBaseStyle } from '@/lib/map/basemap';
import { getRouteGeometry } from '@/lib/api/geo';

export interface RoutePoint {
  lat: number;
  lng: number;
}

const SRC = 'preview-route';

function lineFC(coords: [number, number][]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
    ],
  };
}

export function RoutePreview({
  origin,
  destination,
  waypoints,
}: {
  origin: RoutePoint;
  destination: RoutePoint;
  waypoints: RoutePoint[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [loaded, setLoaded] = useState(false);

  // A signature that changes only when the actual coordinates change, so the
  // draw effect doesn't re-run on every parent render.
  const sig = JSON.stringify([
    [origin.lng, origin.lat],
    ...waypoints.map((w) => [w.lng, w.lat]),
    [destination.lng, destination.lat],
  ]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
    const map = new maplibregl.Map({
      container: containerRef.current,
      center: REGION_CENTER,
      zoom: REGION_ZOOM,
      style: buildBaseStyle(),
      attributionControl: { compact: true },
    });
    map.on('load', () => {
      map.addSource(SRC, { type: 'geojson', data: lineFC([]) });
      map.addLayer({
        id: `${SRC}-line`,
        type: 'line',
        source: SRC,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#2b6b80', 'line-width': 4, 'line-opacity': 0.85 },
      });
      setLoaded(true);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      maplibregl.removeProtocol('pmtiles');
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const seq: RoutePoint[] = [origin, ...waypoints, destination];

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    seq.forEach((p, i) => {
      const isOrigin = i === 0;
      const isDest = i === seq.length - 1;
      const bg = isOrigin ? '#059669' : isDest ? '#dc2626' : '#2563eb';
      const el = document.createElement('div');
      el.style.cssText =
        `display:flex;align-items:center;justify-content:center;width:22px;height:22px;` +
        `border-radius:9999px;background:${bg};color:#fff;font:600 11px sans-serif;` +
        `border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);`;
      el.textContent = isOrigin ? 'A' : isDest ? 'B' : String(i);
      markersRef.current.push(
        new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map)
      );
    });

    const src = map.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
    src?.setData(lineFC(seq.map((p) => [p.lng, p.lat])));

    const b = new maplibregl.LngLatBounds(
      [origin.lng, origin.lat],
      [origin.lng, origin.lat]
    );
    seq.forEach((p) => b.extend([p.lng, p.lat]));
    map.fitBounds(b, { padding: 48, maxZoom: 13, duration: 300 });

    let cancelled = false;
    getRouteGeometry(origin, destination, waypoints).then((g) => {
      if (cancelled || !g) return;
      const s = map.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
      s?.setData(lineFC(g));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, loaded]);

  return (
    <div className="relative mt-1 h-56 w-full overflow-hidden rounded-md border border-neutral-300">
      <div ref={containerRef} className="h-full w-full" />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-50 text-xs text-neutral-500">
          Karte wird geladen…
        </div>
      )}
    </div>
  );
}
