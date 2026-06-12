import { fail, redirect } from '@sveltejs/kit';
import { translate } from '$lib/i18n/translate';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
	if (!user) redirect(303, '/auth/login');

	const email = user.email?.toLowerCase() ?? '';
	const { data } = await supabase
		.from('invitations')
		.select('id, tree_id, tree_name, role')
		.eq('email', email)
		.order('created_at', { ascending: true });

	return { invitations: data ?? [] };
};

export const actions: Actions = {
	accept: async ({ request, locals: { supabase, user, locale } }) => {
		if (!user) redirect(303, '/auth/login');

		const formData = await request.formData();
		const invitationId = String(formData.get('invitationId') ?? '');

		const { data: inv } = await supabase
			.from('invitations')
			.select('tree_id, role')
			.eq('id', invitationId)
			.maybeSingle();
		if (!inv) {
			return fail(400, { error: translate(locale, 'invitations.noLongerAvailable') });
		}

		// Allowed by the "Invitees can join" RLS policy because a matching invite exists.
		const { error: insErr } = await supabase
			.from('tree_members')
			.insert({ tree_id: inv.tree_id, user_id: user.id, role: inv.role });
		// 23505 = already a member; that's fine, fall through to cleanup + redirect.
		if (insErr && insErr.code !== '23505') {
			return fail(400, { error: insErr.message });
		}

		await supabase.from('invitations').delete().eq('id', invitationId);
		redirect(303, `/trees/${inv.tree_id}`);
	},

	decline: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');

		const formData = await request.formData();
		const invitationId = String(formData.get('invitationId') ?? '');
		const { error: dbError } = await supabase.from('invitations').delete().eq('id', invitationId);
		if (dbError) {
			return fail(400, { error: dbError.message });
		}

		return { declined: true };
	}
};
