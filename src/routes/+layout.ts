import { supabasePublishableKey, supabaseUrl } from '$lib/supabase/env';
import type { Database } from '$lib/supabase/types';
import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr';
import type { LayoutLoad } from './$types';

/**
 * Builds a Supabase client that works on both server (during SSR) and browser,
 * and resolves the current session/user. Depends on 'supabase:auth' so the
 * layout reruns whenever we invalidate it after an auth state change.
 */
export const load: LayoutLoad = async ({ data, depends, fetch }) => {
	depends('supabase:auth');

	const supabase = isBrowser()
		? createBrowserClient<Database>(supabaseUrl(), supabasePublishableKey(), {
				global: { fetch }
			})
		: createServerClient<Database>(supabaseUrl(), supabasePublishableKey(), {
				global: { fetch },
				cookies: { getAll: () => data.cookies }
			});

	const {
		data: { session }
	} = await supabase.auth.getSession();
	const {
		data: { user }
	} = await supabase.auth.getUser();

	return { supabase, session, user };
};
