<script lang="ts">
	import { untrack } from 'svelte';
	import FamilyGraph from '$lib/components/FamilyGraph.svelte';
	import MapView from '$lib/components/MapView.svelte';
	import Timeline from '$lib/components/Timeline.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Auto-derived slider span; a sensible default when the tree has no dated facts.
	const fallbackMax = new Date().getFullYear();
	let defaultMin = $derived(data.timeline?.min ?? 1900);
	let defaultMax = $derived(data.timeline?.max ?? fallbackMax);

	// Shared timeline year, seeded at the most recent known year (untrack: the
	// slider drives it from here on).
	let year = $state(untrack(() => data.timeline?.max ?? fallbackMax));

	// Shared selection across both panes.
	let selectedId = $state<string | null>(null);

	let hasPeople = $derived(data.graph.persons.length > 0);
</script>

<svelte:head><title>{data.tree.name} · HeritageAtlas</title></svelte:head>

{#if !hasPeople}
	<div class="grid flex-1 place-items-center p-8 text-center">
		<p class="max-w-sm text-ink/55">
			No people in {data.tree.name} yet. Add someone to start building the tree and map.
		</p>
	</div>
{:else}
	<!-- Fixed 50/50 split: tree on the left, map on the right. -->
	<div class="flex min-h-0 flex-1">
		<div class="min-w-0 flex-1 border-r border-sage">
			<FamilyGraph
				graph={data.graph}
				treeId={data.tree.id}
				{selectedId}
				{year}
				fill
				onselect={(id) => (selectedId = id)}
			/>
		</div>
		<div class="min-w-0 flex-1">
			<MapView
				persons={data.map.persons}
				{year}
				{selectedId}
				height={null}
				onselect={(id) => (selectedId = id)}
			/>
		</div>
	</div>

	<Timeline bind:year {defaultMin} {defaultMax} />
{/if}
