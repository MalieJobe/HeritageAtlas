<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Invitations · HeritageAtlas</title></svelte:head>

<div class="flex flex-col gap-6">
	<div class="flex flex-col gap-1">
		<a href={resolve('/trees')} class="text-sm text-ink/60 hover:text-ink">← Your trees</a>
		<h1 class="text-2xl font-semibold text-ink">Invitations</h1>
	</div>

	{#if form?.error}
		<p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{form.error}</p>
	{/if}

	{#if data.invitations.length > 0}
		<ul class="flex flex-col gap-2">
			{#each data.invitations as invite (invite.id)}
				<li
					class="flex items-center justify-between gap-4 rounded-lg border border-sage bg-white px-4 py-3"
				>
					<div class="flex flex-col">
						<span class="font-medium text-ink">{invite.tree_name}</span>
						<span class="text-xs tracking-wide text-ink/45 uppercase">as {invite.role}</span>
					</div>
					<div class="flex items-center gap-2">
						<form method="POST" action="?/accept" use:enhance>
							<input type="hidden" name="invitationId" value={invite.id} />
							<button
								type="submit"
								class="rounded-md bg-clay px-3 py-1.5 text-sm font-medium text-ink hover:bg-clay/80"
							>
								Accept
							</button>
						</form>
						<form method="POST" action="?/decline" use:enhance>
							<input type="hidden" name="invitationId" value={invite.id} />
							<button
								type="submit"
								class="rounded-md border border-sage px-3 py-1.5 text-sm font-medium text-ink/80 hover:bg-cream"
							>
								Decline
							</button>
						</form>
					</div>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="rounded-lg border border-dashed border-sage px-4 py-8 text-center text-ink/55">
			You have no pending invitations.
		</p>
	{/if}
</div>
