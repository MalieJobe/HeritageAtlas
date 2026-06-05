// Fetch freely-licensed portraits for the Windsor demo from Wikimedia Commons.
//   node scripts/windsor-demo/fetch-portraits.mjs
// For each person it searches Commons (File namespace), checks the license via the
// API (accepting only Public Domain / CC0 / CC BY / CC BY-SA — never NC/ND), and
// downloads a ~480px thumbnail to static/demo/portraits/<id>.jpg. Writes a
// CREDITS.md with attribution + license per image. Per-file license checking is
// required (the research flagged that you cannot assume PD), which this enforces.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = `${__dirname}/../../static/demo/portraits`;
const UA = 'HeritageAtlas-demo/0.1 (genealogy demo; contact accounts@dot.studio)';
const API = 'https://commons.wikimedia.org/w/api.php';

// id -> { q: search query, match: token that should appear in a good file title }
const TARGETS = {
	georgev: { q: 'King George V official portrait', match: 'george' },
	maryteck: { q: 'Queen Mary of Teck portrait', match: 'mary' },
	edward8: { q: 'Edward VIII Duke of Windsor portrait', match: 'edward' },
	wallis: { q: 'Wallis Simpson Duchess of Windsor', match: 'wallis' },
	george6: { q: 'King George VI formal portrait', match: 'george' },
	queenmum: { q: 'Queen Elizabeth The Queen Mother portrait', match: 'elizabeth' },
	maryp: { q: 'Mary Princess Royal Countess of Harewood', match: 'mary' },
	kent_g: { q: 'Prince George Duke of Kent', match: 'kent' },
	marina: { q: 'Princess Marina Duchess of Kent', match: 'marina' },
	johnp: { q: 'Prince John of the United Kingdom 1905', match: 'john' },
	philip: { q: 'Prince Philip Duke of Edinburgh portrait', match: 'philip' },
	eliz2: { q: 'Queen Elizabeth II portrait', match: 'elizabeth' },
	margaret: { q: 'Princess Margaret Countess of Snowdon', match: 'margaret' },
	snowdon: { q: 'Antony Armstrong-Jones Lord Snowdon', match: 'snowdon' },
	charles3: { q: 'King Charles III portrait', match: 'charles' },
	diana: { q: 'Diana Princess of Wales portrait', match: 'diana' },
	camilla: { q: 'Queen Camilla portrait', match: 'camilla' },
	anne: { q: 'Anne Princess Royal portrait', match: 'anne' },
	andrew_y: { q: 'Prince Andrew Duke of York portrait', match: 'andrew' },
	edward_w: { q: 'Prince Edward Duke of Edinburgh 2020', match: 'edward' },
	william: { q: 'Prince William Wales portrait', match: 'william' },
	kate: { q: 'Catherine Princess of Wales portrait', match: 'catherine' },
	harry: { q: 'Prince Harry Duke of Sussex portrait', match: 'harry' },
	meghan: { q: 'Meghan Duchess of Sussex portrait', match: 'meghan' },
	mountb: { q: 'Louis Mountbatten 1st Earl portrait', match: 'mountbatten' },
	alice_b: { q: 'Princess Alice of Battenberg', match: 'alice' },
	andrew_gr: { q: 'Prince Andrew of Greece and Denmark', match: 'andrew' },
	louis_b: { q: 'Louis Alexander Mountbatten Battenberg admiral', match: 'battenberg' },
	victoria_h: { q: 'Victoria Mountbatten Marchioness Milford Haven Hesse', match: 'victoria' }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripHtml = (s) =>
	s
		? s
				.replace(/<[^>]*>/g, '')
				.replace(/\s+/g, ' ')
				.trim()
		: '';

function isFree(licenseCode, licenseName) {
	const code = (licenseCode || '').toLowerCase();
	const name = (licenseName || '').toLowerCase();
	if (/nc|nd|noncommercial|noderiv|fair use|gfdl-only/.test(code + ' ' + name)) return false;
	if (code.startsWith('pd') || code === 'cc0' || code.startsWith('cc-by')) return true;
	if (name.includes('public domain') || name.startsWith('cc0') || name.startsWith('cc by'))
		return true;
	return false;
}

async function api(params) {
	const url = `${API}?${new URLSearchParams({ format: 'json', ...params })}`;
	const res = await fetch(url, { headers: { 'User-Agent': UA } });
	if (!res.ok) throw new Error(`${res.status} ${url}`);
	return res.json();
}

async function pickPortrait(q, match) {
	const search = await api({
		action: 'query',
		list: 'search',
		srnamespace: '6',
		srsearch: q,
		srlimit: '12'
	});
	const titles = (search.query?.search ?? []).map((s) => s.title);
	if (titles.length === 0) return null;

	const info = await api({
		action: 'query',
		prop: 'imageinfo',
		iiprop: 'url|mime|extmetadata',
		iiurlwidth: '480',
		titles: titles.join('|')
	});
	const pages = Object.values(info.query?.pages ?? {});
	// Keep the search ranking order.
	const byTitle = new Map(pages.map((p) => [p.title, p]));
	const ranked = titles.map((t) => byTitle.get(t)).filter(Boolean);

	const candidates = [];
	for (const p of ranked) {
		const ii = p.imageinfo?.[0];
		if (!ii || !ii.mime?.startsWith('image/')) continue;
		const m = ii.extmetadata ?? {};
		const licenseCode = m.License?.value;
		const licenseName = m.LicenseShortName?.value;
		if (!isFree(licenseCode, licenseName)) continue;
		const title = p.title.toLowerCase();
		const matches = title.includes(match.toLowerCase());
		candidates.push({
			title: p.title,
			matches,
			thumb: ii.thumburl || ii.url,
			descriptionurl: ii.descriptionurl,
			license: licenseName || licenseCode,
			artist: stripHtml(m.Artist?.value) || 'Unknown',
			credit: stripHtml(m.Credit?.value)
		});
	}
	// Prefer a name-matching file, else the first free image.
	return candidates.find((c) => c.matches) ?? candidates[0] ?? null;
}

async function download(url, dest) {
	const res = await fetch(url, { headers: { 'User-Agent': UA } });
	if (!res.ok) throw new Error(`download ${res.status}`);
	const buf = Buffer.from(await res.arrayBuffer());
	writeFileSync(dest, buf);
	return buf.length;
}

mkdirSync(OUT_DIR, { recursive: true });
const results = {};
const credits = [];
for (const [id, { q, match }] of Object.entries(TARGETS)) {
	try {
		const pick = await pickPortrait(q, match);
		if (!pick) {
			console.log(`✗ ${id}: no free image found`);
			continue;
		}
		const bytes = await download(pick.thumb, `${OUT_DIR}/${id}.jpg`);
		results[id] = { path: `/demo/portraits/${id}.jpg`, ...pick };
		credits.push(
			`- **${id}** — [${pick.title}](${pick.descriptionurl}) · ${pick.license} · ${pick.artist}`
		);
		console.log(
			`✓ ${id}: ${pick.matches ? '' : '[loose] '}${pick.license} · ${(bytes / 1024) | 0}KB · ${pick.title}`
		);
	} catch (e) {
		console.log(`✗ ${id}: ${e.message}`);
	}
	await sleep(350); // be polite to the API
}

writeFileSync(`${OUT_DIR}/portraits.json`, JSON.stringify(results, null, 2));
writeFileSync(
	`${OUT_DIR}/CREDITS.md`,
	`# Windsor demo portraits\n\nPortraits sourced from Wikimedia Commons, each under a free licence\n(Public Domain / CC0 / CC BY / CC BY-SA). Attribution per file:\n\n${credits.join('\n')}\n`
);
console.log(`\nDone: ${Object.keys(results).length}/${Object.keys(TARGETS).length} portraits.`);
