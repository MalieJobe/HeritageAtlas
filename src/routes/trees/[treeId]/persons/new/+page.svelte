<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const inputClass =
		'rounded-md border border-sage bg-white px-3 py-2 text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none';
</script>

<svelte:head><title>Add person · {data.tree.name} · HeritageAtlas</title></svelte:head>

<div class="mx-auto flex w-full max-w-lg flex-col gap-6">
	<div class="flex flex-col gap-1">
		<a
			href={resolve('/trees/[treeId]', { treeId: data.tree.id })}
			class="text-sm text-ink/60 hover:text-ink"
		>
			← {data.tree.name}
		</a>
		<h1 class="text-2xl font-semibold text-ink">Add a person</h1>
	</div>

	<form method="POST" use:enhance class="flex flex-col gap-4">
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
				Given name(s)
				<input name="given_names" type="text" value={form?.given_names ?? ''} class={inputClass} />
			</label>
			<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
				Surname
				<input name="surname" type="text" value={form?.surname ?? ''} class={inputClass} />
			</label>
			<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
				Birth / maiden surname
				<input
					name="birth_surname"
					type="text"
					value={form?.birth_surname ?? ''}
					class={inputClass}
				/>
			</label>
			<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
				Nickname
				<input name="nickname" type="text" value={form?.nickname ?? ''} class={inputClass} />
			</label>
		</div>

		<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
			Sex
			<select name="sex" class={inputClass}>
				<option value="" selected={!form?.sex}>Unspecified</option>
				<option value="female" selected={form?.sex === 'female'}>Female</option>
				<option value="male" selected={form?.sex === 'male'}>Male</option>
				<option value="other" selected={form?.sex === 'other'}>Other</option>
			</select>
		</label>

		<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
			Notes
			<textarea name="notes" rows="4" class={inputClass}>{form?.notes ?? ''}</textarea>
		</label>

		{#if form?.error}
			<p class="text-sm text-red-600">{form.error}</p>
		{/if}

		<div class="flex gap-2">
			<button
				type="submit"
				class="rounded-md bg-clay px-4 py-2 font-medium text-ink hover:bg-clay/80"
			>
				Add person
			</button>
			<a
				href={resolve('/trees/[treeId]', { treeId: data.tree.id })}
				class="rounded-md border border-sage px-4 py-2 font-medium text-ink/80 hover:bg-cream"
			>
				Cancel
			</a>
		</div>
	</form>
</div>
