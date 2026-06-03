<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PersonNode from '$lib/components/PersonNode.svelte';
	import { layoutGraph, buildConnectors, type LayoutResult } from '$lib/graph/layout';
	import type { GraphData } from '$lib/graph/types';

	let {
		graph,
		treeId,
		centerId
	}: {
		graph: GraphData;
		treeId: string;
		centerId: string;
	} = $props();

	let result = $state<LayoutResult | null>(null);

	// Same layout engine as the full tree — just fed a subset (direct relatives),
	// so the preview keeps real hierarchy. Re-runs when the subject changes.
	$effect(() => {
		const data = graph;
		let cancelled = false;
		layoutGraph(data).then((r) => {
			if (!cancelled) result = r;
		});
		return () => {
			cancelled = true;
		};
	});

	let connectors = $derived(result ? buildConnectors(result) : []);
	const PAD = 24;

	function open(id: string) {
		if (id !== centerId)
			goto(resolve('/trees/[treeId]/persons/[personId]', { treeId, personId: id }));
	}
</script>

{#if result}
	<svg
		viewBox="{-PAD} {-PAD} {result.width + PAD * 2} {result.height + PAD * 2}"
		preserveAspectRatio="xMidYMid meet"
		class="h-full w-full"
		role="group"
		aria-label="Direct relatives"
	>
		{#each connectors as c (c.id)}
			{#if c.partnerLine}
				<line
					x1={c.partnerLine.x1}
					y1={c.partnerLine.y}
					x2={c.partnerLine.x2}
					y2={c.partnerLine.y}
					stroke="#0D0F0B"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-opacity={c.partnerLine.status === 'former' ? 0.5 : 0.9}
					stroke-dasharray={c.partnerLine.status === 'former' ? '7 7' : undefined}
				/>
			{/if}
			{#each c.childPaths as cp (cp.id)}
				<path
					d={cp.d}
					fill="none"
					stroke="#0D0F0B"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-opacity="0.9"
				/>
			{/each}
		{/each}

		{#each graph.persons as person (person.id)}
			{@const pos = result.nodes.get(person.id)}
			{#if pos}
				<g transform="translate({pos.x},{pos.y})">
					<PersonNode {person} selected={person.id === centerId} onselect={open} />
				</g>
			{/if}
		{/each}
	</svg>
{:else}
	<div class="grid h-full place-items-center text-xs text-ink/40">Loading…</div>
{/if}
