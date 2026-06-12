<script lang="ts">
	import { onDestroy } from 'svelte';
	import { useI18n } from '$lib/i18n';
	import PinDropMap from '$lib/components/PinDropMap.svelte';

	const t = useI18n().t;
	import { formatCoords, normalizePlaceName, type Place, type PlaceSelection } from '$lib/place';
	import { GEOCODE_ATTRIBUTION, type GeocodeResult } from '$lib/geocode';

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

	// One search box drives both: existing places in the tree are suggested first
	// (live filter), then new places from geocoding (debounced) below them.
	let query = $state('');

	// The suggestion dropdown opens on focus and closes on Escape / focus loss.
	let open = $state(false);
	let comboEl = $state<HTMLDivElement>();
	$effect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') open = false;
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	});

	let matches = $derived.by(() => {
		const q = normalizePlaceName(query);
		return q ? places.filter((p) => normalizePlaceName(p.name).includes(q)) : places;
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

	// --- Geocoding (new places) ---
	let geoResults = $state<GeocodeResult[]>([]);
	let loading = $state(false);
	let failed = $state(false);

	const DEBOUNCE_MS = 350;
	const MIN_CHARS = 3;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let controller: AbortController | undefined;

	async function runGeocode(q: string) {
		controller?.abort();
		controller = new AbortController();
		loading = true;
		failed = false;
		try {
			const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, {
				signal: controller.signal
			});
			if (!res.ok) throw new Error(String(res.status));
			const body = (await res.json()) as { results: GeocodeResult[] };
			geoResults = body.results;
		} catch (e) {
			// An aborted request just means a newer keystroke superseded it.
			if (e instanceof DOMException && e.name === 'AbortError') return;
			failed = true;
			geoResults = [];
		} finally {
			loading = false;
		}
	}

	function onInput() {
		clearTimeout(timer);
		const q = query.trim();
		if (q.length < MIN_CHARS) {
			geoResults = [];
			loading = false;
			failed = false;
			return;
		}
		timer = setTimeout(() => runGeocode(q), DEBOUNCE_MS);
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

	let searching = $derived(query.trim().length >= MIN_CHARS);

	// --- Pin-drop fallback: for places Nominatim can't find (vanished towns,
	// imprecise locations) the user names it and clicks the map for coordinates. ---
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

	onDestroy(() => {
		clearTimeout(timer);
		controller?.abort();
	});
</script>

{#if selection}
	<div
		class="flex items-center justify-between gap-3 rounded-md border border-sage bg-cream/50 px-3 py-2"
	>
		<div class="min-w-0">
			<p class="truncate text-sm font-medium text-ink">{selection.name}</p>
			<p class="text-xs text-ink/55">
				{selection.kind === 'existing' ? t('map.place.inThisTree') : t('map.place.newPlace')} ·
				{formatCoords(selection.lat, selection.lng)}
			</p>
		</div>
		<button
			type="button"
			onclick={() => onchange(null)}
			class="shrink-0 rounded-md border border-sage px-2 py-1 text-xs text-ink/70 hover:bg-paper"
		>
			{t('map.place.change')}
		</button>
	</div>
{:else}
	<div class="space-y-3">
		<div
			class="relative"
			bind:this={comboEl}
			onfocusout={(e) => {
				if (comboEl && !comboEl.contains(e.relatedTarget as Node)) open = false;
			}}
		>
			<input
				type="text"
				role="combobox"
				aria-expanded={open}
				aria-controls="place-results"
				autocomplete="off"
				bind:value={query}
				oninput={onInput}
				onfocus={() => (open = true)}
				placeholder={t('map.place.searchPlaceholder')}
				class="w-full rounded-md border border-sage bg-paper px-3 py-2 text-sm text-ink focus:border-ink/40 focus:outline-none"
			/>

			{#if open}
				<div
					id="place-results"
					class="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-sage bg-paper shadow-lg"
				>
					<!-- Existing places: capped to ~2 rows, scroll for the rest. -->
					{#if matches.length > 0}
						<p class="border-b border-sage/60 bg-cream/40 px-3 py-1 text-[10px] text-ink/45">
							{t('map.place.inThisTree')}
						</p>
						<ul class="max-h-24 overflow-y-auto">
							{#each matches as place (place.id)}
								<li class="border-b border-sage/40 last:border-b-0">
									<button
										type="button"
										onclick={() => pickExisting(place)}
										class="block w-full px-3 py-2 text-left text-sm hover:bg-cream"
									>
										<span class="font-medium text-ink">{place.name}</span>
										<span class="block text-xs text-ink/55"
											>{formatCoords(place.lat, place.lng)}</span
										>
									</button>
								</li>
							{/each}
						</ul>
					{/if}

					<!-- New places from geocoding, shown once the query is long enough. -->
					{#if searching}
						<p class="border-y border-sage/60 bg-cream/40 px-3 py-1 text-[10px] text-ink/45">
							{t('map.place.newPlace')}
						</p>
						{#if loading}
							<p class="px-3 py-2 text-sm text-ink/50">{t('map.place.searching')}</p>
						{:else if failed}
							<p class="px-3 py-2 text-sm text-red-600">{t('map.place.geocodeError')}</p>
						{:else if geoResults.length === 0}
							<p class="px-3 py-2 text-sm text-ink/50">{t('map.place.noMatches')}</p>
						{:else}
							<ul class="max-h-48 overflow-y-auto">
								{#each geoResults as result (result.osmRef ?? result.displayName)}
									<li class="border-b border-sage/40 last:border-b-0">
										<button
											type="button"
											onclick={() => pickGeocoded(result)}
											class="block w-full px-3 py-2 text-left text-sm hover:bg-cream"
										>
											<span class="font-medium text-ink">{result.name}</span>
											<span class="block text-xs text-ink/55">{result.displayName}</span>
										</button>
									</li>
								{/each}
							</ul>
							<p class="border-t border-sage/60 px-3 py-1 text-[10px] text-ink/40">
								{GEOCODE_ATTRIBUTION}
							</p>
						{/if}
					{:else if matches.length === 0}
						<p class="px-3 py-2 text-sm text-ink/50">{t('map.place.typeToSearch')}</p>
					{/if}
				</div>
			{/if}
		</div>

		{#if pinMode}
			<div class="space-y-2 rounded-md border border-sage bg-cream/40 p-3">
				<input
					type="text"
					bind:value={pinName}
					placeholder={t('map.place.nameRequired')}
					autocomplete="off"
					class="w-full rounded-md border border-sage bg-paper px-3 py-2 text-sm text-ink focus:border-ink/40 focus:outline-none"
				/>
				<input
					type="text"
					bind:value={pinHistorical}
					placeholder={t('map.place.historicalOptional')}
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
					<p class="text-xs text-ink/55">
						{t('map.place.pinnedAt', { coords: formatCoords(pinLat, pinLng) })}
					</p>
				{/if}
				<div class="flex gap-2">
					<button
						type="button"
						onclick={usePin}
						disabled={!canUsePin}
						class="rounded-md bg-clay px-3 py-1.5 text-sm font-medium text-ink hover:bg-clay/80 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{t('map.place.useLocation')}
					</button>
					<button
						type="button"
						onclick={resetPin}
						class="rounded-md border border-sage px-3 py-1.5 text-sm text-ink/70 hover:bg-paper"
					>
						{t('common.cancel')}
					</button>
				</div>
			</div>
		{:else}
			<button
				type="button"
				onclick={() => (pinMode = true)}
				class="text-xs font-medium text-ink/60 underline underline-offset-2 hover:text-ink"
			>
				{t('map.place.dropPin')}
			</button>
		{/if}
	</div>
{/if}
