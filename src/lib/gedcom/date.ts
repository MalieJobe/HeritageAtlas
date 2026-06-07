/**
 * GEDCOM date ↔ fuzzy-date translation (task 5.5).
 *
 * GEDCOM dates carry qualifiers we already model: ABT/EST/CAL (about/estimated),
 * BEF/AFT (before/after), BET…AND… and FROM…TO… (ranges → between). We fold them
 * into the app's FuzzyDate shape (see `$lib/fuzzyDate`) on import, and back to a
 * GEDCOM string on export.
 */

import type { FuzzyDate, DatePrecision, DateQualifier } from '$lib/fuzzyDate';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const EMPTY: FuzzyDate = { date: null, dateEnd: null, qualifier: null, precision: null };

function monthNum(token: string): number | null {
	const i = MONTHS.indexOf(token.toUpperCase());
	return i >= 0 ? i + 1 : null;
}

interface Point {
	iso: string;
	precision: DatePrecision;
}

/** Parse a single GEDCOM date like "3 JAN 1900", "JAN 1900", or "1900". */
function parsePoint(input: string): Point | null {
	// Strip a leading calendar escape (@#DGREGORIAN@ etc.) and collapse a dual
	// year ("1700/01" → "1700"). BC dates aren't supported and parse to year only.
	const s = input
		.replace(/@#[^@]*@/gi, '')
		.replace(/(\d{3,4})\/\d{1,2}/, '$1')
		.trim();
	if (!s) return null;

	let day: number | null = null;
	let month: number | null = null;
	let year: number | null = null;
	for (const tok of s.split(/\s+/)) {
		const mn = monthNum(tok);
		if (mn != null) {
			month = mn;
		} else if (/^\d{3,4}$/.test(tok)) {
			year = Number(tok);
		} else if (/^\d{1,2}$/.test(tok) && day === null) {
			day = Number(tok); // GEDCOM always writes the day before the month
		}
	}
	if (year === null) return null;

	let precision: DatePrecision = 'year';
	if (month !== null && day !== null) precision = 'day';
	else if (month !== null) precision = 'month';
	else day = null; // a day with no month is meaningless

	const mm = String(month ?? 1).padStart(2, '0');
	const dd = String(day ?? 1).padStart(2, '0');
	return { iso: `${year}-${mm}-${dd}`, precision };
}

function withQualifier(point: Point | null, qualifier: DateQualifier): FuzzyDate {
	if (!point) return EMPTY;
	return { date: point.iso, dateEnd: null, qualifier, precision: point.precision };
}

/** Translate a GEDCOM DATE value into a FuzzyDate (empty when unparseable). */
export function parseGedcomDate(value: string | null | undefined): FuzzyDate {
	const s = value?.trim();
	if (!s) return EMPTY;

	let m = /^BET\.?\s+(.+?)\s+AND\s+(.+)$/i.exec(s);
	if (m) {
		const a = parsePoint(m[1]);
		const b = parsePoint(m[2]);
		if (!a) return EMPTY;
		return { date: a.iso, dateEnd: b?.iso ?? null, qualifier: 'between', precision: a.precision };
	}

	m = /^FROM\s+(.+?)\s+TO\s+(.+)$/i.exec(s);
	if (m) {
		const a = parsePoint(m[1]);
		const b = parsePoint(m[2]);
		if (!a) return EMPTY;
		return {
			date: a.iso,
			dateEnd: b?.iso ?? null,
			qualifier: b ? 'between' : 'after',
			precision: a.precision
		};
	}

	m = /^FROM\s+(.+)$/i.exec(s);
	if (m) return withQualifier(parsePoint(m[1]), 'after');

	m = /^TO\s+(.+)$/i.exec(s);
	if (m) return withQualifier(parsePoint(m[1]), 'before');

	m = /^BEF\.?\s+(.+)$/i.exec(s);
	if (m) return withQualifier(parsePoint(m[1]), 'before');

	m = /^AFT\.?\s+(.+)$/i.exec(s);
	if (m) return withQualifier(parsePoint(m[1]), 'after');

	m = /^(ABT|EST|CAL|INT)\.?\s+(.+)$/i.exec(s);
	if (m) {
		const kw = m[1].toUpperCase();
		const qualifier: DateQualifier = kw === 'EST' || kw === 'CAL' ? 'estimated' : 'about';
		// INT dates may trail an "(interpreted phrase)" — drop it.
		const datePart = m[2].replace(/\(.*\)\s*$/, '').trim();
		return withQualifier(parsePoint(datePart), qualifier);
	}

	return withQualifier(parsePoint(s), 'exact');
}

function formatPoint(iso: string, precision: DatePrecision | null): string {
	const [year, month, day] = iso.split('-').map((p) => Number.parseInt(p, 10));
	if (!year) return '';
	if (precision === 'year') return String(year);
	const mon = month ? MONTHS[month - 1] : null;
	if (precision === 'month' || !day) return mon ? `${mon} ${year}` : String(year);
	return mon ? `${day} ${mon} ${year}` : String(year);
}

/** Serialize a FuzzyDate to a GEDCOM DATE value (empty string when no date). */
export function formatGedcomDate(fd: FuzzyDate | null | undefined): string {
	if (!fd?.date) return '';
	const point = formatPoint(fd.date, fd.precision);
	switch (fd.qualifier) {
		case 'about':
			return `ABT ${point}`;
		case 'estimated':
			return `EST ${point}`;
		case 'before':
			return `BEF ${point}`;
		case 'after':
			return `AFT ${point}`;
		case 'between': {
			const end = fd.dateEnd ? formatPoint(fd.dateEnd, fd.precision) : '';
			return end ? `BET ${point} AND ${end}` : `ABT ${point}`;
		}
		default:
			return point;
	}
}
