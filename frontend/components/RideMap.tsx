'use client';

/**
 * Ride map — MapLibre GL rendering self-hosted vector tiles (PMTiles) with the
 * Protomaps light basemap. Each ride is a marker at its origin; clicking one
 * calls onSelect(documentId).
 *
 * Tiles come from /region.pmtiles (served statically from public/; generate it
 * with the pmtiles CLI — see README/DEV notes). Glyphs + sprites are likewise
 * self-hosted from public/basemaps-assets/ (scripts/fetch-basemap-assets.sh),
 * so the map makes no third-party requests.
 *
 * Loaded via next/dynamic with ssr:false so MapLibre only runs in the browser.
 */

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';
import { REGION_CENTER, REGION_ZOOM, buildBaseStyle } from '@/lib/map/basemap';

/**
 * The minimal shape the map needs — satisfied by both a ride and a Gesuch
 * (RideListItem / RideRequestListItem). A marker sits at the origin; if
 * `onSelect` is given and the item has a documentId, the marker is clickable.
 */
export interface MapPoint {
  documentId?: string;
  origin_lat?: number | null;
  origin_lng?: number | null;
  origin_address: string;
  destination_address: string;
}

export function RideMap({
  items,
  onSelect,
}: {
  items: MapPoint[];
  onSelect?: (documentId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [loaded, setLoaded] = useState(false);

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
    map.on('load', () => setLoaded(true));
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      maplibregl.removeProtocol('pmtiles');
    };
  }, []);

  // (Re)draw markers when the point set changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers: maplibregl.Marker[] = [];

    for (const it of items) {
      if (
        typeof it.origin_lat !== 'number' ||
        typeof it.origin_lng !== 'number'
      ) {
        continue;
      }
      const clickable = !!onSelect && !!it.documentId;
      const el = document.createElement(clickable ? 'button' : 'div');
      if (clickable) (el as HTMLButtonElement).type = 'button';
      el.setAttribute('aria-label', `${it.origin_address} → ${it.destination_address}`);
      el.style.cssText =
        'width:18px;height:18px;border-radius:9999px;background:#0a0a0a;' +
        'border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);' +
        (clickable ? 'cursor:pointer;' : '');
      if (clickable) {
        el.addEventListener('click', () => onSelect!(it.documentId!));
      }

      markers.push(
        new maplibregl.Marker({ element: el })
          .setLngLat([it.origin_lng, it.origin_lat])
          .addTo(map)
      );
    }

    return () => markers.forEach((m) => m.remove());
  }, [items, onSelect]);

  return (
    <div className="relative h-[70vh] w-full overflow-hidden rounded-md border border-neutral-300">
      <div ref={containerRef} className="h-full w-full" />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-50 text-sm text-neutral-500">
          Karte wird geladen…
        </div>
      )}
    </div>
  );
}
