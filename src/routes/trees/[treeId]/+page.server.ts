import { error, redirect } from '@sveltejs/kit';
import { loadTreeViewData } from '$lib/server/treeViewData';
import { translate } from '$lib/i18n/translate';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, user, locale } }) => {
	if (!user) redirect(303, '/auth/login');

	// RLS limits this to trees the user is a member of; anything else returns
	// null and is indistinguishable from "doesn't exist" — a 404 either way.
	const { data: tree } = await supabase
		.from('trees')
		.select('id, name, owner_id')
		.eq('id', params.treeId)
		.maybeSingle();

	if (!tree) {
		error(404, translate(locale, 'tree.notFound'));
	}

	const { data: membership } = await supabase
		.from('tree_members')
		.select('role')
		.eq('tree_id', params.treeId)
		.eq('user_id', user.id)
		.maybeSingle();
	const canEdit = membership?.role === 'owner' || membership?.role === 'editor';

	const { graph, map, timeline } = await loadTreeViewData(supabase, params.treeId);

	return { tree, isOwner: tree.owner_id === user.id, canEdit, graph, map, timeline };
};
