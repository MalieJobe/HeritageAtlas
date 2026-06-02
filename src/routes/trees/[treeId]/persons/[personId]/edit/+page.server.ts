import { error, fail, redirect } from '@sveltejs/kit';
import { requireEditableTree } from '$lib/server/treeAccess';
import type { Actions, PageServerLoad } from './$types';

const PHOTO_BUCKET = 'person-photos';
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function field(formData: FormData, name: string): string | null {
	const value = String(formData.get(name) ?? '').trim();
	return value === '' ? null : value;
}

function photoPath(treeId: string, personId: string): string {
	return `${treeId}/${personId}`;
}

export const load: PageServerLoad = async ({ params, locals: { supabase, user } }) => {
	if (!user) redirect(303, '/auth/login');
	const tree = await requireEditableTree(supabase, user.id, params.treeId);

	const { data: person } = await supabase
		.from('persons')
		.select('id, given_names, surname, birth_surname, nickname, sex, notes, profile_photo_path')
		.eq('id', params.personId)
		.eq('tree_id', params.treeId)
		.maybeSingle();

	if (!person) {
		error(404, 'Person not found');
	}

	// Private bucket → hand the browser a short-lived signed URL for the preview.
	let photoUrl: string | null = null;
	if (person.profile_photo_path) {
		const { data: signed } = await supabase.storage
			.from(PHOTO_BUCKET)
			.createSignedUrl(person.profile_photo_path, 3600);
		photoUrl = signed?.signedUrl ?? null;
	}

	return { tree, person, photoUrl };
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

		redirect(303, `/trees/${params.treeId}/persons/${params.personId}`);
	},

	uploadPhoto: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		await requireEditableTree(supabase, user.id, params.treeId);

		const formData = await request.formData();
		const file = formData.get('photo');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { photoError: 'Choose an image to upload.' });
		}
		if (!file.type.startsWith('image/')) {
			return fail(400, { photoError: 'That file is not an image.' });
		}
		if (file.size > MAX_PHOTO_BYTES) {
			return fail(400, { photoError: 'Image must be 5 MB or smaller.' });
		}

		const path = photoPath(params.treeId, params.personId);
		const { error: upErr } = await supabase.storage
			.from(PHOTO_BUCKET)
			.upload(path, file, { upsert: true, contentType: file.type });
		if (upErr) {
			return fail(400, { photoError: upErr.message });
		}

		const { error: dbErr } = await supabase
			.from('persons')
			.update({ profile_photo_path: path })
			.eq('id', params.personId)
			.eq('tree_id', params.treeId);
		if (dbErr) {
			return fail(400, { photoError: dbErr.message });
		}

		return { photoUpdated: true };
	},

	removePhoto: async ({ params, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		await requireEditableTree(supabase, user.id, params.treeId);

		const path = photoPath(params.treeId, params.personId);
		await supabase.storage.from(PHOTO_BUCKET).remove([path]);
		const { error: dbErr } = await supabase
			.from('persons')
			.update({ profile_photo_path: null })
			.eq('id', params.personId)
			.eq('tree_id', params.treeId);
		if (dbErr) {
			return fail(400, { photoError: dbErr.message });
		}

		return { photoUpdated: true };
	},

	delete: async ({ params, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		await requireEditableTree(supabase, user.id, params.treeId);

		// Remove the photo object too (the persons row cascade only covers DB rows).
		await supabase.storage.from(PHOTO_BUCKET).remove([photoPath(params.treeId, params.personId)]);

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
