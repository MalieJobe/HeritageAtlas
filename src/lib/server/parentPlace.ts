import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/types';
import type { EventType } from '$lib/events';
import type { PlaceSelection } from '$lib/place';

type DB = SupabaseClient<Database>;

/**
 * The place to inherit from a set of people — used to default a child's
 * birthplace so you don't re-enter where the family already is.
 *
 * Heuristic: the place of their most recent located event (one with
 * coordinates), preferring a non-death event since a death place is a poor
 * birthplace default. Returns an 'existing' selection (the place already lives in
 * the tree) or null when none of them has a located event. It's only a default —
 * the picker lets the user change it.
 */
export async function inheritedPlace(
	supabase: DB,
	treeId: string,
	personIds: string[]
): Promise<PlaceSelection | null> {
	if (personIds.length === 0) return null;

	const { data: events } = await supabase
		.from('events')
		.select('type, event_date, place:places(id, name, lat, lng)')
		.eq('tree_id', treeId)
		.in('person_id', personIds)
		.not('place_id', 'is', null);

	const located = (events ?? []).filter(
		(e): e is typeof e & { place: { id: string; name: string; lat: number; lng: number } } =>
			!!e.place && e.place.lat != null && e.place.lng != null
	);
	if (located.length === 0) return null;

	// Most recent first; a non-death event always beats a death event regardless of
	// date (a residence/birth is a better "where the family is" signal).
	const isDeath = (t: EventType) => t === 'death';
	located.sort((a, b) => {
		const deathDiff = Number(isDeath(a.type)) - Number(isDeath(b.type));
		if (deathDiff !== 0) return deathDiff;
		return (b.event_date ?? '').localeCompare(a.event_date ?? '');
	});

	const place = located[0].place;
	return { kind: 'existing', id: place.id, name: place.name, lat: place.lat, lng: place.lng };
}

/** The place to inherit from a person's parent(s) — for defaulting that person's first event. */
export async function parentDefaultPlace(
	supabase: DB,
	treeId: string,
	childId: string
): Promise<PlaceSelection | null> {
	const { data: links } = await supabase
		.from('parent_child_links')
		.select('parent_id')
		.eq('tree_id', treeId)
		.eq('child_id', childId);
	const parentIds = (links ?? []).map((l) => l.parent_id);
	return inheritedPlace(supabase, treeId, parentIds);
}
