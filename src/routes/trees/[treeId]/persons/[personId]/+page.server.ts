import { error, fail, redirect } from '@sveltejs/kit';
import { personInitials, personName } from '$lib/person';
import { eventDisplayLabel, eventTypeMeta, type EventType } from '$lib/events';
import { formatFuzzyDate, fuzzyDateFromColumns, fuzzyDateToParts } from '$lib/fuzzyDate';
import { requireEditableTree } from '$lib/server/treeAccess';
import { parseEventForm } from '$lib/server/eventForm';
import { inheritedPlace, parentDefaultPlace } from '$lib/server/parentPlace';
import type { EventRowInitial } from '$lib/components/EventRowFields.svelte';
import type { PlaceSelection } from '$lib/place';
import type { GraphData, GraphPerson, Sex } from '$lib/graph/types';
import type { Actions, PageServerLoad } from './$types';

const PHOTO_BUCKET = 'person-photos';
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Canonical ordering for the symmetric partnership pair (partner_a < partner_b). */
function orderedPair(a: string, b: string): [string, string] {
	return a < b ? [a, b] : [b, a];
}

const isExternal = (p: string | null | undefined) => !!p && /^https?:\/\//.test(p);

/** Keep persons.profile_photo_path pointing at the first gallery photo (the one
 *  shown in the trees/map). Called after any photo add/delete/reorder. */
async function syncProfilePhoto(
	supabase: Parameters<typeof requireEditableTree>[0],
	treeId: string,
	personId: string
) {
	const { data } = await supabase
		.from('person_photos')
		.select('path')
		.eq('tree_id', treeId)
		.eq('person_id', personId)
		.order('position')
		.limit(1);
	await supabase
		.from('persons')
		.update({ profile_photo_path: data?.[0]?.path ?? null })
		.eq('id', personId)
		.eq('tree_id', treeId);
}

function field(formData: FormData, name: string): string | null {
	const value = String(formData.get(name) ?? '').trim();
	return value === '' ? null : value;
}

function normalizeSex(value: string | null): Sex {
	return value === 'male' || value === 'female' || value === 'other' ? value : null;
}

