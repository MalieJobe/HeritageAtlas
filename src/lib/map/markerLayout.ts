/**
 * Marker layout for the map dots.
 *
 * The goal: keep people as their own individual dots for as long as they fit,
 * and only fall back to a numbered cluster when there are so many crammed into
 * one spot that scattering them would fling dots wildly far from where they
 * actually were.
 *
 * Per render we group dots that overlap on screen, then decide each group:
 *  - small enough to fan out within a sane footprint → individual dots, scattered
 *    in pixel space so none overlap;
 *  - too crowded → a single count badge at the group's centre.
 *
 * As you zoom in, groups split, footprints shrink, and badges resolve back into
 * individual dots; as you zoom out, the opposite. Everything here is pure and
 * deterministic for a given input, so it's stable frame-to-frame.
 */

export type LayoutInput = {
	id: string;
	lng: number;
	lat: number;
	/** Projected pixel position at the current zoom. */
	x: number;
	y: number;
};

export type DotInstruction = {
	kind: 'dot';
	id: string;
	lng: number;
	lat: number;
	/** Pixel nudge that keeps this dot clear of its neighbours. */
	offsetX: number;
	offsetY: number;
};

export type ClusterInstruction = {
	kind: 'cluster';
	key: string;
	lng: number;
	lat: number;
	count: number;
	memberIds: string[];
};

export type MarkerInstruction = DotInstruction | ClusterInstruction;

const GOLDEN_ANGLE = 2.399963229728653;
const MAX_ITERATIONS = 90;

/** Greedy screen-space grouping: a point joins a group whose centroid is within
 *  `mergePx`, otherwise it starts its own. */
function groupByProximity(points: LayoutInput[], mergePx: number): LayoutInput[][] {
	type Acc = { x: number; y: number; sumX: number; sumY: number; members: LayoutInput[] };
	const accs: Acc[] = [];
	const thresh2 = mergePx * mergePx;
	for (const pt of points) {
		let placed: Acc | null = null;
		for (const a of accs) {
			const dx = a.x - pt.x;
			const dy = a.y - pt.y;
			if (dx * dx + dy * dy <= thresh2) {
				placed = a;
				break;
			}
		}
		if (placed) {
			placed.members.push(pt);
			placed.sumX += pt.x;
			placed.sumY += pt.y;
			placed.x = placed.sumX / placed.members.length;
			placed.y = placed.sumY / placed.members.length;
		} else {
			accs.push({ x: pt.x, y: pt.y, sumX: pt.x, sumY: pt.y, members: [pt] });
		}
	}
	return accs.map((a) => a.members);
}

/** Push a group's dots apart (in pixel space) until none are closer than `minDist`. */
function scatter(group: LayoutInput[], minDist: number): { x: number; y: number }[] {
	const n = group.length;
	const xs = new Float64Array(n);
	const ys = new Float64Array(n);

	// Seed coincident points onto a spiral so relaxation has a direction to push.
	const seen = new Map<string, number>();
	for (let i = 0; i < n; i++) {
		const key = `${Math.round(group[i].x)},${Math.round(group[i].y)}`;
		const k = seen.get(key) ?? 0;
		seen.set(key, k + 1);
		const r = k === 0 ? 0 : Math.sqrt(k) * minDist * 0.6;
		const a = k * GOLDEN_ANGLE;
		xs[i] = group[i].x + Math.cos(a) * r;
		ys[i] = group[i].y + Math.sin(a) * r;
	}

	const min2 = minDist * minDist;
	for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
		let moved = false;
		for (let i = 0; i < n; i++) {
			for (let j = i + 1; j < n; j++) {
				let dx = xs[j] - xs[i];
				let dy = ys[j] - ys[i];
				const d2 = dx * dx + dy * dy;
				if (d2 >= min2) continue;
				let d = Math.sqrt(d2);
				if (d < 1e-6) {
					const a = (i * 12.9898 + j * 78.233) % (2 * Math.PI) || 0.1;
					dx = Math.cos(a);
					dy = Math.sin(a);
					d = 1;
				}
				const push = (minDist - d) / 2 + 0.5;
				const ux = dx / d;
				const uy = dy / d;
				xs[i] -= ux * push;
				ys[i] -= uy * push;
				xs[j] += ux * push;
				ys[j] += uy * push;
				moved = true;
			}
		}
		if (!moved) break;
	}

	const out: { x: number; y: number }[] = [];
	for (let i = 0; i < n; i++) out.push({ x: xs[i], y: ys[i] });
	return out;
}

/** Rough radius a hex-packed group of `n` dots needs at the given spacing. */
function packRadius(n: number, minDist: number): number {
	return 0.5 * minDist * (1 + Math.sqrt(n));
}

/**
 * Lay out the dots: individuals (scattered to avoid overlap) wherever a crowd
 * fits within `maxSpread`, count badges only for crowds too dense to fan out.
 */
export function layoutMarkers(
	points: LayoutInput[],
	{
		minDist,
		maxSpread,
		forceIndividual = false
	}: { minDist: number; maxSpread: number; forceIndividual?: boolean }
): MarkerInstruction[] {
	const out: MarkerInstruction[] = [];
	for (const group of groupByProximity(points, minDist)) {
		if (group.length === 1) {
			const p = group[0];
			out.push({ kind: 'dot', id: p.id, lng: p.lng, lat: p.lat, offsetX: 0, offsetY: 0 });
			continue;
		}

		// Too many to fan out without flinging dots far from the truth → one badge.
		// `forceIndividual` (zoomed in close) overrides this: always show every person.
		if (!forceIndividual && packRadius(group.length, minDist) > maxSpread) {
			let sumLng = 0;
			let sumLat = 0;
			for (const p of group) {
				sumLng += p.lng;
				sumLat += p.lat;
			}
			out.push({
				kind: 'cluster',
				key: `c:${group
					.map((p) => p.id)
					.sort()
					.join(',')}`,
				lng: sumLng / group.length,
				lat: sumLat / group.length,
				count: group.length,
				memberIds: group.map((p) => p.id)
			});
			continue;
		}

		const resolved = scatter(group, minDist);
		group.forEach((p, i) => {
			out.push({
				kind: 'dot',
				id: p.id,
				lng: p.lng,
				lat: p.lat,
				offsetX: resolved[i].x - p.x,
				offsetY: resolved[i].y - p.y
			});
		});
	}
	return out;
}
