/**
 * Places — shared shapes for picking and reusing locations. The PlacePicker
 * emits a PlaceSelection (an existing row, or a new place to create); the
 * server's findOrCreatePlace turns that into a concrete place_id, reusing an
 * existing row where it can so repeated geocodes don't pile up duplicates.
 */

import type { Database } from '$lib/supabase/types';

export type Place = Database['public']['Tables']['places']['Row'];
export type PlaceSource = Database['public']['Enums']['place_source'];

/** A picked place: either an existing row, or a new one to find-or-create. */
export type PlaceSelection =
	| { kind: 'existing'; id: string; name: string; lat: number | null; lng: number | null }
	| {
			kind: 'new';
			name: string;
			historicalName?: string | null;
			lat: number;
			lng: number;
			source: PlaceSource;
	  };

/** Normalised key for comparing place names case/whitespace-insensitively. */
export function normalizePlaceName(name: string): string {
	return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** A short coordinate label like "48.5846, 7.7507" for display. */
export function formatCoords(lat: number | null, lng: number | null): string {
	if (lat == null || lng == null) return 'No coordinates';
	return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}
