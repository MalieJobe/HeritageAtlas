/**
 * GEDCOM export (task 5.7).
 *
 * Serializes a tree's people + relationships + events into valid GEDCOM 5.5.1
 * text. Families are reconstructed from partnerships and parent-child links:
 * children are grouped by their exact set of parents, and childless couples still
 * get a FAM record so the partnership survives a round-trip.
 */

import type { EventType } from '$lib/events';
import type { FuzzyDate } from '$lib/fuzzyDate';
import { formatGedcomDate } from './date';

export type ExportSex = 'male' | 'female' | 'other' | null;

export interface ExportEvent {
	type: EventType;
	label: string | null;
	date: FuzzyDate;
	placeName: string | null;
	note: string | null;
}

export interface ExportPerson {
	id: string;
	given: string | null;
	surname: string | null;
	nickname: string | null;
	sex: ExportSex;
	notes: string | null;
	events: ExportEvent[];
}

export interface ExportInput {
	treeName: string;
	persons: ExportPerson[];
	partnerships: { a: string; b: string }[];
	parentChild: { parent: string; child: string }[];
}

const EVENT_TAG: Record<EventType, string> = {
	birth: 'BIRT',
	death: 'DEAT',
	residence: 'RESI',
	occupation: 'OCCU',
	marriage: 'MARR',
	custom: 'EVEN'
};

const SEX_TAG: Record<NonNullable<ExportSex>, string> = { male: 'M', female: 'F', other: 'U' };

const MAX_VALUE = 200; // keep lines comfortably under GEDCOM's 255-char limit

/** Emit a tag line, splitting on newlines (CONT) and long runs (CONC). */
function emit(out: string[], level: number, tag: string, value?: string | null) {
	if (value == null || value === '') {
		out.push(`${level} ${tag}`);
		return;
	}
	const lines = value.split('\n');
	lines.forEach((line, li) => {
		const lineTag = li === 0 ? tag : 'CONT';
		const lineLevel = li === 0 ? level : level + 1;
		if (line === '') {
			out.push(`${lineLevel} ${lineTag}`);
			return;
		}
		// Break overly long lines with CONC.
		let first = true;
		for (let i = 0; i < line.length; i += MAX_VALUE) {
			const chunk = line.slice(i, i + MAX_VALUE);
			if (first) {
				out.push(`${lineLevel} ${lineTag} ${chunk}`);
				first = false;
			} else {
				out.push(`${level + 1} CONC ${chunk}`);
			}
		}
	});
}

interface Family {
	gid: string;
	parents: string[];
	children: string[];
}

/** Group children by their parent-set and add childless couples (from partnerships). */
function buildFamilies(input: ExportInput): {
	families: Family[];
	byPerson: Map<string, Family[]>;
} {
	const childParents = new Map<string, string[]>();
	for (const { parent, child } of input.parentChild) {
		const arr = childParents.get(child) ?? [];
		if (!arr.includes(parent)) arr.push(parent);
		childParents.set(child, arr);
	}

	const byKey = new Map<string, Family>();
	const keyOf = (parents: string[]) => [...parents].sort().join('|');
	const ensure = (parents: string[]): Family => {
		const key = keyOf(parents);
		let fam = byKey.get(key);
		if (!fam) {
			fam = { gid: '', parents: [...parents].sort(), children: [] };
			byKey.set(key, fam);
		}
		return fam;
	};

	for (const [child, parents] of childParents) ensure(parents).children.push(child);
	for (const { a, b } of input.partnerships) ensure([a, b]);

	const families = [...byKey.values()];
	families.forEach((f, i) => (f.gid = `@F${i + 1}@`));

	return { families, byPerson: indexFamiliesByPerson(families) };
}

function indexFamiliesByPerson(families: Family[]): Map<string, Family[]> {
	const byPerson = new Map<string, Family[]>();
	const add = (id: string, fam: Family) => {
		const arr = byPerson.get(id) ?? [];
		arr.push(fam);
		byPerson.set(id, arr);
	};
	for (const fam of families) {
		for (const p of fam.parents) add(p, fam);
		for (const c of fam.children) add(c, fam);
	}
	return byPerson;
}

/** Serialize a tree to GEDCOM 5.5.1 text. */
export function buildGedcom(input: ExportInput): string {
	const out: string[] = [];
	const gidOf = new Map<string, string>();
	input.persons.forEach((p, i) => gidOf.set(p.id, `@I${i + 1}@`));

	const { families, byPerson } = buildFamilies(input);

	// Header.
	emit(out, 0, 'HEAD');
	emit(out, 1, 'SOUR', 'HeritageAtlas');
	emit(out, 2, 'VERS', '0.1');
	emit(out, 2, 'NAME', 'HeritageAtlas');
	emit(out, 1, 'GEDC');
	emit(out, 2, 'VERS', '5.5.1');
	emit(out, 2, 'FORM', 'LINEAGE-LINKED');
	emit(out, 1, 'CHAR', 'UTF-8');
	if (input.treeName) emit(out, 1, 'NOTE', input.treeName);

	// Individuals.
	for (const person of input.persons) {
		const gid = gidOf.get(person.id)!;
		out.push(`0 ${gid} INDI`);
		const name = `${person.given ?? ''} /${person.surname ?? ''}/`.trim();
		emit(out, 1, 'NAME', name);
		if (person.given) emit(out, 2, 'GIVN', person.given);
		if (person.surname) emit(out, 2, 'SURN', person.surname);
		if (person.nickname) emit(out, 2, 'NICK', person.nickname);
		if (person.sex) emit(out, 1, 'SEX', SEX_TAG[person.sex]);

		for (const ev of person.events) {
			const tag = EVENT_TAG[ev.type] ?? 'EVEN';
			emit(out, 1, tag);
			if (ev.type === 'custom' && ev.label) emit(out, 2, 'TYPE', ev.label);
			const date = formatGedcomDate(ev.date);
			if (date) emit(out, 2, 'DATE', date);
			if (ev.placeName) emit(out, 2, 'PLAC', ev.placeName);
			if (ev.note) emit(out, 2, 'NOTE', ev.note);
		}

		if (person.notes) emit(out, 1, 'NOTE', person.notes);

		const fams = byPerson.get(person.id) ?? [];
		for (const fam of fams) {
			if (fam.parents.includes(person.id)) emit(out, 1, 'FAMS', fam.gid);
			if (fam.children.includes(person.id)) emit(out, 1, 'FAMC', fam.gid);
		}
	}

	// Families.
	for (const fam of families) {
		out.push(`0 ${fam.gid} FAM`);
		// HUSB/WIFE by sex where known; otherwise first parent → HUSB.
		const parents = fam.parents
			.map((id) => input.persons.find((p) => p.id === id)!)
			.filter(Boolean);
		const husband = parents.find((p) => p.sex === 'male') ?? parents[0];
		const wife = parents.find((p) => p !== husband);
		if (husband) emit(out, 1, 'HUSB', gidOf.get(husband.id)!);
		if (wife) emit(out, 1, 'WIFE', gidOf.get(wife.id)!);
		for (const childId of fam.children) emit(out, 1, 'CHIL', gidOf.get(childId)!);
	}

	emit(out, 0, 'TRLR');
	return out.join('\n') + '\n';
}
