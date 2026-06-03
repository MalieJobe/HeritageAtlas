<script lang="ts">
	import GeocodeSearch from '$lib/components/GeocodeSearch.svelte';
	import PinDropMap from '$lib/components/PinDropMap.svelte';
	import { formatCoords, normalizePlaceName, type Place, type PlaceSelection } from '$lib/place';
	import type { GeocodeResult } from '$lib/geocode';

	let {
		places = [],
		selection = null,
		onchange
	}: {
		/** Existing places in the tree, offered for reuse. */
		places?: Place[];
		selection?: PlaceSelection | null;
		onchange: (selection: PlaceSelection | null) => void;
	} = $props();

	let filter = $state('');

	// Existing places matching the filter, most-recently-used names first-ish
	// (we just cap the list so a long history doesn't flood the picker).
	let matches = $derived.by(() => {
		const q = normalizePlaceName(filter);
		const list = q ? places.filter((p) => normalizePlaceName(p.name).includes(q)) : places;
		return list.slice(0, 8);
	});

	function pickExisting(place: Place) {
		onchange({
			kind: 'existing',
			id: place.id,
			name: place.name,
			lat: place.lat,
			lng: place.lng
		});
	}

	function pickGeocoded(result: GeocodeResult) {
		onchange({
			kind: 'new',
			name: result.name,
			lat: result.lat,
			lng: result.lng,
			source: 'geocoded'
		});
	}

	// Pin-drop fallback: for places Nominatim can't find (vanished towns,
	// imprecise locations) the user names it and clicks the map for coordinates.
	let pinMode = $state(false);
	let pinLat = $state<number | null>(null);
	let pinLng = $state<number | null>(null);
	let pinName = $state('');
	let pinHistorical = $state('');

	let canUsePin = $derived(pinLat != null && pinLng != null && pinName.trim().length > 0);

	function resetPin() {
		pinMode = false;
		pinLat = null;
		pinLng = null;
		pinName = '';
		pinHistorical = '';
	}

	function usePin() {
		if (!canUsePin) return;
		onchange({
			kind: 'new',
			name: pinName.trim(),
			historicalName: pinHistorical.trim() || null,
			lat: pinLat!,
			lng: pinLng!,
			source: 'manual'
		});
		resetPin();
	}
</script>

{#if selection}
	<div
		class="flex items-center justify-between gap-3 rounded-md border border-sage bg-cream/50 px-3 py-2"
	>
		<div class="min-w-0">
			<p class="truncate text-sm font-medium text-ink">{selection.name}</p>
			<p class="text-xs text-ink/55">
				{selection.kind === 'existing' ? 'In this tree' : 'New place'} ·
				{formatCoords(selection.lat, selection.lng)}
			</p>
		</div>
		<button
			type="button"
			onclick={() => onchange(null)}
			class="shrink-0 rounded-md border border-sage px-2 py-1 text-xs text-ink/70 hover:bg-paper"
		>
			Change
		</button>
	</div>
{:else}
	<div class="space-y-3">
		{#if places.length > 0}
			<div>
				<label for="place-filter" class="mb-1 block text-xs font-medium text-ink/60">
					Places in this tree
				</label>
				<input
					id="place-filter"
					type="text"
					bind:value={filter}
					placeholder="Filter existing places…"
					autocomplete="off"
					class="w-full rounded-md border border-sage bg-paper px-3 py-2 text-sm text-ink focus:border-ink/40 focus:outline-none"
				/>
				{#if matches.length > 0}
					<ul class="mt-1 overflow-hidden rounded-md border border-sage">
						{#each matches as place (place.id)}
							<li class="border-b border-sage/50 last:border-b-0">
								<button
									type="button"
									onclick={() => pickExisting(place)}
									class="block w-full px-3 py-2 text-left text-sm hover:bg-cream"
								>
									<span class="font-medium text-ink">{place.name}</span>
									<span class="block text-xs text-ink/55">{formatCoords(place.lat, place.lng)}</span
									>
								</button>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="mt-1 text-xs text-ink/45">No existing place matches.</p>
				{/if}
			</div>
		{/if}

		<div>
			<span class="mb-1 block text-xs font-medium text-ink/60">Search for a new place</span>
			<GeocodeSearch onselect={pickGeocoded} />
		</div>

		{#if pinMode}
			<div class="space-y-2 rounded-md border border-sage bg-cream/40 p-3">
				<input
					type="text"
					bind:value={pinName}
					placeholder="Place name (required)"
					autocomplete="off"
					class="w-full rounded-md border border-sage bg-paper px-3 py-2 text-sm text-ink focus:border-ink/40 focus:outline-none"
				/>
				<input
					type="text"
					bind:value={pinHistorical}
					placeholder="Historical name (optional)"
					autocomplete="off"
					class="w-full rounded-md border border-sage bg-paper px-3 py-2 text-sm text-ink focus:border-ink/40 focus:outline-none"
				/>
				<PinDropMap
					lat={pinLat}
					lng={pinLng}
					onpick={(c) => {
						pinLat = c.lat;
						pinLng = c.lng;
					}}
				/>
				{#if pinLat != null && pinLng != null}
					<p class="text-xs text-ink/55">Pinned at {formatCoords(pinLat, pinLng)}</p>
				{/if}
				<div class="flex gap-2">
					<button
						type="button"
						onclick={usePin}
						disabled={!canUsePin}
						class="rounded-md bg-clay px-3 py-1.5 text-sm font-medium text-ink hover:bg-clay/80 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Use this location
					</button>
					<button
						type="button"
						onclick={resetPin}
						class="rounded-md border border-sage px-3 py-1.5 text-sm text-ink/70 hover:bg-paper"
					>
						Cancel
					</button>
				</div>
			</div>
		{:else}
			<button
				type="button"
				onclick={() => (pinMode = true)}
				class="text-xs font-medium text-ink/60 underline underline-offset-2 hover:text-ink"
			>
				Can’t find it? Drop a pin on the map
			</button>
		{/if}
	</div>
{/if}
