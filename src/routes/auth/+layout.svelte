<script lang="ts">
	let { children } = $props();
</script>

<div class="mx-auto flex w-full max-w-sm flex-col gap-6 py-8">
	{@render children()}
</div>
