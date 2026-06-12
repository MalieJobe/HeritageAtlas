import { fail, redirect } from '@sveltejs/kit';
import { buildImportPlan } from '$lib/gedcom/import';
import { translate } from '$lib/i18n';
import { commitImport, type PlaceCoords } from '$lib/server/gedcomImport';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { user } }) => {
	if (!user) redirect(303, '/auth/login');
	return {};
};

export const actions: Actions = {
	// Receives the raw GEDCOM text + (optional) client-geocoded place coordinates,
	// re-parses server-side (authoritative), and writes everything into a new tree.
	commit: async ({ request, locals: { supabase, user, locale } }) => {
		if (!user) redirect(303, '/auth/login');

		const fd = await request.formData();
		const name = (
			String(fd.get('name') ?? '').trim() || translate(locale, 'import.importedTree')
		).slice(0, 200);
		const gedcom = String(fd.get('gedcom') ?? '');
		if (!gedcom.trim()) return fail(400, { error: translate(locale, 'import.noGedcomContent') });

		let coords: PlaceCoords;
		try {
			coords = JSON.parse(String(fd.get('coords') ?? '{}')) as PlaceCoords;
		} catch {
			coords = {};
		}

		const plan = buildImportPlan(gedcom);
		if (plan.persons.length === 0) {
			return fail(400, { error: translate(locale, 'import.noIndividuals') });
		}

		let treeId: string;
		try {
			const result = await commitImport(supabase, user.id, name, plan, coords);
			treeId = result.treeId;
		} catch (e) {
			return fail(500, {
				error: e instanceof Error ? e.message : translate(locale, 'import.importFailed')
			});
		}
		redirect(303, `/trees/${treeId}?imported=${plan.counts.persons}`);
	}
};
