import { fail, redirect } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/types';
import { findOrCreatePlace } from '$lib/server/places';
import type { PlaceSelection } from '$lib/place';
import type { Actions, PageServerLoad } from './$types';

const PHOTO_BUCKET = 'person-photos';
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
type DB = SupabaseClient<Database>;
type Sex = 'male' | 'female' | 'other' | '';

export const load: PageServerLoad = async ({ locals: { user } }) => {
	if (!user) redirect(303, '/auth/login');
	return {};
};

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

async function addPerson(db: DB, treeId: string, given: string, surname: string, sex: Sex) {
	const { data, error } = await db
		.from('persons')
		.insert({
			tree_id: treeId,
			given_names: given || null,
			surname: surname || null,
			sex: sex || null
		})
		.select('id')
		.single();
	if (error) throw new Error(error.message);
	return data.id;
}

async function link(db: DB, treeId: string, parent: string, child: string) {
	await db
		.from('parent_child_links')
		.insert({ tree_id: treeId, parent_id: parent, child_id: child });
}

/** Insert a dated life event (birth/death/residence). `date` is 'YYYY-MM-DD' or ''. */
async function lifeEvent(
	db: DB,
	treeId: string,
	personId: string,
	type: 'birth' | 'death' | 'residence',
	date: string,
	placeId: string | null,
	opts: { residenceYear?: number } = {}
) {
	if (!date && !placeId && !opts.residenceYear) return;
	const isResidence = type === 'residence';
	await db.from('events').insert({
		tree_id: treeId,
		person_id: personId,
		type,
		event_date: date || (isResidence && opts.residenceYear ? `${opts.residenceYear}-01-01` : null),
		event_precision: date ? 'day' : isResidence ? 'year' : null,
		event_qualifier: !date && isResidence ? 'about' : null,
		place_id: placeId
	});
}

async function resolvePlace(db: DB, treeId: string, raw: string): Promise<string | null> {
	if (!raw) return null;
	try {
		return await findOrCreatePlace(db, treeId, JSON.parse(raw) as PlaceSelection);
	} catch {
		return null;
	}
}

export const actions: Actions = {
	createTree: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		const name = str(await request.formData(), 'name');
		if (!name) return fail(400, { step: 'tree', error: 'Please name your family tree.' });
		const { data, error } = await supabase
			.from('trees')
			.insert({ name, owner_id: user.id })
			.select('id')
			.single();
		if (error) return fail(400, { step: 'tree', error: error.message });
		return { treeId: data.id };
	},

	addSelf: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		const f = await request.formData();
		const treeId = str(f, 'treeId');
		const given = str(f, 'given');
		const surname = str(f, 'surname');
		if (!treeId) return fail(400, { step: 'self', error: 'Something went wrong — restart.' });
		if (!given && !surname) return fail(400, { step: 'self', error: 'Enter your name.' });
		try {
			const selfId = await addPerson(supabase, treeId, given, surname, str(f, 'sex') as Sex);

			const birthPlaceId = await resolvePlace(supabase, treeId, str(f, 'birthPlace'));
			await lifeEvent(supabase, treeId, selfId, 'birth', str(f, 'birthDate'), birthPlaceId);

			const resPlaceId = await resolvePlace(supabase, treeId, str(f, 'residencePlace'));
			if (resPlaceId)
				await lifeEvent(supabase, treeId, selfId, 'residence', '', resPlaceId, {
					residenceYear: new Date().getFullYear()
				});

			const file = f.get('photo');
			if (
				file instanceof File &&
				file.size > 0 &&
				file.type.startsWith('image/') &&
				file.size <= MAX_PHOTO_BYTES
			) {
				const path = `${treeId}/${selfId}/${crypto.randomUUID()}`;
				const { error: upErr } = await supabase.storage
					.from(PHOTO_BUCKET)
					.upload(path, file, { contentType: file.type });
				if (!upErr) {
					await supabase
						.from('person_photos')
						.insert({ tree_id: treeId, person_id: selfId, path, position: 0 });
					await supabase
						.from('persons')
						.update({ profile_photo_path: path })
						.eq('id', selfId)
						.eq('tree_id', treeId);
				}
			}
			return { selfId, selfSurname: surname };
		} catch (e) {
			return fail(400, { step: 'self', error: (e as Error).message });
		}
	},

	addParents: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		const f = await request.formData();
		const treeId = str(f, 'treeId');
		const selfId = str(f, 'selfId');
		if (!treeId || !selfId) return fail(400, { step: 'parents', error: 'Something went wrong.' });
		try {
			for (const role of ['father', 'mother'] as const) {
				const given = str(f, `${role}Given`);
				const surname = str(f, `${role}Surname`);
				if (!given && !surname) continue;
				const id = await addPerson(
					supabase,
					treeId,
					given,
					surname,
					role === 'father' ? 'male' : 'female'
				);
				await link(supabase, treeId, id, selfId);
				await lifeEvent(supabase, treeId, id, 'birth', str(f, `${role}Dob`), null);
				await lifeEvent(supabase, treeId, id, 'death', str(f, `${role}Dod`), null);
			}
			return { parentsDone: true };
		} catch (e) {
			return fail(400, { step: 'parents', error: (e as Error).message });
		}
	},

	addPartner: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		const f = await request.formData();
		const treeId = str(f, 'treeId');
		const selfId = str(f, 'selfId');
		const given = str(f, 'given');
		const surname = str(f, 'surname');
		if (!treeId || !selfId) return fail(400, { step: 'partner', error: 'Something went wrong.' });
		if (!given && !surname) return { partnerId: null };
		try {
			const partnerId = await addPerson(supabase, treeId, given, surname, str(f, 'sex') as Sex);
			const [a, b] = selfId < partnerId ? [selfId, partnerId] : [partnerId, selfId];
			await supabase
				.from('partnerships')
				.insert({ tree_id: treeId, partner_a: a, partner_b: b, status: 'current' });
			return { partnerId };
		} catch (e) {
			return fail(400, { step: 'partner', error: (e as Error).message });
		}
	},

	addChildren: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		const f = await request.formData();
		const treeId = str(f, 'treeId');
		const selfId = str(f, 'selfId');
		const partnerId = str(f, 'partnerId');
		const surname = str(f, 'childSurname');
		if (!treeId || !selfId) return fail(400, { step: 'children', error: 'Something went wrong.' });
		try {
			const givens = f.getAll('childGiven').map((v) => String(v).trim());
			const dobs = f.getAll('childDob').map((v) => String(v).trim());
			for (let i = 0; i < givens.length; i++) {
				if (!givens[i]) continue;
				const childId = await addPerson(supabase, treeId, givens[i], surname, '');
				await link(supabase, treeId, selfId, childId);
				if (partnerId) await link(supabase, treeId, partnerId, childId);
				await lifeEvent(supabase, treeId, childId, 'birth', dobs[i] ?? '', null);
			}
			return { childrenDone: true };
		} catch (e) {
			return fail(400, { step: 'children', error: (e as Error).message });
		}
	}
};
