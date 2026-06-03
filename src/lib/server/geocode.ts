import type { GeocodeResult } from '$lib/geocode';

/**
 * Server-side Nominatim search. Kept off the client so we can set the
 * identifying User-Agent the OSM usage policy requires (and centralise the one
 * request-per-call discipline). Callers should debounce; Nominatim asks for at
 * most ~1 request/second.
 */

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
// Nominatim wants a UA that identifies the app with a contact address.
const USER_AGENT = 'HeritageAtlas/0.1 (accounts@dot.studio)';

const MIN_QUERY_LENGTH = 3;

interface NominatimRow {
	name?: string;
	display_name?: string;
	lat?: string;
	lon?: string;
	osm_type?: string;
	osm_id?: number;
}

function toResult(row: NominatimRow): GeocodeResult | null {
	const lat = Number(row.lat);
	const lng = Number(row.lon);
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
	const displayName = row.display_name?.trim() || row.name?.trim() || '';
	if (!displayName) return null;
	return {
		name: row.name?.trim() || displayName.split(',')[0].trim(),
		displayName,
		lat,
		lng,
		osmRef: row.osm_type && row.osm_id != null ? `${row.osm_type}/${row.osm_id}` : null
	};
}

/** Geocode a free-text query into up to a handful of candidate places. */
export async function geocodeSearch(query: string): Promise<GeocodeResult[]> {
	const q = query.trim();
	if (q.length < MIN_QUERY_LENGTH) return [];

	const url = new URL(ENDPOINT);
	url.searchParams.set('format', 'jsonv2');
	url.searchParams.set('q', q);
	url.searchParams.set('limit', '6');
	url.searchParams.set('addressdetails', '0');

	const res = await fetch(url, {
		headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' }
	});
	if (!res.ok) {
		throw new Error(`Nominatim request failed (${res.status})`);
	}

	const rows = (await res.json()) as NominatimRow[];
	return rows.map(toResult).filter((r): r is GeocodeResult => r !== null);
}
