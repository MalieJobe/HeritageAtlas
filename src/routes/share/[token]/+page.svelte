<script lang="ts">
	import { enhance } from '$app/forms';
	import FamilyGraph from '$lib/components/FamilyGraph.svelte';
	import MapView from '$lib/components/MapView.svelte';
	import Timeline from '$lib/components/Timeline.svelte';
	import { useI18n } from '$lib/i18n';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const t = useI18n().t;

	const fallbackMax = new Date().getFullYear();
	let year = $state<number | null>(null);
	let selectedId = $state<string | null>(null);

	// Seed the timeline once the tree is unlocked (load may arrive locked first).
	$effect(() => {
		if (data.unlocked && data.view && year === null) {
			year = data.view.timeline?.max ?? fallbackMax;
		}
	});
</script>

<svelte:head><title>{t('share.title', { name: data.name })}</title></svelte:head>

{#if !data.unlocked}
	<!-- Password gate -->
	<div class="mx-auto mt-12 flex max-w-sm flex-col gap-4">
		<div class="text-center">
			<h1 class="text-xl font-semibold text-ink">{data.name}</h1>
			<p class="mt-1 text-sm text-ink/60">{t('share.passwordProtected')}</p>
		</div>
		<form method="POST" action="?/unlock" use:enhance class="flex flex-col gap-3">
			<input
				name="password"
				type="password"
				autocomplete="current-password"
				placeholder={t('share.passwordPlaceholder')}
				required
				class="rounded-md border border-sage bg-white px-3 py-2 text-sm text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none"
			/>
			{#if form?.error}
				<p class="text-sm text-red-600">{form.error}</p>
			{/if}
			<button
				type="submit"
				class="rounded-md bg-clay px-4 py-2 text-sm font-medium text-ink hover:bg-clay/80"
			>
				{t('share.viewTree')}
			</button>
		</form>
	</div>
{:else if data.view && data.tree}
	<div class="flex flex-col gap-3">
		<div class="flex flex-col gap-1 text-center">
			<h1 class="text-2xl font-semibold text-ink">{data.name}</h1>
			<p class="text-sm text-ink/55">{t('share.readOnlyNotice')}</p>
		</div>
		<div class="overflow-hidden rounded-xl border border-sage bg-paper shadow-sm">
			<div class="flex h-[70vh] min-h-96">
				<div class="min-w-0 flex-1 border-r border-sage">
					<FamilyGraph
						graph={data.view.graph}
						treeId={data.tree.id}
						{selectedId}
						year={year ?? fallbackMax}
						fill
						readonly
						onselect={(id) => (selectedId = id)}
					/>
				</div>
				<div class="min-w-0 flex-1">
					<MapView
						persons={data.view.map.persons}
						year={year ?? fallbackMax}
						{selectedId}
						height={null}
						onselect={(id) => (selectedId = id)}
					/>
				</div>
			</div>
			{#if year !== null}
				<Timeline
					bind:year
					defaultMin={data.view.timeline?.min ?? 1900}
					defaultMax={data.view.timeline?.max ?? fallbackMax}
				/>
			{/if}
		</div>
	</div>
{/if}
