import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// No UI for this route — it only handles the sign-out POST.
export const load: PageServerLoad = () => {
	redirect(303, '/');
};

export const actions: Actions = {
	default: async ({ locals: { supabase } }) => {
		await supabase.auth.signOut();
		redirect(303, '/');
	}
};
