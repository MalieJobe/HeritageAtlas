<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{data.tree.name} · HeritageAtlas</title></svelte:head>

<div class="flex flex-col gap-6">
	<div class="flex items-start justify-between gap-4">
		<div class="flex flex-col gap-1">
			<a href={resolve('/trees')} class="text-sm text-stone-500 hover:text-stone-700">
				← Your trees
			</a>
			<h1 class="text-2xl font-semibold text-stone-800">{data.tree.name}</h1>
		</div>
		<a
			href={resolve('/trees/[treeId]/settings', { treeId: data.tree.id })}
			class="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
		>
			Settings
		</a>
	</div>

	<p class="rounded-lg border border-dashed border-stone-300 px-4 py-10 text-center text-stone-500">
		The family graph for this tree will appear here (built in a later task).
	</p>
</div>
