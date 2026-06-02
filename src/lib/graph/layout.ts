import type { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import type { GraphData } from './types';

/** Rendered card footprint, shared by the layout and the node component. */
export const NODE_WIDTH = 170;
export const NODE_HEIGHT = 186;

/** Union nodes are invisible junction points; ELK still needs a size. */
const UNION_SIZE = 1;

export type Point = { x: number; y: number };

export type LayoutNode = { id: string; x: number; y: number };
export type LayoutUnion = { id: string; x: number; y: number };
export type LayoutEdge = {
	id: string;
	kind: 'partner' | 'parent';
	status?: 'current' | 'former';
	points: Point[];
};

export type LayoutResult = {
	nodes: Map<string, LayoutNode>;
	unions: LayoutUnion[];
	edges: LayoutEdge[];
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

type EdgeMeta = { kind: 'partner' | 'parent'; status?: 'current' | 'former' };

/**
 * Turn the raw graph into ELK input using the union-node model: both parents
 * point at a shared union node (so layered layout lands them on the same rank,
 * one above the union), and the union points down at each child (one rank below).
 * Returns the ELK graph plus a map describing how to style each edge.
 */
function buildElkGraph(data: GraphData): {
	graph: ElkNode;
	edgeMeta: Map<string, EdgeMeta>;
	unionIds: Set<string>;
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
	const edgeMeta = new Map<string, EdgeMeta>();
	const edges: ElkExtendedEdge[] = [];

	for (const union of unions.values()) {
		const isPartnerUnion = union.parents.length === 2 && union.partnershipStatus != null;
		for (const parent of union.parents) {
			if (!personIds.has(parent)) continue;
			const id = `pe:${parent}:${union.key}`;
			edges.push({ id, sources: [parent], targets: [union.id] });
			edgeMeta.set(
				id,
				isPartnerUnion ? { kind: 'partner', status: union.partnershipStatus } : { kind: 'parent' }
			);
		}
		for (const child of union.children) {
			if (!personIds.has(child)) continue;
			const id = `ce:${union.key}:${child}`;
			edges.push({ id, sources: [union.id], targets: [child] });
			edgeMeta.set(id, { kind: 'parent' });
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
			'elk.layered.spacing.nodeNodeBetweenLayers': '70',
			'elk.spacing.nodeNode': '44',
			'elk.layered.spacing.edgeNodeBetweenLayers': '24',
			'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
			'elk.layered.mergeEdges': 'true',
			'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES'
		},
		children,
		edges
	};

	return { graph, edgeMeta, unionIds };
}

/**
 * Run ELK over the family graph and return absolute positions for person nodes,
 * junction points for unions, and routed polylines for every connector. Pure
 * with respect to its input — safe to memoize on the graph data.
 */
export async function layoutGraph(data: GraphData): Promise<LayoutResult> {
	const { graph, edgeMeta, unionIds } = buildElkGraph(data);
	// Dynamic import keeps the ~1MB ELK bundle out of the SSR path; layout only
	// ever runs in the browser.
	const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
	const elk = new ELK();
	const laid = await elk.layout(graph);

	const nodes = new Map<string, LayoutNode>();
	const unions: LayoutUnion[] = [];
	for (const child of laid.children ?? []) {
		const x = child.x ?? 0;
		const y = child.y ?? 0;
		if (unionIds.has(child.id)) {
			unions.push({ id: child.id, x: x + (child.width ?? 0) / 2, y: y + (child.height ?? 0) / 2 });
		} else {
			nodes.set(child.id, { id: child.id, x, y });
		}
	}

	const edges: LayoutEdge[] = [];
	for (const edge of laid.edges ?? []) {
		const section = edge.sections?.[0];
		if (!section) continue;
		const points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];
		const meta = edgeMeta.get(edge.id) ?? { kind: 'parent' as const };
		edges.push({ id: edge.id, kind: meta.kind, status: meta.status, points });
	}

	return {
		nodes,
		unions,
		edges,
		width: laid.width ?? 0,
		height: laid.height ?? 0
	};
}
