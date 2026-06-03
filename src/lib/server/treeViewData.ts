/**
 * Shared tree-view data loader.
 *
 * The tree graph, the map, and the combined split view all need the same raw
 * material — persons (with signed photos), partnerships, parent-child links and
 * events. Rather than three loaders drifting apart, this builds both the
 * `GraphData` (for the family graph) and the `MapData` (for the map) from a
 * single round of queries, and derives a combined timeline range that spans both
 * located events and birth/death years.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { personInitials, personName } from '$lib/person';
import { EVENT_TYPES, eventTypeMeta, type EventType } from '$lib/events';
import type { Database } from '$lib/supabase/types';
import type { GraphData, Sex } from '$lib/graph/types';
import type { LocatingEvent, MapData, MapPerson } from '$lib/map/types';

const PHOTO_BUCKET = 'person-photos';

/** Narrow the free-text `sex` column to the values the node palette understands. */
function normalizeSex(value: string | null): Sex {
	return value === 'male' || value === 'female' || value === 'other' ? value : null;
}

/** Lower-bound calendar year from an ISO date string, or null. */
function yearOf(iso: string | null): number | null {
	if (!iso) return null;
	const year = Number.parseInt(iso.slice(0, 4), 10);
	return Number.isFinite(year) ? year : null;
}

/** Order weight so same-year events resolve sensibly (birth before residence
 *  before death), derived from EVENT_TYPES order; unknown types sort last. */
function typeWeight(t: EventType): number {
	const i = EVENT_TYPES.findIndex((m) => m.type === t);
	return i === -1 ? EVENT_TYPES.length : i;
}

export type TreeViewData = {
	graph: GraphData;
	map: MapData;
	/** Combined slider range over located events *and* birth/death years; null if
	 *  the tree carries no dated facts at all. */
	timeline: { min: number; max: number } | null;
};

/**
 * Load everything the family graph and the map need for one tree, in a single
 * pass over persons + events. RLS still applies via the passed client.
 */
export async function loadTreeViewData(
	supabase: SupabaseClient<Database>,
	treeId: string
): Promise<TreeViewData> {
	const [{ data: personRows }, { data: partnerRows }, { data: linkRows }, { data: eventRows }] =
		await Promise.all([
			supabase
				.from('persons')
				.select('id, given_names, surname, nickname, sex, profile_photo_path')
				.eq('tree_id', treeId),
			supabase
				.from('partnerships')
				.select('id, partner_a, partner_b, status')
				.eq('tree_id', treeId),
			supabase.from('parent_child_links').select('id, parent_id, child_id').eq('tree_id', treeId),
			supabase
				.from('events')
				.select('id, person_id, type, event_date, place:places(name, lat, lng)')
				.eq('tree_id', treeId)
		]);

	const persons = personRows ?? [];

	// Resolve stored photo paths to usable URLs: external URLs (seeded demo images)
	// pass through; bucket paths are batch-signed in one round trip.
	const isExternal = (path: string | null | undefined): boolean =>
		!!path && /^https?:\/\//.test(path);
	const photoPaths = persons
		.map((p) => p.profile_photo_path)
		.filter((path): path is string => Boolean(path) && !isExternal(path));
	const signedByPath = new Map<string, string>();
	if (photoPaths.length > 0) {
		const { data: signed } = await supabase.storage
			.from(PHOTO_BUCKET)
			.createSignedUrls(photoPaths, 3600);
		for (const entry of signed ?? []) {
			if (entry.path && entry.signedUrl) signedByPath.set(entry.path, entry.signedUrl);
		}
	}
	const resolvePhoto = (path: string | null): string | null =>
		path ? (isExternal(path) ? path : (signedByPath.get(path) ?? null)) : null;

	// Single pass over events derives three things: birth/death years (for the
	// graph cards + aging cue), located events per person (for the map), and the
	// span of every dated fact (for the timeline range).
	const birthYears = new Map<string, number>();
	const deathYears = new Map<string, number>();
	const eventsByPerson = new Map<string, LocatingEvent[]>();
	let minYear = Infinity;
	let maxYear = -Infinity;
	const stretch = (year: number) => {
		if (year < minYear) minYear = year;
		if (year > maxYear) maxYear = year;
	};

	for (const row of eventRows ?? []) {
		const type = row.type as EventType;
		const year = yearOf(row.event_date);

		if (year != null && (type === 'birth' || type === 'death')) {
			const target = type === 'death' ? deathYears : birthYears;
			if (!target.has(row.person_id)) target.set(row.person_id, year);
			stretch(year);
		}

		if (!eventTypeMeta(type).locates) continue;
		const place = row.place;
		if (!place || place.lat == null || place.lng == null || year == null) continue;

		const event: LocatingEvent = {
			type,
			year,
			lat: place.lat,
			lng: place.lng,
			placeName: place.name
		};
		const list = eventsByPerson.get(row.person_id);
		if (list) list.push(event);
		else eventsByPerson.set(row.person_id, [event]);
		stretch(year);
	}

	const graph: GraphData = {
		persons: persons
			.map((p) => ({
				id: p.id,
				name: personName(p),
				surname: p.surname,
				initials: personInitials(p),
				sex: normalizeSex(p.sex),
				photoUrl: resolvePhoto(p.profile_photo_path),
				birthYear: birthYears.get(p.id) ?? null,
				deathYear: deathYears.get(p.id) ?? null
			}))
			.sort((a, b) => a.name.localeCompare(b.name)),
		partnerships: (partnerRows ?? []).map((row) => ({
			id: row.id,
			a: row.partner_a,
			b: row.partner_b,
			status: row.status === 'former' ? 'former' : 'current'
		})),
		parentLinks: (linkRows ?? []).map((row) => ({
			id: row.id,
			parent: row.parent_id,
			child: row.child_id
		}))
	};

	const mapPersons: MapPerson[] = persons
		.map((p) => {
			const events = (eventsByPerson.get(p.id) ?? []).sort(
				(a, b) => a.year - b.year || typeWeight(a.type) - typeWeight(b.type)
			);
			return {
				id: p.id,
				name: personName(p),
				surname: p.surname,
				initials: personInitials(p),
				sex: normalizeSex(p.sex),
				photoUrl: resolvePhoto(p.profile_photo_path),
				events
			};
		})
		.filter((p) => p.events.length > 0);

	const eventYears = mapPersons.length > 0 ? { min: minYear, max: maxYear } : null;

	const map: MapData = {
		persons: mapPersons,
		// The map's own range is just the located-event span (dots only move on
		// located events), kept separate from the fuller timeline span below.
		yearRange: eventYears
	};

	return {
		graph,
		map,
		timeline: Number.isFinite(minYear) ? { min: minYear, max: maxYear } : null
	};
}
