<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { toasts } from '$lib/toast.svelte';
	import { useI18n } from '$lib/i18n';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const t = useI18n().t;

	let confirmingDelete = $state(false);

	function memberLabel(member: PageData['members'][number]): string {
		return member.displayName ?? t('tree.settings.unnamedMember');
	}

	// Public share link.
	let shareUrl = $derived(data.shareToken ? `${page.url.origin}/share/${data.shareToken}` : null);
	let copied = $state(false);
	async function copyShareUrl() {
		if (!shareUrl) return;
		try {
			await navigator.clipboard.writeText(shareUrl);
			copied = true;
			toasts.success(t('tree.settings.linkCopied'));
			setTimeout(() => (copied = false), 1500);
		} catch {
			toasts.error(t('tree.settings.copyFailed'));
		}
	}
</script>

<svelte:head><title>{t('tree.settings.title', { name: data.tree.name })}</title></svelte:head>

<div class="flex flex-col gap-8">
	<div class="flex flex-col gap-1">
		<a
			href={resolve('/trees/[treeId]', { treeId: data.tree.id })}
			class="text-sm text-ink/60 hover:text-ink"
		>
			{t('tree.settings.backTo', { name: data.tree.name })}
		</a>
		<h1 class="text-2xl font-semibold text-ink">{t('tree.settings.heading')}</h1>
	</div>

	<!-- Name (rename is owner-only) -->
	<section class="flex flex-col gap-2">
		<h2 class="text-sm font-medium text-ink/80">{t('tree.settings.nameSection')}</h2>
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
					{t('tree.settings.renameButton')}
				</button>
			</form>
			{#if form?.renameError}
				<p class="text-sm text-red-600">{form.renameError}</p>
			{:else if form?.renamed}
				<p class="text-sm text-green-700">{t('tree.settings.renamed')}</p>
			{/if}
		{:else}
			<p class="text-ink">{data.tree.name}</p>
		{/if}
	</section>

	<!-- Members -->
	<section class="flex flex-col gap-2">
		<h2 class="text-sm font-medium text-ink/80">{t('tree.settings.membersSection')}</h2>
		<ul class="flex flex-col divide-y divide-sage/40 rounded-lg border border-sage bg-white">
			{#each data.members as member (member.userId)}
				<li class="flex items-center justify-between gap-3 px-4 py-3">
					<span class="min-w-0 truncate text-ink">
						{memberLabel(member)}
						{#if member.isYou}<span class="text-ink/40">{t('tree.settings.you')}</span>{/if}
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
									<option value="editor">{t('tree.settings.roleEditor')}</option>
									<option value="viewer">{t('tree.settings.roleViewer')}</option>
								</select>
							</form>
							<form method="POST" action="?/removeMember" use:enhance>
								<input type="hidden" name="userId" value={member.userId} />
								<button
									type="submit"
									class="rounded-md border border-sage px-2 py-1 text-xs text-ink/60 hover:bg-cream hover:text-red-600"
								>
									{t('tree.settings.removeButton')}
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

	<!-- Public share link (owner only) -->
	{#if data.isOwner}
		<section class="flex flex-col gap-3">
			<div class="flex flex-col gap-0.5">
				<h2 class="text-sm font-medium text-ink/80">{t('tree.settings.shareSection')}</h2>
				<p class="text-xs text-ink/45">
					{t('tree.settings.shareDesc')}
				</p>
			</div>

			{#if data.shareToken}
				<div class="flex flex-col gap-2 rounded-lg border border-sage bg-white p-3">
					<div class="flex items-center gap-2">
						<input
							readonly
							value={shareUrl}
							class="min-w-0 flex-1 rounded-md border border-sage bg-cream/40 px-2 py-1.5 text-sm text-ink"
						/>
						<button
							type="button"
							onclick={copyShareUrl}
							class="shrink-0 rounded-md border border-sage px-3 py-1.5 text-sm text-ink hover:bg-cream"
						>
							{copied ? t('tree.settings.copiedButton') : t('tree.settings.copyButton')}
						</button>
					</div>
					<div class="flex flex-wrap items-end gap-2">
						<form method="POST" action="?/share" use:enhance class="flex items-end gap-2">
							<label class="flex flex-col gap-1 text-xs font-medium text-ink/60">
								{t('tree.settings.resetPasswordLabel')}
								<input
									name="password"
									type="password"
									minlength="4"
									required
									placeholder={t('tree.settings.newPasswordPlaceholder')}
									class="rounded-md border border-sage bg-white px-2 py-1.5 text-sm text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none"
								/>
							</label>
							<button
								type="submit"
								class="rounded-md border border-sage px-3 py-1.5 text-sm text-ink hover:bg-cream"
							>
								{t('tree.settings.updateButton')}
							</button>
						</form>
						<form method="POST" action="?/unshare" use:enhance>
							<button
								type="submit"
								class="rounded-md border border-sage px-3 py-1.5 text-sm text-ink/70 hover:bg-cream hover:text-red-600"
							>
								{t('tree.settings.stopSharingButton')}
							</button>
						</form>
					</div>
				</div>
			{:else}
				<form method="POST" action="?/share" use:enhance class="flex flex-wrap items-end gap-2">
					<label class="flex flex-col gap-1 text-xs font-medium text-ink/60">
						{t('tree.settings.passwordLabel')}
						<input
							name="password"
							type="password"
							minlength="4"
							required
							placeholder={t('tree.settings.passwordPlaceholder')}
							class="rounded-md border border-sage bg-white px-3 py-2 text-sm text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none"
						/>
					</label>
					<button
						type="submit"
						class="rounded-md bg-clay px-4 py-2 text-sm font-medium text-ink hover:bg-clay/80"
					>
						{t('tree.settings.createShareButton')}
					</button>
				</form>
			{/if}
			{#if form?.shareError}<p class="text-sm text-red-600">{form.shareError}</p>{/if}
		</section>
	{/if}

	<!-- Export -->
	<section class="flex flex-col gap-2">
		<div class="flex flex-col gap-0.5">
			<h2 class="text-sm font-medium text-ink/80">{t('tree.settings.exportSection')}</h2>
			<p class="text-xs text-ink/45">
				{t('tree.settings.exportDesc')}
			</p>
		</div>
		<a
			href={resolve('/trees/[treeId]/export', { treeId: data.tree.id })}
			download
			class="inline-flex w-fit items-center gap-2 rounded-md border border-sage bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-cream"
		>
			{t('tree.settings.exportButton')}
		</a>
	</section>

	<!-- Invite (owner only) -->
	{#if data.isOwner}
		<section class="flex flex-col gap-3">
			<div class="flex flex-col gap-0.5">
				<h2 class="text-sm font-medium text-ink/80">{t('tree.settings.inviteSection')}</h2>
				<p class="text-xs text-ink/45">
					{t('tree.settings.inviteDesc')}
				</p>
			</div>

			<form method="POST" action="?/invite" use:enhance class="flex flex-wrap gap-2">
				<input
					name="email"
					type="email"
					required
					placeholder={t('tree.settings.inviteEmailPlaceholder')}
					value={form && 'email' in form ? (form.email ?? '') : ''}
					class="min-w-56 flex-1 rounded-md border border-sage bg-white px-3 py-2 text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none"
				/>
				<select
					name="role"
					class="rounded-md border border-sage bg-white px-3 py-2 text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none"
				>
					<option value="viewer">{t('tree.settings.inviteRoleViewer')}</option>
					<option value="editor">{t('tree.settings.inviteRoleEditor')}</option>
				</select>
				<button
					type="submit"
					class="rounded-md bg-clay px-4 py-2 font-medium text-ink hover:bg-clay/80"
				>
					{t('tree.settings.inviteButton')}
				</button>
			</form>

			{#if form?.inviteError}
				<p class="text-sm text-red-600">{form.inviteError}</p>
			{:else if form?.invited}
				<p class="text-sm text-green-700">{t('tree.settings.invited', { email: form.invited })}</p>
			{:else if form?.revoked}
				<p class="text-sm text-green-700">{t('tree.settings.revoked')}</p>
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
										{t('tree.settings.revokeButton')}
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
			<h2 class="text-sm font-medium text-red-700">{t('tree.settings.deleteSection')}</h2>
			<p class="text-sm text-ink/60">
				{t('tree.settings.deleteWarning')}
			</p>
			{#if form?.deleteError}
				<p class="text-sm text-red-600">{form.deleteError}</p>
			{/if}
			{#if confirmingDelete}
				<form method="POST" action="?/delete" use:enhance class="flex items-center gap-2">
					<span class="text-sm text-ink/80">{t('tree.settings.deleteConfirmQuestion')}</span>
					<button
						type="submit"
						class="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
					>
						{t('tree.settings.deleteConfirmButton')}
					</button>
					<button
						type="button"
						onclick={() => (confirmingDelete = false)}
						class="rounded-md border border-sage px-3 py-1.5 text-sm font-medium text-ink/80 hover:bg-cream"
					>
						{t('common.cancel')}
					</button>
				</form>
			{:else}
				<button
					type="button"
					onclick={() => (confirmingDelete = true)}
					class="self-start rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
				>
					{t('tree.settings.deleteButton')}
				</button>
			{/if}
		</section>
	{/if}
</div>
