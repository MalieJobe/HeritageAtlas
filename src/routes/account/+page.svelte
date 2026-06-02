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
		<h1 class="text-2xl font-semibold text-stone-800">Account</h1>
		<p class="mt-1 text-sm text-stone-500">Manage your account details.</p>
	</div>

	<div class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-stone-700">Email</span>
		<span class="text-stone-500">{data.email}</span>
	</div>

	<form method="POST" use:enhance class="flex flex-col gap-4">
		<label class="flex flex-col gap-1 text-sm font-medium text-stone-700">
			Display name
			<input
				name="displayName"
				type="text"
				value={displayName}
				placeholder="How you appear to collaborators"
				class="rounded-md border border-stone-300 px-3 py-2 font-normal text-stone-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
			/>
		</label>

		{#if form?.error}
			<p class="text-sm text-red-600">{form.error}</p>
		{:else if form?.success}
			<p class="text-sm text-green-600">Saved.</p>
		{/if}

		<button
			type="submit"
			class="self-start rounded-md bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700"
		>
			Save
		</button>
	</form>
</div>
