import { test, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Lint guard: there must be NO hardcoded user-facing English left in the app —
 * every visible string has to come from `t(...)` / `translate(...)`. This scans
 * the source on disk (not the bundle) and fails with a file:line list of any
 * offender, so new hardcoded strings can't slip in.
 *
 * It's deliberately heuristic. The few legitimately-literal strings (the brand
 * name, etc.) live in the allowlists below with a reason.
 */

const SRC = join(process.cwd(), 'src');

// Trimmed Svelte text nodes that are allowed to stay literal.
const SVELTE_TEXT_ALLOW = new Set<string>([
	'HeritageAtlas' // brand name — never translated
]);

// Substrings that, if present in a server sentence-literal, mean it's not a
// user-facing UI message (none needed yet — kept for future escape hatches).
const SERVER_SENTENCE_ALLOW: string[] = [];

function walk(dir: string, keep: (p: string) => boolean): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) out.push(...walk(p, keep));
		else if (keep(p)) out.push(p);
	}
	return out;
}

function lineOf(content: string, index: number): number {
	let line = 1;
	for (let i = 0; i < index && i < content.length; i++) if (content[i] === '\n') line++;
	return line;
}

const hasLetter = (s: string) => /\p{L}/u.test(s);
const letterCount = (s: string) => (s.match(/\p{L}/gu) ?? []).length;

/** Strip <script>, <style>, comments, then collapse every {…} expression. */
function stripSvelte(content: string): string {
	let s = content
		.replace(/<script[\s\S]*?<\/script>/g, '')
		.replace(/<style[\s\S]*?<\/style>/g, '')
		.replace(/<!--[\s\S]*?-->/g, '');
	// Collapse mustache expressions innermost-first so nested braces ({t('x', { n })}) vanish.
	let prev: string;
	do {
		prev = s;
		s = s.replace(/\{[^{}]*\}/g, ' ');
	} while (s !== prev);
	return s;
}

const ATTR_RE = /\b(placeholder|title|aria-label|alt)\s*=\s*(["'])([^"']*)\2/g;

function scanSvelte(file: string, content: string): string[] {
	const offenders: string[] = [];

	// 1) Attribute literals that should be translated (dynamic ={...} won't match).
	let m: RegExpExecArray | null;
	while ((m = ATTR_RE.exec(content))) {
		const value = m[3].trim();
		if (value && hasLetter(value) && !SVELTE_TEXT_ALLOW.has(value)) {
			offenders.push(`${file}:${lineOf(content, m.index)}  ${m[1]}="${value}"`);
		}
	}

	// 2) Visible text nodes (after stripping scripts/styles/expressions).
	const stripped = stripSvelte(content);
	const textRe = />([^<>]+)</g;
	while ((m = textRe.exec(stripped))) {
		const text = m[1].replace(/\s+/g, ' ').trim();
		if (!text || !hasLetter(text)) continue;
		if (letterCount(text) < 2) continue; // single stray letters (e.g. the "H" logo)
		if (SVELTE_TEXT_ALLOW.has(text)) continue;
		offenders.push(`${file}:${lineOf(stripped, m.index)}  text: "${text}"`);
	}
	return offenders;
}

// A capitalised, multi-word English literal: "Capital word word…" with an
// optional trailing .?! — catches both full sentences ("Email is required.")
// and short messages ("Tree not found"). Translated calls pass a dot-notation
// KEY (single token, no spaces) so they never match. Hyphenated/identifier-ish
// literals (Content-Type, parent_id) don't match either.
const SENTENCE_RE = /(["'])([A-Z][a-z]+(?: [a-z]+)+[.?!]?)\1/g;

/** Blank out comments (keeping newlines/length so line numbers stay accurate). */
function stripComments(s: string): string {
	return s
		.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
		.replace(/(^|[^:])\/\/[^\n]*/g, (m, p1: string) => p1 + ' '.repeat(m.length - p1.length));
}

function scanServer(file: string, content: string): string[] {
	const offenders: string[] = [];
	const code = stripComments(content);
	let m: RegExpExecArray | null;
	while ((m = SENTENCE_RE.exec(code))) {
		const sentence = m[2];
		if (SERVER_SENTENCE_ALLOW.some((a) => sentence.includes(a))) continue;
		offenders.push(`${file}:${lineOf(content, m.index)}  "${sentence}"`);
	}
	return offenders;
}

const rel = (p: string) => p.slice(SRC.length + 1);

test('no hardcoded user-facing strings in Svelte components', () => {
	const files = walk(SRC, (p) => p.endsWith('.svelte'));
	const offenders = files.flatMap((f) => scanSvelte(rel(f), readFileSync(f, 'utf8')));
	expect(offenders, `Untranslated Svelte strings found:\n${offenders.join('\n')}`).toEqual([]);
});

test('no hardcoded user-facing messages in route server files', () => {
	// Route-level server code is where user-facing fail()/error() messages live.
	const files = walk(SRC, (p) =>
		/\/routes\/.*(\+page\.server\.ts|\+server\.ts|\+layout\.server\.ts)$/.test(p)
	);
	const offenders = files.flatMap((f) => scanServer(rel(f), readFileSync(f, 'utf8')));
	expect(offenders, `Untranslated server messages found:\n${offenders.join('\n')}`).toEqual([]);
});
