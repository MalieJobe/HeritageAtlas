// Generates the Windsor demo seed migration from a single structured dataset.
// Re-run after editing data (e.g. to fill in portrait paths):
//   node scripts/windsor-demo/build.mjs
// then apply supabase/migrations/0016_windsor_demo.sql.
//
// Sourced from the deep-research report (royal.uk, Wikipedia, Britannica) plus
// well-documented public record. Residence years are the approximate year a
// person settled somewhere — the map's signature "where did they live over time"
// feature — and are intentionally evocative rather than exhaustive. Dates flagged
// approximate use the 'about' qualifier.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const TREE_ID = 'windsor';
const TREE_NAME = 'House of Windsor';

const here = dirname(fileURLToPath(import.meta.url));
// Portrait paths come from fetch-portraits.mjs (run that first); people without a
// downloaded portrait fall back to initials in the UI.
const portraitsPath = `${here}/../../static/demo/portraits/portraits.json`;
const PORTRAITS = existsSync(portraitsPath) ? JSON.parse(readFileSync(portraitsPath, 'utf8')) : {};

// --- Places: id -> [display name, lat, lng] -------------------------------
const PLACES = {
	london: ['London, England', 51.5074, -0.1278],
	kensington: ['Kensington Palace, London', 51.505, -0.1877],
	sandringham: ['Sandringham, England', 52.8312, 0.513],
	windsor: ['Windsor, England', 51.4839, -0.6043],
	balmoral: ['Balmoral, Scotland', 57.0398, -3.23],
	richmond: ['Richmond, London', 51.4613, -0.3037],
	glamis: ['Glamis, Scotland', 56.6167, -3.0],
	highgrove: ['Highgrove, England', 51.64, -2.17],
	gatcombe: ['Gatcombe Park, England', 51.7, -2.13],
	anmer: ['Anmer, England', 52.833, 0.5],
	reading: ['Reading, England', 51.4543, -0.9781],
	harewood: ['Harewood, England', 53.894, -1.529],
	oxford: ['Oxford, England', 51.752, -1.2577],
	dartmouth: ['Dartmouth, England', 50.3517, -3.579],
	broadlands: ['Romsey, England', 50.9897, -1.4979],
	caithness: ['Caithness, Scotland', 58.45, -3.5],
	mullaghmore: ['Mullaghmore, Ireland', 54.4717, -8.45],
	corfu: ['Corfu, Greece', 39.6243, 19.9217],
	athens: ['Athens, Greece', 37.9838, 23.7275],
	stcloud: ['Saint-Cloud, France', 48.84, 2.21],
	paris: ['Paris, France', 48.8566, 2.3522],
	montecarlo: ['Monte Carlo, Monaco', 43.7384, 7.4246],
	salem: ['Salem, Germany', 47.7656, 9.2667],
	gordonstoun: ['Gordonstoun, Scotland', 57.7058, -3.4386],
	cheam: ['Cheam, England', 51.3596, -0.2148],
	darmstadt: ['Darmstadt, Germany', 49.8728, 8.6512],
	graz: ['Graz, Austria', 47.0707, 15.4395],
	kreuzlingen: ['Kreuzlingen, Switzerland', 47.65, 9.176],
	florence: ['Florence, Italy', 43.7696, 11.2558],
	malta: ['Valletta, Malta', 35.8989, 14.5145],
	capetown: ['Cape Town, South Africa', -33.9249, 18.4241],
	delhi: ['New Delhi, India', 28.6139, 77.209],
	burma: ['Yangon, Burma', 16.8409, 96.1735],
	nassau: ['Nassau, Bahamas', 25.0443, -77.3504],
	baltimore: ['Baltimore, USA', 39.2904, -76.6122],
	shanghai: ['Shanghai, China', 31.2304, 121.4737],
	losangeles: ['Los Angeles, USA', 34.0522, -118.2437],
	montecito: ['Montecito, California, USA', 34.4367, -119.6321],
	santabarbara: ['Santa Barbara, California, USA', 34.4208, -119.6982],
	mustique: ['Mustique', 12.8845, -61.1847],
	wiltshire: ['Wiltshire, England', 51.3, -1.95]
};

