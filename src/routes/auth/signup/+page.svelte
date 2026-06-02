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
		<h1 class="text-2xl font-semibold text-ink">Check your email</h1>
		<p class="mt-2 text-sm text-ink/60">
			We sent a confirmation link to <strong class="text-ink/80">{form.email}</strong>. Click it to
			activate your account, then sign in.
		</p>
	</div>
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a href={loginHref} class="font-medium text-ink underline-offset-2 hover:underline">
		Back to sign in
	</a>
{:else}
	<div>
		<h1 class="text-2xl font-semibold text-ink">Create your account</h1>
		<p class="mt-1 text-sm text-ink/60">Start building your family atlas.</p>
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
				autocomplete="new-password"
				required
				minlength="8"
				class="rounded-md border border-sage bg-white px-3 py-2 font-normal text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none"
			/>
			<span class="text-xs font-normal text-ink/45">At least 8 characters.</span>
		</label>

		{#if form?.error}
			<p class="text-sm text-red-600">{form.error}</p>
		{/if}

		<button
			type="submit"
			class="rounded-md bg-clay px-3 py-2 font-medium text-ink hover:bg-clay/80"
		>
			Create account
		</button>
	</form>

	<p class="text-sm text-ink/60">
		Already have an account?
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href={loginHref} class="font-medium text-ink underline-offset-2 hover:underline">Sign in</a>
	</p>
{/if}
