import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseGedcom, childValue } from './parse';
import { parseGedcomDate, formatGedcomDate } from './date';
import { buildImportPlan, type ImportPlan } from './import';
import { buildGedcom, type ExportInput, type ExportPerson } from './export';

const royal = readFileSync(
	fileURLToPath(new URL('./fixtures/royal92.ged', import.meta.url)),
	'utf8'
);

describe('parseGedcom', () => {
	it('parses the royal92 fixture into the expected record counts', () => {
		const roots = parseGedcom(royal);
		const indi = roots.filter((r) => r.tag === 'INDI');
		const fam = roots.filter((r) => r.tag === 'FAM');
		expect(indi.length).toBe(3010);
		expect(fam.length).toBe(1422);
		// Every INDI/FAM carries its xref.
		expect(indi.every((r) => r.xref)).toBe(true);
		expect(fam.every((r) => r.xref)).toBe(true);
	});

	it('reads nested values and pointers', () => {
		const roots = parseGedcom(royal);
		const victoria = roots.find((r) => r.xref === '@I1@')!;
		expect(victoria.tag).toBe('INDI');
		expect(childValue(victoria, 'NAME')).toContain('/Hanover/');
		expect(childValue(victoria, 'SEX')).toBe('F');
		const fam = roots.find((r) => r.tag === 'FAM')!;
		expect(fam.children.find((c) => c.tag === 'HUSB')?.pointer).toMatch(/^@I\d+@$/);
	});

	it('folds CONC/CONT continuations into the parent value', () => {
		const roots = parseGedcom(
			['0 @I1@ INDI', '1 NOTE first line', '2 CONT second line', '2 CONC  joined'].join('\n')
		);
		expect(childValue(roots[0], 'NOTE')).toBe('first line\nsecond line joined');
	});
});

describe('parseGedcomDate', () => {
	const cases: [string, Partial<ReturnType<typeof parseGedcomDate>>][] = [
		['24 MAY 1819', { date: '1819-05-24', qualifier: 'exact', precision: 'day' }],
		['MAY 1819', { date: '1819-05-01', qualifier: 'exact', precision: 'month' }],
		['1819', { date: '1819-01-01', qualifier: 'exact', precision: 'year' }],
		['ABT    1969', { date: '1969-01-01', qualifier: 'about', precision: 'year' }],
		['EST 1700', { date: '1700-01-01', qualifier: 'estimated' }],
		['BEF 3 JAN 1900', { date: '1900-01-03', qualifier: 'before', precision: 'day' }],
		['AFT 1850', { date: '1850-01-01', qualifier: 'after' }],
		['BET 1920 AND 1922', { date: '1920-01-01', dateEnd: '1922-01-01', qualifier: 'between' }],
		['FROM 1900 TO 1910', { date: '1900-01-01', dateEnd: '1910-01-01', qualifier: 'between' }]
	];
	it.each(cases)('parses %s', (input, expected) => {
		expect(parseGedcomDate(input)).toMatchObject(expected);
	});

	it('returns an empty date for junk', () => {
		expect(parseGedcomDate('(unknown)')).toEqual({
			date: null,
			dateEnd: null,
			qualifier: null,
			precision: null
		});
	});

	it('round-trips dates through format → parse', () => {
		for (const [input] of cases) {
			const fd = parseGedcomDate(input);
			const reparsed = parseGedcomDate(formatGedcomDate(fd));
			expect(reparsed).toEqual(fd);
		}
	});
});

describe('buildImportPlan (royal92)', () => {
	let plan: ImportPlan;
	it('maps people, families, events and places', () => {
		plan = buildImportPlan(royal);
		expect(plan.persons.length).toBe(3010);
		// Every family references only known people.
		const known = new Set(plan.persons.map((p) => p.xref));
		for (const f of plan.families) {
			for (const x of [...f.partners, ...f.children]) expect(known.has(x)).toBe(true);
		}
		expect(plan.counts.partnerships).toBeGreaterThan(1000);
		expect(plan.counts.events).toBeGreaterThan(3000);
		expect(plan.placeNames.length).toBeGreaterThan(100);
	});

	it('parses Victoria with her title folded into notes and a birthplace event', () => {
		const plan = buildImportPlan(royal);
		const victoria = plan.persons.find((p) => p.xref === '@I1@')!;
		expect(victoria.given).toBe('Victoria');
		expect(victoria.surname).toBe('Hanover');
		expect(victoria.sex).toBe('female');
		expect(victoria.notes).toContain('Queen of England');
		const birth = victoria.events.find((e) => e.type === 'birth')!;
		expect(birth.date.date).toBe('1819-05-24');
		expect(birth.placeName).toContain('Kensington');
	});

	it('keeps at most one birth and one death per person', () => {
		const plan = buildImportPlan(royal);
		for (const p of plan.persons) {
			expect(p.events.filter((e) => e.type === 'birth').length).toBeLessThanOrEqual(1);
			expect(p.events.filter((e) => e.type === 'death').length).toBeLessThanOrEqual(1);
		}
	});
});

describe('export → re-import round-trip', () => {
	// Build an export model straight from the import plan (as the server would),
	// serialize to GEDCOM, then import again and check the structure is stable.
	function planToExport(plan: ImportPlan): ExportInput {
		const persons: ExportPerson[] = plan.persons.map((p) => ({
			id: p.xref,
			given: p.given,
			surname: p.surname,
			nickname: p.nickname,
			sex: p.sex,
			notes: p.notes,
			events: p.events.map((e) => ({
				type: e.type,
				label: e.label,
				date: e.date,
				placeName: e.placeName,
				note: e.note
			}))
		}));
		const partnerships: { a: string; b: string }[] = [];
		const parentChild: { parent: string; child: string }[] = [];
		for (const f of plan.families) {
			if (f.partners.length >= 2) partnerships.push({ a: f.partners[0], b: f.partners[1] });
			for (const parent of f.partners)
				for (const child of f.children) parentChild.push({ parent, child });
		}
		return { treeName: 'Royal test', persons, partnerships, parentChild };
	}

	it('preserves person count, events and relationships', () => {
		const plan = buildImportPlan(royal);
		const gedcom = buildGedcom(planToExport(plan));
		const plan2 = buildImportPlan(gedcom);

		expect(plan2.persons.length).toBe(plan.persons.length);
		// Births/deaths/places survive.
		const births = (pl: ImportPlan) =>
			pl.persons.reduce((n, p) => n + p.events.filter((e) => e.type === 'birth').length, 0);
		expect(births(plan2)).toBe(births(plan));
		expect(plan2.placeNames.length).toBe(plan.placeNames.length);
		// Partnerships + parent-child links are reconstructed from FAM records.
		expect(plan2.counts.partnerships).toBe(plan.counts.partnerships);
		expect(plan2.counts.parentChild).toBe(plan.counts.parentChild);

		// Victoria still reads correctly after the round-trip.
		const v = plan2.persons.find((p) => p.given === 'Victoria' && p.surname === 'Hanover')!;
		expect(v.sex).toBe('female');
		expect(v.events.find((e) => e.type === 'birth')?.date.date).toBe('1819-05-24');
	});

	it('emits a valid header and trailer', () => {
		const gedcom = buildGedcom(planToExport(buildImportPlan(royal)));
		expect(gedcom.startsWith('0 HEAD')).toBe(true);
		expect(gedcom.trimEnd().endsWith('0 TRLR')).toBe(true);
		expect(gedcom).toContain('2 VERS 5.5.1');
	});
});
