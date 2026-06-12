<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { buildImportPlan, type ImportPlan } from '$lib/gedcom/import';
	import { useI18n } from '$lib/i18n';
	import { normalizePlaceName } from '$lib/place';
	import { toasts } from '$lib/toast.svelte';
	import type { ActionData } from './$types';

	const t = useI18n().t;

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

	let fileInput = $state<HTMLInputElement>();
	let dragOver = $state(false);

	async function handleFile(file: File) {
		fileName = file.name;
		parseError = null;
		plan = null;
		coords = {};
		geocodeDone = 0;
		try {
			gedcomText = await file.text();
			const p = buildImportPlan(gedcomText);
			if (p.persons.length === 0) {
				parseError = t('import.noIndividuals');
				return;
			}
			plan = p;
			treeName =
				p.treeName?.replace(/\.ged$/i, '') ||
				file.name.replace(/\.ged$/i, '') ||
				t('import.importedTree');
		} catch {
			parseError = t('import.parseError');
		}
	}

	function onFileInput(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) handleFile(file);
		// Reset so picking the same file again still fires `change`.
		input.value = '';
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
		const file = event.dataTransfer?.files?.[0];
		if (file) handleFile(file);
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
			toasts.success(
				t('import.locatedToast', { located: locatedCount, total: plan.placeNames.length })
			);
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

<svelte:head><title>{t('import.title')}</title></svelte:head>

<div class="mx-auto flex max-w-2xl flex-col gap-6">
	<div>
		<a href={resolve('/dashboard')} class="text-sm text-ink/55 hover:text-ink">{t('import.back')}</a
		>
		<h1 class="mt-2 text-2xl font-semibold text-ink">{t('import.heading')}</h1>
		<p class="mt-1 text-sm text-ink/60">
			{t('import.subtitle')}
		</p>
	</div>

	<button
		type="button"
		onclick={() => fileInput?.click()}
		ondragenter={(e) => {
			e.preventDefault();
			dragOver = true;
		}}
		ondragover={(e) => {
			e.preventDefault();
			dragOver = true;
		}}
		ondragleave={() => (dragOver = false)}
		ondrop={onDrop}
		class="flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors {dragOver
			? 'border-clay bg-cream'
			: 'border-sage bg-cream/40 hover:bg-cream'}"
	>
		<span class="text-2xl">⤓</span>
		<span class="text-sm font-medium text-ink">
			{fileName || t('import.chooseFile')}
		</span>
		<span class="text-xs text-ink/50">{t('import.dropHint')}</span>
	</button>
	<input
		bind:this={fileInput}
		type="file"
		accept=".ged,.gedcom,text/plain"
		class="hidden"
		onchange={onFileInput}
	/>

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
			<h2 class="text-sm font-semibold text-ink">{t('import.previewHeading')}</h2>
			<dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
				{#each [[t('import.statPeople'), plan.counts.persons], [t('import.statPartnerships'), plan.counts.partnerships], [t('import.statParentChild'), plan.counts.parentChild], [t('import.statEvents'), plan.counts.events], [t('import.statPlaces'), plan.counts.places]] as [label, n] (label)}
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
				<h2 class="text-sm font-semibold text-ink">{t('import.locatePlacesHeading')}</h2>
				<p class="mt-1 text-xs text-ink/60">
					{t('import.locatePlacesDesc', { count: plan.placeNames.length, minutes: geocodeMinutes })}
				</p>
				<div class="mt-3 flex items-center gap-3">
					{#if geocoding}
						<button
							type="button"
							onclick={stopGeocoding}
							class="rounded-md border border-sage px-3 py-1.5 text-sm text-ink hover:bg-cream"
						>
							{t('import.stop')}
						</button>
						<span class="text-sm text-ink/60">
							{t('import.locating', {
								done: geocodeDone,
								total: plan.placeNames.length,
								located: locatedCount
							})}
						</span>
					{:else}
						<button
							type="button"
							onclick={locatePlaces}
							class="rounded-md border border-clay bg-clay/20 px-3 py-1.5 text-sm font-medium text-ink hover:bg-clay/30"
						>
							{locatedCount > 0 ? t('import.resumeLocating') : t('import.locatePlaces')}
						</button>
						{#if locatedCount > 0}
							<span class="text-sm text-ink/60"
								>{t('import.locatedCount', { count: locatedCount })}</span
							>
						{/if}
					{/if}
				</div>
			</div>
		{/if}

		<!-- Commit -->
		<form method="POST" action="?/commit" use:enhance={enhanceSubmit} class="flex flex-col gap-3">
			<label class="flex flex-col gap-1 text-sm font-medium text-ink/70">
				{t('import.treeName')}
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
				{submitting ? t('import.importing') : t('import.importN', { count: plan.counts.persons })}
			</button>
			{#if geocoding}
				<p class="text-xs text-ink/50">{t('import.geocodingWarning')}</p>
			{/if}
		</form>
	{/if}
</div>
