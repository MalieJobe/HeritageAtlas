<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { useI18n, LOCALES, LOCALE_LABELS } from '$lib/i18n';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const i18n = useI18n();
	const t = i18n.t;

	let displayName = $derived(form?.displayName ?? data.displayName);
	let confirmingDelete = $state(false);

	const inputClass =
		'rounded-md border border-sage bg-white px-3 py-2 text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none';
</script>

<svelte:head><title>{t('account.title')}</title></svelte:head>

<div class="mx-auto flex w-full max-w-md flex-col gap-8">
	<div>
		<h1 class="text-2xl font-semibold text-ink">{t('account.heading')}</h1>
		<p class="mt-1 text-sm text-ink/60">{t('account.subtitle')}</p>
	</div>

	<div class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-ink/80">{t('common.email')}</span>
		<span class="text-ink/60">{data.email}</span>
	</div>

	<!-- Language -->
	<form method="POST" action="?/setLocale" use:enhance class="flex flex-col gap-3">
		<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
			{t('account.language')}
			<select
				name="locale"
				value={i18n.locale}
				onchange={(e) => {
					const next = e.currentTarget.value;
					if (next === 'en' || next === 'de') i18n.setLocale(next);
					e.currentTarget.form?.requestSubmit();
				}}
				class="{inputClass} font-normal"
			>
				{#each LOCALES as code (code)}
					<option value={code}>{LOCALE_LABELS[code]}</option>
				{/each}
			</select>
		</label>
	</form>

	<!-- Display name -->
	<form method="POST" action="?/updateProfile" use:enhance class="flex flex-col gap-3">
		<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
			{t('account.displayName')}
			<input
				name="displayName"
				type="text"
				value={displayName}
				placeholder={t('account.displayNamePlaceholder')}
				class="{inputClass} font-normal"
			/>
		</label>
		{#if form?.error}
			<p class="text-sm text-red-600">{form.error}</p>
		{:else if form?.success}
			<p class="text-sm text-green-700">{t('common.saved')}</p>
		{/if}
		<button
			type="submit"
			class="self-start rounded-md bg-clay px-4 py-2 font-medium text-ink hover:bg-clay/80"
		>
			{t('common.save')}
		</button>
	</form>

	<!-- Password -->
	<form method="POST" action="?/changePassword" use:enhance class="flex flex-col gap-3">
		<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
			{t('account.changePassword')}
			<input
				name="password"
				type="password"
				autocomplete="new-password"
				placeholder={t('account.newPasswordPlaceholder')}
				class="{inputClass} font-normal"
			/>
		</label>
		{#if form?.passwordError}
			<p class="text-sm text-red-600">{form.passwordError}</p>
		{:else if form?.passwordChanged}
			<p class="text-sm text-green-700">{t('account.passwordUpdated')}</p>
		{/if}
		<button
			type="submit"
			class="self-start rounded-md bg-clay px-4 py-2 font-medium text-ink hover:bg-clay/80"
		>
			{t('account.updatePassword')}
		</button>
	</form>

	<!-- Sign out -->
	<form method="POST" action={resolve('/auth/logout')}>
		<button
			type="submit"
			class="rounded-md border border-sage px-4 py-2 text-sm font-medium text-ink/80 hover:bg-cream"
		>
			{t('common.signOut')}
		</button>
	</form>

	<!-- Danger zone -->
	<section class="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50/50 p-4">
		<h2 class="text-sm font-medium text-red-700">{t('account.deleteHeading')}</h2>
		<p class="text-sm text-ink/60">{t('account.deleteWarning')}</p>
		{#if form?.deleteError}<p class="text-sm text-red-600">{form.deleteError}</p>{/if}
		{#if confirmingDelete}
			<form method="POST" action="?/deleteAccount" use:enhance class="flex items-center gap-2">
				<button
					type="submit"
					class="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
				>
					{t('account.confirmDelete')}
				</button>
				<button
					type="button"
					onclick={() => (confirmingDelete = false)}
					class="rounded-md border border-sage px-3 py-1.5 text-sm text-ink/70 hover:bg-cream"
				>
					{t('common.cancel')}
				</button>
			</form>
		{:else}
			<button
				type="button"
				onclick={() => (confirmingDelete = true)}
				class="self-start rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
			>
				{t('account.deleteButton')}
			</button>
		{/if}
	</section>
</div>