// --- People ----------------------------------------------------------------
// b: [date, place, photo?]   d: [date, place] | null   res: [[year, place], ...]
// dates as 'YYYY-MM-DD' (precision day) or 'YYYY' (precision year).
const PEOPLE = [
	// Battenberg / Hesse branch (Philip's maternal side) — very international.
	{
		id: 'louis_b',
		given: 'Louis',
		surname: 'of Battenberg',
		sex: 'male',
		b: ['1854-05-24', 'graz'],
		d: ['1921-09-11', 'london'],
		res: [
			[1884, 'london'],
			[1899, 'malta'],
			[1914, 'london']
		]
	},
	{
		id: 'victoria_h',
		given: 'Victoria',
		surname: 'of Hesse',
		sex: 'female',
		b: ['1863-04-05', 'windsor'],
		d: ['1950-09-24', 'london'],
		res: [
			[1884, 'darmstadt'],
			[1899, 'malta'],
			[1914, 'london']
		]
	},
	{
		id: 'andrew_gr',
		given: 'Andrew',
		surname: 'of Greece',
		sex: 'male',
		b: ['1882-02-02', 'athens'],
		d: ['1944-12-03', 'montecarlo'],
		res: [
			[1903, 'athens'],
			[1922, 'corfu'],
			[1923, 'stcloud'],
			[1930, 'montecarlo']
		]
	},
	{
		id: 'alice_b',
		given: 'Alice',
		surname: 'of Battenberg',
		sex: 'female',
		b: ['1885-02-25', 'windsor'],
		d: ['1969-12-05', 'london'],
		res: [
			[1890, 'darmstadt'],
			[1903, 'athens'],
			[1922, 'corfu'],
			[1923, 'stcloud'],
			[1930, 'kreuzlingen'],
			[1938, 'athens'],
			[1967, 'london']
		]
	},
	{
		id: 'mountb',
		given: 'Louis',
		surname: 'Mountbatten',
		sex: 'male',
		b: ['1900-06-25', 'windsor'],
		d: ['1979-08-27', 'mullaghmore'],
		res: [
			[1920, 'malta'],
			[1943, 'burma'],
			[1947, 'delhi'],
			[1948, 'broadlands']
		]
	},

	// Generation 1 — King George V & Queen Mary
	{
		id: 'georgev',
		given: 'George V',
		surname: 'Windsor',
		sex: 'male',
		b: ['1865-06-03', 'london'],
		d: ['1936-01-20', 'sandringham'],
		res: [
			[1893, 'sandringham'],
			[1910, 'london']
		]
	},
	{
		id: 'maryteck',
		given: 'Mary',
		surname: 'of Teck',
		birthSurname: 'of Teck',
		sex: 'female',
		b: ['1867-05-26', 'kensington'],
		d: ['1953-03-24', 'london'],
		res: [
			[1883, 'florence'],
			[1885, 'london'],
			[1893, 'sandringham'],
			[1910, 'london']
		]
	},

	// Generation 2 — children of George V (+ spouses) and the well-traveled exiles
	{
		id: 'edward8',
		given: 'Edward VIII',
		surname: 'Windsor',
		sex: 'male',
		b: ['1894-06-23', 'richmond'],
		d: ['1972-05-28', 'paris'],
		res: [
			[1909, 'london'],
			[1937, 'paris'],
			[1940, 'nassau'],
			[1945, 'paris']
		]
	},
	{
		id: 'wallis',
		given: 'Wallis',
		surname: 'Simpson',
		birthSurname: 'Warfield',
		sex: 'female',
		b: ['1896-06-19', 'baltimore'],
		d: ['1986-04-24', 'paris'],
		res: [
			[1924, 'shanghai'],
			[1928, 'london'],
			[1937, 'paris'],
			[1940, 'nassau'],
			[1945, 'paris']
		]
	},
	{
		id: 'george6',
		given: 'George VI',
		surname: 'Windsor',
		sex: 'male',
		b: ['1895-12-14', 'sandringham'],
		d: ['1952-02-06', 'sandringham'],
		res: [
			[1909, 'dartmouth'],
			[1923, 'london'],
			[1936, 'london']
		]
	},
	{
		id: 'queenmum',
		given: 'Elizabeth',
		surname: 'Bowes-Lyon',
		birthSurname: 'Bowes-Lyon',
		sex: 'female',
		b: ['1900-08-04', 'london'],
		d: ['2002-03-30', 'windsor'],
		res: [
			[1904, 'glamis'],
			[1923, 'london'],
			[1953, 'london']
		]
	},
	{
		id: 'maryp',
		given: 'Mary',
		surname: 'Windsor',
		sex: 'female',
		b: ['1897-04-25', 'sandringham'],
		d: ['1965-03-28', 'harewood'],
		res: [[1922, 'harewood']]
	},
	{
		id: 'kent_g',
		given: 'George',
		surname: 'Kent',
		sex: 'male',
		b: ['1902-12-20', 'sandringham'],
		d: ['1942-08-25', 'caithness'],
		res: [
			[1920, 'london'],
			[1934, 'london']
		]
	},
	{
		id: 'marina',
		given: 'Marina',
		surname: 'of Greece',
		birthSurname: 'of Greece',
		sex: 'female',
		b: ['1906-12-13', 'athens'],
		d: ['1968-08-27', 'london'],
		res: [[1934, 'london']]
	},
	{
		id: 'johnp',
		given: 'John',
		surname: 'Windsor',
		sex: 'male',
		b: ['1905-07-12', 'sandringham'],
		d: ['1919-01-18', 'sandringham'],
		res: []
	},

	// Generation 3 — Elizabeth II, Philip, Margaret
	{
		id: 'philip',
		given: 'Philip',
		surname: 'Mountbatten',
		sex: 'male',
		b: ['1921-06-10', 'corfu'],
		d: ['2021-04-09', 'windsor'],
		res: [
			[1922, 'stcloud'],
			[1928, 'cheam'],
			[1933, 'salem'],
			[1934, 'gordonstoun'],
			[1939, 'dartmouth'],
			[1947, 'london'],
			[1949, 'malta'],
			[1951, 'london']
		]
	},
	{
		id: 'eliz2',
		given: 'Elizabeth II',
		surname: 'Windsor',
		sex: 'female',
		b: ['1926-04-21', 'london'],
		d: ['2022-09-08', 'balmoral'],
		res: [
			[1936, 'london'],
			[1947, 'capetown'],
			[1949, 'malta'],
			[1951, 'london']
		]
	},
	{
		id: 'margaret',
		given: 'Margaret',
		surname: 'Windsor',
		sex: 'female',
		b: ['1930-08-21', 'glamis'],
		d: ['2002-02-09', 'london'],
		res: [
			[1936, 'london'],
			[1972, 'mustique'],
			[1999, 'london']
		]
	},
	{
		id: 'snowdon',
		given: 'Antony',
		surname: 'Armstrong-Jones',
		sex: 'male',
		b: ['1930-03-07', 'london'],
		d: ['2017-01-13', 'london'],
		res: [[1960, 'london']]
	},

	// Generation 4 — children of Elizabeth II (+ Charles's wives)
	{
		id: 'charles3',
		given: 'Charles III',
		surname: 'Windsor',
		sex: 'male',
		b: ['1948-11-14', 'london'],
		d: null,
		res: [
			[1980, 'highgrove'],
			[2022, 'london']
		]
	},
	{
		id: 'diana',
		given: 'Diana',
		surname: 'Spencer',
		birthSurname: 'Spencer',
		sex: 'female',
		b: ['1961-07-01', 'sandringham'],
		d: ['1997-08-31', 'paris'],
		res: [
			[1981, 'kensington'],
			[1996, 'kensington'],
			[1997, 'paris']
		]
	},
	{
		id: 'camilla',
		given: 'Camilla',
		surname: 'Shand',
		birthSurname: 'Shand',
		sex: 'female',
		b: ['1947-07-17', 'london'],
		d: null,
		res: [
			[1995, 'wiltshire'],
			[2005, 'london']
		]
	},
	{
		id: 'anne',
		given: 'Anne',
		surname: 'Windsor',
		sex: 'female',
		b: ['1950-08-15', 'london'],
		d: null,
		res: [[1976, 'gatcombe']]
	},
	{
		id: 'andrew_y',
		given: 'Andrew',
		surname: 'Windsor',
		sex: 'male',
		b: ['1960-02-19', 'london'],
		d: null,
		res: [[1990, 'windsor']]
	},
	{
		id: 'edward_w',
		given: 'Edward',
		surname: 'Windsor',
		sex: 'male',
		b: ['1964-03-10', 'london'],
		d: null,
		res: [[1999, 'windsor']]
	},

	// Generation 5 — William & Harry and their families
	{
		id: 'william',
		given: 'William',
		surname: 'Windsor',
		sex: 'male',
		b: ['1982-06-21', 'london'],
		d: null,
		res: [
			[1982, 'kensington'],
			[2013, 'anmer'],
			[2022, 'windsor']
		]
	},
	{
		id: 'kate',
		given: 'Catherine',
		surname: 'Middleton',
		birthSurname: 'Middleton',
		sex: 'female',
		b: ['1982-01-09', 'reading'],
		d: null,
		res: [
			[2011, 'kensington'],
			[2013, 'anmer'],
			[2022, 'windsor']
		]
	},
	{
		id: 'harry',
		given: 'Harry',
		surname: 'Windsor',
		sex: 'male',
		b: ['1984-09-15', 'london'],
		d: null,
		res: [
			[1984, 'kensington'],
			[2020, 'montecito']
		]
	},
	{
		id: 'meghan',
		given: 'Meghan',
		surname: 'Markle',
		birthSurname: 'Markle',
		sex: 'female',
		b: ['1981-08-04', 'losangeles'],
		d: null,
		res: [
			[2018, 'london'],
			[2020, 'montecito']
		]
	},

	// Generation 6 — the youngest
	{
		id: 'george_c',
		given: 'George',
		surname: 'Windsor',
		sex: 'male',
		b: ['2013-07-22', 'london'],
		d: null,
		res: [
			[2013, 'anmer'],
			[2022, 'windsor']
		]
	},
	{
		id: 'charlotte',
		given: 'Charlotte',
		surname: 'Windsor',
		sex: 'female',
		b: ['2015-05-02', 'london'],
		d: null,
		res: [
			[2015, 'anmer'],
			[2022, 'windsor']
		]
	},
	{
		id: 'louis_c',
		given: 'Louis',
		surname: 'Windsor',
		sex: 'male',
		b: ['2018-04-23', 'london'],
		d: null,
		res: [[2022, 'windsor']]
	},
	{
		id: 'archie',
		given: 'Archie',
		surname: 'Windsor',
		sex: 'male',
		b: ['2019-05-06', 'london'],
		d: null,
		res: [[2020, 'montecito']]
	},
	{
		id: 'lilibet',
		given: 'Lilibet',
		surname: 'Windsor',
		sex: 'female',
		b: ['2021-06-04', 'santabarbara'],
		d: null,
		res: [[2021, 'montecito']]
	}
];

