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
		defaultType = 'residence'
	}: {
		places?: Place[];
		event?: EventRowInitial;
		defaultPlace?: PlaceSelection | null;
		defaultType?: EventType;
	} = $props();

	const init = untrack(() => event);
	const seedPlace = untrack(() => defaultPlace);
	const seedType = untrack(() => defaultType);
	let type = $state(init?.type ?? seedType);
	let placeSelection = $state<PlaceSelection | null>(init?.place ?? seedPlace);

	// Renders exactly three grid cells (type · date · place); the host form adds the
	// action cell. The host grid is `display:contents`-friendly so these align to
	// the table columns.
	const cell = 'border-b border-sage/40 py-2 pr-3 align-top';
</script>

<div class={cell}>
	<select
		name="type"
		bind:value={type}
		class="rounded-md border border-sage bg-white px-2 py-1.5 text-sm text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none"
	>
		{#each EVENT_TYPES as meta (meta.type)}
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
