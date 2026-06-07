import type { StyleSpecification } from 'maplibre-gl';

/**
 * Base map style. CARTO's "Positron" OpenStreetMap raster — a light, muted
 * basemap whose country borders are faint grey rather than the bold red-brown of
 * standard OSM tiles, so they don't compete with the people dots. No API key,
 * and its restrained palette sits well under the app's warm theme.
 *
 * NOTE: CARTO basemaps are free for reasonable use; review their usage policy and
 * consider a dedicated provider (or a vector style) before heavy production
 * traffic. Attribution is carried on the source so MapLibre's attribution control
 * shows it automatically.
 */

export const OSM_ATTRIBUTION = '© OpenStreetMap contributors © CARTO';

export const osmRasterStyle: StyleSpecification = {
	version: 8,
	sources: {
		osm: {
			type: 'raster',
			tiles: [
				'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
				'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
				'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
			],
			tileSize: 256,
			maxzoom: 19,
			attribution: OSM_ATTRIBUTION
		}
	},
	layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
};
