import { describe, it, expect } from 'vitest';
import { wouldCreateCycle, type ParentChildEdge } from './cycle';

// Edges read "parent → child" (parentId is a parent of childId).
const edge = (parentId: string, childId: string): ParentChildEdge => ({ parentId, childId });

describe('wouldCreateCycle', () => {
	it('rejects a self link', () => {
		expect(wouldCreateCycle([], 'a', 'a')).toBe(true);
	});

	it('allows an unrelated new link', () => {
		expect(wouldCreateCycle([edge('mom', 'me')], 'dad', 'me')).toBe(false);
	});

	it('allows adding a child to a person', () => {
		// me → kid, with mom → me already present, is fine.
		expect(wouldCreateCycle([edge('mom', 'me')], 'me', 'kid')).toBe(false);
	});

	it('blocks the classic case: making your mother your own child', () => {
		// mom → me exists; adding me → mom would loop.
		expect(wouldCreateCycle([edge('mom', 'me')], 'me', 'mom')).toBe(true);
	});

	it('blocks a grandparent loop (multi-step ancestor)', () => {
		const edges = [edge('grandma', 'mom'), edge('mom', 'me')];
		// Making me a parent of grandma closes a 3-node loop.
		expect(wouldCreateCycle(edges, 'me', 'grandma')).toBe(true);
	});

	it('blocks adding an ancestor as a child anywhere along the chain', () => {
		const edges = [edge('g', 'mom'), edge('mom', 'me'), edge('me', 'kid')];
		expect(wouldCreateCycle(edges, 'kid', 'g')).toBe(true); // kid → g loops the whole chain
		expect(wouldCreateCycle(edges, 'kid', 'mom')).toBe(true);
		expect(wouldCreateCycle(edges, 'kid', 'me')).toBe(true);
	});

	it('allows linking across separate branches that do not loop', () => {
		const edges = [edge('a', 'b'), edge('c', 'd')];
		expect(wouldCreateCycle(edges, 'b', 'c')).toBe(false); // b → c joins two chains, no loop
		expect(wouldCreateCycle(edges, 'd', 'a')).toBe(false);
	});

	it('handles a person with two parents (diamond) without false positives', () => {
		// mom and dad are both parents of me; mom and dad share a parent (gp).
		const edges = [edge('gp', 'mom'), edge('gp', 'dad'), edge('mom', 'me'), edge('dad', 'me')];
		expect(wouldCreateCycle(edges, 'me', 'sibling')).toBe(false);
		// But me → gp would loop (gp is my great-grandparent via both branches).
		expect(wouldCreateCycle(edges, 'me', 'gp')).toBe(true);
	});
});
