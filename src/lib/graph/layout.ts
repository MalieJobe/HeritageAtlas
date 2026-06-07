import type { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import type { GraphData, GraphParentLink } from './types';

/** Rendered card footprint, shared by the layout and the node component. */
export const NODE_WIDTH = 167;
export const NODE_HEIGHT = 175;

/**
 * Connection anchors in node-local coordinates (origin = node's top-left), shared
 * with PersonNode so connectors meet the artwork. The partnership line attaches at
 * the node's mid-height; children attach at the top of the photo blob; a lone
 * parent's line leaves from the bottom of the name card.
 */
export const PARTNER_ANCHOR_Y = 86;
export const CHILD_TOP_Y = 6;
export const PARENT_BOTTOM_Y = 165;

/** Union nodes are invisible junction points; ELK still needs a size. */
const UNION_SIZE = 1;

export type Point = { x: number; y: number };

export type LayoutNode = { id: string; x: number; y: number };

/** A family unit positioned for drawing: the parents (1–2) and the children they share. */
export type LayoutFamily = {
	id: string;
	parents: string[];
	children: string[];
	status?: 'current' | 'former';
};

export type LayoutResult = {
	nodes: Map<string, LayoutNode>;
	families: LayoutFamily[];
	width: number;
	height: number;
};

/** One "family unit": a set of parents and the children they share. A partnership
 *  with no children is still a unit so its connector can be drawn. */
type Union = {
	key: string;
	id: string;
	parents: string[];
	children: string[];
	partnershipStatus?: 'current' | 'former';
};

/**
 * Turn the raw graph into ELK input using the union-node model: both parents
 * point at a shared union node (so layered layout lands them on the same rank,
 * one above the union), and the union points down at each child (one rank below).
 * Returns the ELK graph plus the family units it encodes.
 */
function buildElkGraph(data: GraphData): {
	graph: ElkNode;
	unionIds: Set<string>;
	unions: Union[];
} {
	const unions = new Map<string, Union>();
	const unionFor = (parentIds: string[]): Union => {
		const sorted = [...parentIds].sort();
		const key = sorted.join('|');
		let union = unions.get(key);
		if (!union) {
			union = { key, id: `u:${key}`, parents: sorted, children: [] };
			unions.set(key, union);
		}
		return union;
	};

	// A child's parents form one family unit, regardless of how many links exist.
	const parentsByChild = new Map<string, Set<string>>();
	for (const link of data.parentLinks) {
		let set = parentsByChild.get(link.child);
		if (!set) {
			set = new Set();
			parentsByChild.set(link.child, set);
		}
		set.add(link.parent);
	}
	for (const [child, parents] of parentsByChild) {
		unionFor([...parents]).children.push(child);
	}

	// Each partnership attaches its status to the matching couple's union (creating
	// a childless union if the pair has no shared children yet).
	for (const p of data.partnerships) {
		unionFor([p.a, p.b]).partnershipStatus = p.status;
	}

	const personIds = new Set(data.persons.map((p) => p.id));
	const edges: ElkExtendedEdge[] = [];

	for (const union of unions.values()) {
		for (const parent of union.parents) {
			if (!personIds.has(parent)) continue;
			edges.push({ id: `pe:${parent}:${union.key}`, sources: [parent], targets: [union.id] });
		}
		for (const child of union.children) {
			if (!personIds.has(child)) continue;
			edges.push({ id: `ce:${union.key}:${child}`, sources: [union.id], targets: [child] });
		}
	}

	const unionIds = new Set([...unions.values()].map((u) => u.id));
	const children: ElkNode[] = [
		...data.persons.map((p) => ({ id: p.id, width: NODE_WIDTH, height: NODE_HEIGHT })),
		...[...unions.values()].map((u) => ({ id: u.id, width: UNION_SIZE, height: UNION_SIZE }))
	];

	const graph: ElkNode = {
		id: 'root',
		layoutOptions: {
			'elk.algorithm': 'layered',
			'elk.direction': 'DOWN',
			'elk.edgeRouting': 'ORTHOGONAL',
			'elk.layered.spacing.nodeNodeBetweenLayers': '64',
			'elk.spacing.nodeNode': '52',
			'elk.layered.spacing.edgeNodeBetweenLayers': '24',
			'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
			'elk.layered.mergeEdges': 'true',
			// Crossing minimisation: persons arrive alphabetically (meaningless for
			// layout), so honouring model order forced needless crossings — especially
			// where a maternal + paternal side join. Let ELK's layer-sweep reorder
			// freely and give it more passes (3.5g).
			'elk.layered.considerModelOrder.strategy': 'NONE',
			'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
			'elk.layered.crossingMinimization.semiInteractive': 'false',
			'elk.layered.thoroughness': '40'
		},
		children,
		edges
	};

	return { graph, unionIds, unions: [...unions.values()] };
}

/**
 * Run ELK over the family graph and return absolute positions for person nodes
 * plus the family units to connect. Connector geometry is derived from the node
 * positions at draw time (so partnerships render as a horizontal line and
 * children branch from its centre). Pure with respect to its input.
 */
export async function layoutGraph(data: GraphData): Promise<LayoutResult> {
	const { graph, unionIds, unions } = buildElkGraph(data);
	// Dynamic import keeps the ~1MB ELK bundle out of the SSR path; layout only
	// ever runs in the browser.
	const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
	const elk = new ELK();
	const laid = await elk.layout(graph);

	const nodes = new Map<string, LayoutNode>();
	for (const child of laid.children ?? []) {
		if (unionIds.has(child.id)) continue;
		nodes.set(child.id, { id: child.id, x: child.x ?? 0, y: child.y ?? 0 });
	}

	// Keep only families that still have at least one positioned member to draw.
	const families: LayoutFamily[] = unions
		.map((u) => ({
			id: u.id,
			parents: u.parents.filter((p) => nodes.has(p)),
			children: u.children.filter((c) => nodes.has(c)),
			status: u.partnershipStatus
		}))
		.filter((f) => f.parents.length > 0 && (f.children.length > 0 || f.parents.length === 2));

	return {
		nodes,
		families,
		width: laid.width ?? 0,
		height: laid.height ?? 0
	};
}

/** Drawable connector geometry for one family unit. */
export type Connector = {
	id: string;
	partnerLine?: { x1: number; x2: number; y: number; status?: 'current' | 'former' };
	junction?: { x: number; y: number };
	childPaths: { id: string; d: string }[];
};

/** Orthogonal connector from a junction down to a child, with rounded corners. */
function childPath(jx: number, jy: number, busY: number, cx: number, cy: number): string {
	if (Math.abs(cx - jx) < 0.5) return `M ${jx} ${jy} L ${cx} ${cy}`;
	const dir = cx > jx ? 1 : -1;
	const r = Math.max(
		0,
		Math.min(22, Math.abs(cx - jx) / 2, Math.abs(busY - jy) / 2, Math.abs(cy - busY) / 2)
	);
	return `M ${jx} ${jy} V ${busY - r} Q ${jx} ${busY} ${jx + dir * r} ${busY} H ${cx - dir * r} Q ${cx} ${busY} ${cx} ${busY + r} V ${cy}`;
}

/**
 * Connector geometry from node positions: partnerships are a horizontal line
 * between the two cards with a centre junction; children curve down from that
 * junction (or, for a lone parent, from the bottom of their card). Shared by the
 * full graph and the person-page mini tree.
 */
export function buildConnectors(result: LayoutResult): Connector[] {
	const nodes = result.nodes;
	const out: Connector[] = [];
	for (const fam of result.families) {
		const parents = fam.parents.map((id) => nodes.get(id)).filter((n): n is LayoutNode => !!n);
		if (parents.length === 0) continue;

		let jx: number;
		let jy: number;
		let partnerLine: Connector['partnerLine'];
		if (parents.length === 2) {
			const left = parents[0].x <= parents[1].x ? parents[0] : parents[1];
			const right = parents[0].x <= parents[1].x ? parents[1] : parents[0];
			const y = left.y + PARTNER_ANCHOR_Y;
			partnerLine = { x1: left.x + NODE_WIDTH, x2: right.x, y, status: fam.status };
			jx = (left.x + NODE_WIDTH + right.x) / 2;
			jy = y;
		} else {
			jx = parents[0].x + NODE_WIDTH / 2;
			jy = parents[0].y + PARENT_BOTTOM_Y;
		}

		const childNodes = fam.children.map((id) => nodes.get(id)).filter((n): n is LayoutNode => !!n);
		let childPaths: Connector['childPaths'] = [];
		if (childNodes.length > 0) {
			const minChildTop = Math.min(...childNodes.map((c) => c.y + CHILD_TOP_Y));
			const busY = (jy + minChildTop) / 2;
			childPaths = childNodes.map((c) => ({
				id: c.id,
				d: childPath(jx, jy, busY, c.x + NODE_WIDTH / 2, c.y + CHILD_TOP_Y)
			}));
		}

		out.push({
			id: fam.id,
			partnerLine,
			junction: parents.length === 2 ? { x: jx, y: jy } : undefined,
			childPaths
		});
	}
	return out;
}

/**
 * All ancestors of a person (parents, grandparents, …), never descendants — used
 * to highlight the ancestry path when a node is selected (3.5c). Pure helper so it
 * lives outside the component's reactive scope.
 */
export function ancestorsOf(
	parentLinks: GraphParentLink[],
	selectedId: string | null
): Set<string> {
	const set = new Set<string>();
	if (!selectedId) return set;
	const childToParents = new Map<string, string[]>();
	for (const l of parentLinks) {
		const arr = childToParents.get(l.child);
		if (arr) arr.push(l.parent);
		else childToParents.set(l.child, [l.parent]);
	}
	const stack = [selectedId];
	while (stack.length > 0) {
		const id = stack.pop() as string;
		for (const p of childToParents.get(id) ?? []) {
			if (!set.has(p)) {
				set.add(p);
				stack.push(p);
			}
		}
	}
	return set;
}

/** A point where two connectors from *different* families cross — drawn as a
 *  "line jump" so it's clear they don't actually join (3.5g). */
export type Hop = { x: number; y: number };

type HSeg = { y: number; x1: number; x2: number; fam: string };
type VSeg = { x: number; y1: number; y2: number; fam: string };

/**
 * Find connector crossings by decomposing each family's connectors into their
 * horizontal and vertical segments (the same geometry buildConnectors draws) and
 * intersecting horizontals against verticals from other families. By convention
 * the horizontal line stays continuous and the vertical gets the hop, so the
 * renderer breaks the vertical at each returned point.
 */
export function buildHops(result: LayoutResult): Hop[] {
	const nodes = result.nodes;
	const hs: HSeg[] = [];
	const vs: VSeg[] = [];

	for (const fam of result.families) {
		const parents = fam.parents.map((id) => nodes.get(id)).filter((n): n is LayoutNode => !!n);
		if (parents.length === 0) continue;

		let jx: number;
		let jy: number;
		if (parents.length === 2) {
			const left = parents[0].x <= parents[1].x ? parents[0] : parents[1];
			const right = parents[0].x <= parents[1].x ? parents[1] : parents[0];
			const y = left.y + PARTNER_ANCHOR_Y;
			hs.push({ y, x1: left.x + NODE_WIDTH, x2: right.x, fam: fam.id });
			jx = (left.x + NODE_WIDTH + right.x) / 2;
			jy = y;
		} else {
			jx = parents[0].x + NODE_WIDTH / 2;
			jy = parents[0].y + PARENT_BOTTOM_Y;
		}

		const childNodes = fam.children.map((id) => nodes.get(id)).filter((n): n is LayoutNode => !!n);
		if (childNodes.length > 0) {
			const minChildTop = Math.min(...childNodes.map((c) => c.y + CHILD_TOP_Y));
			const busY = (jy + minChildTop) / 2;
			vs.push({ x: jx, y1: Math.min(jy, busY), y2: Math.max(jy, busY), fam: fam.id });
			for (const c of childNodes) {
				const cx = c.x + NODE_WIDTH / 2;
				const cy = c.y + CHILD_TOP_Y;
				hs.push({ y: busY, x1: Math.min(jx, cx), x2: Math.max(jx, cx), fam: fam.id });
				vs.push({ x: cx, y1: Math.min(busY, cy), y2: Math.max(busY, cy), fam: fam.id });
			}
		}
	}

	const EPS = 1.5;
	const seen = new Set<string>();
	const hops: Hop[] = [];
	for (const h of hs) {
		for (const v of vs) {
			if (h.fam === v.fam) continue;
			if (v.x > h.x1 + EPS && v.x < h.x2 - EPS && h.y > v.y1 + EPS && h.y < v.y2 - EPS) {
				const key = `${Math.round(v.x)},${Math.round(h.y)}`;
				if (seen.has(key)) continue;
				seen.add(key);
				hops.push({ x: v.x, y: h.y });
			}
		}
	}
	return hops;
}
