import { test, expect } from 'vitest';
import { messages } from './messages';
import { LOCALES } from './locale';

/**
 * Completeness / parity guard. Every locale must define the EXACT same set of
 * keys, no value may be blank, and the ICU placeholders ({name}, {count}, …)
 * must match across locales so a translation can't silently drop an
 * interpolation. English is the reference locale.
 */

const REFERENCE = 'en';

function icuArgs(message: string): Set<string> {
	// Capture real ICU argument names only: a word immediately after `{` that is
	// followed by `}` (simple `{name}`) or `,` (`{count, plural, …}`). Plural
	// branch text like `{your parent}` (word followed by a space) is NOT an
	// argument and is correctly skipped.
	const args = new Set<string>();
	const re = /\{(\w+)\s*[,}]/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(message))) args.add(m[1]);
	return args;
}

test('every locale defines the same keys as English', () => {
	const reference = new Set(Object.keys(messages[REFERENCE]));
	for (const locale of LOCALES) {
		if (locale === REFERENCE) continue;
		const here = new Set(Object.keys(messages[locale]));
		const missing = [...reference].filter((k) => !here.has(k)).sort();
		const extra = [...here].filter((k) => !reference.has(k)).sort();
		expect(missing, `${locale} is missing keys`).toEqual([]);
		expect(extra, `${locale} has keys not in ${REFERENCE}`).toEqual([]);
	}
});

test('no translation is blank', () => {
	for (const locale of LOCALES) {
		const blanks = Object.entries(messages[locale])
			.filter(([, v]) => v.trim() === '')
			.map(([k]) => k);
		expect(blanks, `${locale} has blank values`).toEqual([]);
	}
});

test('ICU placeholders match the English reference for every key', () => {
	const mismatches: string[] = [];
	for (const [key, enValue] of Object.entries(messages[REFERENCE])) {
		const expected = icuArgs(enValue);
		for (const locale of LOCALES) {
			if (locale === REFERENCE) continue;
			const value = messages[locale][key];
			if (value === undefined) continue; // covered by the key-parity test
			const got = icuArgs(value);
			const same = expected.size === got.size && [...expected].every((a) => got.has(a));
			if (!same) {
				mismatches.push(
					`${locale} "${key}": expected {${[...expected].join(', ')}}, got {${[...got].join(', ')}}`
				);
			}
		}
	}
	expect(mismatches, 'ICU argument drift between locales').toEqual([]);
});
