import { error, fail, redirect } from '@sveltejs/kit';
import { translate } from '$lib/i18n/translate';
import type { Locale } from '$lib/i18n/locale';
import type { Actions, PageServerLoad } from './$types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function loadTree(
	supabase: App.Locals['supabase'],
	treeId: string,
	locale: Locale
): Promise<{ id: string; name: string; owner_id: string; share_token: string | null }> {
	const { data: tree } = await supabase
		.from('trees')
		.select('id, name, owner_id, share_token')
		.eq('id', treeId)
		.maybeSingle();
	if (!tree) {
		error(404, translate(locale, 'tree.notFound'));
	}
	return tree;
}

export const load: PageServerLoad = async ({ params, locals: { supabase, user, locale } }) => {
	if (!user) redirect(303, '/auth/login');

	const tree = await loadTree(supabase, params.treeId, locale);
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
		invitations: inviteRows ?? [],
		// Whether a public (password-protected) share link is active. Owner only.
		shareToken: isOwner ? tree.share_token : null
	};
};

export const actions: Actions = {
	rename: async ({ params, request, locals: { supabase, user, locale } }) => {
		if (!user) redirect(303, '/auth/login');
		const tree = await loadTree(supabase, params.treeId, locale);
		if (tree.owner_id !== user.id) {
			return fail(403, { renameError: translate(locale, 'tree.settings.errorRenameOwnerOnly') });
		}

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		if (!name) {
			return fail(400, { renameError: translate(locale, 'tree.settings.errorNoName') });
		}
		if (name.length > 200) {
			return fail(400, { renameError: translate(locale, 'tree.settings.errorNameTooLong') });
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

	// Create or rotate a password-protected public share link (owner only; the RPC
	// re-checks ownership and hashes the password in the database).
	share: async ({ params, request, locals: { supabase, user, locale } }) => {
		if (!user) redirect(303, '/auth/login');
		const password = String((await request.formData()).get('password') ?? '');
		if (password.length < 4) {
			return fail(400, { shareError: translate(locale, 'tree.settings.errorSharePassword') });
		}
		const { error: rpcError } = await supabase.rpc('set_tree_share', {
			p_tree_id: params.treeId,
			p_password: password
		});
		if (rpcError) return fail(400, { shareError: rpcError.message });
		return { shared: true };
	},

	// Turn the public share link off (owner only).
	unshare: async ({ params, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		const { error: rpcError } = await supabase.rpc('clear_tree_share', {
			p_tree_id: params.treeId
		});
		if (rpcError) return fail(400, { shareError: rpcError.message });
		return { unshared: true };
	},

	invite: async ({ params, request, locals: { supabase, user, locale } }) => {
		if (!user) redirect(303, '/auth/login');
		const tree = await loadTree(supabase, params.treeId, locale);
		if (tree.owner_id !== user.id) {
			return fail(403, { inviteError: translate(locale, 'tree.settings.errorInviteOwnerOnly') });
		}

		const formData = await request.formData();
		const email = String(formData.get('email') ?? '')
			.trim()
			.toLowerCase();
		const role = String(formData.get('role') ?? 'viewer');

		if (!EMAIL_RE.test(email)) {
			return fail(400, {
				inviteError: translate(locale, 'tree.settings.errorInvalidEmail'),
				email
			});
		}
		if (role !== 'editor' && role !== 'viewer') {
			return fail(400, {
				inviteError: translate(locale, 'tree.settings.errorInviteRoleInvalid'),
				email
			});
		}

		const { error: dbError } = await supabase
			.from('invitations')
			.insert({ tree_id: params.treeId, tree_name: tree.name, email, role });

		if (dbError) {
			// 23505 = unique_violation on (tree_id, email)
			const message =
				dbError.code === '23505'
					? translate(locale, 'tree.settings.errorAlreadyInvited')
					: dbError.message;
			return fail(400, { inviteError: message, email });
		}

		return { invited: email };
	},

	revoke: async ({ params, request, locals: { supabase, user, locale } }) => {
		if (!user) redirect(303, '/auth/login');
		const tree = await loadTree(supabase, params.treeId, locale);
		if (tree.owner_id !== user.id) {
			return fail(403, { inviteError: translate(locale, 'tree.settings.errorRevokeOwnerOnly') });
		}

		const formData = await request.formData();
		const invitationId = String(formData.get('invitationId') ?? '');
		const { error: dbError } = await supabase.from('invitations').delete().eq('id', invitationId);
		if (dbError) {
			return fail(400, { inviteError: dbError.message });
		}

		return { revoked: true };
	},

	setRole: async ({ params, request, locals: { supabase, user, locale } }) => {
		if (!user) redirect(303, '/auth/login');
		const tree = await loadTree(supabase, params.treeId, locale);
		if (tree.owner_id !== user.id) {
			return fail(403, { memberError: translate(locale, 'tree.settings.errorRoleOwnerOnly') });
		}
		const formData = await request.formData();
		const userId = String(formData.get('userId') ?? '');
		const role = String(formData.get('role') ?? '');
		if (role !== 'editor' && role !== 'viewer') {
			return fail(400, { memberError: translate(locale, 'tree.settings.errorRoleInvalid') });
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

	removeMember: async ({ params, request, locals: { supabase, user, locale } }) => {
		if (!user) redirect(303, '/auth/login');
		const tree = await loadTree(supabase, params.treeId, locale);
		if (tree.owner_id !== user.id) {
			return fail(403, { memberError: translate(locale, 'tree.settings.errorRemoveOwnerOnly') });
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

	delete: async ({ params, locals: { supabase, user, locale } }) => {
		if (!user) redirect(303, '/auth/login');
		const tree = await loadTree(supabase, params.treeId, locale);
		if (tree.owner_id !== user.id) {
			return fail(403, { deleteError: translate(locale, 'tree.settings.errorDeleteOwnerOnly') });
		}

		const { error: dbError } = await supabase.from('trees').delete().eq('id', params.treeId);
		if (dbError) {
			return fail(400, { deleteError: dbError.message });
		}

		redirect(303, '/dashboard');
	}
};
