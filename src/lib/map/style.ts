import type { StyleSpecification } from 'maplibre-gl';

/**
 * Base map style. A plain OpenStreetMap raster tile layer — no API key, good
 * enough for the pin-drop picker and the map view (task 2.9).
 *
 * NOTE: tile.openstreetmap.org is fine for development but its usage policy
 * discourages heavy production traffic; swap in a proper tile provider (or a
 * vector style) before launch. Attribution is carried on the source so
 * MapLibre's attribution control shows it automatically.
 */

export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';

export const osmRasterStyle: StyleSpecification = {
	version: 8,
	sources: {
		osm: {
			type: 'raster',
			tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
			tileSize: 256,
			maxzoom: 19,
			attribution: OSM_ATTRIBUTION
		}
	},
	layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
};
