import { error, fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { translate } from '$lib/i18n/translate';
import { buildTreeViewData, type TreeViewRows } from '$lib/server/treeViewData';
import type { Actions, PageServerLoad } from './$types';

const cookieName = (token: string) => `ha_share_${token}`;
const cookiePath = (token: string) => `/share/${token}`;

interface SharedPayload {
	tree: { id: string; name: string };
	persons: TreeViewRows['persons'];
	partnerships: TreeViewRows['partnerships'];
	links: TreeViewRows['links'];
	events: TreeViewRows['events'];
}

// Shared trees never expose private photos (anon can't sign them) — initials only.
function toRows(payload: SharedPayload): TreeViewRows {
	return {
		persons: payload.persons.map((p) => ({ ...p, photoUrl: null })),
		partnerships: payload.partnerships,
		links: payload.links,
		events: payload.events
	};
}

export const load: PageServerLoad = async ({ params, cookies, locals: { supabase, locale } }) => {
	const token = params.token;
	const { data: name } = await supabase.rpc('shared_tree_meta', { p_token: token });
	if (!name) error(404, translate(locale, 'share.invalidLink'));

	const pw = cookies.get(cookieName(token));
	if (pw) {
		const { data } = await supabase.rpc('get_shared_tree', { p_token: token, p_password: pw });
		if (data) {
			const payload = data as unknown as SharedPayload;
			return { unlocked: true, name, tree: payload.tree, view: buildTreeViewData(toRows(payload)) };
		}
		// The password changed (or the link was reset) — drop the stale cookie.
		cookies.delete(cookieName(token), { path: cookiePath(token) });
	}
	return { unlocked: false, name };
};

export const actions: Actions = {
	unlock: async ({ params, request, cookies, locals: { supabase, locale } }) => {
		const token = params.token;
		const password = String((await request.formData()).get('password') ?? '');
		if (!password) return fail(400, { error: translate(locale, 'share.enterPassword') });

		const { data } = await supabase.rpc('get_shared_tree', {
			p_token: token,
			p_password: password
		});
		if (!data) return fail(400, { error: translate(locale, 'share.incorrectPassword') });

		// Remember access for this link only (httpOnly, scoped to the share path).
		cookies.set(cookieName(token), password, {
			path: cookiePath(token),
			httpOnly: true,
			sameSite: 'lax',
			secure: !dev,
			maxAge: 60 * 60 * 8
		});
		redirect(303, cookiePath(token));
	}
};
