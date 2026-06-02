<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Invitations · HeritageAtlas</title></svelte:head>

<div class="flex flex-col gap-6">
	<div class="flex flex-col gap-1">
		<a href={resolve('/trees')} class="text-sm text-stone-500 hover:text-stone-700">← Your trees</a>
		<h1 class="text-2xl font-semibold text-stone-800">Invitations</h1>
	</div>

	{#if form?.error}
		<p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{form.error}</p>
	{/if}

	{#if data.invitations.length > 0}
		<ul class="flex flex-col gap-2">
			{#each data.invitations as invite (invite.id)}
				<li
					class="flex items-center justify-between gap-4 rounded-lg border border-stone-200 bg-white px-4 py-3"
				>
					<div class="flex flex-col">
						<span class="font-medium text-stone-800">{invite.tree_name}</span>
						<span class="text-xs tracking-wide text-stone-400 uppercase">as {invite.role}</span>
					</div>
					<div class="flex items-center gap-2">
						<form method="POST" action="?/accept" use:enhance>
							<input type="hidden" name="invitationId" value={invite.id} />
							<button
								type="submit"
								class="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
							>
								Accept
							</button>
						</form>
						<form method="POST" action="?/decline" use:enhance>
							<input type="hidden" name="invitationId" value={invite.id} />
							<button
								type="submit"
								class="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
							>
								Decline
							</button>
						</form>
					</div>
				</li>
			{/each}
		</ul>
	{:else}
		<p
			class="rounded-lg border border-dashed border-stone-300 px-4 py-8 text-center text-stone-500"
		>
			You have no pending invitations.
		</p>
	{/if}
</div>
