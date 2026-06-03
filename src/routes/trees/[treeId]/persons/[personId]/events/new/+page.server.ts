import { error, fail, redirect } from '@sveltejs/kit';
import { personName } from '$lib/person';
import { requireEditableTree } from '$lib/server/treeAccess';
import { parseEventForm } from '$lib/server/eventForm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, user } }) => {
	if (!user) redirect(303, '/auth/login');
	const tree = await requireEditableTree(supabase, user.id, params.treeId);

	const { data: person } = await supabase
		.from('persons')
		.select('id, given_names, surname, nickname')
		.eq('id', params.personId)
		.eq('tree_id', params.treeId)
		.maybeSingle();
	if (!person) error(404, 'Person not found');

	const { data: places } = await supabase
		.from('places')
		.select('*')
		.eq('tree_id', params.treeId)
		.order('name');

	return { tree, person: { id: person.id, name: personName(person) }, places: places ?? [] };
};

export const actions: Actions = {
	default: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		await requireEditableTree(supabase, user.id, params.treeId);

		const formData = await request.formData();
		let columns;
		try {
			columns = await parseEventForm(supabase, params.treeId, formData);
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Could not save the event.' });
		}

		const { error: dbError } = await supabase
			.from('events')
			.insert({ tree_id: params.treeId, person_id: params.personId, ...columns });
		if (dbError) {
			return fail(400, { error: dbError.message });
		}

		redirect(303, `/trees/${params.treeId}/persons/${params.personId}`);
	}
};
