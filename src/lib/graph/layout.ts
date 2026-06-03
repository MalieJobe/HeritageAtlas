import type { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import type { GraphData } from './types';

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
			'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES'
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
