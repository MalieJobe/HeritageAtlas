<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Your trees · HeritageAtlas</title></svelte:head>

<div class="flex flex-col gap-8">
	<div class="flex flex-col gap-1">
		<h1 class="text-2xl font-semibold text-stone-800">Your trees</h1>
		<p class="text-sm text-stone-500">Family trees you own or have been invited to.</p>
	</div>

	{#if data.pendingInvites > 0}
		<a
			href={resolve('/invitations')}
			class="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 hover:bg-amber-100"
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
						class="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-3 hover:border-stone-300 hover:bg-stone-50"
					>
						<span class="font-medium text-stone-800">{tree.name}</span>
						<span
							class="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium tracking-wide text-stone-500 uppercase"
						>
							{tree.role}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<p
			class="rounded-lg border border-dashed border-stone-300 px-4 py-8 text-center text-stone-500"
		>
			No trees yet. Create your first one below.
		</p>
	{/if}

	<form
		method="POST"
		action="?/create"
		use:enhance
		class="flex flex-col gap-2 border-t border-stone-200 pt-6"
	>
		<h2 class="text-sm font-medium text-stone-700">Create a new tree</h2>
		<div class="flex gap-2">
			<input
				name="name"
				type="text"
				required
				placeholder="e.g. The Müller Family"
				value={form?.name ?? ''}
				class="flex-1 rounded-md border border-stone-300 px-3 py-2 text-stone-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
			/>
			<button
				type="submit"
				class="rounded-md bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700"
			>
				Create
			</button>
		</div>
		{#if form?.error}
			<p class="text-sm text-red-600">{form.error}</p>
		{/if}
	</form>
</div>
