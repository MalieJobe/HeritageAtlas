<script lang="ts" module>
	import type { FuzzyDateParts } from '$lib/fuzzyDate';
	import type { EventType } from '$lib/events';
	import type { PlaceSelection } from '$lib/place';

	/** Initial values for editing an existing event (omit for a blank add row). */
	export interface EventRowInitial {
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
		defaultType = 'residence',
		hideTypes = []
	}: {
		places?: Place[];
		event?: EventRowInitial;
		defaultPlace?: PlaceSelection | null;
		defaultType?: EventType;
		/** Types to omit from the picker (e.g. birth/death already used), unless selected. */
		hideTypes?: EventType[];
	} = $props();

	const init = untrack(() => event);
	const seedPlace = untrack(() => defaultPlace);
	const seedType = untrack(() => defaultType);
	let type = $state(init?.type ?? seedType);
	let placeSelection = $state<PlaceSelection | null>(init?.place ?? seedPlace);

	let typeOptions = $derived(
		EVENT_TYPES.filter((m) => m.type === type || !hideTypes.includes(m.type))
	);

	// Renders exactly three grid cells (type · date · place); the host form adds the
	// action cell. Cells stretch to the row height (grid default) so every row's
	// bottom border lines up; content sits at the top.
	const cell = 'flex flex-col border-b border-sage/40 py-2 pr-3';
</script>

<div class={cell}>
	<select
		name="type"
		bind:value={type}
		class="rounded-md border border-sage bg-white px-2 py-1.5 text-sm text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none"
	>
		{#each typeOptions as meta (meta.type)}
			<option value={meta.type}>{meta.icon} {meta.label}</option>
		{/each}
	</select>
</div>

<div class={cell}>
	<FuzzyDateInput value={event?.dateParts ?? EMPTY_FUZZY_DATE_PARTS} />
</div>

<div class={cell}>
	<PlacePicker {places} selection={placeSelection} onchange={(s) => (placeSelection = s)} />
	<input
		type="hidden"
		name="place_selection"
		value={placeSelection ? JSON.stringify(placeSelection) : ''}
	/>
</div>
