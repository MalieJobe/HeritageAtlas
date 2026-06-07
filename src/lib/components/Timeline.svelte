<script lang="ts">
	import { untrack } from 'svelte';

	let {
		year = $bindable(),
		defaultMin,
		defaultMax
	}: {
		/** The currently scrubbed year, shared with the panes. */
		year: number;
		/** Auto-derived span from the tree's dated facts; the override resets here. */
		defaultMin: number;
		defaultMax: number;
	} = $props();

	// Effective range — seeded from the auto-derived span, adjustable below.
	let rangeMin = $state(untrack(() => defaultMin));
	let rangeMax = $state(untrack(() => defaultMax));

	const clampYear = (v: number) => Math.max(rangeMin, Math.min(rangeMax, v));

	// --- Playback (task 2.18) ---
	let playing = $state(false);
	const SPEEDS = [1, 2, 4] as const;
	let speed = $state<(typeof SPEEDS)[number]>(1);
	// 1× = 4 years/sec; 2×/4× scale from here, so halving this slows the whole scale.
	const BASE_YEARS_PER_SEC = 4;

	let atEnd = $derived(Math.round(year) >= rangeMax);
	let singleYear = $derived(rangeMax <= rangeMin);

	function togglePlay() {
		if (singleYear) return;
		if (!playing && atEnd) year = rangeMin; // restart a finished sweep
		playing = !playing;
	}

	// Animate the year forward while playing. Time-based (years/second) so the
	// sweep takes a consistent wall-clock duration regardless of the span.
	$effect(() => {
		if (!playing) return;
		let raf = 0;
		let prev = performance.now();
		const step = (now: number) => {
			const dt = (now - prev) / 1000;
			prev = now;
			let next = year + BASE_YEARS_PER_SEC * speed * dt;
			if (next >= rangeMax) {
				next = rangeMax;
				playing = false;
			}
			year = next;
			if (playing) raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	});

	function onScrub(e: Event) {
		playing = false;
		year = clampYear(Number((e.currentTarget as HTMLInputElement).value));
	}

	// --- Range override (task 2.15) ---
	let editingRange = $state(false);
	function commitMin(v: number) {
		if (!Number.isFinite(v)) return;
		rangeMin = Math.min(v, rangeMax - 1);
		year = clampYear(year);
	}
	function commitMax(v: number) {
		if (!Number.isFinite(v)) return;
		rangeMax = Math.max(v, rangeMin + 1);
		year = clampYear(year);
	}
	function resetRange() {
		rangeMin = defaultMin;
		rangeMax = defaultMax;
		year = clampYear(year);
	}
	let overridden = $derived(rangeMin !== defaultMin || rangeMax !== defaultMax);

	// Slider fill, as a percentage of the range.
	let pct = $derived(
		singleYear ? 100 : ((clampYear(year) - rangeMin) / (rangeMax - rangeMin)) * 100
	);
	let displayYear = $derived(Math.round(clampYear(year)));
</script>

<div class="shrink-0 border-t border-sage bg-paper px-4 py-3">
	<div class="flex items-center gap-4">
		<!-- Play / pause -->
		<button
			type="button"
			onclick={togglePlay}
			disabled={singleYear}
			class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-clay text-ink shadow-sm transition hover:bg-clay/80 disabled:cursor-not-allowed disabled:opacity-40"
			aria-label={playing ? 'Pause' : 'Play'}
		>
			{#if playing}
				<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
					<rect x="2" y="1.5" width="3.5" height="11" rx="1" />
					<rect x="8.5" y="1.5" width="3.5" height="11" rx="1" />
				</svg>
			{:else}
				<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
					<path d="M3 1.8 12 7 3 12.2z" />
				</svg>
			{/if}
		</button>

		<!-- Year readout -->
		<div class="w-16 shrink-0 text-center">
			<span class="font-mono text-xl font-semibold text-ink tabular-nums">{displayYear}</span>
		</div>

		<!-- Slider -->
		<div class="relative flex-1">
			<div
				class="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-sage/40"
			></div>
			<div
				class="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-clay"
				style="left:0; width:{pct}%"
			></div>
			<input
				type="range"
				min={rangeMin}
				max={rangeMax}
				step="1"
				value={displayYear}
				oninput={onScrub}
				disabled={singleYear}
				aria-label="Year"
				class="ha-range relative w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed"
			/>
		</div>

		<!-- Speed -->
		<div class="flex shrink-0 items-center overflow-hidden rounded-md border border-sage text-xs">
			{#each SPEEDS as s (s)}
				<button
					type="button"
					onclick={() => (speed = s)}
					class="px-2 py-1 font-medium transition {speed === s
						? 'bg-clay text-ink'
						: 'text-ink/60 hover:bg-cream'}"
					aria-pressed={speed === s}
				>
					{s}×
				</button>
			{/each}
		</div>
	</div>

	<!-- Range footer: span + override -->
	<div class="mt-2 flex items-center justify-between text-xs text-ink/55">
		{#if editingRange}
			<div class="flex items-center gap-2">
				<label class="flex items-center gap-1">
					From
					<input
						type="number"
						value={rangeMin}
						onchange={(e) => commitMin(Number(e.currentTarget.value))}
						class="w-16 rounded border border-sage bg-white px-1.5 py-0.5 text-ink"
					/>
				</label>
				<label class="flex items-center gap-1">
					to
					<input
						type="number"
						value={rangeMax}
						onchange={(e) => commitMax(Number(e.currentTarget.value))}
						class="w-16 rounded border border-sage bg-white px-1.5 py-0.5 text-ink"
					/>
				</label>
				{#if overridden}
					<button type="button" onclick={resetRange} class="text-ink/50 underline hover:text-ink">
						reset
					</button>
				{/if}
				<button
					type="button"
					onclick={() => (editingRange = false)}
					class="text-ink/50 hover:text-ink"
				>
					done
				</button>
			</div>
		{:else}
			<span
				>{rangeMin} – {rangeMax}{#if overridden}<span class="text-ink/35">
						(custom)</span
					>{/if}</span
			>
			<button
				type="button"
				onclick={() => (editingRange = true)}
				class="underline underline-offset-2 hover:text-ink"
			>
				Adjust range
			</button>
		{/if}
	</div>
</div>

<style>
	/* Transparent native track/thumb so our painted fill shows through; just a
	   styled thumb on top. */
	.ha-range {
		height: 1.5rem;
	}
	.ha-range::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		height: 18px;
		width: 18px;
		border-radius: 9999px;
		background: #fafbf9;
		border: 3px solid #e9ba9c;
		box-shadow: 0 1px 3px rgba(13, 15, 11, 0.3);
		cursor: pointer;
		margin-top: 0;
	}
	.ha-range::-moz-range-thumb {
		height: 18px;
		width: 18px;
		border-radius: 9999px;
		background: #fafbf9;
		border: 3px solid #e9ba9c;
		box-shadow: 0 1px 3px rgba(13, 15, 11, 0.3);
		cursor: pointer;
	}
	.ha-range::-moz-range-track {
		background: transparent;
	}
</style>
