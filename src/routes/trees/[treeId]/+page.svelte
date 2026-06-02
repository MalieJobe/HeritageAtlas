<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{data.tree.name} · HeritageAtlas</title></svelte:head>

<div class="flex flex-col gap-6">
	<div class="flex items-start justify-between gap-4">
		<div class="flex flex-col gap-1">
			<a href={resolve('/trees')} class="text-sm text-ink/60 hover:text-ink"> ← Your trees </a>
			<h1 class="text-2xl font-semibold text-ink">{data.tree.name}</h1>
		</div>
		<a
			href={resolve('/trees/[treeId]/settings', { treeId: data.tree.id })}
			class="rounded-md border border-sage px-3 py-1.5 text-sm font-medium text-ink/80 hover:bg-cream"
		>
			Settings
		</a>
	</div>

	<section class="flex flex-col gap-3">
		<div class="flex items-center justify-between">
			<h2 class="text-sm font-medium text-ink/80">
				People <span class="text-ink/45">({data.persons.length})</span>
			</h2>
			{#if data.canEdit}
				<a
					href={resolve('/trees/[treeId]/persons/new', { treeId: data.tree.id })}
					class="rounded-md bg-clay px-3 py-1.5 text-sm font-medium text-ink hover:bg-clay/80"
				>
					Add person
				</a>
			{/if}
		</div>

		{#if data.persons.length > 0}
			<ul class="flex flex-col divide-y divide-sage/40 rounded-lg border border-sage bg-white">
				{#each data.persons as person (person.id)}
					<li>
						<a
							href={resolve('/trees/[treeId]/persons/[personId]', {
								treeId: data.tree.id,
								personId: person.id
							})}
							class="block px-4 py-3 text-ink hover:bg-cream"
						>
							{person.name}
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="rounded-lg border border-dashed border-sage px-4 py-8 text-center text-ink/55">
				No people yet.{#if data.canEdit}
					Add the first person to start building this tree.{/if}
			</p>
		{/if}
	</section>

	<p class="rounded-lg border border-dashed border-sage px-4 py-6 text-center text-sm text-ink/45">
		The interactive family graph will replace this list in a later task.
	</p>
</div>
