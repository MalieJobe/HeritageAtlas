<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import FuzzyDateInput from '$lib/components/FuzzyDateInput.svelte';
	import PlacePicker from '$lib/components/PlacePicker.svelte';
	import type { PlaceSelection } from '$lib/place';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Birthplace defaults to where the parent already is; editable via the picker.
	// Seeded once (untrack) — the picker owns it after mount.
	let placeSelection = $state<PlaceSelection | null>(untrack(() => data.defaultPlace));

	const inputClass =
		'rounded-md border border-sage bg-white px-3 py-2 text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none';
</script>

<svelte:head><title>Add child · {data.parent.name} · HeritageAtlas</title></svelte:head>

<div class="mx-auto flex w-full max-w-lg flex-col gap-6">
	<div class="flex flex-col gap-1">
		<a
			href={resolve('/trees/[treeId]/persons/[personId]', {
				treeId: data.tree.id,
				personId: data.parent.id
			})}
			class="text-sm text-ink/60 hover:text-ink"
		>
			← {data.parent.name}
		</a>
		<h1 class="text-2xl font-semibold text-ink">Add a child</h1>
		<p class="text-sm text-ink/55">A new person, linked as {data.parent.name}'s child.</p>
	</div>

	<form method="POST" use:enhance class="flex flex-col gap-5">
		<!-- This flow always records a birth (the locating fact for the map). -->
		<input type="hidden" name="type" value="birth" />

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
				Given name(s)
				<input name="given_names" type="text" value={form?.given_names ?? ''} class={inputClass} />
			</label>
			<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
				Surname
				<input
					name="surname"
					type="text"
					value={form?.surname ?? data.parent.surname ?? ''}
					class={inputClass}
				/>
			</label>
			<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
				Nickname
				<input name="nickname" type="text" value={form?.nickname ?? ''} class={inputClass} />
			</label>
			<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
				Sex
				<select name="sex" class={inputClass}>
					<option value="" selected={!form?.sex}>Unspecified</option>
					<option value="female" selected={form?.sex === 'female'}>Female</option>
					<option value="male" selected={form?.sex === 'male'}>Male</option>
					<option value="other" selected={form?.sex === 'other'}>Other</option>
				</select>
			</label>
		</div>

		<div class="flex flex-col gap-1 text-sm font-medium text-ink/80">
			Born
			<FuzzyDateInput />
		</div>

		<div class="flex flex-col gap-1 text-sm font-medium text-ink/80">
			Birthplace
			<PlacePicker
				places={data.places}
				selection={placeSelection}
				onchange={(s) => (placeSelection = s)}
			/>
			<input
				type="hidden"
				name="place_selection"
				value={placeSelection ? JSON.stringify(placeSelection) : ''}
			/>
		</div>

		{#if form?.error}
			<p class="text-sm text-red-600">{form.error}</p>
		{/if}

		<div class="flex gap-2">
			<button
				type="submit"
				class="rounded-md bg-clay px-4 py-2 font-medium text-ink hover:bg-clay/80"
			>
				Add child
			</button>
			<a
				href={resolve('/trees/[treeId]/persons/[personId]', {
					treeId: data.tree.id,
					personId: data.parent.id
				})}
				class="rounded-md border border-sage px-4 py-2 font-medium text-ink/80 hover:bg-cream"
			>
				Cancel
			</a>
		</div>
	</form>
</div>
