/**
 * Shared MapLibre basemap config — everything self-hosted, no third-party
 * calls. Used by both the overview RideMap and the composer TripMap so the tile
 * source, glyphs, and sprite URLs live in one place.
 *
 * All three assets are served same-origin from public/:
 *   - tiles:   /region.pmtiles          (pmtiles CLI — see README)
 *   - glyphs:  /basemaps-assets/fonts/*  } populate with
 *   - sprite:  /basemaps-assets/sprites/*} scripts/fetch-basemap-assets.sh
 *
 * The font stacks the light flavor requests are "Noto Sans Regular / Medium /
 * Italic"; the fetch script mirrors exactly those.
 */

import type { StyleSpecification } from 'maplibre-gl';
import { layers, namedFlavor } from '@protomaps/basemaps';

// Default map framing for the region: centred over the Elbmarsch/Winsen area
// where members live, zoomed in enough to feel local. Nudge these two lines to
// re-frame every map (picker + overview).
export const REGION_CENTER: [number, number] = [10.35, 53.39];
export const REGION_ZOOM = 10;

export function buildBaseStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: '/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sprite: '/basemaps-assets/sprites/v4/light',
    sources: {
      protomaps: {
        type: 'vector',
        url: 'pmtiles:///region.pmtiles',
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      },
    },
    layers: layers('protomaps', namedFlavor('light'), { lang: 'de' }),
  };
}
