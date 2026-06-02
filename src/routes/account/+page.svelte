<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Show the freshly submitted value after a save, otherwise the loaded value.
	let displayName = $derived(form?.displayName ?? data.displayName);
</script>

<svelte:head><title>Account · HeritageAtlas</title></svelte:head>

<div class="mx-auto flex w-full max-w-md flex-col gap-6">
	<div>
		<h1 class="text-2xl font-semibold text-ink">Account</h1>
		<p class="mt-1 text-sm text-ink/60">Manage your account details.</p>
	</div>

	<div class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-ink/80">Email</span>
		<span class="text-ink/60">{data.email}</span>
	</div>

	<form method="POST" use:enhance class="flex flex-col gap-4">
		<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
			Display name
			<input
				name="displayName"
				type="text"
				value={displayName}
				placeholder="How you appear to collaborators"
				class="rounded-md border border-sage bg-white px-3 py-2 font-normal text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none"
			/>
		</label>

		{#if form?.error}
			<p class="text-sm text-red-600">{form.error}</p>
		{:else if form?.success}
			<p class="text-sm text-green-700">Saved.</p>
		{/if}

		<button
			type="submit"
			class="self-start rounded-md bg-clay px-4 py-2 font-medium text-ink hover:bg-clay/80"
		>
			Save
		</button>
	</form>
</div>
