// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/types';
import type { Locale } from '$lib/i18n/locale';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			supabase: SupabaseClient<Database>;
			/** Validated session + user (calls getUser() to verify the JWT). */
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
			session: Session | null;
			user: User | null;
			/** Active UI language for this request (profile → cookie → default). */
			locale: Locale;
		}
		interface PageData {
			session: Session | null;
			user: User | null;
			locale: Locale;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
