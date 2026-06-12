<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { useI18n } from '$lib/i18n';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const t = useI18n().t;
</script>

<svelte:head><title>{t('tree.list.title')}</title></svelte:head>

<div class="flex flex-col gap-8">
	<div class="flex flex-col gap-1">
		<h1 class="text-2xl font-semibold text-ink">{t('tree.list.heading')}</h1>
		<p class="text-sm text-ink/60">{t('tree.list.subtitle')}</p>
	</div>

	{#if data.pendingInvites > 0}
		<a
			href={resolve('/invitations')}
			class="flex items-center justify-between rounded-lg border border-clay bg-clay/20 px-4 py-3 text-sm text-ink hover:bg-clay/30"
		>
			<span>{t('tree.list.pendingInvites', { count: data.pendingInvites })}</span>
			<span class="font-medium">{t('tree.list.reviewInvites')}</span>
		</a>
	{/if}

	{#if data.trees.length > 0}
		<ul class="flex flex-col gap-2">
			{#each data.trees as tree (tree.id)}
				<li>
					<a
						href={resolve('/trees/[treeId]', { treeId: tree.id })}
						class="flex items-center justify-between rounded-lg border border-sage bg-white px-4 py-3 hover:bg-cream"
					>
						<span class="font-medium text-ink">{tree.name}</span>
						<span
							class="rounded-full bg-sage/40 px-2 py-0.5 text-xs font-medium tracking-wide text-ink/70 uppercase"
						>
							{tree.role}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="rounded-lg border border-dashed border-sage px-4 py-8 text-center text-ink/55">
			{t('tree.list.empty')}
		</p>
	{/if}

	<form
		method="POST"
		action="?/create"
		use:enhance
		class="flex flex-col gap-2 border-t border-sage pt-6"
	>
		<h2 class="text-sm font-medium text-ink/80">{t('tree.list.createHeading')}</h2>
		<div class="flex gap-2">
			<input
				name="name"
				type="text"
				required
				placeholder={t('tree.list.namePlaceholder')}
				value={form?.name ?? ''}
				class="flex-1 rounded-md border border-sage bg-white px-3 py-2 text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none"
			/>
			<button
				type="submit"
				class="rounded-md bg-clay px-4 py-2 font-medium text-ink hover:bg-clay/80"
			>
				{t('tree.list.createButton')}
			</button>
		</div>
		{#if form?.error}
			<p class="text-sm text-red-600">{form.error}</p>
		{/if}
	</form>
</div>
