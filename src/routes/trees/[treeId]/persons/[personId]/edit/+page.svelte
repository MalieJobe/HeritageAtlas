<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { personInitials, personName } from '$lib/person';
	import PersonAvatar from '$lib/components/PersonAvatar.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let confirmingDelete = $state(false);

	const inputClass =
		'rounded-md border border-sage bg-white px-3 py-2 text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none';
</script>

<svelte:head><title>Edit {personName(data.person)} · HeritageAtlas</title></svelte:head>

<div class="mx-auto flex w-full max-w-lg flex-col gap-6">
	<div class="flex flex-col gap-1">
		<a
			href={resolve('/trees/[treeId]', { treeId: data.tree.id })}
			class="text-sm text-ink/60 hover:text-ink"
		>
			← {data.tree.name}
		</a>
		<h1 class="text-2xl font-semibold text-ink">Edit person</h1>
	</div>

	<!-- Profile photo -->
	<section class="flex items-center gap-4">
		<PersonAvatar photoUrl={data.photoUrl} initials={personInitials(data.person)} size={80} />
		<div class="flex flex-col gap-2">
			<form
				method="POST"
				action="?/uploadPhoto"
				enctype="multipart/form-data"
				use:enhance
				class="flex flex-wrap items-center gap-2"
			>
				<input
					name="photo"
					type="file"
					accept="image/*"
					required
					class="text-sm text-ink/70 file:mr-2 file:rounded-md file:border file:border-sage file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-cream"
				/>
				<button
					type="submit"
					class="rounded-md bg-clay px-3 py-1.5 text-sm font-medium text-ink hover:bg-clay/80"
				>
					Upload
				</button>
			</form>
			{#if data.photoUrl}
				<form method="POST" action="?/removePhoto" use:enhance>
					<button type="submit" class="text-sm text-ink/50 hover:text-red-600">
						Remove photo
					</button>
				</form>
			{/if}
			{#if form?.photoError}
				<p class="text-sm text-red-600">{form.photoError}</p>
			{:else if form?.photoUpdated}
				<p class="text-sm text-green-700">Photo updated.</p>
			{/if}
		</div>
	</section>

	<form method="POST" action="?/save" use:enhance class="flex flex-col gap-4">
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
				Given name(s)
				<input
					name="given_names"
					type="text"
					value={data.person.given_names ?? ''}
					class={inputClass}
				/>
			</label>
			<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
				Surname
				<input name="surname" type="text" value={data.person.surname ?? ''} class={inputClass} />
			</label>
			<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
				Birth / maiden surname
				<input
					name="birth_surname"
					type="text"
					value={data.person.birth_surname ?? ''}
					class={inputClass}
				/>
			</label>
			<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
				Nickname
				<input name="nickname" type="text" value={data.person.nickname ?? ''} class={inputClass} />
			</label>
		</div>

		<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
			Sex
			<select name="sex" class={inputClass}>
				<option value="" selected={!data.person.sex}>Unspecified</option>
				<option value="female" selected={data.person.sex === 'female'}>Female</option>
				<option value="male" selected={data.person.sex === 'male'}>Male</option>
				<option value="other" selected={data.person.sex === 'other'}>Other</option>
			</select>
		</label>

		<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
			Notes
			<textarea name="notes" rows="4" class={inputClass}>{data.person.notes ?? ''}</textarea>
		</label>

		{#if form?.error}
			<p class="text-sm text-red-600">{form.error}</p>
		{/if}

		<div class="flex gap-2">
			<button
				type="submit"
				class="rounded-md bg-clay px-4 py-2 font-medium text-ink hover:bg-clay/80"
			>
				Save changes
			</button>
			<a
				href={resolve('/trees/[treeId]', { treeId: data.tree.id })}
				class="rounded-md border border-sage px-4 py-2 font-medium text-ink/80 hover:bg-cream"
			>
				Cancel
			</a>
		</div>
	</form>

	<section class="flex flex-col gap-2 border-t border-sage pt-6">
		<h2 class="text-sm font-medium text-red-700">Delete person</h2>
		<p class="text-sm text-ink/60">
			Removes this person and any relationships connected to them. This cannot be undone.
		</p>
		{#if confirmingDelete}
			<form method="POST" action="?/delete" use:enhance class="flex items-center gap-2">
				<span class="text-sm text-ink/80">Are you sure?</span>
				<button
					type="submit"
					class="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
				>
					Yes, delete
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
				Delete this person
			</button>
		{/if}
	</section>
</div>
