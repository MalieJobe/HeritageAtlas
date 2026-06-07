<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import FamilyGraph from '$lib/components/FamilyGraph.svelte';
	import MapView from '$lib/components/MapView.svelte';
	import Timeline from '$lib/components/Timeline.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Show per-person notes on the tree (tree-only; kept off the map). Off by
	// default and remembered across visits (3.5f). Loaded after mount to avoid an
	// SSR/hydration mismatch.
	let showNotes = $state(false);
	onMount(() => {
		showNotes = localStorage.getItem('ha:showNotes') === '1';
	});
	$effect(() => {
		if (browser) localStorage.setItem('ha:showNotes', showNotes ? '1' : '0');
	});

	// Auto-derived slider span; a sensible default when the tree has no dated facts.
	const fallbackMax = new Date().getFullYear();
	let defaultMin = $derived(data.timeline?.min ?? 1900);
	let defaultMax = $derived(data.timeline?.max ?? fallbackMax);

	// Shared timeline year, seeded at the most recent known year (untrack: the
	// slider drives it from here on).
	let year = $state(untrack(() => data.timeline?.max ?? fallbackMax));

	// Shared selection across both panes.
	let selectedId = $state<string | null>(null);

	// Below lg the panes don't fit side by side: the map fills the width and this
	// toggles to the tree (and back). On lg+ both show and this is ignored.
	let mobileView = $state<'map' | 'tree'>('map');

	let hasPeople = $derived(data.graph.persons.length > 0);
	let addPersonUrl = $derived(resolve('/trees/[treeId]/persons/new', { treeId: data.tree.id }));
</script>

<svelte:head><title>{data.tree.name} · HeritageAtlas</title></svelte:head>

{#if !hasPeople}
	<div class="grid flex-1 place-items-center p-8 text-center">
		<div class="flex max-w-sm flex-col items-center gap-4">
			<p class="text-ink/55">
				No people in {data.tree.name} yet. Add someone to start building the tree and map.
			</p>
			{#if data.canEdit}
				<a
					href={addPersonUrl}
					class="rounded-md bg-clay px-4 py-2 text-sm font-medium text-ink hover:bg-clay/80"
				>
					＋ Add person
				</a>
			{/if}
		</div>
	</div>
{:else}
	<!-- lg+: fixed 50/50 split (tree | map). Below lg: one pane fills the width and
		 the top-left button toggles between map and tree. -->
	<div class="relative flex min-h-0 flex-1">
		<div
			class="min-w-0 flex-1 lg:block lg:border-r lg:border-sage {mobileView === 'tree'
				? 'block'
				: 'hidden'}"
		>
			<FamilyGraph
				graph={data.graph}
				treeId={data.tree.id}
				{selectedId}
				{year}
				{showNotes}
				fill
				onselect={(id) => (selectedId = id)}
			/>
		</div>
		<div class="min-w-0 flex-1 lg:block {mobileView === 'map' ? 'block' : 'hidden'}">
			<MapView
				persons={data.map.persons}
				{year}
				{selectedId}
				height={null}
				onselect={(id) => (selectedId = id)}
			/>
		</div>

		<!-- Top-left controls: add a person + notes toggle. -->
		<div class="absolute top-2 left-2 z-30 flex items-center gap-2">
			{#if data.canEdit}
				<a
					href={addPersonUrl}
					class="flex items-center gap-1.5 rounded-md border border-sage bg-white/90 px-3 py-1.5 text-sm font-medium text-ink shadow-sm backdrop-blur hover:bg-cream"
				>
					＋ Add person
				</a>
			{/if}
			<!-- Notes toggle (tree-only) — hidden on mobile when the map is showing. -->
			<button
				type="button"
				onclick={() => (showNotes = !showNotes)}
				aria-pressed={showNotes}
				class="items-center gap-1.5 rounded-md border border-sage px-3 py-1.5 text-sm font-medium shadow-sm backdrop-blur hover:bg-cream {mobileView ===
				'tree'
					? 'flex'
					: 'hidden'} lg:flex {showNotes ? 'bg-clay text-ink' : 'bg-white/90 text-ink/80'}"
			>
				{showNotes ? 'Notes: on' : 'Notes: off'}
			</button>
		</div>

		<!-- Mobile-only view toggle (sits below the controls row). -->
		<button
			type="button"
			onclick={() => (mobileView = mobileView === 'map' ? 'tree' : 'map')}
			class="absolute top-13 left-2 z-30 flex items-center gap-1.5 rounded-md border border-sage bg-white/90 px-3 py-1.5 text-sm font-medium text-ink shadow-sm backdrop-blur hover:bg-cream lg:hidden"
		>
			{#if mobileView === 'map'}
				<svg
					width="15"
					height="15"
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<rect x="6" y="1.5" width="4" height="3" rx="1" />
					<rect x="1.5" y="11.5" width="4" height="3" rx="1" />
					<rect x="10.5" y="11.5" width="4" height="3" rx="1" />
					<path d="M8 4.5V8M3.5 11.5v-1.5a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v1.5" />
				</svg>
				Tree
			{:else}
				<svg
					width="15"
					height="15"
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M8 14.5s5-4.5 5-8a5 5 0 0 0-10 0c0 3.5 5 8 5 8z" />
					<circle cx="8" cy="6.5" r="1.8" />
				</svg>
				Map
			{/if}
		</button>
	</div>

	<Timeline bind:year {defaultMin} {defaultMax} />
{/if}