// --- Partnerships: [a, b, status] -----------------------------------------
const PARTNERS = [
	['louis_b', 'victoria_h', 'current'],
	['andrew_gr', 'alice_b', 'current'],
	['georgev', 'maryteck', 'current'],
	['edward8', 'wallis', 'current'],
	['george6', 'queenmum', 'current'],
	['kent_g', 'marina', 'current'],
	['eliz2', 'philip', 'current'],
	['margaret', 'snowdon', 'former'],
	['charles3', 'diana', 'former'],
	['charles3', 'camilla', 'current'],
	['william', 'kate', 'current'],
	['harry', 'meghan', 'current']
];

// --- Parent -> child links -------------------------------------------------
const LINKS = [
	// Battenberg/Hesse -> Alice & Mountbatten
	['louis_b', 'alice_b'],
	['victoria_h', 'alice_b'],
	['louis_b', 'mountb'],
	['victoria_h', 'mountb'],
	// Andrew of Greece + Alice -> Philip
	['andrew_gr', 'philip'],
	['alice_b', 'philip'],
	// George V + Mary -> their six children
	['georgev', 'edward8'],
	['maryteck', 'edward8'],
	['georgev', 'george6'],
	['maryteck', 'george6'],
	['georgev', 'maryp'],
	['maryteck', 'maryp'],
	['georgev', 'kent_g'],
	['maryteck', 'kent_g'],
	['georgev', 'johnp'],
	['maryteck', 'johnp'],
	// George VI + Elizabeth -> Elizabeth II & Margaret
	['george6', 'eliz2'],
	['queenmum', 'eliz2'],
	['george6', 'margaret'],
	['queenmum', 'margaret'],
	// Elizabeth II + Philip -> four children
	['eliz2', 'charles3'],
	['philip', 'charles3'],
	['eliz2', 'anne'],
	['philip', 'anne'],
	['eliz2', 'andrew_y'],
	['philip', 'andrew_y'],
	['eliz2', 'edward_w'],
	['philip', 'edward_w'],
	// Charles + Diana -> William & Harry
	['charles3', 'william'],
	['diana', 'william'],
	['charles3', 'harry'],
	['diana', 'harry'],
	// William + Catherine -> George, Charlotte, Louis
	['william', 'george_c'],
	['kate', 'george_c'],
	['william', 'charlotte'],
	['kate', 'charlotte'],
	['william', 'louis_c'],
	['kate', 'louis_c'],
	// Harry + Meghan -> Archie & Lilibet
	['harry', 'archie'],
	['meghan', 'archie'],
	['harry', 'lilibet'],
	['meghan', 'lilibet']
];

