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
	default: async ({ request, locals: { supabase, user } }) => {
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
	}
};
