import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/types';
import { fuzzyDateFromParts, type DatePrecision, type DateQualifier } from '$lib/fuzzyDate';
import { EVENT_TYPES, type EventType } from '$lib/events';
import { findOrCreatePlace } from '$lib/server/places';
import type { PlaceSelection } from '$lib/place';

type DB = SupabaseClient<Database>;

const EVENT_TYPE_SET = new Set<EventType>(EVENT_TYPES.map((m) => m.type));

/** The event columns ready to insert/update (tree_id and person_id added by the caller). */
export interface ParsedEvent {
	type: EventType;
	label: string | null;
	note: string | null;
	place_id: string | null;
	event_date: string | null;
	event_date_end: string | null;
	event_qualifier: DateQualifier | null;
	event_precision: DatePrecision | null;
}

function intField(formData: FormData, name: string): number | null {
	const n = Number.parseInt(String(formData.get(name) ?? ''), 10);
	return Number.isFinite(n) ? n : null;
}

function textField(formData: FormData, name: string): string | null {
	const value = String(formData.get(name) ?? '').trim();
	return value === '' ? null : value;
}

/**
 * Parse the shared event form into DB columns: validates the type, folds the
 * date inputs into the fuzzy-date columns, and resolves the place selection to a
 * place_id (reusing/creating via findOrCreatePlace). Throws a user-facing message
 * on invalid input for the action to surface.
 */
export async function parseEventForm(
	supabase: DB,
	treeId: string,
	formData: FormData
): Promise<ParsedEvent> {
	const type = String(formData.get('type') ?? '') as EventType;
	if (!EVENT_TYPE_SET.has(type)) {
		throw new Error('Choose an event type.');
	}

	const fuzzy = fuzzyDateFromParts({
		year: intField(formData, 'year'),
		month: intField(formData, 'month'),
		day: intField(formData, 'day'),
		qualifier: textField(formData, 'qualifier') as DateQualifier | null,
		endYear: intField(formData, 'end_year'),
		endMonth: intField(formData, 'end_month'),
		endDay: intField(formData, 'end_day')
	});

	let place_id: string | null = null;
	const rawPlace = String(formData.get('place_selection') ?? '').trim();
	if (rawPlace) {
		let selection: PlaceSelection;
		try {
			selection = JSON.parse(rawPlace) as PlaceSelection;
		} catch {
			throw new Error('The selected place was invalid. Pick it again.');
		}
		place_id = await findOrCreatePlace(supabase, treeId, selection);
	}

	return {
		type,
		// A label only means something for custom events.
		label: type === 'custom' ? textField(formData, 'label') : null,
		note: textField(formData, 'note'),
		place_id,
		event_date: fuzzy.date,
		event_date_end: fuzzy.dateEnd,
		event_qualifier: fuzzy.qualifier,
		event_precision: fuzzy.precision
	};
}
