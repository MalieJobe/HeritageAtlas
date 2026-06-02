<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let redirectTo = $derived(page.url.searchParams.get('redirectTo'));
	let signupHref = $derived(
		redirectTo
			? `${resolve('/auth/signup')}?redirectTo=${encodeURIComponent(redirectTo)}`
			: resolve('/auth/signup')
	);
</script>

<svelte:head><title>Sign in · HeritageAtlas</title></svelte:head>

<div>
	<h1 class="text-2xl font-semibold text-ink">Welcome back</h1>
	<p class="mt-1 text-sm text-ink/60">Sign in to your HeritageAtlas account.</p>
</div>

<form method="POST" use:enhance class="flex flex-col gap-4">
	<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
		Email
		<input
			name="email"
			type="email"
			autocomplete="email"
			required
			value={form?.email ?? ''}
			class="rounded-md border border-sage bg-white px-3 py-2 font-normal text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none"
		/>
	</label>

	<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
		Password
		<input
			name="password"
			type="password"
			autocomplete="current-password"
			required
			class="rounded-md border border-sage bg-white px-3 py-2 font-normal text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none"
		/>
	</label>

	{#if form?.error}
		<p class="text-sm text-red-600">{form.error}</p>
	{/if}

	<button type="submit" class="rounded-md bg-clay px-3 py-2 font-medium text-ink hover:bg-clay/80">
		Sign in
	</button>
</form>

<p class="text-sm text-ink/60">
	Don't have an account?
	<!-- signupHref is a resolve()d internal path plus a redirectTo query string -->
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a href={signupHref} class="font-medium text-ink underline-offset-2 hover:underline">Create one</a
	>
</p>
