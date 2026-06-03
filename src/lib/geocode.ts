/**
 * Geocoding — shared shapes for turning a place name into coordinates via
 * OpenStreetMap's Nominatim service. The actual network call lives server-side
 * (src/lib/server/geocode.ts, proxied through /api/geocode) so we can send a
 * policy-compliant User-Agent and keep Nominatim usage off the client.
 */

export interface GeocodeResult {
	/** Short name, e.g. "Berlin". */
	name: string;
	/** Full human-readable name, e.g. "Berlin, Germany". */
	displayName: string;
	lat: number;
	lng: number;
	/** OSM reference ("relation/62422") — lets us recognise the same place again. */
	osmRef: string | null;
}

/** Attribution required by the OpenStreetMap / Nominatim usage policy. */
export const GEOCODE_ATTRIBUTION = '© OpenStreetMap contributors';
