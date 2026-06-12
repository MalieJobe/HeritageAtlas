<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { useI18n } from '$lib/i18n';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const t = useI18n().t;

	const inputClass =
		'rounded-md border border-sage bg-white px-3 py-2 text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none';
</script>

<svelte:head><title>{t('person.newTitle', { treeName: data.tree.name })}</title></svelte:head>

<div class="mx-auto flex w-full max-w-lg flex-col gap-6">
	<div class="flex flex-col gap-1">
		<a
			href={resolve('/trees/[treeId]', { treeId: data.tree.id })}
			class="text-sm text-ink/60 hover:text-ink"
		>
			{t('person.backToTree', { treeName: data.tree.name })}
		</a>
		<h1 class="text-2xl font-semibold text-ink">{t('person.addPerson')}</h1>
	</div>

	<form method="POST" use:enhance class="flex flex-col gap-4">
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
				{t('common.givenNames')}
				<input name="given_names" type="text" value={form?.given_names ?? ''} class={inputClass} />
			</label>
			<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
				{t('common.surname')}
				<input name="surname" type="text" value={form?.surname ?? ''} class={inputClass} />
			</label>
			<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
				{t('common.birthSurname')}
				<input
					name="birth_surname"
					type="text"
					value={form?.birth_surname ?? ''}
					class={inputClass}
				/>
			</label>
			<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
				{t('common.nickname')}
				<input name="nickname" type="text" value={form?.nickname ?? ''} class={inputClass} />
			</label>
		</div>

		<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
			{t('common.sex')}
			<select name="sex" class={inputClass}>
				<option value="" selected={!form?.sex}>{t('common.sexUnspecified')}</option>
				<option value="female" selected={form?.sex === 'female'}>{t('common.sexFemale')}</option>
				<option value="male" selected={form?.sex === 'male'}>{t('common.sexMale')}</option>
				<option value="other" selected={form?.sex === 'other'}>{t('common.sexOther')}</option>
			</select>
		</label>

		<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
			{t('common.notes')}
			<textarea name="notes" rows="4" class={inputClass}>{form?.notes ?? ''}</textarea>
		</label>

		{#if form?.error}
			<p class="text-sm text-red-600">{form.error}</p>
		{/if}

		<div class="flex gap-2">
			<button
				type="submit"
				class="rounded-md bg-clay px-4 py-2 font-medium text-ink hover:bg-clay/80"
			>
				{t('person.addPersonButton')}
			</button>
			<a
				href={resolve('/trees/[treeId]', { treeId: data.tree.id })}
				class="rounded-md border border-sage px-4 py-2 font-medium text-ink/80 hover:bg-cream"
			>
				{t('common.cancel')}
			</a>
		</div>
	</form>
</div>
