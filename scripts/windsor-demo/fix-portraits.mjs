// Targeted re-fetch for portraits the broad search got wrong. Same license rules
// (PD/CC0/CC BY/CC BY-SA only), plus an exclude list (paintings of same-named
// ancestors, signatures, group shots) and a preference for clean modern photos.
//   node scripts/windsor-demo/fix-portraits.mjs

import { writeFileSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = `${__dirname}/../../static/demo/portraits`;
const UA = 'HeritageAtlas-demo/0.1 (genealogy demo; contact accounts@dot.studio)';
const API = 'https://commons.wikimedia.org/w/api.php';

const EXCLUDE =
	/rcin|royal collection|beechey|hoppner|mauritshuis|northern netherlandish|school|signature|coat of arms|arms of|stamp|coin|banknote|plaque|statue|grave|memorial|wedding|funeral|1759|17\d\d/i;

// id -> { q, match (string|array), year?, exclude2? }
const FIXES = {
	wallis: {
		q: 'Wallis Simpson 1936 portrait',
		match: 'wallis',
		exclude2: /edward|duke|wedding|couple|king|prince/i
	},
	marina: {
		q: 'Princess Marina Duchess of Kent Vandyk portrait',
		match: 'marina',
		exclude2: /signature|wedding|1934|stamp|arms|coat/i
	}
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripHtml = (s) =>
	s
		? s
				.replace(/<[^>]*>/g, '')
				.replace(/\s+/g, ' ')
				.trim()
		: '';
const yearIn = (t) => {
	const m = t.match(/(19|20)\d\d/);
	return m ? Number(m[0]) : 0;
};

function isFree(code, name) {
	const c = (code || '').toLowerCase();
	const n = (name || '').toLowerCase();
	if (/nc|nd|noncommercial|noderiv|fair use/.test(c + ' ' + n)) return false;
	if (c.startsWith('pd') || c === 'cc0' || c.startsWith('cc-by')) return true;
	if (n.includes('public domain') || n.startsWith('cc0') || n.startsWith('cc by')) return true;
	return false;
}
async function api(params) {
	const res = await fetch(`${API}?${new URLSearchParams({ format: 'json', ...params })}`, {
		headers: { 'User-Agent': UA }
	});
	if (!res.ok) throw new Error(`${res.status}`);
	return res.json();
}

async function pick(spec) {
	const search = await api({
		action: 'query',
		list: 'search',
		srnamespace: '6',
		srsearch: spec.q,
		srlimit: '15'
	});
	const titles = (search.query?.search ?? []).map((s) => s.title);
	if (!titles.length) return null;
	const info = await api({
		action: 'query',
		prop: 'imageinfo',
		iiprop: 'url|mime|extmetadata',
		iiurlwidth: '480',
		titles: titles.join('|')
	});
	const byTitle = new Map(Object.values(info.query?.pages ?? {}).map((p) => [p.title, p]));
	const cands = [];
	for (const t of titles) {
		const p = byTitle.get(t);
		const ii = p?.imageinfo?.[0];
		if (!ii || !ii.mime?.startsWith('image/')) continue;
		if (EXCLUDE.test(t) || (spec.exclude2 && spec.exclude2.test(t))) continue;
		const m = ii.extmetadata ?? {};
		if (!isFree(m.License?.value, m.LicenseShortName?.value)) continue;
		const tokens = Array.isArray(spec.match) ? spec.match : [spec.match];
		if (!tokens.some((tok) => t.toLowerCase().includes(tok.toLowerCase()))) continue;
		cands.push({
			title: t,
			thumb: ii.thumburl || ii.url,
			descriptionurl: ii.descriptionurl,
			license: m.LicenseShortName?.value || m.License?.value,
			artist: stripHtml(m.Artist?.value) || 'Unknown',
			year: yearIn(t)
		});
	}
	if (spec.year)
		cands.sort((a, b) => (b.year >= spec.year ? b.year : 0) - (a.year >= spec.year ? a.year : 0));
	return cands[0] ?? null;
}

const portraits = JSON.parse(readFileSync(`${OUT_DIR}/portraits.json`, 'utf8'));
for (const [id, spec] of Object.entries(FIXES)) {
	try {
		const p = await pick(spec);
		if (!p) {
			console.log(`✗ ${id}: no suitable image`);
			continue;
		}
		const res = await fetch(p.thumb, { headers: { 'User-Agent': UA } });
		writeFileSync(`${OUT_DIR}/${id}.jpg`, Buffer.from(await res.arrayBuffer()));
		portraits[id] = { path: `/demo/portraits/${id}.jpg`, ...p };
		console.log(`✓ ${id}: ${p.license} · ${p.title}`);
	} catch (e) {
		console.log(`✗ ${id}: ${e.message}`);
	}
	await sleep(350);
}
writeFileSync(`${OUT_DIR}/portraits.json`, JSON.stringify(portraits, null, 2));
console.log('updated portraits.json');
