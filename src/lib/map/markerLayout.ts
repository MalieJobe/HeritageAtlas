/**
 * Marker layout for the map dots.
 *
 * Every person is always their own dot — we never collapse a crowd into a count
 * badge. Dots that land on the same spot are fanned out (scattered in pixel
 * space) just enough that none overlap. The caller sizes the dots so they never
 * represent more than a city's worth of ground (see MapView), and passes the
 * matching `minDist`, so the whole fan-out stays tight to the real location and
 * shrinks as you zoom out.
 *
 * Pure and deterministic for a given input, so it's stable frame-to-frame.
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
	id: string;
	lng: number;
	lat: number;
	/** Pixel nudge that keeps this dot clear of its neighbours. */
	offsetX: number;
	offsetY: number;
};

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

/**
 * Lay out the dots: every person as an individual, scattered just enough that
 * overlapping neighbours sit `minDist` apart.
 */
export function layoutMarkers(
	points: LayoutInput[],
	{ minDist }: { minDist: number }
): DotInstruction[] {
	const out: DotInstruction[] = [];
	for (const group of groupByProximity(points, minDist)) {
		if (group.length === 1) {
			const p = group[0];
			out.push({ id: p.id, lng: p.lng, lat: p.lat, offsetX: 0, offsetY: 0 });
			continue;
		}
		const resolved = scatter(group, minDist);
		group.forEach((p, i) => {
			out.push({
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
