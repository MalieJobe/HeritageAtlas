/**
 * Event types — the single shared definition of the `event_type` enum plus the
 * display metadata the rest of the app reads from. The DB enum
 * (migration 0012) and this list must stay in lockstep; `EVENT_TYPES` is ordered
 * the way we want types presented in pickers and legends.
 *
 * `locates` marks the types that place a person somewhere on the map timeline —
 * the position resolver (task 2.10) walks these to decide where a person "is" in
 * a given year. Non-locating types (e.g. occupation) are still timeline facts but
 * don't move the dot on their own.
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
	/** The label comes from the event row's free-text `label` column. */
	custom?: boolean;
}

export const EVENT_TYPES: EventTypeMeta[] = [
	{ type: 'birth', label: 'Birth', icon: '👶', locates: true },
	{ type: 'residence', label: 'Residence', icon: '🏠', locates: true },
	{ type: 'occupation', label: 'Occupation', icon: '💼', locates: false },
	{ type: 'marriage', label: 'Marriage', icon: '💍', locates: true },
	{ type: 'death', label: 'Death', icon: '✝️', locates: true },
	{ type: 'custom', label: 'Other', icon: '📌', locates: true, custom: true }
];

const BY_TYPE = new Map<EventType, EventTypeMeta>(EVENT_TYPES.map((meta) => [meta.type, meta]));

/** Metadata for an event type; falls back to the 'custom' entry for anything unknown. */
export function eventTypeMeta(type: EventType): EventTypeMeta {
	return BY_TYPE.get(type) ?? BY_TYPE.get('custom')!;
}

/**
 * The name to show for an event: the row's free-text `label` for custom events
 * (falling back to "Other" when blank), otherwise the type's fixed label.
 */
export function eventDisplayLabel(type: EventType, label?: string | null): string {
	const meta = eventTypeMeta(type);
	if (meta.custom) {
		const trimmed = label?.trim();
		return trimmed || meta.label;
	}
	return meta.label;
}
