<script lang="ts" module>
	import type { FuzzyDateParts } from '$lib/fuzzyDate';
	import type { EventType } from '$lib/events';
	import type { PlaceSelection } from '$lib/place';

	/** Initial values for editing an existing event (omit for a blank add form). */
	export interface EventFormInitial {
		type: EventType;
		label: string;
		note: string;
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
		event
	}: {
		places?: Place[];
		event?: EventFormInitial;
	} = $props();

	// Seeded once from the edit prop (it doesn't change after mount).
	const init = untrack(() => event);
	let type = $state(init?.type ?? 'birth');
	let placeSelection = $state<PlaceSelection | null>(init?.place ?? null);

	const inputClass =
		'rounded-md border border-sage bg-white px-3 py-2 text-sm text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none';
</script>

<div class="flex flex-col gap-5">
	<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
		Event type
		<select name="type" bind:value={type} class={inputClass}>
			{#each EVENT_TYPES as meta (meta.type)}
				<option value={meta.type}>{meta.icon} {meta.label}</option>
			{/each}
		</select>
	</label>

	{#if type === 'custom'}
		<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
			Label
			<input
				name="label"
				type="text"
				placeholder="e.g. Emigrated"
				value={event?.label ?? ''}
				class={inputClass}
			/>
		</label>
	{/if}

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

	<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
		Note
		<textarea name="note" rows="3" class={inputClass}>{event?.note ?? ''}</textarea>
	</label>
</div>
