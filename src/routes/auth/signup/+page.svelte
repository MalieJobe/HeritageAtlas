<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { ActionData } from './$types';
	import { useI18n } from '$lib/i18n';

	const t = useI18n().t;

	let { form }: { form: ActionData } = $props();

	let redirectTo = $derived(page.url.searchParams.get('redirectTo'));
	let loginHref = $derived(
		redirectTo
			? `${resolve('/auth/login')}?redirectTo=${encodeURIComponent(redirectTo)}`
			: resolve('/auth/login')
	);
</script>

<svelte:head><title>{t('auth.signup.title')}</title></svelte:head>

{#if form?.checkEmail}
	<div>
		<h1 class="text-2xl font-semibold text-ink">{t('auth.signup.checkEmailHeading')}</h1>
		<p class="mt-2 text-sm text-ink/60">
			{t('auth.signup.checkEmailBody', { email: form.email })}
		</p>
	</div>
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a href={loginHref} class="font-medium text-ink underline-offset-2 hover:underline">
		{t('auth.signup.backToSignIn')}
	</a>
{:else}
	<div>
		<h1 class="text-2xl font-semibold text-ink">{t('auth.signup.createHeading')}</h1>
		<p class="mt-1 text-sm text-ink/60">{t('auth.signup.createSubtitle')}</p>
	</div>

	<form method="POST" use:enhance class="flex flex-col gap-4">
		<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
			{t('common.email')}
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
			{t('common.password')}
			<input
				name="password"
				type="password"
				autocomplete="new-password"
				required
				minlength="8"
				class="rounded-md border border-sage bg-white px-3 py-2 font-normal text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none"
			/>
			<span class="text-xs font-normal text-ink/45">{t('auth.signup.passwordHint')}</span>
		</label>

		{#if form?.error}
			<p class="text-sm text-red-600">{form.error}</p>
		{/if}

		<button
			type="submit"
			class="rounded-md bg-clay px-3 py-2 font-medium text-ink hover:bg-clay/80"
		>
			{t('auth.signup.createButton')}
		</button>
	</form>

	<p class="text-sm text-ink/60">
		{t('auth.signup.alreadyHaveAccount')}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href={loginHref} class="font-medium text-ink underline-offset-2 hover:underline"
			>{t('common.signIn')}</a
		>
	</p>
{/if}
