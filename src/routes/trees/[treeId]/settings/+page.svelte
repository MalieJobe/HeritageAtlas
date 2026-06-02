<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let confirmingDelete = $state(false);

	function memberLabel(member: PageData['members'][number]): string {
		return member.displayName ?? 'Unnamed member';
	}
</script>

<svelte:head><title>Settings · {data.tree.name} · HeritageAtlas</title></svelte:head>

<div class="flex flex-col gap-8">
	<div class="flex flex-col gap-1">
		<a
			href={resolve('/trees/[treeId]', { treeId: data.tree.id })}
			class="text-sm text-stone-500 hover:text-stone-700"
		>
			← {data.tree.name}
		</a>
		<h1 class="text-2xl font-semibold text-stone-800">Tree settings</h1>
	</div>

	{#if form?.error}
		<p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{form.error}</p>
	{:else if form?.renamed}
		<p class="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">Tree renamed.</p>
	{/if}

	<!-- Rename (owner only) -->
	<section class="flex flex-col gap-2">
		<h2 class="text-sm font-medium text-stone-700">Name</h2>
		{#if data.isOwner}
			<form method="POST" action="?/rename" use:enhance class="flex gap-2">
				<input
					name="name"
					type="text"
					required
					value={data.tree.name}
					class="flex-1 rounded-md border border-stone-300 px-3 py-2 text-stone-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
				/>
				<button
					type="submit"
					class="rounded-md bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700"
				>
					Rename
				</button>
			</form>
		{:else}
			<p class="text-stone-800">{data.tree.name}</p>
		{/if}
	</section>

	<!-- Members -->
	<section class="flex flex-col gap-2">
		<h2 class="text-sm font-medium text-stone-700">Members</h2>
		<ul class="flex flex-col divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
			{#each data.members as member (member.userId)}
				<li class="flex items-center justify-between px-4 py-3">
					<span class="text-stone-800">
						{memberLabel(member)}
						{#if member.isYou}<span class="text-stone-400">(you)</span>{/if}
					</span>
					<span
						class="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium tracking-wide text-stone-500 uppercase"
					>
						{member.role}
					</span>
				</li>
			{/each}
		</ul>
	</section>

	<!-- Danger zone (owner only) -->
	{#if data.isOwner}
		<section class="flex flex-col gap-2 border-t border-stone-200 pt-6">
			<h2 class="text-sm font-medium text-red-700">Delete tree</h2>
			<p class="text-sm text-stone-500">
				Permanently deletes this tree and everyone, every relationship, and every event in it. This
				cannot be undone.
			</p>
			{#if confirmingDelete}
				<form method="POST" action="?/delete" use:enhance class="flex items-center gap-2">
					<span class="text-sm text-stone-700">Are you sure?</span>
					<button
						type="submit"
						class="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
					>
						Yes, delete it
					</button>
					<button
						type="button"
						onclick={() => (confirmingDelete = false)}
						class="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
					>
						Cancel
					</button>
				</form>
			{:else}
				<button
					type="button"
					onclick={() => (confirmingDelete = true)}
					class="self-start rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
				>
					Delete this tree
				</button>
			{/if}
		</section>
	{/if}
</div>
