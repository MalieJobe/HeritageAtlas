<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import PersonAvatar from '$lib/components/PersonAvatar.svelte';
	import PersonNode from '$lib/components/PersonNode.svelte';
	import type { GraphData, GraphPerson } from '$lib/graph/types';
	import {
		layoutGraph,
		buildConnectors,
		NODE_WIDTH,
		NODE_HEIGHT,
		type LayoutResult
	} from '$lib/graph/layout';

	let {
		graph,
		treeId,
		selectedId = null,
		onselect,
		year = null,
		fill = false,
		readonly = false
	}: {
		graph: GraphData;
		treeId: string;
		/** Controlled selection. When `onselect` is supplied the graph is driven from
		 *  outside (split view); otherwise it manages selection itself. */
		selectedId?: string | null;
		onselect?: (id: string | null) => void;
		/** Timeline year for the aging cue: nodes for the not-yet-born / already
		 *  deceased fade out. Null disables the cue (standalone tree). */
		year?: number | null;
		/** Fill the parent's height instead of the standalone fixed height. */
		fill?: boolean;
		/** Demo mode: keep selection/centering but hide the "open profile" panel. */
		readonly?: boolean;
	} = $props();

	let controlled = $derived(onselect !== undefined);

	let containerEl = $state<HTMLDivElement>();
	let result = $state<LayoutResult | null>(null);
	let laying = $state(true);
	let failed = $state(false);

	// Pan/zoom is applied as a single transform on the root <g>, so panning and
	// zooming never re-render nodes — only this transform attribute changes.
	let tx = $state(0);
	let ty = $state(0);
	let scale = $state(1);

	// Internal selection for standalone use; in controlled mode the prop wins.
	let internalSelected = $state<string | null>(null);
	let activeSelected = $derived(controlled ? selectedId : internalSelected);
	let personById = $derived(new Map(graph.persons.map((p) => [p.id, p])));
	let selected = $derived<GraphPerson | null>(
		activeSelected ? (personById.get(activeSelected) ?? null) : null
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
		cancelTween();
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
		cancelTween();
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

	// --- Smooth recentre on the selected node (split-view sync, task 2.14) ---
	let raf = 0;
	function cancelTween() {
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
	}
	function tweenTo(tx2: number, ty2: number, s2: number, dur = 380) {
		cancelTween();
		const tx0 = tx;
		const ty0 = ty;
		const s0 = scale;
		const start = performance.now();
		const ease = (t: number) => 1 - Math.pow(1 - t, 3);
		const stepFn = (now: number) => {
			const t = Math.min(1, (now - start) / dur);
			const k = ease(t);
			tx = tx0 + (tx2 - tx0) * k;
			ty = ty0 + (ty2 - ty0) * k;
			scale = s0 + (s2 - s0) * k;
			if (t < 1) raf = requestAnimationFrame(stepFn);
			else raf = 0;
		};
		raf = requestAnimationFrame(stepFn);
	}
	function centerOn(id: string) {
		if (!containerEl || !result) return;
		const pos = result.nodes.get(id);
		if (!pos) return;
		const s = clamp(Math.max(scale, 0.5), MIN_SCALE, MAX_SCALE);
		const cw = containerEl.clientWidth;
		const ch = containerEl.clientHeight;
		tweenTo(cw / 2 - (pos.x + NODE_WIDTH / 2) * s, ch / 2 - (pos.y + NODE_HEIGHT / 2) * s, s);
	}

	// In controlled mode, glide to the externally-selected node — but only when the
	// selection itself changes. `centerOn` reads tx/ty/scale, so we untrack it;
	// otherwise panning (which changes tx/ty) would re-fire this effect and snap the
	// node back to centre. Once centred, the view is yours to drag freely.
	let centeredFor: string | null = null;
	$effect(() => {
		const id = controlled ? selectedId : null;
		if (!result) return;
		if (id === centeredFor) return;
		centeredFor = id;
		if (id) untrack(() => centerOn(id));
	});

	// Re-fit when the graph first gains real dimensions — e.g. it was hidden behind
	// the mobile view toggle (0×0) and just became visible.
	$effect(() => {
		if (!containerEl) return;
		const elRef = containerEl;
		let hadSize = elRef.clientWidth > 0 && elRef.clientHeight > 0;
		const ro = new ResizeObserver(() => {
			const hasSize = elRef.clientWidth > 0 && elRef.clientHeight > 0;
			if (hasSize && !hadSize && result) fitToView();
			hadSize = hasSize;
		});
		ro.observe(elRef);
		return () => ro.disconnect();
	});

	// Pointer panning. `moved` lets us tell a pan from a click so dragging over a
	// node doesn't select it.
	let panning = $state(false);
	let moved = false;
	let startX = 0;
	let startY = 0;
	let startTx = 0;
	let startTy = 0;

	function onPointerDown(e: PointerEvent) {
		cancelTween();
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
		if (controlled) onselect?.(id);
		else internalSelected = id;
	}

	let connectors = $derived(result ? buildConnectors(result) : []);

	/** Where this person sits relative to the timeline year: not-yet-born, dead, or
	 *  living. Drives the visual cue — unborn fade (still in colour), dead go grey. */
	function lifeState(p: GraphPerson): 'unborn' | 'dead' | 'living' {
		if (year == null) return 'living';
		if (p.birthYear != null && year < p.birthYear) return 'unborn';
		if (p.deathYear != null && year > p.deathYear) return 'dead';
		return 'living';
	}
</script>

<div
	bind:this={containerEl}
	class="relative w-full overflow-hidden bg-paper select-none
		{fill ? 'h-full' : 'h-[70vh] min-h-105 rounded-lg border border-sage'}"
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
					{@const state = lifeState(person)}
					{#if pos}
						<g
							transform="translate({pos.x},{pos.y})"
							class="ha-node"
							style:opacity={state === 'unborn' ? 0.3 : state === 'dead' ? 0.9 : 1}
							style:filter={state === 'dead' ? 'grayscale(1)' : null}
						>
							{#if person.id === activeSelected}
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
							<PersonNode
								{person}
								selected={person.id === activeSelected}
								onselect={handleSelect}
							/>
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

	<!-- Selected-person detail panel: the one place to open a profile from the graph. -->
	{#if selected && !readonly}
		<div
			class="absolute top-3 right-3 w-64 rounded-lg border border-sage bg-white/95 p-4 shadow-md backdrop-blur"
		>
			<button
				class="absolute top-2 right-2 text-ink/40 hover:text-ink"
				aria-label="Close"
				onclick={() => (controlled ? onselect?.(null) : (internalSelected = null))}>✕</button
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

<style>
	.ha-node {
		transition:
			opacity 0.4s ease,
			filter 0.4s ease;
	}
</style>
