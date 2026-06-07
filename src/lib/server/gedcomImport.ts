/**
 * Commit a parsed GEDCOM import plan into a brand-new tree (server side).
 *
 * Ids are generated here (not relied upon from insert ordering) so we can wire
 * up events, partnerships and parent-child links in one pass without round-trips.
 * Place coordinates are supplied by the caller (geocoded client-side with the
 * shared proxy, see the import UI); places without coordinates are still created,
 * queued for manual locating later (task 5.4).
 */

import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/types';
import { normalizePlaceName } from '$lib/place';
import type { ImportPlan, ImportCounts } from '$lib/gedcom/import';

type DB = SupabaseClient<Database>;

/** Geocoded coordinates keyed by normalized place name (`normalizePlaceName`). */
export type PlaceCoords = Record<string, { lat: number; lng: number }>;

export interface ImportResult {
	treeId: string;
	counts: ImportCounts;
	placesLocated: number;
	placesQueued: number;
}

const CHUNK = 400;

async function insertAll<T>(
	rows: T[],
	insert: (chunk: T[]) => PromiseLike<{ error: { message: string } | null }>
) {
	for (let i = 0; i < rows.length; i += CHUNK) {
		const { error } = await insert(rows.slice(i, i + CHUNK));
		if (error) throw new Error(error.message ?? 'Import write failed.');
	}
}

function orderedPair(a: string, b: string): [string, string] {
	return a < b ? [a, b] : [b, a];
}

export async function commitImport(
	supabase: DB,
	userId: string,
	treeName: string,
	plan: ImportPlan,
	coords: PlaceCoords
): Promise<ImportResult> {
	// 1. The tree (a DB trigger adds the owner membership).
	const { data: tree, error: treeErr } = await supabase
		.from('trees')
		.insert({ name: treeName, owner_id: userId })
		.select('id')
		.single();
	if (treeErr || !tree) throw new Error(treeErr?.message ?? 'Could not create the tree.');
	const treeId = tree.id;

	// 2. Places — one row per unique name; coordinates if we have them, else queued.
	const placeIdByName = new Map<string, string>();
	let located = 0;
	const placeRows = plan.placeNames.map((name) => {
		const key = normalizePlaceName(name);
		const id = randomUUID();
		placeIdByName.set(key, id);
		const c = coords[key];
		if (c) located++;
		return {
			id,
			tree_id: treeId,
			name,
			lat: c?.lat ?? null,
			lng: c?.lng ?? null,
			source: (c ? 'geocoded' : 'manual') as Database['public']['Enums']['place_source']
		};
	});
	await insertAll(placeRows, (chunk) => supabase.from('places').insert(chunk));

	// 3. Persons — keyed back to their GEDCOM xref.
	const personIdByXref = new Map<string, string>();
	const personRows = plan.persons.map((p) => {
		const id = randomUUID();
		personIdByXref.set(p.xref, id);
		return {
			id,
			tree_id: treeId,
			given_names: p.given,
			surname: p.surname,
			nickname: p.nickname,
			sex: p.sex,
			notes: p.notes
		};
	});
	await insertAll(personRows, (chunk) => supabase.from('persons').insert(chunk));

	// 4. Events.
	const eventRows = [];
	for (const p of plan.persons) {
		const personId = personIdByXref.get(p.xref);
		if (!personId) continue;
		for (const e of p.events) {
			const placeId = e.placeName
				? (placeIdByName.get(normalizePlaceName(e.placeName)) ?? null)
				: null;
			eventRows.push({
				tree_id: treeId,
				person_id: personId,
				type: e.type,
				label: e.label,
				note: e.note,
				place_id: placeId,
				event_date: e.date.date,
				event_date_end: e.date.dateEnd,
				event_qualifier: e.date.qualifier,
				event_precision: e.date.precision
			});
		}
	}
	await insertAll(eventRows, (chunk) => supabase.from('events').insert(chunk));

	// 5. Partnerships (unique couple pairs).
	const pairSeen = new Set<string>();
	const partnershipRows = [];
	for (const f of plan.families) {
		if (f.partners.length < 2) continue;
		const a = personIdByXref.get(f.partners[0]);
		const b = personIdByXref.get(f.partners[1]);
		if (!a || !b) continue;
		const [partner_a, partner_b] = orderedPair(a, b);
		const key = `${partner_a}|${partner_b}`;
		if (pairSeen.has(key)) continue;
		pairSeen.add(key);
		partnershipRows.push({ tree_id: treeId, partner_a, partner_b, status: 'current' as const });
	}
	await insertAll(partnershipRows, (chunk) => supabase.from('partnerships').insert(chunk));

	// 6. Parent-child links (each parent → each child, deduped).
	const linkSeen = new Set<string>();
	const linkRows = [];
	for (const f of plan.families) {
		for (const parentXref of f.partners) {
			const parentId = personIdByXref.get(parentXref);
			if (!parentId) continue;
			for (const childXref of f.children) {
				const childId = personIdByXref.get(childXref);
				if (!childId) continue;
				const key = `${parentId}|${childId}`;
				if (linkSeen.has(key)) continue;
				linkSeen.add(key);
				linkRows.push({ tree_id: treeId, parent_id: parentId, child_id: childId });
			}
		}
	}
	await insertAll(linkRows, (chunk) => supabase.from('parent_child_links').insert(chunk));

	return {
		treeId,
		counts: plan.counts,
		placesLocated: located,
		placesQueued: plan.placeNames.length - located
	};
}
