<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';

	let {
		left,
		right,
		min = 0.25,
		storageKey
	}: {
		left: Snippet;
		right: Snippet;
		/** Smallest fraction either pane may shrink to. */
		min?: number;
		/** When set, the split ratio is remembered across visits. */
		storageKey?: string;
	} = $props();

	// Fraction of the width given to the left pane. The right pane takes the rest.
	let ratio = $state(0.5);
	let containerEl = $state<HTMLDivElement>();

	const clamp = (v: number) => Math.max(min, Math.min(1 - min, v));

	onMount(() => {
		if (!storageKey) return;
		const saved = localStorage.getItem(storageKey);
		if (saved) {
			const v = Number.parseFloat(saved);
			if (Number.isFinite(v)) ratio = clamp(v);
		}
	});

	let dragging = $state(false);

	function onPointerDown(e: PointerEvent) {
		dragging = true;
		(e.currentTarget as Element).setPointerCapture?.(e.pointerId);
		e.preventDefault();
	}
	function onPointerMove(e: PointerEvent) {
		if (!dragging || !containerEl) return;
		const rect = containerEl.getBoundingClientRect();
		ratio = clamp((e.clientX - rect.left) / rect.width);
	}
	function onPointerUp(e: PointerEvent) {
		if (!dragging) return;
		dragging = false;
		(e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
		if (storageKey) localStorage.setItem(storageKey, ratio.toFixed(3));
	}

	// Keyboard nudge for accessibility.
	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') ratio = clamp(ratio - 0.02);
		else if (e.key === 'ArrowRight') ratio = clamp(ratio + 0.02);
		else return;
		e.preventDefault();
	}
</script>

<div bind:this={containerEl} class="flex h-full w-full select-none">
	<div class="h-full min-w-0 overflow-hidden" style="width: {ratio * 100}%">
		{@render left()}
	</div>

	<!-- Divider: drag to resize, arrow keys to nudge. A window-splitter is the
		 WAI-ARIA interactive `separator` pattern, which the a11y lint doesn't model. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		role="separator"
		aria-orientation="vertical"
		aria-valuenow={Math.round(ratio * 100)}
		aria-label="Resize panes"
		tabindex="0"
		class="group relative flex w-2 shrink-0 cursor-col-resize items-center justify-center
			{dragging ? 'bg-clay/30' : 'bg-sage/30 hover:bg-clay/20'}
			focus:outline-none focus-visible:ring-2 focus-visible:ring-clay"
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
		onkeydown={onKeyDown}
	>
		<span
			class="h-8 w-0.5 rounded-full bg-ink/25 transition-colors group-hover:bg-ink/40
				{dragging ? 'bg-ink/50' : ''}"
		></span>
	</div>

	<div class="h-full min-w-0 flex-1 overflow-hidden">
		{@render right()}
	</div>
</div>
