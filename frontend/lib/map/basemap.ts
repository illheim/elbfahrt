/**
 * Shared MapLibre basemap config — self-hosted PMTiles + Protomaps light flavor.
 * Used by both the overview RideMap and the composer TripMap so the tile source,
 * glyphs, and sprite URLs live in one place.
 *
 * NOTE: glyphs + sprites still load from the Protomaps assets host; self-host
 * them from public/ before launch (see DEPLOY Part H).
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
    glyphs:
      'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/light',
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
