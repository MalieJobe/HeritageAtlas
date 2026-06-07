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

// http(s) URLs and root-relative public paths (seeded demo portraits) are used
// as-is; everything else is a Storage bucket path to sign.
const isExternal = (p: string | null | undefined) => !!p && /^(https?:\/\/|\/)/.test(p);

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

/** Friendly message for the one-birth/one-death-per-person unique indexes. */
function duplicateMessage(err: { code?: string; message: string }): string {
	if (err.code === '23505') {
		if (err.message.includes('birth')) return 'This person already has a birth event.';
		if (err.message.includes('death')) return 'This person already has a death event.';
	}
	return err.message;
}

type DB = Parameters<typeof requireEditableTree>[0];

/**
 * Create a person from the relationship "create new" quick-add fields (name, sex)
 * and, if a date/place was given, an accompanying birth event. Returns the new id
 * or a user-facing error message. Used by the add-parent/partner/child/sibling
 * actions so a relative can be created inline (3.5b).
 */
async function createPerson(
	supabase: DB,
	treeId: string,
	formData: FormData
): Promise<{ id: string } | { error: string }> {
	const values = {
		given_names: field(formData, 'given_names'),
		surname: field(formData, 'surname'),
		birth_surname: field(formData, 'birth_surname'),
		nickname: field(formData, 'nickname'),
		sex: field(formData, 'sex')
	};
	if (!values.given_names && !values.surname && !values.nickname) {
		return { error: 'Enter at least a given name, surname, or nickname.' };
	}

	// Validate the (optional) birth event up front so a bad place/date fails before
	// we create the person.
	let birth;
	try {
		birth = await parseEventForm(supabase, treeId, formData);
	} catch (e) {
		return { error: e instanceof Error ? e.message : 'Could not save the birthplace.' };
	}

	const { data: created, error: dbError } = await supabase
		.from('persons')
		.insert({ tree_id: treeId, ...values })
		.select('id')
		.single();
	if (dbError || !created) return { error: dbError?.message ?? 'Could not create the person.' };

	if (birth.type === 'birth' && (birth.event_date || birth.place_id)) {
		await supabase.from('events').insert({ tree_id: treeId, person_id: created.id, ...birth });
	}
	return { id: created.id };
}

/** Insert a parent→child link, treating an existing identical link as success. */
async function linkParentChild(
	supabase: DB,
	treeId: string,
	parentId: string,
	childId: string
): Promise<string | null> {
	const { error: dbError } = await supabase
		.from('parent_child_links')
		.insert({ tree_id: treeId, parent_id: parentId, child_id: childId });
	if (dbError && dbError.code !== '23505') return dbError.message;
	return null;
}

/** Ensure a (current) partnership exists between two people; no-op if already linked. */
async function ensurePartnership(
	supabase: DB,
	treeId: string,
	x: string,
	y: string
): Promise<void> {
	const [partner_a, partner_b] = orderedPair(x, y);
	const { data: existing } = await supabase
		.from('partnerships')
		.select('id')
		.eq('tree_id', treeId)
		.eq('partner_a', partner_a)
		.eq('partner_b', partner_b)
		.maybeSingle();
	if (!existing) {
		await supabase
			.from('partnerships')
			.insert({ tree_id: treeId, partner_a, partner_b, status: 'current' });
	}
}

