<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let redirectTo = $derived(page.url.searchParams.get('redirectTo'));
	let loginHref = $derived(
		redirectTo
			? `${resolve('/auth/login')}?redirectTo=${encodeURIComponent(redirectTo)}`
			: resolve('/auth/login')
	);
</script>

<svelte:head><title>Create account · HeritageAtlas</title></svelte:head>

{#if form?.checkEmail}
	<div>
		<h1 class="text-2xl font-semibold text-stone-800">Check your email</h1>
		<p class="mt-2 text-sm text-stone-500">
			We sent a confirmation link to <strong class="text-stone-700">{form.email}</strong>. Click it
			to activate your account, then sign in.
		</p>
	</div>
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a href={loginHref} class="font-medium text-amber-700 hover:underline">Back to sign in</a>
{:else}
	<div>
		<h1 class="text-2xl font-semibold text-stone-800">Create your account</h1>
		<p class="mt-1 text-sm text-stone-500">Start building your family atlas.</p>
	</div>

	<form method="POST" use:enhance class="flex flex-col gap-4">
		<label class="flex flex-col gap-1 text-sm font-medium text-stone-700">
			Email
			<input
				name="email"
				type="email"
				autocomplete="email"
				required
				value={form?.email ?? ''}
				class="rounded-md border border-stone-300 px-3 py-2 font-normal text-stone-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
			/>
		</label>

		<label class="flex flex-col gap-1 text-sm font-medium text-stone-700">
			Password
			<input
				name="password"
				type="password"
				autocomplete="new-password"
				required
				minlength="8"
				class="rounded-md border border-stone-300 px-3 py-2 font-normal text-stone-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
			/>
			<span class="text-xs font-normal text-stone-400">At least 8 characters.</span>
		</label>

		{#if form?.error}
			<p class="text-sm text-red-600">{form.error}</p>
		{/if}

		<button
			type="submit"
			class="rounded-md bg-amber-600 px-3 py-2 font-medium text-white hover:bg-amber-700"
		>
			Create account
		</button>
	</form>

	<p class="text-sm text-stone-500">
		Already have an account?
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href={loginHref} class="font-medium text-amber-700 hover:underline">Sign in</a>
	</p>
{/if}
