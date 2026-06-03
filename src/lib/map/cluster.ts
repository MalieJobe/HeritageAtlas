/**
 * Marker spreading + screen-space clustering for the map dots.
 *
 * Two things keep dots legible no matter how many people share a place:
 *
 * 1. `spreadCoincident` fans out people sitting on the *exact* same coordinate
 *    onto a small ring, so they're never drawn on top of each other and can
 *    separate into their own circles once you zoom in far enough.
 * 2. `clusterPoints` groups whatever points still overlap *on screen* (closer
 *    than a marker's width) into a single cluster, so a crowd shows one count
 *    badge that splits apart as the map zooms in.
 */

import type { ResolvedPosition } from './types';

/** Rough metres per degree of latitude — good enough for a few-metre fan-out. */
const METRES_PER_DEGREE = 111_320;

/** A resolved person at a (possibly nudged) drawing position. */
export type MapPoint = {
	position: ResolvedPosition;
	lng: number;
	lat: number;
};

/**
 * Nudge people who share an identical coordinate onto a small ring around it so
 * they never render in exactly the same spot; unique points pass through
 * unchanged. The ring grows with the crowd so larger groups stay separable.
 */
export function spreadCoincident(positions: ResolvedPosition[]): MapPoint[] {
	const groups = new Map<string, ResolvedPosition[]>();
	for (const p of positions) {
		const key = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
		const g = groups.get(key);
		if (g) g.push(p);
		else groups.set(key, [p]);
	}

	const out: MapPoint[] = [];
	for (const group of groups.values()) {
		if (group.length === 1) {
			const p = group[0];
			out.push({ position: p, lng: p.lng, lat: p.lat });
			continue;
		}
		const n = group.length;
		// Ring sized so adjacent members sit ~SPREAD_SPACING_M apart on the ground —
		// enough to separate into their own circles once you zoom to roughly town
		// level (they stay a single count badge when zoomed further out).
		const SPREAD_SPACING_M = 550;
		const radius = Math.min(800, Math.max(120, (SPREAD_SPACING_M * n) / (2 * Math.PI)));
		const cosLat = Math.cos((group[0].lat * Math.PI) / 180) || 1e-6;
		group.forEach((p, i) => {
			const angle = (2 * Math.PI * i) / n;
			out.push({
				position: p,
				lat: p.lat + (radius * Math.sin(angle)) / METRES_PER_DEGREE,
				lng: p.lng + (radius * Math.cos(angle)) / (METRES_PER_DEGREE * cosLat)
			});
		});
	}
	return out;
}

/** A drawn marker: a single person, or a crowd collapsed to a count. */
export type Cluster = {
	key: string;
	lng: number;
	lat: number;
	members: MapPoint[];
};

/**
 * Greedy screen-space clustering: any point whose projected pixel lands within
 * `mergePx` of an existing cluster's centroid joins it, otherwise it starts a
 * new one. Recompute on every zoom/move — the same world points decluster as
 * the projection spreads them apart. The cluster key is stable for a lone
 * person (so their marker is reused across frames) and composition-based for a
 * crowd.
 */
export function clusterPoints(
	points: MapPoint[],
	project: (lng: number, lat: number) => { x: number; y: number },
	mergePx: number
): Cluster[] {
	type Acc = { sumLng: number; sumLat: number; x: number; y: number; members: MapPoint[] };
	const accs: Acc[] = [];
	const thresh2 = mergePx * mergePx;

	for (const pt of points) {
		const { x, y } = project(pt.lng, pt.lat);
		let placed: Acc | null = null;
		for (const a of accs) {
			const dx = a.x - x;
			const dy = a.y - y;
			if (dx * dx + dy * dy <= thresh2) {
				placed = a;
				break;
			}
		}
		if (placed) {
			placed.members.push(pt);
			placed.sumLng += pt.lng;
			placed.sumLat += pt.lat;
			const c = project(
				placed.sumLng / placed.members.length,
				placed.sumLat / placed.members.length
			);
			placed.x = c.x;
			placed.y = c.y;
		} else {
			accs.push({ sumLng: pt.lng, sumLat: pt.lat, x, y, members: [pt] });
		}
	}

	return accs.map((a) => {
		const lng = a.sumLng / a.members.length;
		const lat = a.sumLat / a.members.length;
		const key =
			a.members.length === 1
				? `p:${a.members[0].position.person.id}`
				: `c:${a.members
						.map((m) => m.position.person.id)
						.sort()
						.join(',')}`;
		return { key, lng, lat, members: a.members };
	});
}
