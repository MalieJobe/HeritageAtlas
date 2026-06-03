<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import EventForm from '$lib/components/EventForm.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Edit event · {data.person.name} · HeritageAtlas</title></svelte:head>

<div class="mx-auto flex w-full max-w-lg flex-col gap-6">
	<div class="flex flex-col gap-1">
		<a
			href={resolve('/trees/[treeId]/persons/[personId]', {
				treeId: data.tree.id,
				personId: data.person.id
			})}
			class="text-sm text-ink/60 hover:text-ink"
		>
			← {data.person.name}
		</a>
		<h1 class="text-2xl font-semibold text-ink">Edit event</h1>
	</div>

	<form method="POST" action="?/save" use:enhance class="flex flex-col gap-5">
		<EventForm places={data.places} event={data.event} />

		{#if form?.error}
			<p class="text-sm text-red-600">{form.error}</p>
		{/if}

		<div class="flex items-center justify-between">
			<div class="flex gap-2">
				<button
					type="submit"
					class="rounded-md bg-clay px-4 py-2 font-medium text-ink hover:bg-clay/80"
				>
					Save changes
				</button>
				<a
					href={resolve('/trees/[treeId]/persons/[personId]', {
						treeId: data.tree.id,
						personId: data.person.id
					})}
					class="rounded-md border border-sage px-4 py-2 font-medium text-ink/80 hover:bg-cream"
				>
					Cancel
				</a>
			</div>
		</div>
	</form>

	<form method="POST" action="?/delete" use:enhance class="border-t border-sage pt-4">
		<button type="submit" class="text-sm text-ink/50 hover:text-red-600">Delete this event</button>
	</form>
</div>
