<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import FamilyGraph from '$lib/components/FamilyGraph.svelte';
	import MapView from '$lib/components/MapView.svelte';
	import PersonAvatar from '$lib/components/PersonAvatar.svelte';
	import SplitPane from '$lib/components/SplitPane.svelte';
	import Timeline from '$lib/components/Timeline.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Auto-derived slider span (task 2.15); a sensible default when the tree has no
	// dated facts yet.
	const fallbackMax = new Date().getFullYear();
	let defaultMin = $derived(data.timeline?.min ?? 1900);
	let defaultMax = $derived(data.timeline?.max ?? fallbackMax);

	// Shared timeline year, seeded at the most recent known year (untrack: the
	// slider drives it from here on).
	let year = $state(untrack(() => data.timeline?.max ?? fallbackMax));

	// Shared selection across both panes (task 2.14).
	let selectedId = $state<string | null>(null);
	let selectedPerson = $derived(
		selectedId ? (data.graph.persons.find((p) => p.id === selectedId) ?? null) : null
	);

	let hasPeople = $derived(data.graph.persons.length > 0);
</script>

<svelte:head><title>Explore · {data.tree.name} · HeritageAtlas</title></svelte:head>

<div class="flex flex-col gap-4">
	<div class="flex items-start justify-between gap-4">
		<div class="flex flex-col gap-1">
			<a
				href={resolve('/trees/[treeId]', { treeId: data.tree.id })}
				class="text-sm text-ink/60 hover:text-ink"
			>
				← {data.tree.name}
			</a>
			<h1 class="text-2xl font-semibold text-ink">Explore</h1>
		</div>
		<div class="flex items-center gap-2">
			<a
				href={resolve('/trees/[treeId]', { treeId: data.tree.id })}
				class="rounded-md border border-sage px-3 py-1.5 text-sm font-medium text-ink/80 hover:bg-cream"
			>
				Tree
			</a>
			<a
				href={resolve('/trees/[treeId]/map', { treeId: data.tree.id })}
				class="rounded-md border border-sage px-3 py-1.5 text-sm font-medium text-ink/80 hover:bg-cream"
			>
				Map
			</a>
		</div>
	</div>

	{#if !hasPeople}
		<p class="rounded-lg border border-dashed border-sage px-4 py-12 text-center text-ink/55">
			No people yet. Add someone to start exploring the tree and map together.
		</p>
	{:else}
		<!-- Shared selection banner: works even when the person has no map dot at the
			 current year (e.g. not yet born). -->
		{#if selectedPerson}
			<div
				class="flex items-center gap-3 rounded-lg border border-sage bg-paper px-3 py-2 shadow-sm"
			>
				<PersonAvatar
					photoUrl={selectedPerson.photoUrl}
					initials={selectedPerson.initials}
					size={36}
				/>
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-semibold text-ink">{selectedPerson.name}</p>
					<p class="text-xs text-ink/50">
						{#if selectedPerson.birthYear != null}✳ {selectedPerson.birthYear}{/if}
						{#if selectedPerson.deathYear != null}
							· † {selectedPerson.deathYear}{/if}
					</p>
				</div>
				<a
					href={resolve('/trees/[treeId]/persons/[personId]', {
						treeId: data.tree.id,
						personId: selectedPerson.id
					})}
					class="rounded-md bg-clay px-3 py-1.5 text-sm font-medium text-ink hover:bg-clay/80"
				>
					Open profile
				</a>
				<button
					type="button"
					onclick={() => (selectedId = null)}
					class="text-ink/40 hover:text-ink"
					aria-label="Clear selection"
				>
					✕
				</button>
			</div>
		{/if}

		<div class="h-[66vh] min-h-115 overflow-hidden">
			<SplitPane storageKey="ha-explore-split">
				{#snippet left()}
					<FamilyGraph
						graph={data.graph}
						treeId={data.tree.id}
						{selectedId}
						{year}
						fill
						onselect={(id) => (selectedId = id)}
					/>
				{/snippet}
				{#snippet right()}
					<MapView
						persons={data.map.persons}
						{year}
						{selectedId}
						height={null}
						onselect={(id) => (selectedId = id)}
					/>
				{/snippet}
			</SplitPane>
		</div>

		<Timeline bind:year {defaultMin} {defaultMax} />

		<p class="text-xs text-ink/45">
			Tree fades people not yet born or already gone at {Math.round(year)}; the map shows everyone
			at their most recent known place by then. Drag the divider to resize · play to sweep through
			time.
		</p>
	{/if}
</div>
