<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import MapThumbnail from '$lib/components/MapThumbnail.svelte';
	import { useI18n } from '$lib/i18n';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const t = useI18n().t;

	let creating = $state(false);
	let greeting = $derived(data.displayName || data.email.split('@')[0] || 'there');
</script>

<svelte:head><title>{t('dashboard.title')}</title></svelte:head>

<div class="flex flex-col gap-6">
	<div>
		<h1 class="text-2xl font-semibold text-ink">{t('dashboard.welcome', { name: greeting })}</h1>
		<p class="mt-1 text-sm text-ink/60">{t('dashboard.subtitle')}</p>
	</div>

	{#if data.pendingInvites > 0}
		<a
			href={resolve('/invitations')}
			class="flex items-center justify-between rounded-lg border border-clay bg-clay/20 px-4 py-3 text-sm text-ink hover:bg-clay/30"
		>
			<span>{t('dashboard.pending', { count: data.pendingInvites })}</span>
			<span class="font-medium">{t('dashboard.reviewLink')}</span>
		</a>
	{/if}

	{#if data.anniversaries.length > 0}
		<section class="rounded-lg border border-cream bg-cream/40 px-4 py-3">
			<h2 class="mb-1 text-xs font-medium tracking-wide text-ink/55 uppercase">
				{t('dashboard.onThisDay')}
			</h2>
			<ul class="flex flex-col gap-1 text-sm text-ink/80">
				{#each data.anniversaries as a (a.personId + a.kind)}
					<li>
						<a
							href={resolve('/trees/[treeId]/persons/[personId]', {
								treeId: a.treeId,
								personId: a.personId
							})}
							class="hover:text-ink hover:underline"
						>
							{#if a.kind === 'birth'}
								<span class="font-medium"
									>{t('dashboard.birthAnniversary', {
										name: a.name,
										years: a.years,
										year: a.year
									})}</span
								>
							{:else}
								<span class="font-medium"
									>{t('dashboard.deathAnniversary', {
										name: a.name,
										years: a.years,
										year: a.year
									})}</span
								>
							{/if}
							<span class="text-ink/45">{t('dashboard.treeDot', { treeName: a.treeName })}</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.trees as tree (tree.id)}
			<a
				href={resolve('/trees/[treeId]', { treeId: tree.id })}
				class="group flex flex-col overflow-hidden rounded-xl border border-sage bg-white transition hover:border-clay hover:shadow-sm"
			>
				<div class="h-24 w-full shrink-0">
					<MapThumbnail points={tree.points} />
				</div>
				<div class="flex flex-1 flex-col gap-2 p-4">
					<div class="flex items-start justify-between gap-2">
						<h2 class="font-semibold text-ink">{tree.name}</h2>
						<span
							class="shrink-0 rounded-full bg-sage/40 px-2 py-0.5 text-[10px] font-medium tracking-wide text-ink/70 uppercase"
						>
							{tree.role}
						</span>
					</div>
					{#if tree.avatars.length > 0}
						<div class="flex -space-x-2">
							{#each tree.avatars as src, i (i)}
								<img
									{src}
									alt=""
									class="h-7 w-7 rounded-md border-2 border-white object-cover shadow-sm"
								/>
							{/each}
						</div>
					{/if}
					<p class="text-xs text-ink/60">
						{t('dashboard.statPeople', { count: tree.peopleCount })}{#if tree.generations > 0}
							{t('dashboard.statGenerations', { count: tree.generations })}{/if}{t(
							'dashboard.statPlaces',
							{ count: tree.placeCount }
						)}{#if tree.yearSpan}
							· {tree.yearSpan.min}–{tree.yearSpan.max}{/if}
					</p>
					<span class="mt-auto text-sm font-medium text-clay">{t('dashboard.openTree')}</span>
				</div>
			</a>
		{/each}

		<!-- Quick actions card -->
		<div class="flex flex-col gap-3 rounded-xl border border-dashed border-sage bg-paper p-4">
			<h2 class="text-sm font-medium text-ink/80">{t('dashboard.quickActions')}</h2>
			{#if creating}
				<form method="POST" action="?/create" use:enhance class="flex flex-col gap-2">
					<!-- svelte-ignore a11y_autofocus -->
					<input
						name="name"
						type="text"
						autofocus
						placeholder={t('dashboard.treeNamePlaceholder')}
						class="rounded-md border border-sage bg-white px-3 py-2 text-sm text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none"
					/>
					{#if form?.error}<p class="text-xs text-red-600">{form.error}</p>{/if}
					<div class="flex gap-2">
						<button
							type="submit"
							class="rounded-md bg-clay px-3 py-1.5 text-sm font-medium text-ink hover:bg-clay/80"
						>
							{t('common.create')}
						</button>
						<button
							type="button"
							onclick={() => (creating = false)}
							class="rounded-md border border-sage px-3 py-1.5 text-sm text-ink/70 hover:bg-cream"
						>
							{t('common.cancel')}
						</button>
					</div>
				</form>
			{:else}
				<button
					type="button"
					onclick={() => (creating = true)}
					class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink/80 hover:bg-cream"
				>
					<span class="text-lg leading-none text-clay">+</span>
					{t('dashboard.newTree')}
				</button>
			{/if}
			<a
				href={resolve('/import')}
				class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink/80 hover:bg-cream"
			>
				<span class="text-lg leading-none">⤓</span>
				{t('dashboard.importGedcom')}
			</a>
		</div>
	</div>

	{#if data.trees.length === 0}
		<p class="rounded-lg border border-dashed border-sage px-4 py-8 text-center text-ink/55">
			{t('dashboard.noTrees')}
		</p>
	{/if}
</div>
