/**
 * The set of supported UI languages. Keep this in sync with the `locale` check
 * constraint on `profiles.locale` (migration 0019) and the locale folders under
 * `./locales/`.
 */
export const LOCALES = ['en', 'de'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Human-readable names shown in the language picker (each in its own language). */
export const LOCALE_LABELS: Record<Locale, string> = {
	en: 'English',
	de: 'Deutsch'
};

/** Narrowing guard for untrusted values (cookies, form input). */
export function isLocale(value: unknown): value is Locale {
	return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Coerce any input to a valid locale, falling back to the default. */
export function toLocale(value: unknown): Locale {
	return isLocale(value) ? value : DEFAULT_LOCALE;
}