// --- SQL generation --------------------------------------------------------
const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const fullDate = (s) => (s.length === 4 ? `${s}-01-01` : s);
const precOf = (s) => (s.length === 4 ? 'year' : 'day');

const lines = [];
lines.push(
	'-- Windsor demo tree — GENERATED by scripts/windsor-demo/build.mjs. Do not edit by hand.'
);
lines.push('-- Re-runnable: clears and reinserts the fixed-id demo tree. The migration');
lines.push('-- runner wraps this in its own transaction.');
lines.push('');
lines.push(`delete from public.trees where id = ${q(TREE_ID)};`);
lines.push('');
lines.push('-- Owner: reuse an existing user so the migration is portable across envs.');
lines.push('-- (A trees insert trigger adds the owner to tree_members automatically.)');
lines.push(
	`insert into public.trees (id, name, owner_id) values (${q(TREE_ID)}, ${q(TREE_NAME)},\n` +
		`  coalesce((select owner_id from public.trees order by created_at limit 1),\n` +
		`           (select id from auth.users order by created_at limit 1)));`
);
lines.push('');

// Places
lines.push('insert into public.places (id, tree_id, name, lat, lng, source) values');
const placeRows = Object.entries(PLACES).map(
	([id, [name, lat, lng]]) =>
		`  (${q('pl_' + id)}, ${q(TREE_ID)}, ${q(name)}, ${lat}, ${lng}, 'manual')`
);
lines.push(placeRows.join(',\n') + ';');
lines.push('');

