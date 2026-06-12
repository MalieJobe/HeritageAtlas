import { fail, redirect } from '@sveltejs/kit';
import { translate } from '$lib/i18n/translate';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
	if (!user) redirect(303, '/auth/login');

	// Every accessible tree has a membership row for this user (owners are
	// auto-enrolled), so one query gives both the trees and the user's role.
	const { data, error: dbError } = await supabase
		.from('tree_members')
		.select('role, tree:trees(id, name, owner_id, created_at)')
		.eq('user_id', user.id);

	if (dbError) {
		return { trees: [], pendingInvites: 0 };
	}

	const trees = (data ?? [])
		.filter((row) => row.tree)
		.map((row) => ({
			id: row.tree!.id,
			name: row.tree!.name,
			role: row.role,
			isOwner: row.tree!.owner_id === user.id
		}))
		.sort((a, b) => a.name.localeCompare(b.name));

	// Surface any invitations waiting for this account's email.
	const email = user.email?.toLowerCase() ?? '';
	const { count: pendingInvites } = await supabase
		.from('invitations')
		.select('id', { count: 'exact', head: true })
		.eq('email', email);

	return { trees, pendingInvites: pendingInvites ?? 0 };
};

export const actions: Actions = {
	create: async ({ request, locals: { supabase, user, locale } }) => {
		if (!user) redirect(303, '/auth/login');

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();

		if (!name) {
			return fail(400, { name, error: translate(locale, 'tree.list.errorNoName') });
		}
		if (name.length > 200) {
			return fail(400, { name, error: translate(locale, 'tree.list.errorNameTooLong') });
		}

		const { data, error: dbError } = await supabase
			.from('trees')
			.insert({ name, owner_id: user.id })
			.select('id')
			.single();

		if (dbError) {
			return fail(400, { name, error: dbError.message });
		}

		redirect(303, `/trees/${data.id}`);
	}
};
