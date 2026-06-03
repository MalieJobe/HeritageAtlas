<script lang="ts" module>
	import type { FuzzyDateParts } from '$lib/fuzzyDate';
	import type { EventType } from '$lib/events';
	import type { PlaceSelection } from '$lib/place';

	/** Initial values for editing an existing event (omit for a blank add form). */
	export interface EventFormInitial {
		type: EventType;
		dateParts: FuzzyDateParts;
		place: PlaceSelection | null;
	}
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import FuzzyDateInput from '$lib/components/FuzzyDateInput.svelte';
	import PlacePicker from '$lib/components/PlacePicker.svelte';
	import { EVENT_TYPES } from '$lib/events';
	import { EMPTY_FUZZY_DATE_PARTS } from '$lib/fuzzyDate';
	import type { Place } from '$lib/place';

	let {
		places = [],
		event,
		defaultPlace = null,
		defaultType = 'residence'
	}: {
		places?: Place[];
		event?: EventFormInitial;
		/** Pre-selected place for a blank add form (e.g. inherited from a parent). Ignored when editing. */
		defaultPlace?: PlaceSelection | null;
		/** Type pre-selected on a blank add form. */
		defaultType?: EventType;
	} = $props();

	// Seeded once from the edit prop (it doesn't change after mount). A blank add
	// form falls back to defaultPlace so a child's birthplace can pre-fill.
	const init = untrack(() => event);
	const seedPlace = untrack(() => defaultPlace);
	const seedType = untrack(() => defaultType);
	let type = $state(init?.type ?? seedType);
	let placeSelection = $state<PlaceSelection | null>(init?.place ?? seedPlace);

	const inputClass =
		'rounded-md border border-sage bg-white px-3 py-2 text-sm text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none';
</script>

<div class="flex flex-col gap-4">
	<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
		Type
		<select name="type" bind:value={type} class={inputClass}>
			{#each EVENT_TYPES as meta (meta.type)}
				<option value={meta.type}>{meta.icon} {meta.label}</option>
			{/each}
		</select>
	</label>

	<div class="flex flex-col gap-1 text-sm font-medium text-ink/80">
		Date
		<FuzzyDateInput value={event?.dateParts ?? EMPTY_FUZZY_DATE_PARTS} />
	</div>

	<div class="flex flex-col gap-1 text-sm font-medium text-ink/80">
		Place
		<PlacePicker {places} selection={placeSelection} onchange={(s) => (placeSelection = s)} />
		<input
			type="hidden"
			name="place_selection"
			value={placeSelection ? JSON.stringify(placeSelection) : ''}
		/>
	</div>
</div>
