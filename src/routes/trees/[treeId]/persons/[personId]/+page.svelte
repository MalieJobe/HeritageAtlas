<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { personInitials, personName } from '$lib/person';
	import PersonAvatar from '$lib/components/PersonAvatar.svelte';
	import EventForm from '$lib/components/EventForm.svelte';
	import MiniFamily from '$lib/components/MiniFamily.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let person = $derived(data.person);
	let name = $derived(personName(person));

	const inputClass =
		'rounded-md border border-sage bg-white px-3 py-2 text-sm text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none';

	// Inline event form: null = adding, otherwise editing that event id.
	let editingId = $state<string | null>(null);
	let formKey = $state(0);
	let editing = $derived(editingId ? (data.events.find((e) => e.id === editingId) ?? null) : null);
	function startEdit(id: string) {
		editingId = id;
	}
	function cancelEdit() {
		editingId = null;
		formKey += 1;
	}

	let relOpen = $state(false);
	let confirmingDelete = $state(false);
</script>

<svelte:head><title>{name} · HeritageAtlas</title></svelte:head>

{#snippet addForm(action: string, verb: string, withStatus = false)}
	{#if data.candidates.length > 0}
		<form method="POST" {action} use:enhance class="flex flex-wrap items-center gap-2">
			<select name="personId" required class="{inputClass} flex-1">
				<option value="" disabled selected>Choose a person…</option>
				{#each data.candidates as candidate (candidate.id)}
					<option value={candidate.id}>{candidate.name}</option>
				{/each}
			</select>
			{#if withStatus}
				<select name="status" class={inputClass}>
					<option value="current">Current</option>
					<option value="former">Former</option>
				</select>
			{/if}
			<button
				type="submit"
				class="rounded-md border border-sage px-3 py-1.5 text-sm font-medium text-ink/80 hover:bg-cream"
			>
				{verb}
			</button>
		</form>
	{:else}
		<p class="text-sm text-ink/45">Add more people to the tree to link them here.</p>
	{/if}
{/snippet}

{#snippet relRow(rel: { id: string; name: string })}
	<a
		href={resolve('/trees/[treeId]/persons/[personId]', { treeId: data.tree.id, personId: rel.id })}
		class="flex-1 truncate text-ink underline-offset-2 hover:underline">{rel.name}</a
	>
{/snippet}

{#snippet removeButton(action: string, idName: string, idValue: string)}
	<form method="POST" {action} use:enhance>
		<input type="hidden" name={idName} value={idValue} />
		<button type="submit" class="text-xs text-ink/40 hover:text-red-600">Remove</button>
	</form>
{/snippet}

<div class="flex flex-col gap-6">
	<a
		href={resolve('/trees/[treeId]', { treeId: data.tree.id })}
		class="text-sm text-ink/60 hover:text-ink"
	>
		← {data.tree.name}
	</a>

	<!-- Row 1: base info | mini family graph -->
	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Left: editable base info -->
		<section class="flex flex-col gap-5">
			<div class="flex items-start gap-4">
				<PersonAvatar photoUrl={data.photoUrl} initials={personInitials(person)} size={80} />
				{#if data.canEdit}
					<div class="flex flex-col gap-1.5 text-sm">
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
								class="text-xs text-ink/70 file:mr-2 file:rounded-md file:border file:border-sage file:bg-white file:px-2 file:py-1 file:text-xs file:font-medium file:text-ink hover:file:bg-cream"
							/>
							<button
								type="submit"
								class="rounded-md bg-clay px-2.5 py-1 text-xs font-medium text-ink hover:bg-clay/80"
								>Upload</button
							>
						</form>
						{#if data.photoUrl}
							<form method="POST" action="?/removePhoto" use:enhance>
								<button type="submit" class="text-xs text-ink/50 hover:text-red-600"
									>Remove photo</button
								>
							</form>
						{/if}
						{#if form?.photoError}
							<p class="text-xs text-red-600">{form.photoError}</p>
						{/if}
					</div>
				{/if}
			</div>

			{#if data.canEdit}
				<form method="POST" action="?/savePerson" use:enhance class="flex flex-col gap-3">
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
							Given name(s)
							<input
								name="given_names"
								type="text"
								value={person.given_names ?? ''}
								class={inputClass}
							/>
						</label>
						<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
							Surname
							<input name="surname" type="text" value={person.surname ?? ''} class={inputClass} />
						</label>
						<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
							Birth / maiden surname
							<input
								name="birth_surname"
								type="text"
								value={person.birth_surname ?? ''}
								class={inputClass}
							/>
						</label>
						<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
							Nickname
							<input name="nickname" type="text" value={person.nickname ?? ''} class={inputClass} />
						</label>
					</div>
					<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
						Sex
						<select name="sex" class={inputClass}>
							<option value="" selected={!person.sex}>Unspecified</option>
							<option value="female" selected={person.sex === 'female'}>Female</option>
							<option value="male" selected={person.sex === 'male'}>Male</option>
							<option value="other" selected={person.sex === 'other'}>Other</option>
						</select>
					</label>
					<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
						Notes
						<textarea name="notes" rows="3" class={inputClass}>{person.notes ?? ''}</textarea>
					</label>
					<div class="flex items-center gap-3">
						<button
							type="submit"
							class="rounded-md bg-clay px-4 py-2 text-sm font-medium text-ink hover:bg-clay/80"
							>Save</button
						>
						{#if form?.personError}
							<p class="text-sm text-red-600">{form.personError}</p>
						{:else if form?.personSaved}
							<p class="text-sm text-green-700">Saved.</p>
						{/if}
					</div>
				</form>

				<!-- Delete -->
				<div class="mt-1">
					{#if confirmingDelete}
						<form method="POST" action="?/deletePerson" use:enhance class="flex items-center gap-2">
							<span class="text-sm text-ink/70">Delete {name}?</span>
							<button
								type="submit"
								class="rounded-md bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700"
								>Yes, delete</button
							>
							<button
								type="button"
								onclick={() => (confirmingDelete = false)}
								class="text-sm text-ink/60 hover:text-ink">Cancel</button
							>
						</form>
					{:else}
						<button
							type="button"
							onclick={() => (confirmingDelete = true)}
							class="text-xs font-medium text-red-700/80 hover:text-red-700"
							>Delete this person</button
						>
					{/if}
				</div>
			{:else}
				<!-- Read-only view -->
				<div>
					<h1 class="text-2xl font-semibold text-ink">{name}</h1>
					{#if person.sex || person.gender}
						<p class="text-sm text-ink/60 capitalize">
							{[person.sex, person.gender].filter(Boolean).join(' · ')}
						</p>
					{/if}
					{#if person.notes}
						<p class="mt-2 text-sm whitespace-pre-line text-ink">{person.notes}</p>
					{/if}
				</div>
			{/if}
		</section>

		<!-- Right: mini family graph -->
		<section class="flex flex-col gap-2">
			<div class="relative h-75 overflow-hidden rounded-lg border border-sage bg-paper">
				<MiniFamily graph={data.miniGraph} treeId={data.tree.id} centerId={data.centerId} />
				{#if data.canEdit}
					<button
						type="button"
						onclick={() => (relOpen = true)}
						class="absolute top-3 right-3 rounded-md border border-sage bg-white/90 px-2.5 py-1 text-xs font-medium text-ink/80 shadow-sm backdrop-blur hover:bg-cream"
					>
						Manage relationships
					</button>
				{/if}
			</div>
			<p class="text-center text-xs text-ink/45">Click a relative to open their page.</p>
		</section>
	</div>

	<!-- Row 2: events -->
	<section class="flex flex-col gap-3 border-t border-sage pt-6">
		<h2 class="text-sm font-medium text-ink/80">Events</h2>

		{#if data.events.length > 0}
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-sage text-left text-xs font-medium tracking-wide text-ink/45">
						<th class="py-1.5 pr-3 font-medium">Event</th>
						<th class="py-1.5 pr-3 font-medium">Date</th>
						<th class="py-1.5 pr-3 font-medium">Place</th>
						{#if data.canEdit}<th class="py-1.5"></th>{/if}
					</tr>
				</thead>
				<tbody>
					{#each data.events as event (event.id)}
						<tr class="border-b border-sage/40" class:bg-cream={editingId === event.id}>
							<td class="py-2 pr-3">
								<span aria-hidden="true">{event.icon}</span>
								<span class="font-medium text-ink">{event.label}</span>
							</td>
							<td class="py-2 pr-3 text-ink/70">{event.date || '—'}</td>
							<td class="py-2 pr-3 text-ink/70">{event.place || '—'}</td>
							{#if data.canEdit}
								<td class="py-2 text-right whitespace-nowrap">
									<button
										type="button"
										onclick={() => startEdit(event.id)}
										class="text-xs text-ink/40 hover:text-ink">Edit</button
									>
									<form method="POST" action="?/deleteEvent" use:enhance class="inline">
										<input type="hidden" name="eventId" value={event.id} />
										<button type="submit" class="ml-2 text-xs text-ink/40 hover:text-red-600"
											>Remove</button
										>
									</form>
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<p class="text-sm text-ink/55">No events recorded.</p>
		{/if}

		{#if data.canEdit}
			<div class="mt-2 rounded-lg border border-sage bg-paper/60 p-4">
				<div class="mb-3 flex items-center justify-between">
					<h3 class="text-xs font-medium tracking-wide text-ink/45 uppercase">
						{editing ? 'Edit event' : 'Add an event'}
					</h3>
					{#if editing}
						<button type="button" onclick={cancelEdit} class="text-xs text-ink/40 hover:text-ink"
							>Cancel</button
						>
					{/if}
				</div>

				{#if form?.eventError}
					<p class="mb-2 text-sm text-red-600">{form.eventError}</p>
				{/if}

				{#key editingId ? `edit:${editingId}` : `new:${formKey}`}
					<form
						method="POST"
						action={editing ? '?/updateEvent' : '?/addEvent'}
						use:enhance={() =>
							async ({ update, result }) => {
								await update({ reset: false });
								if (result.type === 'success') {
									editingId = null;
									formKey += 1;
								}
							}}
						class="flex flex-col gap-4"
					>
						{#if editing}
							<input type="hidden" name="eventId" value={editing.id} />
							<EventForm places={data.places} event={editing.initial} />
						{:else}
							<EventForm
								places={data.places}
								defaultPlace={data.defaultPlace}
								defaultType={data.defaultType}
							/>
						{/if}
						<div>
							<button
								type="submit"
								class="rounded-md bg-clay px-4 py-2 text-sm font-medium text-ink hover:bg-clay/80"
							>
								{editing ? 'Save event' : 'Add event'}
							</button>
						</div>
					</form>
				{/key}
			</div>
		{/if}
	</section>
</div>

<!-- Relationships modal -->
{#if relOpen}
	<div
		class="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-4"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) relOpen = false;
		}}
	>
		<div
			class="flex max-h-[85vh] w-full max-w-lg flex-col overflow-y-auto rounded-lg border border-sage bg-paper p-5 shadow-xl"
		>
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-base font-semibold text-ink">Relationships</h2>
				<button
					type="button"
					onclick={() => (relOpen = false)}
					class="text-ink/40 hover:text-ink"
					aria-label="Close">✕</button
				>
			</div>

			{#if form?.relError}
				<p class="mb-2 text-sm text-red-600">{form.relError}</p>
			{/if}

			<div class="flex flex-col gap-5">
				<!-- Parents -->
				<div class="flex flex-col gap-2">
					<h3 class="text-xs font-medium tracking-wide text-ink/45 uppercase">Parents</h3>
					{#each data.parents as p (p.linkId)}
						<div class="flex items-center gap-3 text-sm">
							{@render relRow(p)}
							{@render removeButton('?/removeLink', 'linkId', p.linkId)}
						</div>
					{/each}
					{@render addForm('?/addParent', 'Add parent')}
				</div>

				<!-- Partners -->
				<div class="flex flex-col gap-2">
					<h3 class="text-xs font-medium tracking-wide text-ink/45 uppercase">Partners</h3>
					{#each data.partners as p (p.partnershipId)}
						<div class="flex items-center gap-3 text-sm">
							{@render relRow(p)}
							<span class="text-ink/45">{p.status === 'former' ? '(former)' : ''}</span>
							<form method="POST" action="?/setPartnerStatus" use:enhance>
								<input type="hidden" name="partnershipId" value={p.partnershipId} />
								<input
									type="hidden"
									name="status"
									value={p.status === 'former' ? 'current' : 'former'}
								/>
								<button type="submit" class="text-xs text-ink/40 hover:text-ink"
									>{p.status === 'former' ? 'Mark current' : 'Mark former'}</button
								>
							</form>
							{@render removeButton('?/removePartnership', 'partnershipId', p.partnershipId)}
						</div>
					{/each}
					{@render addForm('?/addPartner', 'Add partner', true)}
				</div>

				<!-- Children -->
				<div class="flex flex-col gap-2">
					<h3 class="text-xs font-medium tracking-wide text-ink/45 uppercase">Children</h3>
					{#each data.children as c (c.linkId)}
						<div class="flex items-center gap-3 text-sm">
							{@render relRow(c)}
							{@render removeButton('?/removeLink', 'linkId', c.linkId)}
						</div>
					{/each}
					{@render addForm('?/addChild', 'Add child')}
					<a
						href={resolve('/trees/[treeId]/persons/[personId]/children/new', {
							treeId: data.tree.id,
							personId: person.id
						})}
						class="text-xs font-medium text-ink/60 underline underline-offset-2 hover:text-ink"
					>
						+ New child (creates a person, birthplace from {name})
					</a>
				</div>

				<!-- Siblings (read-only — they're derived from shared parents) -->
				{#if data.siblings.length > 0}
					<div class="flex flex-col gap-2">
						<h3 class="text-xs font-medium tracking-wide text-ink/45 uppercase">Siblings</h3>
						{#each data.siblings as s (s.id)}
							<div class="flex items-center gap-3 text-sm">{@render relRow(s)}</div>
						{/each}
						<p class="text-xs text-ink/45">
							Siblings come from shared parents — add a parent to connect them.
						</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
