<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Your trees · HeritageAtlas</title></svelte:head>

<div class="flex flex-col gap-8">
	<div class="flex flex-col gap-1">
		<h1 class="text-2xl font-semibold text-ink">Your trees</h1>
		<p class="text-sm text-ink/60">Family trees you own or have been invited to.</p>
	</div>

	{#if data.pendingInvites > 0}
		<a
			href={resolve('/invitations')}
			class="flex items-center justify-between rounded-lg border border-clay bg-clay/20 px-4 py-3 text-sm text-ink hover:bg-clay/30"
		>
			<span>
				You have {data.pendingInvites} pending
				{data.pendingInvites === 1 ? 'invitation' : 'invitations'}.
			</span>
			<span class="font-medium">Review →</span>
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
			No trees yet. Create your first one below.
		</p>
	{/if}

	<form
		method="POST"
		action="?/create"
		use:enhance
		class="flex flex-col gap-2 border-t border-sage pt-6"
	>
		<h2 class="text-sm font-medium text-ink/80">Create a new tree</h2>
		<div class="flex gap-2">
			<input
				name="name"
				type="text"
				required
				placeholder="e.g. The Müller Family"
				value={form?.name ?? ''}
				class="flex-1 rounded-md border border-sage bg-white px-3 py-2 text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none"
			/>
			<button
				type="submit"
				class="rounded-md bg-clay px-4 py-2 font-medium text-ink hover:bg-clay/80"
			>
				Create
			</button>
		</div>
		{#if form?.error}
			<p class="text-sm text-red-600">{form.error}</p>
		{/if}
	</form>
</div>
