import { error, redirect } from '@sveltejs/kit';
import { personName } from '$lib/person';
import type { PageServerLoad } from './$types';

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

	// Relationships touching this person.
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

	// Names for every related person, fetched once.
	const relatedIds = new Set<string>();
	for (const row of partnerRowsSafe) {
		relatedIds.add(row.partner_a === personId ? row.partner_b : row.partner_a);
	}
	for (const row of linkRowsSafe) {
		relatedIds.add(row.parent_id === personId ? row.child_id : row.parent_id);
	}

	const { data: relatedPersons } = relatedIds.size
		? await supabase
				.from('persons')
				.select('id, given_names, surname, nickname')
				.in('id', [...relatedIds])
		: { data: [] };
	const nameById = new Map((relatedPersons ?? []).map((p) => [p.id, personName(p)]));
	const label = (id: string) => ({ id, name: nameById.get(id) ?? 'Unnamed person' });

	const partners = partnerRowsSafe.map((row) => {
		const otherId = row.partner_a === personId ? row.partner_b : row.partner_a;
		return { ...label(otherId), status: row.status };
	});
	const parents = linkRowsSafe
		.filter((r) => r.child_id === personId)
		.map((r) => label(r.parent_id));
	const children = linkRowsSafe
		.filter((r) => r.parent_id === personId)
		.map((r) => label(r.child_id));

	return { tree, person, photoUrl, canEdit, partners, parents, children };
};
