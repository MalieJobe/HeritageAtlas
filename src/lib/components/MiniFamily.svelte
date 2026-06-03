<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PersonNode from '$lib/components/PersonNode.svelte';
	import { layoutGraph, buildConnectors, NODE_WIDTH, type LayoutResult } from '$lib/graph/layout';
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

	let containerEl = $state<HTMLDivElement>();
	let result = $state<LayoutResult | null>(null);

	let tx = $state(0);
	let ty = $state(0);
	let scale = $state(1);

	const MIN_SCALE = 0.15;
	const MAX_SCALE = 2.5;
	const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

	// Same layout engine as the full tree — just fed a subset (direct relatives).
	$effect(() => {
		const data = graph;
		let cancelled = false;
		layoutGraph(data).then((r) => {
			if (cancelled) return;
			result = r;
			queueMicrotask(fitToView);
		});
		return () => {
			cancelled = true;
		};
	});

	let connectors = $derived(result ? buildConnectors(result) : []);

	function fitToView() {
		if (!containerEl || !result || result.width === 0) return;
		const pad = 24;
		const cw = containerEl.clientWidth;
		const ch = containerEl.clientHeight;
		const s = clamp(
			Math.min((cw - pad * 2) / result.width, (ch - pad * 2) / result.height),
			MIN_SCALE,
			1.4
		);
		scale = s;
		tx = (cw - result.width * s) / 2;
		ty = (ch - result.height * s) / 2;
	}

	function zoomAt(px: number, py: number, factor: number) {
		const next = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
		const ratio = next / scale;
		tx = px - (px - tx) * ratio;
		ty = py - (py - ty) * ratio;
		scale = next;
	}
	function onWheel(e: WheelEvent) {
		if (!containerEl) return;
		e.preventDefault();
		const rect = containerEl.getBoundingClientRect();
		zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0015));
	}

	// Pan; `moved` tells a drag from a click so dragging doesn't navigate.
	let panning = $state(false);
	let moved = false;
	let startX = 0;
	let startY = 0;
	let startTx = 0;
	let startTy = 0;
	function onPointerDown(e: PointerEvent) {
		panning = true;
		moved = false;
		startX = e.clientX;
		startY = e.clientY;
		startTx = tx;
		startTy = ty;
	}
	function onPointerMove(e: PointerEvent) {
		if (!panning) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		if (Math.abs(dx) + Math.abs(dy) > 3 && !moved) {
			moved = true;
			(e.currentTarget as Element).setPointerCapture?.(e.pointerId);
		}
		tx = startTx + dx;
		ty = startTy + dy;
	}
	function onPointerUp(e: PointerEvent) {
		panning = false;
		(e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
	}

	function open(id: string) {
		if (moved || id === centerId) return;
		goto(resolve('/trees/[treeId]/persons/[personId]', { treeId, personId: id }));
	}
</script>

<div bind:this={containerEl} class="h-full w-full overflow-hidden select-none">
	{#if result}
		<svg
			class="h-full w-full {panning ? 'cursor-grabbing' : 'cursor-grab'}"
			role="group"
			aria-label="Direct relatives"
			onwheel={onWheel}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointerleave={onPointerUp}
		>
			<g transform="translate({tx},{ty}) scale({scale})">
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
							{#if person.id === centerId}
								<!-- Highlight the current person. -->
								<rect
									x={-7}
									y={-12}
									width={NODE_WIDTH + 14}
									height={188}
									rx="16"
									fill="none"
									stroke="#E9BA9C"
									stroke-width="4"
								/>
							{/if}
							<PersonNode {person} selected={person.id === centerId} onselect={open} />
						</g>
					{/if}
				{/each}
			</g>
		</svg>
	{:else}
		<div class="grid h-full place-items-center text-xs text-ink/40">Loading…</div>
	{/if}
</div>
