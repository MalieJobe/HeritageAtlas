<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let displayName = $derived(form?.displayName ?? data.displayName);
	let confirmingDelete = $state(false);

	const inputClass =
		'rounded-md border border-sage bg-white px-3 py-2 text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none';
</script>

<svelte:head><title>Account · HeritageAtlas</title></svelte:head>

<div class="mx-auto flex w-full max-w-md flex-col gap-8">
	<div>
		<h1 class="text-2xl font-semibold text-ink">Account</h1>
		<p class="mt-1 text-sm text-ink/60">Manage your account details.</p>
	</div>

	<div class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-ink/80">Email</span>
		<span class="text-ink/60">{data.email}</span>
	</div>

	<!-- Display name -->
	<form method="POST" use:enhance class="flex flex-col gap-3">
		<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
			Display name
			<input
				name="displayName"
				type="text"
				value={displayName}
				placeholder="How you appear to collaborators"
				class="{inputClass} font-normal"
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

	<!-- Password -->
	<form method="POST" action="?/changePassword" use:enhance class="flex flex-col gap-3">
		<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
			Change password
			<input
				name="password"
				type="password"
				autocomplete="new-password"
				placeholder="New password (min 8 characters)"
				class="{inputClass} font-normal"
			/>
		</label>
		{#if form?.passwordError}
			<p class="text-sm text-red-600">{form.passwordError}</p>
		{:else if form?.passwordChanged}
			<p class="text-sm text-green-700">Password updated.</p>
		{/if}
		<button
			type="submit"
			class="self-start rounded-md bg-clay px-4 py-2 font-medium text-ink hover:bg-clay/80"
		>
			Update password
		</button>
	</form>

	<!-- Sign out -->
	<form method="POST" action={resolve('/auth/logout')}>
		<button
			type="submit"
			class="rounded-md border border-sage px-4 py-2 text-sm font-medium text-ink/80 hover:bg-cream"
		>
			Sign out
		</button>
	</form>

	<!-- Danger zone -->
	<section class="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50/50 p-4">
		<h2 class="text-sm font-medium text-red-700">Delete account</h2>
		<p class="text-sm text-ink/60">
			Permanently deletes your account and every tree you own, with all of their people, places, and
			events. This cannot be undone.
		</p>
		{#if form?.deleteError}<p class="text-sm text-red-600">{form.deleteError}</p>{/if}
		{#if confirmingDelete}
			<form method="POST" action="?/deleteAccount" use:enhance class="flex items-center gap-2">
				<button
					type="submit"
					class="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
				>
					Yes, delete my account
				</button>
				<button
					type="button"
					onclick={() => (confirmingDelete = false)}
					class="rounded-md border border-sage px-3 py-1.5 text-sm text-ink/70 hover:bg-cream"
				>
					Cancel
				</button>
			</form>
		{:else}
			<button
				type="button"
				onclick={() => (confirmingDelete = true)}
				class="self-start rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
			>
				Delete account
			</button>
		{/if}
	</section>
</div>
