import { env } from '$env/dynamic/public';

function requireEnv(name: string, value: string | undefined): string {
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}. See .env.example.`);
	}
	return value;
}

/** Public Supabase credentials, read at runtime from PUBLIC_SUPABASE_* env vars. */
export const supabaseUrl = () => requireEnv('PUBLIC_SUPABASE_URL', env.PUBLIC_SUPABASE_URL);

/**
 * The publishable (browser-safe) Supabase API key. This is Supabase's current
 * naming for what used to be called the "anon" key — safe to expose to the client.
 */
export const supabasePublishableKey = () =>
	requireEnv('PUBLIC_SUPABASE_PUBLISHABLE_KEY', env.PUBLIC_SUPABASE_PUBLISHABLE_KEY);
