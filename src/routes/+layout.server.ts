import type { LayoutServerLoad } from './$types';

/**
 * Exposes the validated session/user (resolved in hooks.server.ts) to the
 * universal load, and forwards cookies so the server-side client in +layout.ts
 * can read the auth state during SSR.
 */
export const load: LayoutServerLoad = async ({ locals: { session, user, locale }, cookies }) => {
	return {
		session,
		user,
		locale,
		cookies: cookies.getAll()
	};
};
