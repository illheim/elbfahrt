'use client';

/**
 * Ride map — MapLibre GL rendering self-hosted vector tiles (PMTiles) with the
 * Protomaps light basemap. Each ride is drawn as a coloured route line from its
 * origin to its destination (real driving route from OSRM, straight-line
 * fallback), with a filled origin marker and a hollow destination ring in the
 * same colour. Distinct colours let the rides be told apart. Clicking a route or
 * its origin marker calls onSelect(documentId).
 *
 * Tiles come from /region.pmtiles; glyphs + sprites are self-hosted from
 * public/basemaps-assets/ (scripts/fetch-basemap-assets.sh), so the map makes no
 * third-party requests. Loaded via next/dynamic with ssr:false.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';
import { REGION_CENTER, REGION_ZOOM, buildBaseStyle } from '@/lib/map/basemap';
import { getRouteGeometry } from '@/lib/api/geo';

/**
 * The minimal shape the map needs — satisfied by both a ride and a Gesuch
 * (RideListItem / RideRequestListItem). Coordinates may arrive as strings
 * (Strapi serialises `decimal` columns as strings), so we coerce below.
 */
export interface MapPoint {
  documentId?: string;
  origin_lat?: number | string | null;
  origin_lng?: number | string | null;
  destination_lat?: number | string | null;
  destination_lng?: number | string | null;
  waypoints?: { lat: number | string; lng: number | string }[] | null;
  origin_address: string;
  destination_address: string;
}

// Distinct, high-contrast colours cycled per ride so routes can be told apart.
const PALETTE = [
  '#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed',
  '#0891b2', '#db2777', '#4d7c0f', '#ea580c', '#4f46e5',
];

/** Coerce a possibly-string coordinate to a finite number, or null. */
function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

interface Plotted {
  documentId?: string;
  color: string;
  origin: [number, number];
  destination: [number, number] | null;
  waypoints: [number, number][];
  label: string;
}

const SRC = 'ride-routes';
const LINE = 'ride-routes-line';
const HIT = 'ride-routes-hit';

