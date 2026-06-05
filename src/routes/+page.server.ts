import { redirect } from '@sveltejs/kit';
import { loadTreeViewData } from '$lib/server/treeViewData';
import type { PageServerLoad } from './$types';

const DEMO_TREE = 'windsor';

// The landing demo loads the public Windsor tree. RLS allows anonymous read of
// `is_public` trees (migration 0017), so this works for logged-out visitors too.
export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
	// Logged-in users go straight to their workspace; the landing is for visitors.
	if (user) redirect(303, '/dashboard');

	const { data: tree } = await supabase
		.from('trees')
		.select('id, name')
		.eq('id', DEMO_TREE)
		.maybeSingle();
	if (!tree) return { demo: null };

	const { graph, map, timeline } = await loadTreeViewData(supabase, DEMO_TREE);
	return { demo: { tree, graph, map, timeline } };
};
