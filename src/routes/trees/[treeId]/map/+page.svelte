<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import MapView from '$lib/components/MapView.svelte';
	import PersonAvatar from '$lib/components/PersonAvatar.svelte';
	import { eventTypeMeta } from '$lib/events';
	import { resolvePositions } from '$lib/map/positionResolver';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Until the timeline slider lands (task 2.15) the map shows everyone at their
	// most recent known position — i.e. resolved at the latest event year. Seeded
	// once from the loaded range (untrack: the slider, not data, will drive it).
	let year = $state(untrack(() => data.map.yearRange?.max ?? new Date().getFullYear()));

	let selectedId = $state<string | null>(null);

	let positions = $derived(resolvePositions(data.map.persons, year));
	let selected = $derived(positions.find((p) => p.person.id === selectedId) ?? null);
	let locatedCount = $derived(positions.length);
</script>

<svelte:head><title>Map · {data.tree.name} · HeritageAtlas</title></svelte:head>

<div class="flex flex-col gap-4">
	<div class="flex items-start justify-between gap-4">
		<div class="flex flex-col gap-1">
			<a
				href={resolve('/trees/[treeId]', { treeId: data.tree.id })}
				class="text-sm text-ink/60 hover:text-ink"
			>
				← {data.tree.name}
			</a>
			<h1 class="text-2xl font-semibold text-ink">Map</h1>
		</div>
		<a
			href={resolve('/trees/[treeId]', { treeId: data.tree.id })}
			class="rounded-md border border-sage px-3 py-1.5 text-sm font-medium text-ink/80 hover:bg-cream"
		>
			Tree view
		</a>
	</div>

	{#if data.map.persons.length === 0}
		<p class="rounded-lg border border-dashed border-sage px-4 py-12 text-center text-ink/55">
			No located people yet. Add events with places to see them on the map.
		</p>
	{:else}
		<p class="text-sm text-ink/55">
			Showing {locatedCount}
			{locatedCount === 1 ? 'person' : 'people'} in {year}.
		</p>

		<div class="relative">
			<MapView
				persons={data.map.persons}
				{year}
				{selectedId}
				onselect={(id) => (selectedId = id)}
			/>

			{#if selected}
				<div
					class="absolute bottom-4 left-4 z-10 w-64 rounded-lg border border-sage bg-paper/95 p-3 shadow-lg backdrop-blur"
				>
					<div class="flex items-start gap-3">
						<PersonAvatar
							photoUrl={selected.person.photoUrl}
							initials={selected.person.initials}
							size={48}
						/>
						<div class="min-w-0 flex-1">
							<p class="truncate font-semibold text-ink">{selected.person.name}</p>
							<p class="truncate text-sm text-ink/65">
								{eventTypeMeta(selected.event.type).icon}
								{selected.placeName}
							</p>
							<p class="text-xs text-ink/45">in {selected.event.year}</p>
						</div>
						<button
							type="button"
							onclick={() => (selectedId = null)}
							class="text-ink/40 hover:text-ink"
							aria-label="Close"
						>
							✕
						</button>
					</div>
					<a
						href={resolve('/trees/[treeId]/persons/[personId]', {
							treeId: data.tree.id,
							personId: selected.person.id
						})}
						class="mt-3 block rounded-md bg-clay px-3 py-1.5 text-center text-sm font-medium text-ink hover:bg-clay/80"
					>
						Open profile
					</a>
				</div>
			{/if}
		</div>
	{/if}
</div>
