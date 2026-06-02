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

	<!-- Name (rename is owner-only) -->
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
			{#if form?.renameError}
				<p class="text-sm text-red-600">{form.renameError}</p>
			{:else if form?.renamed}
				<p class="text-sm text-green-600">Tree renamed.</p>
			{/if}
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

	<!-- Invite (owner only) -->
	{#if data.isOwner}
		<section class="flex flex-col gap-3">
			<div class="flex flex-col gap-0.5">
				<h2 class="text-sm font-medium text-stone-700">Invite a member</h2>
				<p class="text-xs text-stone-400">
					The invitation appears in HeritageAtlas when they sign in with this email (no email is
					sent yet).
				</p>
			</div>

			<form method="POST" action="?/invite" use:enhance class="flex flex-wrap gap-2">
				<input
					name="email"
					type="email"
					required
					placeholder="name@example.com"
					value={form && 'email' in form ? (form.email ?? '') : ''}
					class="min-w-56 flex-1 rounded-md border border-stone-300 px-3 py-2 text-stone-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
				/>
				<select
					name="role"
					class="rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
				>
					<option value="viewer">Viewer</option>
					<option value="editor">Editor</option>
				</select>
				<button
					type="submit"
					class="rounded-md bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700"
				>
					Invite
				</button>
			</form>

			{#if form?.inviteError}
				<p class="text-sm text-red-600">{form.inviteError}</p>
			{:else if form?.invited}
				<p class="text-sm text-green-600">Invited {form.invited}.</p>
			{:else if form?.revoked}
				<p class="text-sm text-green-600">Invitation revoked.</p>
			{/if}

			{#if data.invitations.length > 0}
				<ul
					class="flex flex-col divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white"
				>
					{#each data.invitations as invite (invite.id)}
						<li class="flex items-center justify-between gap-2 px-4 py-3">
							<span class="text-stone-800">{invite.email}</span>
							<div class="flex items-center gap-3">
								<span
									class="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium tracking-wide text-stone-500 uppercase"
								>
									{invite.role}
								</span>
								<form method="POST" action="?/revoke" use:enhance>
									<input type="hidden" name="invitationId" value={invite.id} />
									<button type="submit" class="text-sm text-stone-400 hover:text-red-600">
										Revoke
									</button>
								</form>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}

	<!-- Danger zone (owner only) -->
	{#if data.isOwner}
		<section class="flex flex-col gap-2 border-t border-stone-200 pt-6">
			<h2 class="text-sm font-medium text-red-700">Delete tree</h2>
			<p class="text-sm text-stone-500">
				Permanently deletes this tree and everyone, every relationship, and every event in it. This
				cannot be undone.
			</p>
			{#if form?.deleteError}
				<p class="text-sm text-red-600">{form.deleteError}</p>
			{/if}
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
