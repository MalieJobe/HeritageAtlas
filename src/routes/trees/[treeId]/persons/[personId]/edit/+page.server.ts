import { error, fail, redirect } from '@sveltejs/kit';
import { requireEditableTree } from '$lib/server/treeAccess';
import type { Actions, PageServerLoad } from './$types';

function field(formData: FormData, name: string): string | null {
	const value = String(formData.get(name) ?? '').trim();
	return value === '' ? null : value;
}

export const load: PageServerLoad = async ({ params, locals: { supabase, user } }) => {
	if (!user) redirect(303, '/auth/login');
	const tree = await requireEditableTree(supabase, user.id, params.treeId);

	const { data: person } = await supabase
		.from('persons')
		.select('id, given_names, surname, birth_surname, nickname, sex, notes')
		.eq('id', params.personId)
		.eq('tree_id', params.treeId)
		.maybeSingle();

	if (!person) {
		error(404, 'Person not found');
	}

	return { tree, person };
};

export const actions: Actions = {
	save: async ({ params, request, locals: { supabase, user } }) => {
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
			return fail(400, { error: 'Enter at least a given name, surname, or nickname.' });
		}

		const { error: dbError } = await supabase
			.from('persons')
			.update(values)
			.eq('id', params.personId)
			.eq('tree_id', params.treeId);

		if (dbError) {
			return fail(400, { error: dbError.message });
		}

		// Detail route arrives in task 1.17; until then land back on the tree.
		redirect(303, `/trees/${params.treeId}`);
	},

	delete: async ({ params, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		await requireEditableTree(supabase, user.id, params.treeId);

		// Relationship edges referencing this person cascade away via FK
		// (on delete cascade), so no dangling links are left behind.
		const { error: dbError } = await supabase
			.from('persons')
			.delete()
			.eq('id', params.personId)
			.eq('tree_id', params.treeId);

		if (dbError) {
			return fail(400, { error: dbError.message });
		}

		redirect(303, `/trees/${params.treeId}`);
	}
};
