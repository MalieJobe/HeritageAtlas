import { error, redirect } from '@sveltejs/kit';
import { personInitials, personName } from '$lib/person';
import { eventTypeMeta, type EventType } from '$lib/events';
import type { Sex } from '$lib/graph/types';
import type { LocatingEvent, MapData, MapPerson } from '$lib/map/types';
import type { PageServerLoad } from './$types';

const PHOTO_BUCKET = 'person-photos';

function normalizeSex(value: string | null): Sex {
	return value === 'male' || value === 'female' || value === 'other' ? value : null;
}

/** Lower-bound calendar year from an ISO date string, or null. */
function yearOf(iso: string | null): number | null {
	if (!iso) return null;
	const year = Number.parseInt(iso.slice(0, 4), 10);
	return Number.isFinite(year) ? year : null;
}

export const load: PageServerLoad = async ({ params, locals: { supabase, user } }) => {
	if (!user) redirect(303, '/auth/login');

	// RLS limits this to trees the user is a member of.
	const { data: tree } = await supabase
		.from('trees')
		.select('id, name, owner_id')
		.eq('id', params.treeId)
		.maybeSingle();
	if (!tree) error(404, 'Tree not found');

	const { data: membership } = await supabase
		.from('tree_members')
		.select('role')
		.eq('tree_id', params.treeId)
		.eq('user_id', user.id)
		.maybeSingle();
	const canEdit = membership?.role === 'owner' || membership?.role === 'editor';

	const [{ data: personRows }, { data: eventRows }] = await Promise.all([
		supabase
			.from('persons')
			.select('id, given_names, surname, nickname, sex, profile_photo_path')
			.eq('tree_id', params.treeId),
		supabase
			.from('events')
			.select('id, person_id, type, event_date, place:places(name, lat, lng)')
			.eq('tree_id', params.treeId)
	]);

	const persons = personRows ?? [];

	// Batch-sign profile photos (same approach as the graph loader): external URLs
	// pass through, bucket paths are signed in one round trip.
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

	// Group locating events (type.locates + a placed, dated row) by person.
	const eventsByPerson = new Map<string, LocatingEvent[]>();
	let minYear = Infinity;
	let maxYear = -Infinity;
	for (const row of eventRows ?? []) {
		const type = row.type as EventType;
		if (!eventTypeMeta(type).locates) continue;
		const place = row.place;
		if (!place || place.lat == null || place.lng == null) continue;
		const year = yearOf(row.event_date);
		if (year == null) continue;

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
		if (year < minYear) minYear = year;
		if (year > maxYear) maxYear = year;
	}

	// Order weight so same-year events resolve sensibly (birth before death, etc.).
	const TYPE_WEIGHT: Record<EventType, number> = {
		birth: 0,
		residence: 1,
		occupation: 2,
		marriage: 3,
		death: 4,
		custom: 5
	};

	const mapPersons: MapPerson[] = persons
		.map((p) => {
			const events = (eventsByPerson.get(p.id) ?? []).sort(
				(a, b) => a.year - b.year || TYPE_WEIGHT[a.type] - TYPE_WEIGHT[b.type]
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

	const mapData: MapData = {
		persons: mapPersons,
		yearRange: Number.isFinite(minYear) ? { min: minYear, max: maxYear } : null
	};

	return { tree, canEdit, map: mapData };
};
