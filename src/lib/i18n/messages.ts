import type { Locale } from './locale';

/**
 * Loads and merges every translation file for each locale into one flat
 * dictionary of `dot.notation.key -> message`. Each JSON file under
 * `./locales/<locale>/` already namespaces its own keys (e.g. settings.json
 * holds `"settings.account"`), so we just merge them. Add a new area by
 * dropping in a matching file in BOTH locale folders — no wiring needed.
 */
const enFiles = import.meta.glob('./locales/en/*.json', { eager: true });
const deFiles = import.meta.glob('./locales/de/*.json', { eager: true });

function merge(files: Record<string, unknown>): Record<string, string> {
	const out: Record<string, string> = {};
	for (const mod of Object.values(files)) {
		Object.assign(out, (mod as { default: Record<string, string> }).default);
	}
	return out;
}

export const messages: Record<Locale, Record<string, string>> = {
	en: merge(enFiles),
	de: merge(deFiles)
};