// Persons
lines.push(
	'insert into public.persons (id, tree_id, given_names, surname, birth_surname, sex, profile_photo_path) values'
);
const personRows = PEOPLE.map(
	(p) =>
		`  (${q(p.id)}, ${q(TREE_ID)}, ${q(p.given)}, ${q(p.surname)}, ${q(p.birthSurname ?? null)}, ${q(p.sex)}, ${q(p.photo ?? PORTRAITS[p.id]?.path ?? null)})`
);
lines.push(personRows.join(',\n') + ';');
lines.push('');

// Events (birth, residences, death)
const eventRows = [];
for (const p of PEOPLE) {
	const [bd, bp] = p.b;
	eventRows.push(
		`  (${q(TREE_ID)}, ${q(p.id)}, 'birth', '${fullDate(bd)}', '${precOf(bd)}', null, ${q('pl_' + bp)})`
	);
	for (const [year, place] of p.res) {
		eventRows.push(
			`  (${q(TREE_ID)}, ${q(p.id)}, 'residence', '${year}-01-01', 'year', 'about', ${q('pl_' + place)})`
		);
	}
	if (p.d) {
		const [dd, dp] = p.d;
		eventRows.push(
			`  (${q(TREE_ID)}, ${q(p.id)}, 'death', '${fullDate(dd)}', '${precOf(dd)}', null, ${q('pl_' + dp)})`
		);
	}
}
lines.push(
	'insert into public.events (tree_id, person_id, type, event_date, event_precision, event_qualifier, place_id) values'
);
lines.push(eventRows.join(',\n') + ';');
lines.push('');

// Partnerships (canonical order partner_a < partner_b)
lines.push('insert into public.partnerships (tree_id, partner_a, partner_b, status) values');
const partnerRows = PARTNERS.map(([a, b, status]) => {
	const [lo, hi] = a < b ? [a, b] : [b, a];
	return `  (${q(TREE_ID)}, ${q(lo)}, ${q(hi)}, ${q(status)})`;
});
lines.push(partnerRows.join(',\n') + ';');
lines.push('');

// Parent-child links
lines.push('insert into public.parent_child_links (tree_id, parent_id, child_id) values');
const linkRows = LINKS.map(([parent, child]) => `  (${q(TREE_ID)}, ${q(parent)}, ${q(child)})`);
lines.push(linkRows.join(',\n') + ';');
lines.push('');

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = `${__dirname}/../../supabase/migrations/0016_windsor_demo.sql`;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, lines.join('\n'));
console.log(
	`Wrote ${outPath}\n  ${PEOPLE.length} people · ${Object.keys(PLACES).length} places · ${eventRows.length} events · ${PARTNERS.length} partnerships · ${LINKS.length} links`
);
