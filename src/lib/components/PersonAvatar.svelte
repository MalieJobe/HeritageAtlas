<script lang="ts">
	let {
		photoUrl = null,
		initials,
		size = 96
	}: { photoUrl?: string | null; initials: string; size?: number } = $props();
</script>

{#if photoUrl}
	<img
		src={photoUrl}
		alt=""
		class="rounded-full border border-sage object-cover"
		style="width:{size}px;height:{size}px"
	/>
{:else}
	<div
		class="grid place-items-center rounded-full border border-sage bg-sage/40 font-semibold text-ink/70"
		style="width:{size}px;height:{size}px;font-size:{Math.round(size / 2.8)}px"
	>
		{initials}
	</div>
{/if}
