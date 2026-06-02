import { fail, redirect } from '@sveltejs/kit';
import { requireEditableTree } from '$lib/server/treeAccess';
import type { Actions, PageServerLoad } from './$types';

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

		const { data, error: dbError } = await supabase
			.from('persons')
			.insert({ tree_id: params.treeId, ...values })
			.select('id')
			.single();

		if (dbError) {
			return fail(400, { ...values, error: dbError.message });
		}

		redirect(303, `/trees/${params.treeId}/persons/${data.id}`);
	}
};
