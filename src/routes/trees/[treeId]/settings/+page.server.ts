import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
	const isOwner = tree.owner_id === user.id;

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

	// Pending invitations (only the owner can read these for the tree).
	const { data: inviteRows } = isOwner
		? await supabase
				.from('invitations')
				.select('id, email, role, created_at')
				.eq('tree_id', params.treeId)
				.order('created_at', { ascending: true })
		: { data: [] };

	return {
		tree: { id: tree.id, name: tree.name },
		isOwner,
		members,
		invitations: inviteRows ?? []
	};
};

export const actions: Actions = {
	rename: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		const tree = await loadTree(supabase, params.treeId);
		if (tree.owner_id !== user.id) {
			return fail(403, { renameError: 'Only the owner can rename this tree.' });
		}

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		if (!name) {
			return fail(400, { renameError: 'Please enter a tree name.' });
		}
		if (name.length > 200) {
			return fail(400, { renameError: 'Name must be 200 characters or fewer.' });
		}

		const { error: dbError } = await supabase
			.from('trees')
			.update({ name })
			.eq('id', params.treeId);
		if (dbError) {
			return fail(400, { renameError: dbError.message });
		}

		return { renamed: true };
	},

	invite: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		const tree = await loadTree(supabase, params.treeId);
		if (tree.owner_id !== user.id) {
			return fail(403, { inviteError: 'Only the owner can invite members.' });
		}

		const formData = await request.formData();
		const email = String(formData.get('email') ?? '')
			.trim()
			.toLowerCase();
		const role = String(formData.get('role') ?? 'viewer');

		if (!EMAIL_RE.test(email)) {
			return fail(400, { inviteError: 'Please enter a valid email address.', email });
		}
		if (role !== 'editor' && role !== 'viewer') {
			return fail(400, { inviteError: 'Pick a role of editor or viewer.', email });
		}

		const { error: dbError } = await supabase
			.from('invitations')
			.insert({ tree_id: params.treeId, tree_name: tree.name, email, role });

		if (dbError) {
			// 23505 = unique_violation on (tree_id, email)
			const message =
				dbError.code === '23505'
					? 'That email has already been invited to this tree.'
					: dbError.message;
			return fail(400, { inviteError: message, email });
		}

		return { invited: email };
	},

	revoke: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		const tree = await loadTree(supabase, params.treeId);
		if (tree.owner_id !== user.id) {
			return fail(403, { inviteError: 'Only the owner can revoke invitations.' });
		}

		const formData = await request.formData();
		const invitationId = String(formData.get('invitationId') ?? '');
		const { error: dbError } = await supabase.from('invitations').delete().eq('id', invitationId);
		if (dbError) {
			return fail(400, { inviteError: dbError.message });
		}

		return { revoked: true };
	},

	setRole: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		const tree = await loadTree(supabase, params.treeId);
		if (tree.owner_id !== user.id) {
			return fail(403, { memberError: 'Only the owner can change roles.' });
		}
		const formData = await request.formData();
		const userId = String(formData.get('userId') ?? '');
		const role = String(formData.get('role') ?? '');
		if (role !== 'editor' && role !== 'viewer') {
			return fail(400, { memberError: 'Pick a role of editor or viewer.' });
		}
		const { error: dbError } = await supabase
			.from('tree_members')
			.update({ role })
			.eq('tree_id', params.treeId)
			.eq('user_id', userId)
			.neq('role', 'owner');
		if (dbError) return fail(400, { memberError: dbError.message });
		return { memberUpdated: true };
	},

	removeMember: async ({ params, request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		const tree = await loadTree(supabase, params.treeId);
		if (tree.owner_id !== user.id) {
			return fail(403, { memberError: 'Only the owner can remove members.' });
		}
		const userId = String((await request.formData()).get('userId') ?? '');
		const { error: dbError } = await supabase
			.from('tree_members')
			.delete()
			.eq('tree_id', params.treeId)
			.eq('user_id', userId)
			.neq('role', 'owner');
		if (dbError) return fail(400, { memberError: dbError.message });
		return { memberRemoved: true };
	},

	delete: async ({ params, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		const tree = await loadTree(supabase, params.treeId);
		if (tree.owner_id !== user.id) {
			return fail(403, { deleteError: 'Only the owner can delete this tree.' });
		}

		const { error: dbError } = await supabase.from('trees').delete().eq('id', params.treeId);
		if (dbError) {
			return fail(400, { deleteError: dbError.message });
		}

		redirect(303, '/dashboard');
	}
};
