import { createBrowserClient } from '@supabase/ssr';
import { supabaseAnonKey, supabaseUrl } from './env';
import type { Database } from './types';

/**
 * Supabase client for use in the browser. Persists the auth session in cookies
 * (via @supabase/ssr) so it stays in sync with the server.
 */
export function createSupabaseBrowserClient() {
	return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
}
