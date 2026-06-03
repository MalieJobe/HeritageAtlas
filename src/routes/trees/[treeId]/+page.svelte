<script lang="ts">
	import { resolve } from '$app/paths';
	import FamilyGraph from '$lib/components/FamilyGraph.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let personCount = $derived(data.graph.persons.length);
</script>

<svelte:head><title>{data.tree.name} · HeritageAtlas</title></svelte:head>

<div class="flex flex-col gap-6">
	<div class="flex items-start justify-between gap-4">
		<div class="flex flex-col gap-1">
			<a href={resolve('/trees')} class="text-sm text-ink/60 hover:text-ink"> ← Your trees </a>
			<h1 class="text-2xl font-semibold text-ink">{data.tree.name}</h1>
		</div>
		<div class="flex items-center gap-2">
			{#if data.canEdit}
				<a
					href={resolve('/trees/[treeId]/persons/new', { treeId: data.tree.id })}
					class="rounded-md bg-clay px-3 py-1.5 text-sm font-medium text-ink hover:bg-clay/80"
				>
					Add person
				</a>
			{/if}
			<a
				href={resolve('/trees/[treeId]/map', { treeId: data.tree.id })}
				class="rounded-md border border-sage px-3 py-1.5 text-sm font-medium text-ink/80 hover:bg-cream"
			>
				Map
			</a>
			<a
				href={resolve('/trees/[treeId]/settings', { treeId: data.tree.id })}
				class="rounded-md border border-sage px-3 py-1.5 text-sm font-medium text-ink/80 hover:bg-cream"
			>
				Settings
			</a>
		</div>
	</div>

	<section class="flex flex-col gap-3">
		<h2 class="text-sm font-medium text-ink/80">
			People <span class="text-ink/45">({personCount})</span>
		</h2>

		{#if personCount > 0}
			<FamilyGraph graph={data.graph} treeId={data.tree.id} />
		{:else}
			<p class="rounded-lg border border-dashed border-sage px-4 py-8 text-center text-ink/55">
				No people yet.{#if data.canEdit}
					Add the first person to start building this tree.{/if}
			</p>
		{/if}
	</section>
</div>