export const load: PageServerLoad = async ({ params, locals: { supabase, user } }) => {
	if (!user) redirect(303, '/auth/login');

	const { treeId, personId } = params;

	const { data: tree } = await supabase
		.from('trees')
		.select('id, name')
		.eq('id', treeId)
		.maybeSingle();
	if (!tree) error(404, 'Tree not found');

	const { data: person } = await supabase
		.from('persons')
		.select(
			'id, given_names, surname, birth_surname, nickname, sex, gender, notes, profile_photo_path'
		)
		.eq('id', personId)
		.eq('tree_id', treeId)
		.maybeSingle();
	if (!person) error(404, 'Person not found');

	const { data: membership } = await supabase
		.from('tree_members')
		.select('role')
		.eq('tree_id', treeId)
		.eq('user_id', user.id)
		.maybeSingle();
	const canEdit = membership?.role === 'owner' || membership?.role === 'editor';

	// Everyone in the tree, with the fields the relationship pickers and mini-graph
	// avatars need.
	const { data: everyone } = await supabase
		.from('persons')
		.select('id, given_names, surname, nickname, sex, profile_photo_path')
		.eq('tree_id', treeId);
	const all = everyone ?? [];
	const personById = new Map(all.map((p) => [p.id, p]));

	// This person's gallery photos, in display order.
	const { data: photoRows } = await supabase
		.from('person_photos')
		.select('id, path, position')
		.eq('tree_id', treeId)
		.eq('person_id', personId)
		.order('position');

	// All edges in the tree — small enough to fetch whole, and we need them to build
	// the induced subgraph for the mini tree (not just edges touching this person).
	const [{ data: allPartners }, { data: allLinks }] = await Promise.all([
		supabase.from('partnerships').select('id, partner_a, partner_b, status').eq('tree_id', treeId),
		supabase.from('parent_child_links').select('id, parent_id, child_id').eq('tree_id', treeId)
	]);
	const partnershipsAll = allPartners ?? [];
	const linksAll = allLinks ?? [];

	const partnerRowsSafe = partnershipsAll.filter(
		(p) => p.partner_a === personId || p.partner_b === personId
	);
	const linkRowsSafe = linksAll.filter((r) => r.parent_id === personId || r.child_id === personId);

	const parentLinks = linkRowsSafe.filter((r) => r.child_id === personId);
	const childLinks = linkRowsSafe.filter((r) => r.parent_id === personId);
	const parentIds = parentLinks.map((r) => r.parent_id);

	// Siblings share at least one parent (and aren't this person).
	const siblingIds =
		parentIds.length > 0
			? [
					...new Set(linksAll.filter((l) => parentIds.includes(l.parent_id)).map((l) => l.child_id))
				].filter((id) => id !== personId)
			: [];

	// Batch-sign the profile photos we'll actually show (this person + the people in
	// the mini-graph). External URLs pass through; bucket paths sign in one trip.
	const relatedIds = new Set<string>([
		personId,
		...partnerRowsSafe.map((r) => (r.partner_a === personId ? r.partner_b : r.partner_a)),
		...parentIds,
		...childLinks.map((r) => r.child_id),
		...siblingIds
	]);
	const paths: string[] = [];
	for (const id of relatedIds) {
		const path =
			id === personId ? person.profile_photo_path : personById.get(id)?.profile_photo_path;
		if (path && !isExternal(path)) paths.push(path);
	}
	for (const r of photoRows ?? []) if (r.path && !isExternal(r.path)) paths.push(r.path);
	const signed = new Map<string, string>();
	if (paths.length > 0) {
		const { data: urls } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600);
		for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
	}
	const resolvePhoto = (path: string | null | undefined): string | null =>
		path ? (isExternal(path) ? path : (signed.get(path) ?? null)) : null;

	const photos = (photoRows ?? [])
		.map((r) => ({ id: r.id, url: resolvePhoto(r.path) }))
		.filter((p): p is { id: string; url: string } => !!p.url);

	// A mini-graph node for a related person.
	const node = (id: string) => {
		const p = personById.get(id);
		if (!p) return null;
		return {
			id,
			name: personName(p),
			initials: personInitials(p),
			sex: normalizeSex(p.sex),
			photoUrl: resolvePhoto(p.profile_photo_path)
		};
	};
	const nodes = (ids: string[]) => ids.map(node).filter((n): n is NonNullable<typeof n> => !!n);

	const parents = parentLinks.map((r) => ({ ...node(r.parent_id)!, linkId: r.id })).filter(Boolean);
	const children = childLinks.map((r) => ({ ...node(r.child_id)!, linkId: r.id })).filter(Boolean);
	const partners = partnerRowsSafe.map((r) => {
		const otherId = r.partner_a === personId ? r.partner_b : r.partner_a;
		return { ...node(otherId)!, partnershipId: r.id, status: r.status };
	});
	const siblings = nodes(siblingIds);

	// People not yet directly connected, offered in the relationship picker.
	const connectedIds = new Set<string>([
		personId,
		...partners.map((p) => p.id),
		...parents.map((p) => p.id),
		...children.map((c) => c.id)
	]);
	const candidates = all
		.filter((p) => !connectedIds.has(p.id))
		.map((p) => ({ id: p.id, name: personName(p) }))
		.sort((a, b) => a.name.localeCompare(b.name));

	// Events — birth/residence/death facts, shown as a table sorted by date; each
	// row also carries what the inline edit form needs.
	const { data: eventRows } = await supabase
		.from('events')
		.select(
			'id, type, label, note, event_date, event_date_end, event_qualifier, event_precision, place:places(id, name, lat, lng)'
		)
		.eq('tree_id', treeId)
		.eq('person_id', personId);

	const events = (eventRows ?? [])
		.map((row) => {
			const place: PlaceSelection | null = row.place
				? {
						kind: 'existing',
						id: row.place.id,
						name: row.place.name,
						lat: row.place.lat,
						lng: row.place.lng
					}
				: null;
			const initial: EventRowInitial = {
				type: row.type,
				dateParts: fuzzyDateToParts(fuzzyDateFromColumns(row, 'event')),
				place
			};
			return {
				id: row.id,
				type: row.type,
				icon: eventTypeMeta(row.type).icon,
				label: eventDisplayLabel(row.type, row.label),
				date: formatFuzzyDate(fuzzyDateFromColumns(row, 'event')),
				place: row.place?.name ?? null,
				initial,
				sortKey: row.event_date ?? ''
			};
		})
		.sort((a, b) => {
			if (!a.sortKey) return b.sortKey ? 1 : 0;
			if (!b.sortKey) return -1;
			return a.sortKey.localeCompare(b.sortKey);
		});

	// Birth is expected on everyone — default a new event to it when missing.
	const hasBirth = events.some((e) => e.type === 'birth');
	const defaultType: EventType = hasBirth ? 'residence' : 'birth';

	const { data: placeRows } = await supabase
		.from('places')
		.select('*')
		.eq('tree_id', treeId)
		.order('name');
	// Pre-fill the place: a first birth inherits the parent's location; any later
	// event (a new residence, or a death) starts from this person's own last known
	// place (their most recent residence/birth) to save re-typing it.
	const defaultPlace = hasBirth
		? await inheritedPlace(supabase, treeId, [personId])
		: await parentDefaultPlace(supabase, treeId, personId);

	// Mini family tree: this person + direct relatives, laid out with the same
	// engine as the full tree (just fewer people). Persons need full node fields,
	// edges are the induced subgraph among the subset.
	const subsetIds = new Set<string>([
		personId,
		...parentIds,
		...partners.map((p) => p.id),
		...children.map((c) => c.id),
		...siblingIds
	]);
	const { data: yearEvents } = await supabase
		.from('events')
		.select('person_id, type, event_date')
		.eq('tree_id', treeId)
		.in('type', ['birth', 'death'])
		.in('person_id', [...subsetIds]);
	const yearOf = (iso: string | null) => {
		const y = iso ? Number.parseInt(iso.slice(0, 4), 10) : NaN;
		return Number.isFinite(y) ? y : null;
	};
	const birthYears = new Map<string, number>();
	const deathYears = new Map<string, number>();
	for (const ev of yearEvents ?? []) {
		const y = yearOf(ev.event_date);
		if (y == null) continue;
		const target = ev.type === 'death' ? deathYears : ev.type === 'birth' ? birthYears : null;
		if (target && !target.has(ev.person_id)) target.set(ev.person_id, y);
	}
	const graphPerson = (id: string): GraphPerson | null => {
		const p = personById.get(id);
		if (!p) return null;
		return {
			id,
			name: personName(p),
			surname: p.surname,
			initials: personInitials(p),
			sex: normalizeSex(p.sex),
			photoUrl: resolvePhoto(p.profile_photo_path),
			birthYear: birthYears.get(id) ?? null,
			deathYear: deathYears.get(id) ?? null
		};
	};
	const miniGraph: GraphData = {
		persons: [...subsetIds].map(graphPerson).filter((p): p is GraphPerson => !!p),
		partnerships: partnershipsAll
			.filter((p) => subsetIds.has(p.partner_a) && subsetIds.has(p.partner_b))
			.map((p) => ({
				id: p.id,
				a: p.partner_a,
				b: p.partner_b,
				status: p.status === 'former' ? ('former' as const) : ('current' as const)
			})),
		parentLinks: linksAll
			.filter((l) => subsetIds.has(l.parent_id) && subsetIds.has(l.child_id))
			.map((l) => ({ id: l.id, parent: l.parent_id, child: l.child_id }))
	};

	return {
		tree,
		person,
		photoUrl: resolvePhoto(person.profile_photo_path),
		canEdit,
		parents,
		partners,
		children,
		siblings,
		candidates,
		events,
		hasBirth,
		defaultType,
		places: placeRows ?? [],
		defaultPlace,
		miniGraph,
		centerId: personId,
		photos
	};
};

