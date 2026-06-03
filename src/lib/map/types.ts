/** Shared shapes for the map view: what the loader produces and the position
 *  resolver / dots layer consume. Kept framework-agnostic so the resolver stays
 *  a pure, testable function. */

import type { EventType } from '$lib/events';
import type { Sex } from '$lib/graph/types';

/**
 * A single located moment in a person's life: a locating event (per
 * `EVENT_TYPES.locates`) that resolved to a place with coordinates. `year` is the
 * lower-bound calendar year parsed from the fuzzy date — enough to order events
 * and compare against the timeline year.
 */
export type LocatingEvent = {
	type: EventType;
	year: number;
	lat: number;
	lng: number;
	placeName: string;
};

/** A person ready to place on the map, with their locating events ascending by year. */
export type MapPerson = {
	id: string;
	name: string;
	surname: string | null;
	initials: string;
	sex: Sex;
	photoUrl: string | null;
	events: LocatingEvent[];
};

/** Everything the map needs, resolved server-side. */
export type MapData = {
	persons: MapPerson[];
	/** Span of known event years, for the (later) timeline slider; null if no dates. */
	yearRange: { min: number; max: number } | null;
};

/** A person resolved to a position at a given year. */
export type ResolvedPosition = {
	person: MapPerson;
	lat: number;
	lng: number;
	placeName: string;
	/** The event that put them there. */
	event: LocatingEvent;
};
