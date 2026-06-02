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

	<p class="rounded-lg border border-dashed border-sage px-4 py-10 text-center text-ink/55">
		The family graph for this tree will appear here (built in a later task).
	</p>
</div>
