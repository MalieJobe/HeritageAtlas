import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/** Loads the tree and confirms the user may edit it (owner or editor). */
async function requireEditableTree(
	supabase: App.Locals['supabase'],
	userId: string,
	treeId: string
): Promise<{ id: string; name: string }> {
	const { data: tree } = await supabase
		.from('trees')
		.select('id, name')
		.eq('id', treeId)
		.maybeSingle();
	if (!tree) {
		error(404, 'Tree not found');
	}

	const { data: membership } = await supabase
		.from('tree_members')
		.select('role')
		.eq('tree_id', treeId)
		.eq('user_id', userId)
		.maybeSingle();
	if (membership?.role !== 'owner' && membership?.role !== 'editor') {
		error(403, 'You do not have permission to edit this tree.');
	}

	return tree;
}

function field(formData: FormData, name: string): string | null {
	const value = String(formData.get(name) ?? '').trim();
	return value === '' ? null : value;
}

export const load: PageServerLoad = async ({ params, locals: { supabase, user } }) => {
	if (!user) redirect(303, '/auth/login');
	const tree = await requireEditableTree(supabase, user.id, params.treeId);
	return { tree };
};

export const actions: Actions = {
	default: async ({ params, request, locals: { supabase, user } }) => {
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
			return fail(400, { ...values, error: 'Enter at least a given name, surname, or nickname.' });
		}

		const { error: dbError } = await supabase
			.from('persons')
			.insert({ tree_id: params.treeId, ...values });

		if (dbError) {
			return fail(400, { ...values, error: dbError.message });
		}

		// Detail route arrives in task 1.17; until then land back on the tree.
		redirect(303, `/trees/${params.treeId}`);
	}
};
