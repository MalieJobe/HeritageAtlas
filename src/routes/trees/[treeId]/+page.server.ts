import { error, redirect } from '@sveltejs/kit';
import { personInitials, personName } from '$lib/person';
import type { GraphData, Sex } from '$lib/graph/types';
import type { PageServerLoad } from './$types';

const PHOTO_BUCKET = 'person-photos';

/** Narrow the free-text `sex` column to the values the node palette understands. */
function normalizeSex(value: string | null): Sex {
	return value === 'male' || value === 'female' || value === 'other' ? value : null;
}

export const load: PageServerLoad = async ({ params, locals: { supabase, user } }) => {
	if (!user) redirect(303, '/auth/login');

	// RLS limits this to trees the user is a member of; anything else returns
	// null and is indistinguishable from "doesn't exist" — a 404 either way.
	const { data: tree } = await supabase
		.from('trees')
		.select('id, name, owner_id')
		.eq('id', params.treeId)
		.maybeSingle();

	if (!tree) {
		error(404, 'Tree not found');
	}

	const { data: membership } = await supabase
		.from('tree_members')
		.select('role')
		.eq('tree_id', params.treeId)
		.eq('user_id', user.id)
		.maybeSingle();
	const canEdit = membership?.role === 'owner' || membership?.role === 'editor';

	// Persons, partnerships, parent-child links and birth/death years — the whole
	// graph for this tree.
	const [{ data: personRows }, { data: partnerRows }, { data: linkRows }, { data: eventRows }] =
		await Promise.all([
			supabase
				.from('persons')
				.select('id, given_names, surname, nickname, sex, profile_photo_path')
				.eq('tree_id', params.treeId),
			supabase
				.from('partnerships')
				.select('id, partner_a, partner_b, status')
				.eq('tree_id', params.treeId),
			supabase
				.from('parent_child_links')
				.select('id, parent_id, child_id')
				.eq('tree_id', params.treeId),
			supabase
				.from('events')
				.select('person_id, type, event_date')
				.eq('tree_id', params.treeId)
				.in('type', ['birth', 'death'])
		]);

	const persons = personRows ?? [];

	// Birth/death years per person (lower-bound year from the event date).
	const yearOf = (iso: string | null): number | null => {
		if (!iso) return null;
		const y = Number.parseInt(iso.slice(0, 4), 10);
		return Number.isFinite(y) ? y : null;
	};
	const birthYears = new Map<string, number>();
	const deathYears = new Map<string, number>();
	for (const ev of eventRows ?? []) {
		const year = yearOf(ev.event_date);
		if (year == null) continue;
		const target = ev.type === 'death' ? deathYears : ev.type === 'birth' ? birthYears : null;
		if (target && !target.has(ev.person_id)) target.set(ev.person_id, year);
	}

	// Resolve a stored photo path to a usable URL: external URLs (e.g. seeded
	// demo images) are used as-is; bucket paths are batch-signed in one round trip.
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

	return { tree, isOwner: tree.owner_id === user.id, canEdit, graph };
};
