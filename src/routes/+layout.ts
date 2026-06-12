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

	// Validate with getUser() before getSession(): on the server this sets the
	// library's suppression flag before getSession() wraps session.user, avoiding
	// the "insecure session.user" warning. Identity comes from getUser().
	const {
		data: { user }
	} = await supabase.auth.getUser();
	const {
		data: { session }
	} = await supabase.auth.getSession();

	return { supabase, session, user, locale: data.locale };
};
