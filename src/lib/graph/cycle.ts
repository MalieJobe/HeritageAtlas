/**
 * Cycle prevention for parent-child links.
 *
 * A genealogy graph must stay acyclic: nobody can be their own ancestor. The DB
 * blocks the trivial self-link (parent_id <> child_id), but not longer loops —
 * e.g. making your mother your own child (you → mother already exists, so adding
 * mother → you... no: adding you → mother closes the loop). This pure helper
 * catches those before we ever write the edge.
 */

export interface ParentChildEdge {
	parentId: string;
	childId: string;
}

/**
 * Would adding the edge `parentId → childId` (parentId becomes a parent of
 * childId) create a cycle, given the existing edges? True when parentId === childId,
 * or when childId is already an ancestor of parentId (so the new edge would make
 * childId an ancestor of itself).
 */
export function wouldCreateCycle(
	edges: ParentChildEdge[],
	parentId: string,
	childId: string
): boolean {
	if (parentId === childId) return true;

	// child → [its parents], to walk ancestry upward.
	const parentsOf = new Map<string, string[]>();
	for (const e of edges) {
		const arr = parentsOf.get(e.childId);
		if (arr) arr.push(e.parentId);
		else parentsOf.set(e.childId, [e.parentId]);
	}

	// Walk up from parentId; if we reach childId, childId is already an ancestor of
	// parentId and the new edge would close a loop.
	const seen = new Set<string>();
	const stack = [parentId];
	while (stack.length > 0) {
		const id = stack.pop() as string;
		if (id === childId) return true;
		for (const p of parentsOf.get(id) ?? []) {
			if (!seen.has(p)) {
				seen.add(p);
				stack.push(p);
			}
		}
	}
	return false;
}
