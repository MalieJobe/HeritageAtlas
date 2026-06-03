<script lang="ts" module>
	export type LightboxPhoto = { id: string; url: string };
</script>

<script lang="ts">
	import { untrack } from 'svelte';

	let {
		photos,
		startIndex = 0,
		onclose
	}: {
		photos: LightboxPhoto[];
		startIndex?: number;
		onclose: () => void;
	} = $props();

	// Seeded once; navigation owns it afterwards.
	let current = $state(untrack(() => startIndex));

	function prev() {
		current = (current - 1 + photos.length) % photos.length;
	}
	function next() {
		current = (current + 1) % photos.length;
	}
	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
		else if (e.key === 'ArrowLeft') prev();
		else if (e.key === 'ArrowRight') next();
	}
</script>

<svelte:window onkeydown={onKey} />

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-6 select-none"
	role="presentation"
	onclick={(e) => {
		if (e.target === e.currentTarget) onclose();
	}}
>
	<button
		type="button"
		onclick={onclose}
		aria-label="Close"
		class="absolute top-4 right-4 grid h-9 w-9 place-items-center rounded-full bg-white/15 text-xl text-white hover:bg-white/30"
	>
		✕
	</button>

	{#if photos.length > 1}
		<button
			type="button"
			onclick={prev}
			aria-label="Previous"
			class="absolute left-4 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/30"
		>
			‹
		</button>
		<button
			type="button"
			onclick={next}
			aria-label="Next"
			class="absolute right-4 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/30"
		>
			›
		</button>
	{/if}

	<img
		src={photos[current].url}
		alt=""
		class="max-h-[88vh] max-w-[88vw] rounded-md object-contain shadow-2xl"
	/>

	{#if photos.length > 1}
		<div
			class="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 text-sm text-white"
		>
			{current + 1} / {photos.length}
		</div>
	{/if}
</div>
