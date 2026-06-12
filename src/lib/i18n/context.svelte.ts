import { getContext, setContext } from 'svelte';
import { translate } from './translate';
import { DEFAULT_LOCALE, type Locale } from './locale';

/**
 * Reactive i18n for components. The root layout calls provideI18n(); every
 * component calls useI18n() at the top of its <script> and uses `t(...)` in
 * markup. `t` reads the $state-backed locale, so every `{t('…')}` re-renders
 * the instant the language changes — and because the holder lives in component
 * context (not a module global), concurrent SSR requests never bleed.
 */
const I18N_KEY = Symbol('i18n');

export interface I18n {
	/** The active locale (reactive). */
	readonly locale: Locale;
	/** Switch language live (also persist via the account action for it to stick). */
	setLocale: (locale: Locale) => void;
	/** Translate a key, optionally interpolating ICU values. Reactive on locale. */
	t: (key: string, values?: Record<string, unknown>) => string;
}

export function provideI18n(initial: Locale = DEFAULT_LOCALE): I18n {
	let locale = $state<Locale>(initial);

	const i18n: I18n = {
		get locale() {
			return locale;
		},
		setLocale(next: Locale) {
			locale = next;
		},
		t(key, values) {
			return translate(locale, key, values);
		}
	};

	setContext(I18N_KEY, i18n);
	return i18n;
}

export function useI18n(): I18n {
	const i18n = getContext<I18n | undefined>(I18N_KEY);
	if (!i18n) {
		throw new Error(
			'useI18n() called with no provider — provideI18n() must run in a parent layout.'
		);
	}
	return i18n;
}