export function RideMap({
  items,
  onSelect,
}: {
  items: MapPoint[];
  onSelect?: (documentId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Keep the latest onSelect reachable from the (once-registered) click handler.
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Resolve + coerce the items we can actually plot (valid origin).
  const plotted = useMemo<Plotted[]>(() => {
    const out: Plotted[] = [];
    items.forEach((it, i) => {
      const olng = num(it.origin_lng);
      const olat = num(it.origin_lat);
      if (olng === null || olat === null) return;
      const dlng = num(it.destination_lng);
      const dlat = num(it.destination_lat);
      const wps: [number, number][] = [];
      for (const w of it.waypoints ?? []) {
        const wlng = num(w.lng);
        const wlat = num(w.lat);
        if (wlng !== null && wlat !== null) wps.push([wlng, wlat]);
      }
      out.push({
        documentId: it.documentId,
        color: PALETTE[i % PALETTE.length],
        origin: [olng, olat],
        destination: dlng !== null && dlat !== null ? [dlng, dlat] : null,
        waypoints: wps,
        label: `${it.origin_address} → ${it.destination_address}`,
      });
    });
    return out;
  }, [items]);

  // Init the map once.
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
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      map.addSource(SRC, { type: 'geojson', data: emptyFC() });
      map.addLayer({
        id: LINE,
        type: 'line',
        source: SRC,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 4, 'line-opacity': 0.85 },
      });
      // Wide invisible layer so routes are easy to tap.
      map.addLayer({
        id: HIT,
        type: 'line',
        source: SRC,
        paint: { 'line-color': '#000', 'line-opacity': 0, 'line-width': 18 },
      });
      const pick = (e: maplibregl.MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.documentId as string | undefined;
        if (id) onSelectRef.current?.(id);
      };
      map.on('click', HIT, pick);
      map.on('mouseenter', HIT, () => {
        if (onSelectRef.current) map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', HIT, () => {
        map.getCanvas().style.cursor = '';
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

  // Draw routes + markers whenever the plotted set changes (and the map is up).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const src = map.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;

    // Clear previous markers.
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Straight-line features first (instant), then upgrade to real routes.
    src.setData(buildFC(plotted, {}));

    // Origin (filled, clickable) + destination (hollow ring) markers. Track the
    // origin/destination markers per route so they can be snapped onto the
    // road-routed line's endpoints once the geometry resolves (OSRM snaps the
    // route to the nearest road; the raw geocoded point can sit off it).
    const endpoints: { o: maplibregl.Marker; d: maplibregl.Marker | null }[] = [];
    plotted.forEach((p) => {
      const clickable = !!onSelectRef.current && !!p.documentId;
      const el = document.createElement(clickable ? 'button' : 'div');
      if (clickable) (el as HTMLButtonElement).type = 'button';
      el.setAttribute('aria-label', p.label);
      el.style.cssText =
        `width:16px;height:16px;border-radius:9999px;background:${p.color};` +
        'border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);' +
        (clickable ? 'cursor:pointer;' : '');
      if (clickable) el.addEventListener('click', () => onSelectRef.current!(p.documentId!));
      const oMarker = new maplibregl.Marker({ element: el }).setLngLat(p.origin).addTo(map);
      markersRef.current.push(oMarker);

      let dMarker: maplibregl.Marker | null = null;
      if (p.destination) {
        const d = document.createElement('div');
        d.setAttribute('aria-hidden', 'true');
        d.style.cssText =
          `width:12px;height:12px;border-radius:9999px;background:#fff;` +
          `border:3px solid ${p.color};box-shadow:0 1px 2px rgba(0,0,0,.35);`;
        dMarker = new maplibregl.Marker({ element: d }).setLngLat(p.destination).addTo(map);
        markersRef.current.push(dMarker);
      }
      endpoints.push({ o: oMarker, d: dMarker });

      // Small dots for intermediate pick-up points.
      for (const wp of p.waypoints) {
        const w = document.createElement('div');
        w.setAttribute('aria-hidden', 'true');
        w.style.cssText =
          `width:9px;height:9px;border-radius:9999px;background:${p.color};` +
          `border:2px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,.3);`;
        markersRef.current.push(
          new maplibregl.Marker({ element: w }).setLngLat(wp).addTo(map)
        );
      }
    });

    // Fit to everything we're showing.
    const pts = plotted.flatMap((p) => [
      p.origin,
      ...p.waypoints,
      ...(p.destination ? [p.destination] : []),
    ]);
    if (pts.length === 1) {
      map.easeTo({ center: pts[0], zoom: 12, duration: 400 });
    } else if (pts.length > 1) {
      const b = new maplibregl.LngLatBounds(pts[0], pts[0]);
      pts.forEach((c) => b.extend(c));
      map.fitBounds(b, { padding: 56, maxZoom: 13, duration: 400 });
    }

    // Upgrade straight lines to real driving routes where OSRM answers.
    let cancelled = false;
    (async () => {
      const geoms = await Promise.all(
        plotted.map((p) =>
          p.destination
            ? getRouteGeometry(
                { lng: p.origin[0], lat: p.origin[1] },
                { lng: p.destination[0], lat: p.destination[1] },
                p.waypoints.map(([lng, lat]) => ({ lng, lat }))
              )
            : Promise.resolve(null)
        )
      );
      if (cancelled) return;
      const byIndex: Record<number, [number, number][]> = {};
      geoms.forEach((g, i) => {
        if (!g) return;
        byIndex[i] = g;
        // Snap the origin/destination markers onto the routed line's endpoints.
        endpoints[i]?.o.setLngLat(g[0]);
        endpoints[i]?.d?.setLngLat(g[g.length - 1]);
      });
      const s = map.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
      s?.setData(buildFC(plotted, byIndex));
    })();

    return () => {
      cancelled = true;
    };
  }, [plotted, loaded]);

  return (
    <div className="relative h-[70vh] w-full overflow-hidden rounded-md border border-neutral-300">
      <div ref={containerRef} className="h-full w-full" />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-50 text-sm text-neutral-500">
          Karte wird geladen…
        </div>
      )}
      {loaded && plotted.length > 0 && (
        <div className="absolute bottom-2 left-2 max-h-[40%] max-w-[70%] overflow-auto rounded-md border border-neutral-200 bg-white/95 p-2 text-xs shadow-sm">
          <ul className="flex flex-col gap-1">
            {plotted.map((p, i) => (
              <li key={p.documentId ?? i} className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: p.color }}
                  aria-hidden="true"
                />
                <span className="truncate text-neutral-700">{p.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function emptyFC(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

/** Build the route FeatureCollection; use real geometry by index when present. */
function buildFC(
  plotted: Plotted[],
  geoms: Record<number, [number, number][]>
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  plotted.forEach((p, i) => {
    if (!p.destination) return;
    const coords = geoms[i] ?? [p.origin, ...p.waypoints, p.destination];
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: { color: p.color, documentId: p.documentId ?? '' },
    });
  });
  return { type: 'FeatureCollection', features };
}
