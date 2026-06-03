import { error, fail, redirect } from '@sveltejs/kit';
import { personName } from '$lib/person';
import { requireEditableTree } from '$lib/server/treeAccess';
import { parseEventForm } from '$lib/server/eventForm';
import { inheritedPlace } from '$lib/server/parentPlace';
import type { Actions, PageServerLoad } from './$types';

function field(formData: FormData, name: string): string | null {
	const value = String(formData.get(name) ?? '').trim();
	return value === '' ? null : value;
}

export const load: PageServerLoad = async ({ params, locals: { supabase, user } }) => {
	if (!user) redirect(303, '/auth/login');
	const tree = await requireEditableTree(supabase, user.id, params.treeId);

	const { data: parent } = await supabase
		.from('persons')
		.select('id, given_names, surname, nickname')
		.eq('id', params.personId)
		.eq('tree_id', params.treeId)
		.maybeSingle();
	if (!parent) error(404, 'Person not found');

	const [{ data: places }, defaultPlace] = await Promise.all([
		supabase.from('places').select('*').eq('tree_id', params.treeId).order('name'),
		// The child's birthplace defaults to where this parent already is.
		inheritedPlace(supabase, params.treeId, [params.personId])
	]);

	return {
		tree,
		parent: { id: parent.id, name: personName(parent), surname: parent.surname },
		places: places ?? [],
		defaultPlace
	};
};

export const actions: Actions = {
	default: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		await requireEditableTree(supabase, user.id, params.treeId);

		const formData = await request.formData();
		const person = {
			given_names: field(formData, 'given_names'),
			surname: field(formData, 'surname'),
			birth_surname: field(formData, 'birth_surname'),
			nickname: field(formData, 'nickname'),
			sex: field(formData, 'sex'),
			notes: field(formData, 'notes')
		};

		if (!person.given_names && !person.surname && !person.nickname) {
			return fail(400, {
				...person,
				error: 'Enter at least a given name, surname, or nickname.'
			});
		}

		// Parse the birth event up front so an invalid place/date fails before we
		// create anything.
		let birth;
		try {
			birth = await parseEventForm(supabase, params.treeId, formData);
		} catch (e) {
			return fail(400, {
				...person,
				error: e instanceof Error ? e.message : 'Could not save the birthplace.'
			});
		}

		const { data: child, error: personError } = await supabase
			.from('persons')
			.insert({ tree_id: params.treeId, ...person })
			.select('id')
			.single();
		if (personError || !child) {
			return fail(400, { ...person, error: personError?.message ?? 'Could not add the child.' });
		}

		const { error: linkError } = await supabase
			.from('parent_child_links')
			.insert({ tree_id: params.treeId, parent_id: params.personId, child_id: child.id });
		if (linkError) {
			// The person exists; send them to it rather than orphaning the form.
			redirect(303, `/trees/${params.treeId}/persons/${child.id}`);
		}

		// Only record a birth event when there's something to record (a date or a place).
		if (birth.event_date || birth.place_id) {
			await supabase
				.from('events')
				.insert({ tree_id: params.treeId, person_id: child.id, ...birth });
		}

		redirect(303, `/trees/${params.treeId}/persons/${child.id}`);
	}
};
