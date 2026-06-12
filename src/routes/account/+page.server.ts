import { error, fail, redirect } from '@sveltejs/kit';
import { translate } from '$lib/i18n/translate';
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from '$lib/i18n/locale';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, user, locale } }) => {
	// The auth guard guarantees a user here, but narrow the type for safety.
	if (!user) {
		redirect(303, '/auth/login');
	}

	const { data: profile, error: dbError } = await supabase
		.from('profiles')
		.select('display_name')
		.eq('id', user.id)
		.maybeSingle();

	if (dbError) {
		error(500, translate(locale, 'account.loadError'));
	}

	return {
		email: user.email,
		displayName: profile?.display_name ?? ''
	};
};

export const actions: Actions = {
	// Must be a named action: SvelteKit forbids a `default` action alongside named
	// ones (changePassword/deleteAccount), which otherwise 500s every action here.
	updateProfile: async ({ request, locals: { supabase, user } }) => {
		if (!user) {
			redirect(303, '/auth/login');
		}

		const formData = await request.formData();
		const displayName = String(formData.get('displayName') ?? '').trim();

		const { error: dbError } = await supabase
			.from('profiles')
			.update({ display_name: displayName || null })
			.eq('id', user.id);

		if (dbError) {
			return fail(400, { displayName, error: dbError.message });
		}

		return { displayName, success: true };
	},

	changePassword: async ({ request, locals: { supabase, user, locale } }) => {
		if (!user) redirect(303, '/auth/login');
		const password = String((await request.formData()).get('password') ?? '');
		if (password.length < 8) {
			return fail(400, { passwordError: translate(locale, 'account.passwordTooShort') });
		}
		const { error: authError } = await supabase.auth.updateUser({ password });
		if (authError) return fail(400, { passwordError: authError.message });
		return { passwordChanged: true };
	},

	// Persist the UI language: update the profile (follows the user across devices)
	// and refresh the cookie (SSR + instant client switch, which the page already
	// applied optimistically).
	setLocale: async ({ request, cookies, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		const value = String((await request.formData()).get('locale') ?? '');
		if (!isLocale(value)) return fail(400, { localeError: true });
		cookies.set(LOCALE_COOKIE, value, {
			path: '/',
			maxAge: LOCALE_COOKIE_MAX_AGE,
			httpOnly: false,
			sameSite: 'lax'
		});
		await supabase.from('profiles').update({ locale: value }).eq('id', user.id);
		return { localeChanged: true };
	},

	deleteAccount: async ({ locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		// Service-role deletion happens in the delete-account Edge Function; this
		// forwards the caller's JWT so it deletes only their own account.
		const { error: fnError } = await supabase.functions.invoke('delete-account', {
			method: 'POST'
		});
		if (fnError) return fail(400, { deleteError: fnError.message });
		await supabase.auth.signOut();
		redirect(303, '/');
	}
};
