/**
 * GEDCOM parser (task 5.1).
 *
 * Turns the flat, level-numbered lines of a GEDCOM file (5.5.1 or 7.0) into a
 * tree of records. Each line is `LEVEL [@XREF@] TAG [VALUE]`; indentation is
 * encoded by the level number, and long values are split across CONC/CONT
 * continuation lines, which we fold back into the parent's value here.
 *
 * This module is intentionally dumb: it produces a faithful record tree and a
 * few accessors. Turning that tree into persons/families/events lives in
 * `import.ts`, and date strings are handled by `date.ts`.
 *
 * Encoding note: we assume UTF-8 (always true for 7.0, and the common case for
 * 5.5.1). Legacy ANSEL-encoded 5.5.1 files are not transcoded.
 */

export interface GedcomNode {
	/** Upper-cased tag, e.g. INDI, NAME, BIRT, DATE. */
	tag: string;
	/** The record's own cross-reference id (`@I1@`) — only on level-0 records. */
	xref: string | null;
	/** Line value, with CONC/CONT continuations folded in. May be empty. */
	value: string;
	/** Set when `value` is a pointer to another record (`@F1@`). */
	pointer: string | null;
	children: GedcomNode[];
}

// LEVEL [@XREF@] TAG [VALUE]. The xref only appears (between level and tag) on
// level-0 record lines; a pointer value (after the tag) is captured as VALUE.
const LINE_RE = /^\s*(\d+)\s+(?:(@[^@]+@)\s+)?(\S+)(?:[ \t](.*))?$/;

/** Parse GEDCOM text into its top-level (level-0) records. */
export function parseGedcom(text: string): GedcomNode[] {
	const roots: GedcomNode[] = [];
	// stack[n] = the most recent node opened at level n; a child at level n+1
	// attaches to stack[n].
	const stack: GedcomNode[] = [];

	const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
	for (const raw of lines) {
		if (!raw.trim()) continue;
		const m = LINE_RE.exec(raw);
		if (!m) continue;

		const level = Number(m[1]);
		const xref = m[2] ?? null;
		const tag = m[3].toUpperCase();
		const value = m[4] ?? '';

		// Continuations extend the value of the node one level up.
		if (tag === 'CONC' || tag === 'CONT') {
			const parent = stack[level - 1];
			if (parent) parent.value += (tag === 'CONT' ? '\n' : '') + value;
			continue;
		}

		const node: GedcomNode = { tag, xref, value, pointer: null, children: [] };
		if (level === 0) {
			roots.push(node);
			stack.length = 0;
			stack[0] = node;
		} else {
			const parent = stack[level - 1];
			if (parent) parent.children.push(node);
			stack.length = level; // drop any deeper open nodes
			stack[level] = node;
		}
	}

	const finalize = (n: GedcomNode) => {
		const v = n.value.trim();
		if (/^@[^@]+@$/.test(v)) n.pointer = v;
		n.children.forEach(finalize);
	};
	roots.forEach(finalize);
	return roots;
}

/** The first child with the given tag, if any. */
export function child(node: GedcomNode, tag: string): GedcomNode | undefined {
	return node.children.find((c) => c.tag === tag);
}

/** Trimmed value of the first child with the given tag, or null. */
export function childValue(node: GedcomNode, tag: string): string | null {
	const c = child(node, tag);
	const v = c?.value.trim();
	return v ? v : null;
}

/** All children with the given tag. */
export function childrenWithTag(node: GedcomNode, tag: string): GedcomNode[] {
	return node.children.filter((c) => c.tag === tag);
}
