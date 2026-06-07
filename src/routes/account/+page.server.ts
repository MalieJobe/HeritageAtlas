import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
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
		error(500, 'Could not load your profile.');
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

	changePassword: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		const password = String((await request.formData()).get('password') ?? '');
		if (password.length < 8) {
			return fail(400, { passwordError: 'Password must be at least 8 characters.' });
		}
		const { error: authError } = await supabase.auth.updateUser({ password });
		if (authError) return fail(400, { passwordError: authError.message });
		return { passwordChanged: true };
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
