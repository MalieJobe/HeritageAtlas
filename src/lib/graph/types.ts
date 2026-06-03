/** Shared shapes for the family graph: the data the loader produces and the
 *  layout consumes. Kept framework-agnostic so the layout helper stays pure. */

export type Sex = 'male' | 'female' | 'other' | null;

/** A person, ready to render as a node. */
export type GraphPerson = {
	id: string;
	name: string;
	surname: string | null;
	initials: string;
	sex: Sex;
	photoUrl: string | null;
	/** Birth year (from the birth event), shown in the card's bottom-left. */
	birthYear: number | null;
	/** Death year (from a death event, if any), shown in the card's bottom-right. */
	deathYear: number | null;
};

/** A partnership edge (symmetric). `status` drives the connector style. */
export type GraphPartnership = {
	id: string;
	a: string;
	b: string;
	status: 'current' | 'former';
};

/** A directed parent → child edge. */
export type GraphParentLink = {
	id: string;
	parent: string;
	child: string;
};

/** Everything the graph needs, resolved server-side. */
export type GraphData = {
	persons: GraphPerson[];
	partnerships: GraphPartnership[];
	parentLinks: GraphParentLink[];
};
