/**
 * Position resolver (task 2.10).
 *
 * Given a year, decide where each person "is": the place of their most recent
 * locating event at or before that year. A person with no event yet (e.g. born
 * later than the slider year) simply isn't on the map — they haven't appeared.
 *
 * Each person's events are assumed sorted ascending by year (the loader does
 * this), so the resolved event is the last one with `year <= target`.
 */

import type { LocatingEvent, MapPerson, ResolvedPosition } from './types';

/** The most recent locating event at or before `year`, or null if none qualifies. */
function eventAtYear(events: LocatingEvent[], year: number): LocatingEvent | null {
	let resolved: LocatingEvent | null = null;
	for (const event of events) {
		if (event.year <= year) resolved = event;
		else break; // ascending — nothing further can qualify
	}
	return resolved;
}

/** Resolve every person to a position at `year`; people with no event yet are omitted. */
export function resolvePositions(persons: MapPerson[], year: number): ResolvedPosition[] {
	const positions: ResolvedPosition[] = [];
	for (const person of persons) {
		const event = eventAtYear(person.events, year);
		if (!event) continue;
		positions.push({
			person,
			lat: event.lat,
			lng: event.lng,
			placeName: event.placeName,
			event
		});
	}
	return positions;
}
