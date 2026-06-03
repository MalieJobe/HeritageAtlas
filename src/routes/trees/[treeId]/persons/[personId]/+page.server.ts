import { error, fail, redirect } from '@sveltejs/kit';
import { personName } from '$lib/person';
import { eventDisplayLabel, eventTypeMeta } from '$lib/events';
import { formatFuzzyDate, fuzzyDateFromColumns } from '$lib/fuzzyDate';
import { requireEditableTree } from '$lib/server/treeAccess';
import type { Actions, PageServerLoad } from './$types';

/** Canonical ordering for the symmetric partnership pair (partner_a < partner_b). */
function orderedPair(a: string, b: string): [string, string] {
	return a < b ? [a, b] : [b, a];
}

export const load: PageServerLoad = async ({ params, locals: { supabase, user } }) => {
	if (!user) redirect(303, '/auth/login');

	const { treeId, personId } = params;

	const { data: tree } = await supabase
		.from('trees')
		.select('id, name')
		.eq('id', treeId)
		.maybeSingle();
	if (!tree) {
		error(404, 'Tree not found');
	}

	const { data: person } = await supabase
		.from('persons')
		.select(
			'id, given_names, surname, birth_surname, nickname, sex, gender, notes, profile_photo_path'
		)
		.eq('id', personId)
		.eq('tree_id', treeId)
		.maybeSingle();
	if (!person) {
		error(404, 'Person not found');
	}

	const { data: membership } = await supabase
		.from('tree_members')
		.select('role')
		.eq('tree_id', treeId)
		.eq('user_id', user.id)
		.maybeSingle();
	const canEdit = membership?.role === 'owner' || membership?.role === 'editor';

	let photoUrl: string | null = null;
	if (person.profile_photo_path) {
		const { data: signed } = await supabase.storage
			.from('person-photos')
			.createSignedUrl(person.profile_photo_path, 3600);
		photoUrl = signed?.signedUrl ?? null;
	}

	// All people in the tree (for relationship pickers + name lookups).
	const { data: everyone } = await supabase
		.from('persons')
		.select('id, given_names, surname, nickname')
		.eq('tree_id', treeId);
	const all = everyone ?? [];
	const nameById = new Map(all.map((p) => [p.id, personName(p)]));

	const { data: partnerRows } = await supabase
		.from('partnerships')
		.select('id, partner_a, partner_b, status')
		.eq('tree_id', treeId)
		.or(`partner_a.eq.${personId},partner_b.eq.${personId}`);

	const { data: linkRows } = await supabase
		.from('parent_child_links')
		.select('id, parent_id, child_id')
		.eq('tree_id', treeId)
		.or(`parent_id.eq.${personId},child_id.eq.${personId}`);

	const partnerRowsSafe = partnerRows ?? [];
	const linkRowsSafe = linkRows ?? [];

	const partners = partnerRowsSafe.map((row) => {
		const otherId = row.partner_a === personId ? row.partner_b : row.partner_a;
		return {
			partnershipId: row.id,
			id: otherId,
			name: nameById.get(otherId) ?? 'Unnamed person',
			status: row.status
		};
	});
	const parents = linkRowsSafe
		.filter((r) => r.child_id === personId)
		.map((r) => ({
			linkId: r.id,
			id: r.parent_id,
			name: nameById.get(r.parent_id) ?? 'Unnamed person'
		}));
	const children = linkRowsSafe
		.filter((r) => r.parent_id === personId)
		.map((r) => ({
			linkId: r.id,
			id: r.child_id,
			name: nameById.get(r.child_id) ?? 'Unnamed person'
		}));

	// People not yet connected to this person, offered in the pickers.
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

	// Events — life facts that drive the map timeline. Listed here chronologically.
	const { data: eventRows } = await supabase
		.from('events')
		.select(
			'id, type, label, note, event_date, event_date_end, event_qualifier, event_precision, place:places(name)'
		)
		.eq('tree_id', treeId)
		.eq('person_id', personId);

	const events = (eventRows ?? [])
		.map((row) => ({
			id: row.id,
			icon: eventTypeMeta(row.type).icon,
			label: eventDisplayLabel(row.type, row.label),
			date: formatFuzzyDate(fuzzyDateFromColumns(row, 'event')),
			place: row.place?.name ?? null,
			note: row.note,
			// Lower-bound ISO date for ordering; undated events sort to the end.
			sortKey: row.event_date ?? ''
		}))
		.sort((a, b) => {
			if (!a.sortKey) return b.sortKey ? 1 : 0;
			if (!b.sortKey) return -1;
			return a.sortKey.localeCompare(b.sortKey);
		});

	return { tree, person, photoUrl, canEdit, partners, parents, children, candidates, events };
};

export const actions: Actions = {
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
		if (dbError) {
			return fail(400, { relError: dbError.message });
		}
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
		if (dbError) {
			return fail(400, { relError: dbError.message });
		}
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
		if (dbError) {
			return fail(400, { relError: dbError.message });
		}
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
		if (dbError) {
			return fail(400, { relError: dbError.message });
		}
		return { ok: true };
	}
};
