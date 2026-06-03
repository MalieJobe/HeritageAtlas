import { error, fail, redirect } from '@sveltejs/kit';
import { personName } from '$lib/person';
import { fuzzyDateFromColumns, fuzzyDateToParts } from '$lib/fuzzyDate';
import { requireEditableTree } from '$lib/server/treeAccess';
import { parseEventForm } from '$lib/server/eventForm';
import type { EventFormInitial } from '$lib/components/EventForm.svelte';
import type { PlaceSelection } from '$lib/place';
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

	const { data: ev } = await supabase
		.from('events')
		.select(
			'id, type, label, note, event_date, event_date_end, event_qualifier, event_precision, place:places(id, name, lat, lng)'
		)
		.eq('id', params.eventId)
		.eq('tree_id', params.treeId)
		.eq('person_id', params.personId)
		.maybeSingle();
	if (!ev) error(404, 'Event not found');

	const { data: places } = await supabase
		.from('places')
		.select('*')
		.eq('tree_id', params.treeId)
		.order('name');

	const place: PlaceSelection | null = ev.place
		? {
				kind: 'existing',
				id: ev.place.id,
				name: ev.place.name,
				lat: ev.place.lat,
				lng: ev.place.lng
			}
		: null;

	const event: EventFormInitial = {
		type: ev.type,
		label: ev.label ?? '',
		note: ev.note ?? '',
		dateParts: fuzzyDateToParts(fuzzyDateFromColumns(ev, 'event')),
		place
	};

	return {
		tree,
		person: { id: person.id, name: personName(person) },
		places: places ?? [],
		event
	};
};

export const actions: Actions = {
	save: async ({ params, request, locals: { supabase, user } }) => {
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
			.update(columns)
			.eq('id', params.eventId)
			.eq('tree_id', params.treeId);
		if (dbError) {
			return fail(400, { error: dbError.message });
		}

		redirect(303, `/trees/${params.treeId}/persons/${params.personId}`);
	},

	delete: async ({ params, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		await requireEditableTree(supabase, user.id, params.treeId);

		const { error: dbError } = await supabase
			.from('events')
			.delete()
			.eq('id', params.eventId)
			.eq('tree_id', params.treeId);
		if (dbError) {
			return fail(400, { error: dbError.message });
		}

		redirect(303, `/trees/${params.treeId}/persons/${params.personId}`);
	}
};
