/**
 * Event types — the single shared definition of the event types the app uses,
 * plus the display metadata the rest of the app reads from.
 *
 * We track three life facts: birth (expected on everyone), residence, and death
 * (optional). All three can carry a place and so can position a person on the map
 * over time; marriage/work belong to the relationship data, not the map. The DB
 * `event_type` enum (migration 0012) still has other legacy values, but the app
 * only offers and resolves these three.
 */

import type { Database } from '$lib/supabase/types';

export type EventType = Database['public']['Enums']['event_type'];

export interface EventTypeMeta {
	type: EventType;
	/** Short display name, e.g. "Birth". */
	label: string;
	/** Emoji glyph for compact lists and map markers. */
	icon: string;
	/** Whether this event type contributes to a person's location over time. */
	locates: boolean;
}

export const EVENT_TYPES: EventTypeMeta[] = [
	{ type: 'birth', label: 'Birth', icon: '👶', locates: true },
	{ type: 'residence', label: 'Residence', icon: '🏠', locates: true },
	{ type: 'death', label: 'Death', icon: '✝️', locates: true }
];

const BY_TYPE = new Map<EventType, EventTypeMeta>(EVENT_TYPES.map((meta) => [meta.type, meta]));

/** Metadata for an event type; a generic fallback for any legacy/unknown type. */
export function eventTypeMeta(type: EventType): EventTypeMeta {
	return BY_TYPE.get(type) ?? { type, label: 'Event', icon: '📍', locates: true };
}

/** The name to show for an event: its free-text `label`, falling back to the type's name. */
export function eventDisplayLabel(type: EventType, label?: string | null): string {
	const trimmed = label?.trim();
	return trimmed || eventTypeMeta(type).label;
}
