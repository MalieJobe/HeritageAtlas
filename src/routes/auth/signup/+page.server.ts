import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

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
		if (password.length < 8) {
			return fail(400, { email, error: 'Password must be at least 8 characters.' });
		}

		const { data, error } = await supabase.auth.signUp({ email, password });
		if (error) {
			return fail(400, { email, error: error.message });
		}

		// When email confirmation is enabled, signUp returns no session — the user
		// must confirm via the emailed link before they can sign in.
		if (!data.session) {
			return { email, checkEmail: true };
		}

		redirect(303, safeRedirect(url.searchParams.get('redirectTo')));
	}
};
