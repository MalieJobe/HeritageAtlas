import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

async function loadTree(
	supabase: App.Locals['supabase'],
	treeId: string
): Promise<{ id: string; name: string; owner_id: string }> {
	const { data: tree } = await supabase
		.from('trees')
		.select('id, name, owner_id')
		.eq('id', treeId)
		.maybeSingle();
	if (!tree) {
		error(404, 'Tree not found');
	}
	return tree;
}

export const load: PageServerLoad = async ({ params, locals: { supabase, user } }) => {
	if (!user) redirect(303, '/auth/login');

	const tree = await loadTree(supabase, params.treeId);

	const { data: memberRows } = await supabase
		.from('tree_members')
		.select('user_id, role, created_at')
		.eq('tree_id', params.treeId)
		.order('created_at', { ascending: true });

	const rows = memberRows ?? [];

	// tree_members and profiles both key off auth.users with no direct FK between
	// them, so fetch display names separately and merge (co-member RLS permits it).
	const { data: profileRows } = await supabase
		.from('profiles')
		.select('id, display_name')
		.in(
			'id',
			rows.map((row) => row.user_id)
		);
	const displayNames = new Map((profileRows ?? []).map((p) => [p.id, p.display_name]));

	const members = rows.map((row) => ({
		userId: row.user_id,
		role: row.role,
		displayName: displayNames.get(row.user_id) ?? null,
		isYou: row.user_id === user.id
	}));

	return { tree: { id: tree.id, name: tree.name }, isOwner: tree.owner_id === user.id, members };
};

export const actions: Actions = {
	rename: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		const tree = await loadTree(supabase, params.treeId);
		if (tree.owner_id !== user.id) {
			return fail(403, { error: 'Only the owner can rename this tree.' });
		}

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		if (!name) {
			return fail(400, { error: 'Please enter a tree name.' });
		}
		if (name.length > 200) {
			return fail(400, { error: 'Name must be 200 characters or fewer.' });
		}

		const { error: dbError } = await supabase
			.from('trees')
			.update({ name })
			.eq('id', params.treeId);
		if (dbError) {
			return fail(400, { error: dbError.message });
		}

		return { renamed: true };
	},

	delete: async ({ params, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		const tree = await loadTree(supabase, params.treeId);
		if (tree.owner_id !== user.id) {
			return fail(403, { error: 'Only the owner can delete this tree.' });
		}

		const { error: dbError } = await supabase.from('trees').delete().eq('id', params.treeId);
		if (dbError) {
			return fail(400, { error: dbError.message });
		}

		redirect(303, '/trees');
	}
};
