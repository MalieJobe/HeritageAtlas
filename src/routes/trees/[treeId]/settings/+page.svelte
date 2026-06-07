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
			class="text-sm text-ink/60 hover:text-ink"
		>
			← {data.tree.name}
		</a>
		<h1 class="text-2xl font-semibold text-ink">Tree settings</h1>
	</div>

	<!-- Name (rename is owner-only) -->
	<section class="flex flex-col gap-2">
		<h2 class="text-sm font-medium text-ink/80">Name</h2>
		{#if data.isOwner}
			<form method="POST" action="?/rename" use:enhance class="flex gap-2">
				<input
					name="name"
					type="text"
					required
					value={data.tree.name}
					class="flex-1 rounded-md border border-sage bg-white px-3 py-2 text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none"
				/>
				<button
					type="submit"
					class="rounded-md bg-clay px-4 py-2 font-medium text-ink hover:bg-clay/80"
				>
					Rename
				</button>
			</form>
			{#if form?.renameError}
				<p class="text-sm text-red-600">{form.renameError}</p>
			{:else if form?.renamed}
				<p class="text-sm text-green-700">Tree renamed.</p>
			{/if}
		{:else}
			<p class="text-ink">{data.tree.name}</p>
		{/if}
	</section>

	<!-- Members -->
	<section class="flex flex-col gap-2">
		<h2 class="text-sm font-medium text-ink/80">Members</h2>
		<ul class="flex flex-col divide-y divide-sage/40 rounded-lg border border-sage bg-white">
			{#each data.members as member (member.userId)}
				<li class="flex items-center justify-between gap-3 px-4 py-3">
					<span class="min-w-0 truncate text-ink">
						{memberLabel(member)}
						{#if member.isYou}<span class="text-ink/40">(you)</span>{/if}
					</span>
					{#if data.isOwner && member.role !== 'owner'}
						<div class="flex shrink-0 items-center gap-2">
							<form method="POST" action="?/setRole" use:enhance>
								<input type="hidden" name="userId" value={member.userId} />
								<select
									name="role"
									value={member.role}
									onchange={(e) => e.currentTarget.form?.requestSubmit()}
									class="rounded-md border border-sage bg-white px-2 py-1 text-xs text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none"
								>
									<option value="editor">editor</option>
									<option value="viewer">viewer</option>
								</select>
							</form>
							<form method="POST" action="?/removeMember" use:enhance>
								<input type="hidden" name="userId" value={member.userId} />
								<button
									type="submit"
									class="rounded-md border border-sage px-2 py-1 text-xs text-ink/60 hover:bg-cream hover:text-red-600"
								>
									Remove
								</button>
							</form>
						</div>
					{:else}
						<span
							class="shrink-0 rounded-full bg-sage/40 px-2 py-0.5 text-xs font-medium tracking-wide text-ink/70 uppercase"
						>
							{member.role}
						</span>
					{/if}
				</li>
			{/each}
		</ul>
		{#if form?.memberError}<p class="text-sm text-red-600">{form.memberError}</p>{/if}
	</section>

	<!-- Export -->
	<section class="flex flex-col gap-2">
		<div class="flex flex-col gap-0.5">
			<h2 class="text-sm font-medium text-ink/80">Export</h2>
			<p class="text-xs text-ink/45">
				Download this tree as a GEDCOM 5.5.1 file you can open in other genealogy software.
			</p>
		</div>
		<a
			href={resolve('/trees/[treeId]/export', { treeId: data.tree.id })}
			download
			class="inline-flex w-fit items-center gap-2 rounded-md border border-sage bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-cream"
		>
			<span class="leading-none">⤓</span> Export GEDCOM
		</a>
	</section>

	<!-- Invite (owner only) -->
	{#if data.isOwner}
		<section class="flex flex-col gap-3">
			<div class="flex flex-col gap-0.5">
				<h2 class="text-sm font-medium text-ink/80">Invite a member</h2>
				<p class="text-xs text-ink/45">
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
					class="min-w-56 flex-1 rounded-md border border-sage bg-white px-3 py-2 text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none"
				/>
				<select
					name="role"
					class="rounded-md border border-sage bg-white px-3 py-2 text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none"
				>
					<option value="viewer">Viewer</option>
					<option value="editor">Editor</option>
				</select>
				<button
					type="submit"
					class="rounded-md bg-clay px-4 py-2 font-medium text-ink hover:bg-clay/80"
				>
					Invite
				</button>
			</form>

			{#if form?.inviteError}
				<p class="text-sm text-red-600">{form.inviteError}</p>
			{:else if form?.invited}
				<p class="text-sm text-green-700">Invited {form.invited}.</p>
			{:else if form?.revoked}
				<p class="text-sm text-green-700">Invitation revoked.</p>
			{/if}

			{#if data.invitations.length > 0}
				<ul class="flex flex-col divide-y divide-sage/40 rounded-lg border border-sage bg-white">
					{#each data.invitations as invite (invite.id)}
						<li class="flex items-center justify-between gap-2 px-4 py-3">
							<span class="text-ink">{invite.email}</span>
							<div class="flex items-center gap-3">
								<span
									class="rounded-full bg-sage/40 px-2 py-0.5 text-xs font-medium tracking-wide text-ink/70 uppercase"
								>
									{invite.role}
								</span>
								<form method="POST" action="?/revoke" use:enhance>
									<input type="hidden" name="invitationId" value={invite.id} />
									<button type="submit" class="text-sm text-ink/40 hover:text-red-600">
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
		<section class="flex flex-col gap-2 border-t border-sage pt-6">
			<h2 class="text-sm font-medium text-red-700">Delete tree</h2>
			<p class="text-sm text-ink/60">
				Permanently deletes this tree and everyone, every relationship, and every event in it. This
				cannot be undone.
			</p>
			{#if form?.deleteError}
				<p class="text-sm text-red-600">{form.deleteError}</p>
			{/if}
			{#if confirmingDelete}
				<form method="POST" action="?/delete" use:enhance class="flex items-center gap-2">
					<span class="text-sm text-ink/80">Are you sure?</span>
					<button
						type="submit"
						class="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
					>
						Yes, delete it
					</button>
					<button
						type="button"
						onclick={() => (confirmingDelete = false)}
						class="rounded-md border border-sage px-3 py-1.5 text-sm font-medium text-ink/80 hover:bg-cream"
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
