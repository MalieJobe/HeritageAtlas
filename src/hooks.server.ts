import { createSupabaseServerClient } from '$lib/supabase/server';
import { isLocale, toLocale, type Locale } from '$lib/i18n/locale';
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

const LOCALE_COOKIE = 'ha_locale';
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/** Routes that do NOT require an authenticated session. */
const PUBLIC_ROUTES = ['/', '/auth', '/share'];

function isPublic(pathname: string): boolean {
	return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * Attaches a request-scoped Supabase client to locals, resolves the (validated)
 * session/user, and exposes a safeGetSession helper for load functions/actions.
 */
const supabase: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createSupabaseServerClient(event.cookies);

	// getSession() alone trusts the cookie without verifying it. Call getUser()
	// FIRST so the JWT is validated against the auth server and the library's
	// "insecure session.user" warning is suppressed before getSession() wraps it;
	// then read the session for its tokens. Identity always comes from getUser().
	event.locals.safeGetSession = async () => {
		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error || !user) {
			return { session: null, user: null };
		}

		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		return { session, user };
	};

	const { session, user } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.user = user;

	// Resolve the request's UI language: a signed-in user's saved profile.locale
	// wins (follows them across devices); otherwise the ha_locale cookie; else the
	// default. The select is defensive — if the locale column hasn't been migrated
	// yet it simply falls back to the cookie. We refresh the cookie so SSR and the
	// anonymous /share pages stay in sync and the client can read it for instant
	// switching.
	let locale: Locale = toLocale(event.cookies.get(LOCALE_COOKIE));
	if (user) {
		const { data: profile } = await event.locals.supabase
			.from('profiles')
			.select('locale')
			.eq('id', user.id)
			.maybeSingle();
		if (profile && isLocale(profile.locale)) {
			locale = profile.locale;
		}
	}
	event.locals.locale = locale;

	if (event.cookies.get(LOCALE_COOKIE) !== locale) {
		event.cookies.set(LOCALE_COOKIE, locale, {
			path: '/',
			maxAge: LOCALE_COOKIE_MAX_AGE,
			httpOnly: false,
			sameSite: 'lax'
		});
	}

	return resolve(event, {
		// Render the document in the active language for a11y / correct hyphenation.
		transformPageChunk: ({ html }) => html.replace('%lang%', locale),
		// Supabase needs these headers to pass through to the client.
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};

/** Redirects unauthenticated users away from protected routes, and signed-in users away from /auth. */
const authGuard: Handle = async ({ event, resolve }) => {
	const { session } = event.locals;
	const { pathname } = event.url;

	if (!session && !isPublic(pathname)) {
		const redirectTo = encodeURIComponent(pathname + event.url.search);
		redirect(303, `/auth/login?redirectTo=${redirectTo}`);
	}

	// Signed-in users have no reason to see the login/signup forms. (Note: /auth/logout
	// is intentionally excluded — a signed-in user must be able to reach it.)
	if (session && (pathname === '/auth/login' || pathname === '/auth/signup')) {
		redirect(303, '/');
	}

	return resolve(event);
};

export const handle: Handle = sequence(supabase, authGuard);