export const actions: Actions = {
	savePerson: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		await requireEditableTree(supabase, user.id, params.treeId);

		const formData = await request.formData();
		const values = {
			given_names: field(formData, 'given_names'),
			surname: field(formData, 'surname'),
			birth_surname: field(formData, 'birth_surname'),
			nickname: field(formData, 'nickname'),
			sex: field(formData, 'sex'),
			notes: field(formData, 'notes')
		};
		if (!values.given_names && !values.surname && !values.nickname) {
			return fail(400, { personError: 'Enter at least a given name, surname, or nickname.' });
		}

		const { error: dbError } = await supabase
			.from('persons')
			.update(values)
			.eq('id', params.personId)
			.eq('tree_id', params.treeId);
		if (dbError) return fail(400, { personError: dbError.message });
		return { personSaved: true };
	},

	uploadPhoto: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		await requireEditableTree(supabase, user.id, params.treeId);

		const formData = await request.formData();
		const file = formData.get('photo');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { photoError: 'Choose an image to upload.' });
		}
		if (!file.type.startsWith('image/'))
			return fail(400, { photoError: 'That file is not an image.' });
		if (file.size > MAX_PHOTO_BYTES)
			return fail(400, { photoError: 'Image must be 5 MB or smaller.' });

		// Unique object per photo (tree id stays the first path segment so the
		// existing storage RLS policies still apply).
		const path = `${params.treeId}/${params.personId}/${crypto.randomUUID()}`;
		const { error: upErr } = await supabase.storage
			.from(PHOTO_BUCKET)
			.upload(path, file, { contentType: file.type });
		if (upErr) return fail(400, { photoError: upErr.message });

		const { data: last } = await supabase
			.from('person_photos')
			.select('position')
			.eq('tree_id', params.treeId)
			.eq('person_id', params.personId)
			.order('position', { ascending: false })
			.limit(1);
		const nextPos = (last?.[0]?.position ?? -1) + 1;

		const { error: dbErr } = await supabase
			.from('person_photos')
			.insert({ tree_id: params.treeId, person_id: params.personId, path, position: nextPos });
		if (dbErr) return fail(400, { photoError: dbErr.message });

		await syncProfilePhoto(supabase, params.treeId, params.personId);
		return { photoUpdated: true };
	},

	deletePhoto: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		await requireEditableTree(supabase, user.id, params.treeId);

		const formData = await request.formData();
		const photoId = String(formData.get('photoId') ?? '');
		const { data: row } = await supabase
			.from('person_photos')
			.select('path')
			.eq('id', photoId)
			.eq('tree_id', params.treeId)
			.maybeSingle();

		const { error: dbErr } = await supabase
			.from('person_photos')
			.delete()
			.eq('id', photoId)
			.eq('tree_id', params.treeId);
		if (dbErr) return fail(400, { photoError: dbErr.message });

		if (row?.path && !isExternal(row.path)) {
			await supabase.storage.from(PHOTO_BUCKET).remove([row.path]);
		}
		await syncProfilePhoto(supabase, params.treeId, params.personId);
		return { photoUpdated: true };
	},

	reorderPhotos: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		await requireEditableTree(supabase, user.id, params.treeId);

		const formData = await request.formData();
		const order = String(formData.get('order') ?? '')
			.split(',')
			.filter(Boolean);
		for (let i = 0; i < order.length; i++) {
			await supabase
				.from('person_photos')
				.update({ position: i })
				.eq('id', order[i])
				.eq('tree_id', params.treeId)
				.eq('person_id', params.personId);
		}
		await syncProfilePhoto(supabase, params.treeId, params.personId);
		return { photoUpdated: true };
	},

	deletePerson: async ({ params, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		await requireEditableTree(supabase, user.id, params.treeId);

		// Remove the person's storage objects (rows cascade via FK).
		const { data: rows } = await supabase
			.from('person_photos')
			.select('path')
			.eq('tree_id', params.treeId)
			.eq('person_id', params.personId);
		const objects = (rows ?? []).map((r) => r.path).filter((p) => !isExternal(p));
		if (objects.length > 0) await supabase.storage.from(PHOTO_BUCKET).remove(objects);

		const { error: dbError } = await supabase
			.from('persons')
			.delete()
			.eq('id', params.personId)
			.eq('tree_id', params.treeId);
		if (dbError) return fail(400, { personError: dbError.message });
		redirect(303, `/trees/${params.treeId}`);
	},

	addPartner: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		await requireEditableTree(supabase, user.id, params.treeId);

		const formData = await request.formData();
		const partnerId = String(formData.get('personId') ?? '');
		const status = String(formData.get('status') ?? 'current');
		if (!partnerId || partnerId === params.personId) {
			return fail(400, { relError: 'Choose a different person to link as a partner.' });
		}

		const [partner_a, partner_b] = orderedPair(params.personId, partnerId);
		const { error: dbError } = await supabase.from('partnerships').insert({
			tree_id: params.treeId,
			partner_a,
			partner_b,
			status: status === 'former' ? 'former' : 'current'
		});
		if (dbError) return fail(400, { relError: dbError.message });
		return { ok: true };
	},

	addParent: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		await requireEditableTree(supabase, user.id, params.treeId);

		const formData = await request.formData();
		const parentId = String(formData.get('personId') ?? '');
		if (!parentId || parentId === params.personId) {
			return fail(400, { relError: 'Choose a different person to link as a parent.' });
		}

		const { error: dbError } = await supabase
			.from('parent_child_links')
			.insert({ tree_id: params.treeId, parent_id: parentId, child_id: params.personId });
		if (dbError) {
			return fail(400, {
				relError: dbError.code === '23505' ? 'That parent is already linked.' : dbError.message
			});
		}
		return { ok: true };
	},

	addChild: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		await requireEditableTree(supabase, user.id, params.treeId);

		const formData = await request.formData();
		const childId = String(formData.get('personId') ?? '');
		if (!childId || childId === params.personId) {
			return fail(400, { relError: 'Choose a different person to link as a child.' });
		}

		const { error: dbError } = await supabase
			.from('parent_child_links')
			.insert({ tree_id: params.treeId, parent_id: params.personId, child_id: childId });
		if (dbError) {
			return fail(400, {
				relError: dbError.code === '23505' ? 'That child is already linked.' : dbError.message
			});
		}
		return { ok: true };
	},

	setPartnerStatus: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		await requireEditableTree(supabase, user.id, params.treeId);

		const formData = await request.formData();
		const partnershipId = String(formData.get('partnershipId') ?? '');
		const status = String(formData.get('status') ?? '') === 'former' ? 'former' : 'current';
		const { error: dbError } = await supabase
			.from('partnerships')
			.update({ status })
			.eq('id', partnershipId)
			.eq('tree_id', params.treeId);
		if (dbError) return fail(400, { relError: dbError.message });
		return { ok: true };
	},

	removePartnership: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		await requireEditableTree(supabase, user.id, params.treeId);

		const formData = await request.formData();
		const partnershipId = String(formData.get('partnershipId') ?? '');
		const { error: dbError } = await supabase
			.from('partnerships')
			.delete()
			.eq('id', partnershipId)
			.eq('tree_id', params.treeId);
		if (dbError) return fail(400, { relError: dbError.message });
		return { ok: true };
	},

	removeLink: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		await requireEditableTree(supabase, user.id, params.treeId);

		const formData = await request.formData();
		const linkId = String(formData.get('linkId') ?? '');
		const { error: dbError } = await supabase
			.from('parent_child_links')
			.delete()
			.eq('id', linkId)
			.eq('tree_id', params.treeId);
		if (dbError) return fail(400, { relError: dbError.message });
		return { ok: true };
	},

	addEvent: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		await requireEditableTree(supabase, user.id, params.treeId);

		const formData = await request.formData();
		let columns;
		try {
			columns = await parseEventForm(supabase, params.treeId, formData);
		} catch (e) {
			return fail(400, {
				eventError: e instanceof Error ? e.message : 'Could not save the event.'
			});
		}

		const { error: dbError } = await supabase
			.from('events')
			.insert({ tree_id: params.treeId, person_id: params.personId, ...columns });
		if (dbError) return fail(400, { eventError: dbError.message });
		return { ok: true };
	},

	updateEvent: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		await requireEditableTree(supabase, user.id, params.treeId);

		const formData = await request.formData();
		const eventId = String(formData.get('eventId') ?? '');
		if (!eventId) return fail(400, { eventError: 'Missing event.' });

		let columns;
		try {
			columns = await parseEventForm(supabase, params.treeId, formData);
		} catch (e) {
			return fail(400, {
				eventError: e instanceof Error ? e.message : 'Could not save the event.'
			});
		}

		const { error: dbError } = await supabase
			.from('events')
			.update(columns)
			.eq('id', eventId)
			.eq('tree_id', params.treeId)
			.eq('person_id', params.personId);
		if (dbError) return fail(400, { eventError: dbError.message });
		return { ok: true };
	},

	deleteEvent: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		await requireEditableTree(supabase, user.id, params.treeId);

		const formData = await request.formData();
		const eventId = String(formData.get('eventId') ?? '');
		const { error: dbError } = await supabase
			.from('events')
			.delete()
			.eq('id', eventId)
			.eq('tree_id', params.treeId)
			.eq('person_id', params.personId);
		if (dbError) return fail(400, { eventError: dbError.message });
		return { ok: true };
	}
};
