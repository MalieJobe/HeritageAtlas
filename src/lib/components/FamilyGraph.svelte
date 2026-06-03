<script lang="ts">
	import { resolve } from '$app/paths';
	import PersonAvatar from '$lib/components/PersonAvatar.svelte';
	import PersonNode from '$lib/components/PersonNode.svelte';
	import type { GraphData, GraphPerson } from '$lib/graph/types';
	import {
		layoutGraph,
		NODE_WIDTH,
		PARTNER_ANCHOR_Y,
		CHILD_TOP_Y,
		PARENT_BOTTOM_Y,
		type LayoutNode,
		type LayoutResult
	} from '$lib/graph/layout';

	let { graph, treeId }: { graph: GraphData; treeId: string } = $props();

	let containerEl = $state<HTMLDivElement>();
	let result = $state<LayoutResult | null>(null);
	let laying = $state(true);
	let failed = $state(false);

	// Pan/zoom is applied as a single transform on the root <g>, so panning and
	// zooming never re-render nodes — only this transform attribute changes.
	let tx = $state(0);
	let ty = $state(0);
	let scale = $state(1);

	let selectedId = $state<string | null>(null);
	let personById = $derived(new Map(graph.persons.map((p) => [p.id, p])));
	let selected = $derived<GraphPerson | null>(
		selectedId ? (personById.get(selectedId) ?? null) : null
	);

	const MIN_SCALE = 0.12;
	const MAX_SCALE = 2.5;
	const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

	// Run ELK whenever the underlying graph changes (not on pan/zoom).
	$effect(() => {
		const data = graph;
		let cancelled = false;
		laying = true;
		failed = false;
		layoutGraph(data)
			.then((r) => {
				if (cancelled) return;
				result = r;
				laying = false;
				queueMicrotask(fitToView);
			})
			.catch(() => {
				if (cancelled) return;
				failed = true;
				laying = false;
			});
		return () => {
			cancelled = true;
		};
	});

	function fitToView() {
		if (!containerEl || !result || result.width === 0) return;
		const pad = 48;
		const cw = containerEl.clientWidth;
		const ch = containerEl.clientHeight;
		const s = clamp(
			Math.min((cw - pad * 2) / result.width, (ch - pad * 2) / result.height),
			MIN_SCALE,
			1.2
		);
		scale = s;
		tx = (cw - result.width * s) / 2;
		ty = Math.max(pad, (ch - result.height * s) / 2);
	}

	function zoomBy(factor: number) {
		if (!containerEl) return;
		const cx = containerEl.clientWidth / 2;
		const cy = containerEl.clientHeight / 2;
		zoomAt(cx, cy, factor);
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

	// Pointer panning. `moved` lets us tell a pan from a click so dragging over a
	// node doesn't select it.
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
			// Only capture once a real drag starts, so a plain click still reaches
			// the node underneath (capture would otherwise swallow its click event).
			(e.currentTarget as Element).setPointerCapture?.(e.pointerId);
		}
		tx = startTx + dx;
		ty = startTy + dy;
	}
	function onPointerUp(e: PointerEvent) {
		panning = false;
		(e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
	}

	function handleSelect(id: string) {
		if (moved) return; // the pointer was dragged — treat as pan, not click
		selectedId = id;
	}

	type Connector = {
		id: string;
		partnerLine?: { x1: number; x2: number; y: number; status?: 'current' | 'former' };
		junction?: { x: number; y: number };
		childPaths: { id: string; d: string }[];
	};

	/** Orthogonal connector from a junction down to a child, with rounded corners. */
	function childPath(jx: number, jy: number, busY: number, cx: number, cy: number): string {
		if (Math.abs(cx - jx) < 0.5) return `M ${jx} ${jy} L ${cx} ${cy}`;
		const dir = cx > jx ? 1 : -1;
		const r = Math.max(
			0,
			Math.min(22, Math.abs(cx - jx) / 2, Math.abs(busY - jy) / 2, Math.abs(cy - busY) / 2)
		);
		return `M ${jx} ${jy} V ${busY - r} Q ${jx} ${busY} ${jx + dir * r} ${busY} H ${cx - dir * r} Q ${cx} ${busY} ${cx} ${busY + r} V ${cy}`;
	}

	// Connector geometry, derived from node positions: partnerships are a horizontal
	// line between the two cards with a centre junction; children curve down from
	// that junction (or, for a lone parent, from the bottom of their card).
	let connectors = $derived.by<Connector[]>(() => {
		if (!result) return [];
		const nodes = result.nodes;
		const out: Connector[] = [];
		for (const fam of result.families) {
			const parents = fam.parents.map((id) => nodes.get(id)).filter((n): n is LayoutNode => !!n);
			if (parents.length === 0) continue;

			let jx: number;
			let jy: number;
			let partnerLine: Connector['partnerLine'];
			if (parents.length === 2) {
				const left = parents[0].x <= parents[1].x ? parents[0] : parents[1];
				const right = parents[0].x <= parents[1].x ? parents[1] : parents[0];
				const y = left.y + PARTNER_ANCHOR_Y;
				partnerLine = { x1: left.x + NODE_WIDTH, x2: right.x, y, status: fam.status };
				jx = (left.x + NODE_WIDTH + right.x) / 2;
				jy = y;
			} else {
				jx = parents[0].x + NODE_WIDTH / 2;
				jy = parents[0].y + PARENT_BOTTOM_Y;
			}

			const childNodes = fam.children
				.map((id) => nodes.get(id))
				.filter((n): n is LayoutNode => !!n);
			let childPaths: Connector['childPaths'] = [];
			if (childNodes.length > 0) {
				const minChildTop = Math.min(...childNodes.map((c) => c.y + CHILD_TOP_Y));
				const busY = (jy + minChildTop) / 2;
				childPaths = childNodes.map((c) => ({
					id: c.id,
					d: childPath(jx, jy, busY, c.x + NODE_WIDTH / 2, c.y + CHILD_TOP_Y)
				}));
			}

			out.push({
				id: fam.id,
				partnerLine,
				junction: parents.length === 2 ? { x: jx, y: jy } : undefined,
				childPaths
			});
		}
		return out;
	});
</script>

<div
	bind:this={containerEl}
	class="relative h-[70vh] min-h-105 w-full overflow-hidden rounded-lg border border-sage bg-paper select-none"
>
	{#if laying}
		<div class="absolute inset-0 grid place-items-center text-sm text-ink/50">
			Laying out the family graph…
		</div>
	{:else if failed}
		<div class="absolute inset-0 grid place-items-center text-sm text-red-600">
			Couldn’t lay out the graph.
		</div>
	{/if}

	{#if result}
		<svg
			class="h-full w-full {panning ? 'cursor-grabbing' : 'cursor-grab'}"
			role="application"
			aria-label="Family graph"
			onwheel={onWheel}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointerleave={onPointerUp}
		>
			<g transform="translate({tx},{ty}) scale({scale})">
				<!-- Connectors first, behind the nodes. -->
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

				<!-- Junction dots at the centre of each partnership line. -->
				{#each connectors as c (c.id)}
					{#if c.junction}
						<circle cx={c.junction.x} cy={c.junction.y} r="4" fill="#D9D9D9" />
					{/if}
				{/each}

				<!-- Person nodes. -->
				{#each graph.persons as person (person.id)}
					{@const pos = result.nodes.get(person.id)}
					{#if pos}
						<g transform="translate({pos.x},{pos.y})">
							<PersonNode {person} selected={person.id === selectedId} onselect={handleSelect} />
						</g>
					{/if}
				{/each}
			</g>
		</svg>

		<!-- Zoom controls -->
		<div
			class="absolute bottom-3 left-3 flex flex-col overflow-hidden rounded-md border border-sage bg-white/90 text-ink shadow-sm backdrop-blur"
		>
			<button
				class="px-2.5 py-1.5 text-lg leading-none hover:bg-cream"
				aria-label="Zoom in"
				onclick={() => zoomBy(1.2)}>+</button
			>
			<button
				class="border-t border-sage px-2.5 py-1.5 text-lg leading-none hover:bg-cream"
				aria-label="Zoom out"
				onclick={() => zoomBy(1 / 1.2)}>−</button
			>
			<button
				class="border-t border-sage px-2 py-1.5 text-xs hover:bg-cream"
				aria-label="Fit to view"
				onclick={fitToView}>Fit</button
			>
		</div>
	{/if}

	<!-- Selected-person detail panel -->
	{#if selected}
		<div
			class="absolute top-3 right-3 w-64 rounded-lg border border-sage bg-white/95 p-4 shadow-md backdrop-blur"
		>
			<button
				class="absolute top-2 right-2 text-ink/40 hover:text-ink"
				aria-label="Close"
				onclick={() => (selectedId = null)}>✕</button
			>
			<div class="flex flex-col items-center gap-3 text-center">
				<PersonAvatar photoUrl={selected.photoUrl} initials={selected.initials} size={72} />
				<div>
					<p class="font-semibold text-ink">{selected.name}</p>
					{#if selected.sex}
						<p class="text-xs text-ink/55 capitalize">{selected.sex}</p>
					{/if}
				</div>
				<a
					href={resolve('/trees/[treeId]/persons/[personId]', { treeId, personId: selected.id })}
					class="w-full rounded-md bg-clay px-3 py-1.5 text-sm font-medium text-ink hover:bg-clay/80"
				>
					Open profile
				</a>
			</div>
		</div>
	{/if}
</div>
