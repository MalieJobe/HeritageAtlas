<script lang="ts">
	import { onDestroy } from 'svelte';
	import { useI18n } from '$lib/i18n';
	import { GEOCODE_ATTRIBUTION, type GeocodeResult } from '$lib/geocode';

	const t = useI18n().t;

	let {
		onselect,
		placeholder,
		id
	}: {
		onselect: (result: GeocodeResult) => void;
		placeholder?: string;
		id?: string;
	} = $props();

	let effectivePlaceholder = $derived(placeholder ?? t('map.place.searchPlaceholder'));

	let query = $state('');
	let results = $state<GeocodeResult[]>([]);
	let loading = $state(false);
	let failed = $state(false);
	let open = $state(false);

	const DEBOUNCE_MS = 350;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let controller: AbortController | undefined;

	async function run(q: string) {
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
			results = body.results;
			open = true;
		} catch (e) {
			// An aborted request just means a newer keystroke superseded it.
			if (e instanceof DOMException && e.name === 'AbortError') return;
			failed = true;
			results = [];
			open = true;
		} finally {
			loading = false;
		}
	}

	function onInput() {
		clearTimeout(timer);
		const q = query.trim();
		if (q.length < 3) {
			results = [];
			open = false;
			loading = false;
			return;
		}
		timer = setTimeout(() => run(q), DEBOUNCE_MS);
	}

	function choose(result: GeocodeResult) {
		onselect(result);
		query = '';
		results = [];
		open = false;
	}

	onDestroy(() => {
		clearTimeout(timer);
		controller?.abort();
	});
</script>

<div class="relative">
	<input
		{id}
		type="text"
		role="combobox"
		aria-expanded={open}
		aria-controls="geocode-results"
		autocomplete="off"
		bind:value={query}
		oninput={onInput}
		onfocus={() => {
			if (results.length) open = true;
		}}
		placeholder={effectivePlaceholder}
		class="w-full rounded-md border border-sage bg-paper px-3 py-2 text-sm text-ink focus:border-ink/40 focus:outline-none"
	/>

	{#if open}
		<div
			id="geocode-results"
			class="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-sage bg-white shadow-lg"
		>
			{#if loading}
				<p class="px-3 py-2 text-sm text-ink/50">{t('map.place.searching')}</p>
			{:else if failed}
				<p class="px-3 py-2 text-sm text-red-600">{t('map.place.geocodeError')}</p>
			{:else if results.length === 0}
				<p class="px-3 py-2 text-sm text-ink/50">{t('map.place.noMatches')}</p>
			{:else}
				<ul class="max-h-64 overflow-y-auto">
					{#each results as result (result.osmRef ?? result.displayName)}
						<li>
							<button
								type="button"
								onclick={() => choose(result)}
								class="block w-full px-3 py-2 text-left text-sm hover:bg-cream"
							>
								<span class="font-medium text-ink">{result.name}</span>
								<span class="block text-xs text-ink/55">{result.displayName}</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
			<p class="border-t border-sage/60 px-3 py-1 text-[10px] text-ink/40">
				{GEOCODE_ATTRIBUTION}
			</p>
		</div>
	{/if}
</div>
