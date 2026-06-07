/**
 * GEDCOM → import plan (tasks 5.2 map persons, 5.3 map relationships,
 * 5.4 map events/places).
 *
 * Walks the parsed record tree into a flat, serializable ImportPlan: people with
 * their events, families (→ partnerships + parent-child links), and the set of
 * unique place names to geocode. The plan is what the review UI previews and what
 * the server commit writes — it carries no DB ids, only GEDCOM xrefs.
 */

import type { EventType } from '$lib/events';
import type { FuzzyDate } from '$lib/fuzzyDate';
import { normalizePlaceName } from '$lib/place';
import { parseGedcom, child, childValue, childrenWithTag, type GedcomNode } from './parse';
import { parseGedcomDate } from './date';

export type ImportSex = 'male' | 'female' | 'other' | null;

export interface ImportEvent {
	type: EventType;
	/** Free-text name for non-standard events (shown instead of the type label). */
	label: string | null;
	date: FuzzyDate;
	placeName: string | null;
	note: string | null;
}

export interface ImportPerson {
	xref: string;
	given: string | null;
	surname: string | null;
	nickname: string | null;
	sex: ImportSex;
	notes: string | null;
	events: ImportEvent[];
}

export interface ImportFamily {
	/** Partner xrefs (0–2). Two → a partnership; each links as a parent to children. */
	partners: string[];
	children: string[];
}

export interface ImportCounts {
	persons: number;
	partnerships: number;
	parentChild: number;
	events: number;
	places: number;
}

export interface ImportPlan {
	treeName: string | null;
	persons: ImportPerson[];
	families: ImportFamily[];
	/** Unique place names (original casing), ready to geocode. */
	placeNames: string[];
	warnings: string[];
	counts: ImportCounts;
}

// GEDCOM event tags we keep, mapped to our event types. The app only tracks/maps
// birth, residence and death; the rest are imported as their nearest enum value
// (with a human label) so the data isn't lost on the person's timeline.
const EVENT_TAGS: Record<string, { type: EventType; label: string | null }> = {
	BIRT: { type: 'birth', label: null },
	DEAT: { type: 'death', label: null },
	RESI: { type: 'residence', label: null },
	OCCU: { type: 'occupation', label: null },
	BAPM: { type: 'custom', label: 'Baptism' },
	CHR: { type: 'custom', label: 'Christening' },
	BURI: { type: 'custom', label: 'Burial' },
	GRAD: { type: 'custom', label: 'Graduation' },
	EMIG: { type: 'custom', label: 'Emigration' },
	IMMI: { type: 'custom', label: 'Immigration' },
	NATU: { type: 'custom', label: 'Naturalization' },
	// Generic event — the human label comes from its TYPE sub-tag (see below).
	EVEN: { type: 'custom', label: null }
};

function sexFrom(value: string | null): ImportSex {
	switch ((value ?? '').toUpperCase()) {
		case 'M':
			return 'male';
		case 'F':
			return 'female';
		case 'X':
		case 'U':
			return 'other';
		default:
			return null;
	}
}

/** Split a GEDCOM NAME ("John /Smith/ Jr") into given + surname, honouring GIVN/SURN. */
function parseName(indi: GedcomNode): { given: string | null; surname: string | null } {
	const nameNode = child(indi, 'NAME');
	let given: string | null = null;
	let surname: string | null = null;
	if (nameNode) {
		const m = /^(.*?)\/(.*?)\/(.*)$/.exec(nameNode.value);
		if (m) {
			given = `${m[1].trim()} ${m[3].trim()}`.trim() || null;
			surname = m[2].trim() || null;
		} else {
			given = nameNode.value.trim() || null;
		}
		const givn = childValue(nameNode, 'GIVN');
		const surn = childValue(nameNode, 'SURN');
		if (givn) given = givn;
		if (surn) surname = surn;
	}
	return { given, surname };
}

function gatherNotes(node: GedcomNode): string | null {
	// Titles (royal/noble TITL) are worth keeping; fold them in with any notes.
	const titles = childrenWithTag(node, 'TITL')
		.map((n) => n.value.trim())
		.filter(Boolean);
	const notes = childrenWithTag(node, 'NOTE')
		.map((n) => n.value.trim())
		.filter(Boolean);
	const parts = [...titles, ...notes];
	return parts.length ? parts.join('\n\n') : null;
}

