import { createServerClient } from '@supabase/ssr';
import type { Cookies } from '@sveltejs/kit';
import { supabaseAnonKey, supabaseUrl } from './env';
import type { Database } from './types';

/**
 * Supabase client for server-side use (load functions, actions, hooks).
 * Reads/writes the auth session via SvelteKit's request cookies.
 */
export function createSupabaseServerClient(cookies: Cookies) {
	return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
		cookies: {
			getAll: () => cookies.getAll(),
			setAll: (cookiesToSet) => {
				for (const { name, value, options } of cookiesToSet) {
					cookies.set(name, value, { ...options, path: '/' });
				}
			}
		}
	});
}
