/**
 * Fuzzy dates — the project-wide convention for uncertain historical dates.
 *
 * Genealogical dates are often partial or approximate ("abt. 1880", "before
 * March 1945", "between 1920 and 1922"). We store each fuzzy date as a group of
 * four flat columns sharing a prefix. This is the convention for event dates
 * (Phase 2) — the dates that drive the map timeline. (Relationships deliberately
 * carry no dates; they only appear in the tree, never on the map.)
 *
 *   <prefix>_date       date  — best-guess / lower-bound calendar date
 *   <prefix>_date_end   date  — upper bound, only set when qualifier = 'between'
 *   <prefix>_qualifier  enum  — how to read the date (see DateQualifier)
 *   <prefix>_precision  enum  — how much of the date is known (see DatePrecision)
 *
 * All four are nullable; a fully-null group means "no date". Dates are ISO
 * strings (yyyy-mm-dd) as returned by Supabase; only the part indicated by
 * `precision` is meaningful (e.g. precision 'year' → only the year matters).
 */

export type DateQualifier = 'exact' | 'about' | 'before' | 'after' | 'between' | 'estimated';
export type DatePrecision = 'day' | 'month' | 'year';

export interface FuzzyDate {
	date: string | null;
	dateEnd: string | null;
	qualifier: DateQualifier | null;
	precision: DatePrecision | null;
}

/** A snake_case row keyed by `${prefix}_date` etc. — i.e. how the DB returns it. */
type FuzzyDateColumns<Prefix extends string> = {
	[K in `${Prefix}_date` | `${Prefix}_date_end` | `${Prefix}_qualifier` | `${Prefix}_precision`]:
		| string
		| null;
};

/** Read a fuzzy-date column group off a DB row into a FuzzyDate object. */
export function fuzzyDateFromColumns<Prefix extends string>(
	row: FuzzyDateColumns<Prefix>,
	prefix: Prefix
): FuzzyDate {
	return {
		date: row[`${prefix}_date`],
		dateEnd: row[`${prefix}_date_end`],
		qualifier: row[`${prefix}_qualifier`] as DateQualifier | null,
		precision: row[`${prefix}_precision`] as DatePrecision | null
	};
}

/** Build the snake_case column group for writing a FuzzyDate back to the DB. */
export function fuzzyDateToColumns<Prefix extends string>(
	fd: FuzzyDate,
	prefix: Prefix
): FuzzyDateColumns<Prefix> {
	return {
		[`${prefix}_date`]: fd.date,
		[`${prefix}_date_end`]: fd.qualifier === 'between' ? fd.dateEnd : null,
		[`${prefix}_qualifier`]: fd.qualifier,
		[`${prefix}_precision`]: fd.precision
	} as FuzzyDateColumns<Prefix>;
}

export function isEmptyFuzzyDate(fd: FuzzyDate | null | undefined): boolean {
	return !fd || (!fd.date && !fd.dateEnd && !fd.qualifier);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Format a single ISO date at the given precision, e.g. "3 Mar 1920" / "Mar 1920" / "1920". */
function formatPoint(iso: string, precision: DatePrecision | null): string {
	// Parse the yyyy-mm-dd parts directly to avoid timezone shifts.
	const [year, month, day] = iso.split('-').map((part) => Number.parseInt(part, 10));
	if (!year) return '';
	if (precision === 'year') return String(year);
	const monthName = month ? MONTHS[month - 1] : undefined;
	if (precision === 'month' || !day) {
		return monthName ? `${monthName} ${year}` : String(year);
	}
	return monthName ? `${day} ${monthName} ${year}` : String(year);
}

const QUALIFIER_PREFIX: Record<Exclude<DateQualifier, 'exact' | 'between'>, string> = {
	about: 'abt. ',
	before: 'before ',
	after: 'after ',
	estimated: 'est. '
};

/** Render a fuzzy date for display, e.g. "abt. 1920", "1920–1922", "before Mar 1945". */
export function formatFuzzyDate(fd: FuzzyDate | null | undefined): string {
	if (isEmptyFuzzyDate(fd)) return '';
	const date = fd as FuzzyDate;

	if (date.qualifier === 'between' && date.date && date.dateEnd) {
		return `${formatPoint(date.date, date.precision)}–${formatPoint(date.dateEnd, date.precision)}`;
	}
	if (!date.date) return '';

	const point = formatPoint(date.date, date.precision);
	if (!date.qualifier || date.qualifier === 'exact' || date.qualifier === 'between') {
		return point;
	}
	return `${QUALIFIER_PREFIX[date.qualifier]}${point}`;
}
