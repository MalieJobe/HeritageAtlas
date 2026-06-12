import { error, json } from '@sveltejs/kit';
import { geocodeSearch } from '$lib/server/geocode';
import { translate } from '$lib/i18n/translate';
import type { RequestHandler } from './$types';

/**
 * Geocoding proxy: GET /api/geocode?q=… → { results: GeocodeResult[] }.
 * Auth is enforced by the global hook; this just keeps Nominatim access
 * server-side (policy-compliant User-Agent) for the type-ahead picker.
 */
export const GET: RequestHandler = async ({ url, locals: { user, locale } }) => {
	if (!user) error(401, translate(locale, 'common.notAuthenticated'));

	const q = url.searchParams.get('q') ?? '';
	if (q.trim().length < 3) {
		return json({ results: [] });
	}

	try {
		const results = await geocodeSearch(q);
		return json({ results });
	} catch {
		error(502, translate(locale, 'map.place.serviceUnavailable'));
	}
};