export const load: PageServerLoad = async ({ params, locals: { supabase, user } }) => {
	if (!user) redirect(303, '/auth/login');

	const { treeId, personId } = params;

	// Phase 1 — every read that only needs the tree/person ids, fired in parallel
	// (this load used to run ~10 queries back-to-back, which is what made every save
	// feel slow; 3.5a).
	const [
		{ data: tree },
		{ data: person },
		{ data: membership },
		{ data: everyone },
		{ data: photoRows },
		{ data: allPartners },
		{ data: allLinks },
		{ data: eventRows },
		{ data: placeRows }
	] = await Promise.all([
		supabase.from('trees').select('id, name').eq('id', treeId).maybeSingle(),
		supabase
			.from('persons')
			.select(
				'id, given_names, surname, birth_surname, nickname, sex, gender, notes, profile_photo_path'
			)
			.eq('id', personId)
			.eq('tree_id', treeId)
			.maybeSingle(),
		supabase
			.from('tree_members')
			.select('role')
			.eq('tree_id', treeId)
			.eq('user_id', user.id)
			.maybeSingle(),
		// Everyone in the tree, with the fields the relationship pickers + mini-graph need.
		supabase
			.from('persons')
			.select('id, given_names, surname, nickname, sex, profile_photo_path')
			.eq('tree_id', treeId),
		supabase
			.from('person_photos')
			.select('id, path, position')
			.eq('tree_id', treeId)
			.eq('person_id', personId)
			.order('position'),
		// All edges in the tree — small enough to fetch whole; needed for the induced subgraph.
		supabase.from('partnerships').select('id, partner_a, partner_b, status').eq('tree_id', treeId),
		supabase.from('parent_child_links').select('id, parent_id, child_id').eq('tree_id', treeId),
		supabase
			.from('events')
			.select(
				'id, type, label, note, event_date, event_date_end, event_qualifier, event_precision, place:places(id, name, lat, lng)'
			)
			.eq('tree_id', treeId)
			.eq('person_id', personId),
		supabase.from('places').select('*').eq('tree_id', treeId).order('name')
	]);
	if (!tree) error(404, 'Tree not found');
	if (!person) error(404, 'Person not found');

	const canEdit = membership?.role === 'owner' || membership?.role === 'editor';
	const all = everyone ?? [];
	const personById = new Map(all.map((p) => [p.id, p]));
	const partnershipsAll = allPartners ?? [];
	const linksAll = allLinks ?? [];

	const partnerRowsSafe = partnershipsAll.filter(
		(p) => p.partner_a === personId || p.partner_b === personId
	);
	const linkRowsSafe = linksAll.filter((r) => r.parent_id === personId || r.child_id === personId);

	const parentLinks = linkRowsSafe.filter((r) => r.child_id === personId);
	const childLinks = linkRowsSafe.filter((r) => r.parent_id === personId);
	const parentIds = parentLinks.map((r) => r.parent_id);
	const partnerIds = partnerRowsSafe.map((r) =>
		r.partner_a === personId ? r.partner_b : r.partner_a
	);
	const childIds = childLinks.map((r) => r.child_id);

	// Siblings share at least one parent (and aren't this person).
	const siblingIds =
		parentIds.length > 0
			? [
					...new Set(linksAll.filter((l) => parentIds.includes(l.parent_id)).map((l) => l.child_id))
				].filter((id) => id !== personId)
			: [];

	const hasBirth = (eventRows ?? []).some((e) => e.type === 'birth');

	// The people whose profile photo we'll show, and the mini-graph subset — both
	// derivable from the raw rows, so we can fan out phase 2 immediately.
	const relatedIds = new Set<string>([
		personId,
		...partnerIds,
		...parentIds,
		...childIds,
		...siblingIds
	]);
	const subsetIds = new Set<string>([
		personId,
		...parentIds,
		...partnerIds,
		...childIds,
		...siblingIds
	]);

	const paths: string[] = [];
	for (const id of relatedIds) {
		const path =
			id === personId ? person.profile_photo_path : personById.get(id)?.profile_photo_path;
		if (path && !isExternal(path)) paths.push(path);
	}
	for (const r of photoRows ?? []) if (r.path && !isExternal(r.path)) paths.push(r.path);

	// Phase 2 — sign the photos, fetch birth/death years for the subset, and resolve
	// the default place, all in parallel (each only needs phase-1 results).
	const [signedRes, { data: yearEvents }, defaultPlace] = await Promise.all([
		paths.length > 0
			? supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600)
			: Promise.resolve({ data: [] as { path: string; signedUrl: string }[] }),
		supabase
			.from('events')
			.select('person_id, type, event_date')
			.eq('tree_id', treeId)
			.in('type', ['birth', 'death'])
			.in('person_id', [...subsetIds]),
		// A first birth inherits the parent's location; any later event starts from
		// this person's own last known place to save re-typing it.
		hasBirth
			? inheritedPlace(supabase, treeId, [personId])
			: parentDefaultPlace(supabase, treeId, personId)
	]);
	const signed = new Map<string, string>();
	for (const u of signedRes.data ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
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

	// Everyone except this person — used by the "other parent" (co-parent) picker
	// when adding a child, where any existing person (not just unconnected ones) is
	// a valid choice.
	const allPeople = all
		.filter((p) => p.id !== personId)
		.map((p) => ({ id: p.id, name: personName(p) }))
		.sort((a, b) => a.name.localeCompare(b.name));

	// Events — birth/residence/death facts, shown as a table sorted by date; each
	// row also carries what the inline edit form needs.
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
	const defaultType: EventType = hasBirth ? 'residence' : 'birth';

	// Mini family tree: this person + direct relatives, laid out with the same
	// engine as the full tree (just fewer people). The subset + its birth/death
	// years were already gathered in phase 2.
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
		allPeople,
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

	// Resolve the relative for an add action: an existing person (mode=existing) or a
	// freshly created one (mode=create). Returns the id + whether it was created.
	// (Inline so each action shares the create/validate flow — 3.5b.)

	addPartner: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		await requireEditableTree(supabase, user.id, params.treeId);

		const formData = await request.formData();
		const status = String(formData.get('status') ?? 'current') === 'former' ? 'former' : 'current';

		let partnerId: string;
		let createdId: string | null = null;
		if (String(formData.get('mode')) === 'create') {
			const res = await createPerson(supabase, params.treeId, formData);
			if ('error' in res) return fail(400, { relError: res.error });
			partnerId = res.id;
			createdId = res.id;
		} else {
			partnerId = String(formData.get('personId') ?? '');
			if (!partnerId || partnerId === params.personId) {
				return fail(400, { relError: 'Choose a different person to link as a partner.' });
			}
		}

		const [partner_a, partner_b] = orderedPair(params.personId, partnerId);
		const { error: dbError } = await supabase
			.from('partnerships')
			.insert({ tree_id: params.treeId, partner_a, partner_b, status });
		if (dbError) {
			return fail(400, {
				relError: dbError.code === '23505' ? 'They are already partners.' : dbError.message
			});
		}
		return { ok: true, createdId };
	},

	addParent: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		await requireEditableTree(supabase, user.id, params.treeId);

		const formData = await request.formData();
		let parentId: string;
		let createdId: string | null = null;
		if (String(formData.get('mode')) === 'create') {
			const res = await createPerson(supabase, params.treeId, formData);
			if ('error' in res) return fail(400, { relError: res.error });
			parentId = res.id;
			createdId = res.id;
		} else {
			parentId = String(formData.get('personId') ?? '');
			if (!parentId || parentId === params.personId) {
				return fail(400, { relError: 'Choose a different person to link as a parent.' });
			}
		}

		const linkErr = await linkParentChild(supabase, params.treeId, parentId, params.personId);
		if (linkErr) return fail(400, { relError: linkErr });

		// If this person now has exactly two parents who aren't yet partners, offer to
		// link them as a couple (the client asks "Are X and Y partners?").
		const { data: pls } = await supabase
			.from('parent_child_links')
			.select('parent_id')
			.eq('tree_id', params.treeId)
			.eq('child_id', params.personId);
		const parentIds = [...new Set((pls ?? []).map((l) => l.parent_id))];
		let promptPartners: { aId: string; bId: string; aName: string; bName: string } | null = null;
		if (parentIds.length === 2) {
			const [a, b] = orderedPair(parentIds[0], parentIds[1]);
			const { data: existing } = await supabase
				.from('partnerships')
				.select('id')
				.eq('tree_id', params.treeId)
				.eq('partner_a', a)
				.eq('partner_b', b)
				.maybeSingle();
			if (!existing) {
				const { data: ppl } = await supabase
					.from('persons')
					.select('id, given_names, surname, nickname')
					.in('id', [a, b]);
				const nameOf = (id: string) => {
					const p = (ppl ?? []).find((x) => x.id === id);
					return p ? personName(p) : 'parent';
				};
				promptPartners = { aId: a, bId: b, aName: nameOf(a), bName: nameOf(b) };
			}
		}
		return { ok: true, createdId, promptPartners };
	},

	addChild: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		await requireEditableTree(supabase, user.id, params.treeId);

		const formData = await request.formData();
		let childId: string;
		let createdId: string | null = null;
		if (String(formData.get('mode')) === 'create') {
			const res = await createPerson(supabase, params.treeId, formData);
			if ('error' in res) return fail(400, { relError: res.error });
			childId = res.id;
			createdId = res.id;
		} else {
			childId = String(formData.get('personId') ?? '');
			if (!childId || childId === params.personId) {
				return fail(400, { relError: 'Choose a different person to link as a child.' });
			}
		}

		const linkErr = await linkParentChild(supabase, params.treeId, params.personId, childId);
		if (linkErr) return fail(400, { relError: linkErr });

		// Co-parent (the second parent): a new person (co_* fields), an existing one
		// (coparent_id), or none. If chosen and not yet a partner, link them too.
		let coId: string | null = null;
		const coGiven = field(formData, 'co_given_names');
		const coSurname = field(formData, 'co_surname');
		if (coGiven || coSurname) {
			const { data: co } = await supabase
				.from('persons')
				.insert({
					tree_id: params.treeId,
					given_names: coGiven,
					surname: coSurname,
					sex: field(formData, 'co_sex')
				})
				.select('id')
				.single();
			coId = co?.id ?? null;
		} else {
			const sel = String(formData.get('coparent_id') ?? '');
			if (sel) coId = sel;
		}
		if (coId && coId !== params.personId && coId !== childId) {
			await linkParentChild(supabase, params.treeId, coId, childId);
			await ensurePartnership(supabase, params.treeId, params.personId, coId);
		}
		return { ok: true, createdId };
	},

	addSibling: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		await requireEditableTree(supabase, user.id, params.treeId);

		// A sibling shares this person's parents — so there must be at least one.
		const { data: pls } = await supabase
			.from('parent_child_links')
			.select('parent_id')
			.eq('tree_id', params.treeId)
			.eq('child_id', params.personId);
		const parentIds = [...new Set((pls ?? []).map((l) => l.parent_id))];
		if (parentIds.length === 0) {
			return fail(400, {
				relError: 'Add a parent first — siblings are linked through shared parents.'
			});
		}

		const formData = await request.formData();
		let siblingId: string;
		let createdId: string | null = null;
		if (String(formData.get('mode')) === 'create') {
			const res = await createPerson(supabase, params.treeId, formData);
			if ('error' in res) return fail(400, { relError: res.error });
			siblingId = res.id;
			createdId = res.id;
		} else {
			siblingId = String(formData.get('personId') ?? '');
			if (!siblingId || siblingId === params.personId) {
				return fail(400, { relError: 'Choose a different person to link as a sibling.' });
			}
		}

		// Link the sibling to every parent this person has.
		for (const parentId of parentIds) {
			await linkParentChild(supabase, params.treeId, parentId, siblingId);
		}
		return { ok: true, createdId };
	},

	// Used by the "Are X and Y partners?" prompt after a second parent is added.
	linkPartners: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		await requireEditableTree(supabase, user.id, params.treeId);

		const formData = await request.formData();
		const aId = String(formData.get('aId') ?? '');
		const bId = String(formData.get('bId') ?? '');
		if (!aId || !bId || aId === bId)
			return fail(400, { relError: 'Could not link those partners.' });
		await ensurePartnership(supabase, params.treeId, aId, bId);
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
		if (dbError) return fail(400, { eventError: duplicateMessage(dbError) });
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
		if (dbError) return fail(400, { eventError: duplicateMessage(dbError) });
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
