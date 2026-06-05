import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

/** Only allow redirects to internal paths, to avoid open-redirect abuse. */
function safeRedirect(target: string | null): string {
	if (target && target.startsWith('/') && !target.startsWith('//')) {
		return target;
	}
	return '/dashboard';
}

export const actions: Actions = {
	default: async ({ request, url, locals: { supabase } }) => {
		const formData = await request.formData();
		const email = String(formData.get('email') ?? '');
		const password = String(formData.get('password') ?? '');

		if (!email || !password) {
			return fail(400, { email, error: 'Email and password are required.' });
		}

		const { error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) {
			return fail(400, { email, error: error.message });
		}

		redirect(303, safeRedirect(url.searchParams.get('redirectTo')));
	}
};
