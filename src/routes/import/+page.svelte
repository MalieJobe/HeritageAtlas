<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { buildImportPlan, type ImportPlan } from '$lib/gedcom/import';
	import { normalizePlaceName } from '$lib/place';
	import { toasts } from '$lib/toast.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let fileName = $state('');
	let gedcomText = $state('');
	let plan = $state<ImportPlan | null>(null);
	let parseError = $state<string | null>(null);
	let treeName = $state('');

	// Client-side geocoding (optional). Coordinates are keyed by normalized place
	// name and posted alongside the import; unresolved places are queued (created
	// without coordinates) for locating later.
	let coords = $state<Record<string, { lat: number; lng: number }>>({});
	let geocoding = $state(false);
	let geocodeDone = $state(0);
	let cancelGeocode = false;

	let locatedCount = $derived(Object.keys(coords).length);
	let submitting = $state(false);

	async function onFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		fileName = file.name;
		parseError = null;
		plan = null;
		coords = {};
		geocodeDone = 0;
		try {
			gedcomText = await file.text();
			const p = buildImportPlan(gedcomText);
			if (p.persons.length === 0) {
				parseError = 'No individuals were found in this file.';
				return;
			}
			plan = p;
			treeName =
				p.treeName?.replace(/\.ged$/i, '') || file.name.replace(/\.ged$/i, '') || 'Imported tree';
		} catch {
			parseError = 'This file could not be parsed as GEDCOM.';
		}
	}

	const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

	async function locatePlaces() {
		if (!plan || geocoding) return;
		geocoding = true;
		cancelGeocode = false;
		geocodeDone = 0;
		for (const name of plan.placeNames) {
			if (cancelGeocode) break;
			const key = normalizePlaceName(name);
			if (!coords[key]) {
				try {
					const query = name.replace(/,/g, ', ');
					const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
					if (res.ok) {
						const { results } = (await res.json()) as {
							results: { lat: number; lng: number }[];
						};
						if (results?.[0]) coords[key] = { lat: results[0].lat, lng: results[0].lng };
					}
				} catch {
					// Leave this place queued; keep going.
				}
				// Nominatim asks for ~1 request/second.
				await sleep(1100);
			}
			geocodeDone++;
		}
		geocoding = false;
		if (!cancelGeocode)
			toasts.success(`Located ${locatedCount} of ${plan.placeNames.length} places.`);
	}

	function stopGeocoding() {
		cancelGeocode = true;
	}

	// Rough wall-clock estimate for geocoding the remaining places (~1.1s each).
	let geocodeMinutes = $derived(
		plan ? Math.max(1, Math.round((plan.placeNames.length * 1.1) / 60)) : 0
	);

	const enhanceSubmit = () => {
		submitting = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			submitting = false;
			if (form?.error) toasts.error(form.error);
		};
	};
</script>

<svelte:head><title>Import GEDCOM · HeritageAtlas</title></svelte:head>

<div class="mx-auto flex max-w-2xl flex-col gap-6">
	<div>
		<a href={resolve('/dashboard')} class="text-sm text-ink/55 hover:text-ink">← Dashboard</a>
		<h1 class="mt-2 text-2xl font-semibold text-ink">Import a GEDCOM file</h1>
		<p class="mt-1 text-sm text-ink/60">
			Bring in a family tree exported from another genealogy program. It’s imported into a brand-new
			tree — your existing trees are untouched.
		</p>
	</div>

	<label
		class="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-sage bg-cream/40 px-4 py-8 text-center hover:bg-cream"
	>
		<span class="text-2xl">⤓</span>
		<span class="text-sm font-medium text-ink">
			{fileName || 'Choose a .ged file'}
		</span>
		<span class="text-xs text-ink/50">GEDCOM 5.5.1 or 7.0</span>
		<input type="file" accept=".ged,.gedcom,text/plain" class="hidden" onchange={onFile} />
	</label>

	{#if parseError}
		<p class="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
			{parseError}
		</p>
	{/if}

	{#if form?.error}
		<p class="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
			{form.error}
		</p>
	{/if}

	{#if plan}
		<div class="rounded-lg border border-sage bg-white p-4">
			<h2 class="text-sm font-semibold text-ink">Preview</h2>
			<dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
				{#each [['People', plan.counts.persons], ['Partnerships', plan.counts.partnerships], ['Parent–child links', plan.counts.parentChild], ['Events', plan.counts.events], ['Places', plan.counts.places]] as [label, n] (label)}
					<div class="flex flex-col">
						<dt class="text-xs text-ink/50">{label}</dt>
						<dd class="text-lg font-semibold text-ink">{n}</dd>
					</div>
				{/each}
			</dl>

			{#if plan.warnings.length > 0}
				<ul class="mt-3 space-y-1 border-t border-sage/60 pt-3 text-xs text-ink/60">
					{#each plan.warnings as w (w)}
						<li>• {w}</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Optional geocoding -->
		{#if plan.placeNames.length > 0}
			<div class="rounded-lg border border-sage bg-white p-4">
				<h2 class="text-sm font-semibold text-ink">Locate places (optional)</h2>
				<p class="mt-1 text-xs text-ink/60">
					Look up coordinates for the {plan.placeNames.length} place names so imported people appear on
					the map. This respects OpenStreetMap’s rate limit (~1/second), so it takes about {geocodeMinutes}
					min. You can skip it and import now — unlocated places are queued and people simply won’t be
					on the map until you locate them.
				</p>
				<div class="mt-3 flex items-center gap-3">
					{#if geocoding}
						<button
							type="button"
							onclick={stopGeocoding}
							class="rounded-md border border-sage px-3 py-1.5 text-sm text-ink hover:bg-cream"
						>
							Stop
						</button>
						<span class="text-sm text-ink/60">
							Locating… {geocodeDone}/{plan.placeNames.length} ({locatedCount} found)
						</span>
					{:else}
						<button
							type="button"
							onclick={locatePlaces}
							class="rounded-md border border-clay bg-clay/20 px-3 py-1.5 text-sm font-medium text-ink hover:bg-clay/30"
						>
							{locatedCount > 0 ? 'Resume locating' : 'Locate places'}
						</button>
						{#if locatedCount > 0}
							<span class="text-sm text-ink/60">{locatedCount} located</span>
						{/if}
					{/if}
				</div>
			</div>
		{/if}

		<!-- Commit -->
		<form method="POST" action="?/commit" use:enhance={enhanceSubmit} class="flex flex-col gap-3">
			<label class="flex flex-col gap-1 text-sm font-medium text-ink/70">
				Tree name
				<input
					name="name"
					bind:value={treeName}
					required
					maxlength="200"
					class="rounded-md border border-sage bg-white px-3 py-2 text-sm text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none"
				/>
			</label>
			<input type="hidden" name="gedcom" value={gedcomText} />
			<input type="hidden" name="coords" value={JSON.stringify(coords)} />
			<button
				type="submit"
				disabled={submitting || geocoding}
				class="self-start rounded-md bg-clay px-4 py-2 text-sm font-medium text-ink hover:bg-clay/80 disabled:cursor-not-allowed disabled:opacity-60"
			>
				{submitting ? 'Importing…' : `Import ${plan.counts.persons} people`}
			</button>
			{#if geocoding}
				<p class="text-xs text-ink/50">Finish or stop locating places before importing.</p>
			{/if}
		</form>
	{/if}
</div>