function parseEvents(indi: GedcomNode): ImportEvent[] {
	const events: ImportEvent[] = [];
	let hasBirth = false;
	let hasDeath = false;
	for (const node of indi.children) {
		const mapped = EVENT_TAGS[node.tag];
		if (!mapped) continue;
		// One birth / one death per person (DB constraint) — keep the first.
		if (mapped.type === 'birth') {
			if (hasBirth) continue;
			hasBirth = true;
		}
		if (mapped.type === 'death') {
			if (hasDeath) continue;
			hasDeath = true;
		}
		const date = parseGedcomDate(childValue(node, 'DATE'));
		const placeName = childValue(node, 'PLAC');
		const note = childValue(node, 'NOTE');
		// Skip events with nothing useful to store.
		if (!date.date && !placeName && !note) continue;
		// A TYPE sub-tag names a generic/custom event (e.g. EVEN → "Burial").
		const label = childValue(node, 'TYPE') ?? mapped.label;
		events.push({ type: mapped.type, label, date, placeName, note });
	}
	return events;
}

/** Build a serializable import plan from raw GEDCOM text. */
export function buildImportPlan(text: string): ImportPlan {
	const roots = parseGedcom(text);
	const warnings: string[] = [];

	const persons: ImportPerson[] = [];
	const families: ImportFamily[] = [];
	const placeSeen = new Set<string>();
	const placeNames: string[] = [];
	let eventCount = 0;
	let droppedNoXref = 0;

	const addPlace = (name: string | null) => {
		if (!name) return;
		const key = normalizePlaceName(name);
		if (placeSeen.has(key)) return;
		placeSeen.add(key);
		placeNames.push(name);
	};

	for (const rec of roots) {
		if (rec.tag === 'INDI') {
			if (!rec.xref) {
				droppedNoXref++;
				continue;
			}
			const { given, surname } = parseName(rec);
			const events = parseEvents(rec);
			eventCount += events.length;
			for (const e of events) addPlace(e.placeName);
			persons.push({
				xref: rec.xref,
				given,
				surname,
				nickname: child(rec, 'NAME') ? childValue(child(rec, 'NAME')!, 'NICK') : null,
				sex: sexFrom(childValue(rec, 'SEX')),
				notes: gatherNotes(rec),
				events
			});
		} else if (rec.tag === 'FAM') {
			const partners = [...childrenWithTag(rec, 'HUSB'), ...childrenWithTag(rec, 'WIFE')]
				.map((n) => n.pointer)
				.filter((p): p is string => !!p);
			const kids = childrenWithTag(rec, 'CHIL')
				.map((n) => n.pointer)
				.filter((p): p is string => !!p);
			if (partners.length === 0 && kids.length === 0) continue;
			families.push({ partners, children: kids });
		}
	}

	// Only keep references to people we actually imported.
	const known = new Set(persons.map((p) => p.xref));
	const cleanedFamilies = families.map((f) => ({
		partners: f.partners.filter((p) => known.has(p)),
		children: f.children.filter((c) => known.has(c))
	}));

	// Count partnerships (unique partner pairs) and parent-child links.
	const pairSeen = new Set<string>();
	let partnerships = 0;
	let parentChild = 0;
	for (const f of cleanedFamilies) {
		if (f.partners.length >= 2) {
			const [a, b] = [f.partners[0], f.partners[1]].sort();
			const key = `${a}|${b}`;
			if (!pairSeen.has(key)) {
				pairSeen.add(key);
				partnerships++;
			}
		}
		parentChild += f.partners.length * f.children.length;
	}

	if (droppedNoXref > 0) {
		warnings.push(`${droppedNoXref} individual record(s) without an id were skipped.`);
	}
	const marriages = roots.filter((r) => r.tag === 'FAM').filter((r) => child(r, 'MARR')).length;
	if (marriages > 0) {
		warnings.push(
			`${marriages} marriage event(s) found — partnerships are imported, but marriage dates aren't stored (relationships carry no dates).`
		);
	}

	return {
		treeName: importedTreeName(roots),
		persons,
		families: cleanedFamilies,
		placeNames,
		warnings,
		counts: {
			persons: persons.length,
			partnerships,
			parentChild,
			events: eventCount,
			places: placeNames.length
		}
	};
}

/** Best-effort tree name from the GEDCOM header (the source software's file name). */
function importedTreeName(roots: GedcomNode[]): string | null {
	const head = roots.find((r) => r.tag === 'HEAD');
	if (!head) return null;
	const sour = child(head, 'SOUR');
	const fileName =
		childValue(head, 'FILE') ?? (sour ? (childValue(sour, 'NAME') ?? sour.value.trim()) : null);
	return fileName || null;
}
