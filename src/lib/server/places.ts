import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/types';
import { normalizePlaceName, type PlaceSelection } from '$lib/place';

type DB = SupabaseClient<Database>;

// Same name within this many degrees (~100m) is treated as the same place, so a
// town geocoded twice (or geocoded then pin-dropped) doesn't create duplicates.
const COORD_EPSILON = 0.001;

/**
 * Resolve a PlaceSelection to a concrete place_id within a tree. Existing
 * selections pass straight through; new ones reuse a matching place (same name +
 * near-identical coordinates) if one exists, otherwise insert a fresh row.
 * RLS enforces tree membership on both the read and the insert.
 */
export async function findOrCreatePlace(
	supabase: DB,
	treeId: string,
	selection: PlaceSelection
): Promise<string> {
	if (selection.kind === 'existing') return selection.id;

	const target = normalizePlaceName(selection.name);

	// ilike with no wildcards is a case-insensitive equality pre-filter; we then
	// confirm the name and coordinate proximity in JS.
	const { data: candidates } = await supabase
		.from('places')
		.select('id, name, lat, lng')
		.eq('tree_id', treeId)
		.ilike('name', selection.name);

	const match = (candidates ?? []).find(
		(p) =>
			normalizePlaceName(p.name) === target &&
			p.lat != null &&
			p.lng != null &&
			Math.abs(p.lat - selection.lat) < COORD_EPSILON &&
			Math.abs(p.lng - selection.lng) < COORD_EPSILON
	);
	if (match) return match.id;

	const { data: created, error } = await supabase
		.from('places')
		.insert({
			tree_id: treeId,
			name: selection.name,
			historical_name: selection.historicalName ?? null,
			lat: selection.lat,
			lng: selection.lng,
			source: selection.source
		})
		.select('id')
		.single();

	if (error || !created) {
		throw new Error(error?.message ?? 'Could not save place.');
	}
	return created.id;
}
