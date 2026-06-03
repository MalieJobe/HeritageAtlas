import { error, json } from '@sveltejs/kit';
import { geocodeSearch } from '$lib/server/geocode';
import type { RequestHandler } from './$types';

/**
 * Geocoding proxy: GET /api/geocode?q=… → { results: GeocodeResult[] }.
 * Auth is enforced by the global hook; this just keeps Nominatim access
 * server-side (policy-compliant User-Agent) for the type-ahead picker.
 */
export const GET: RequestHandler = async ({ url, locals: { user } }) => {
	if (!user) error(401, 'Not authenticated');

	const q = url.searchParams.get('q') ?? '';
	if (q.trim().length < 3) {
		return json({ results: [] });
	}

	try {
		const results = await geocodeSearch(q);
		return json({ results });
	} catch {
		error(502, 'Geocoding service is unavailable. Try again in a moment.');
	}
};
