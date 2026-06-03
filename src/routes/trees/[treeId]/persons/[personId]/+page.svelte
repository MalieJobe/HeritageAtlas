<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { personInitials, personName } from '$lib/person';
	import PersonAvatar from '$lib/components/PersonAvatar.svelte';
	import EventForm from '$lib/components/EventForm.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let person = $derived(data.person);
	let name = $derived(personName(person));
	let hasRelationships = $derived(
		data.parents.length > 0 || data.partners.length > 0 || data.children.length > 0
	);

	function cap(value: string): string {
		return value.charAt(0).toUpperCase() + value.slice(1);
	}

	// Inline event form: null = adding, otherwise editing that event id. `formKey`
	// is bumped to remount EventForm (clearing its internal state) after a save.
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
</script>

<svelte:head><title>{name} · HeritageAtlas</title></svelte:head>

{#snippet personLink(rel: { id: string; name: string })}
	<a
		href={resolve('/trees/[treeId]/persons/[personId]', { treeId: data.tree.id, personId: rel.id })}
		class="text-ink underline-offset-2 hover:underline"
	>
		{rel.name}
	</a>
{/snippet}

{#snippet addForm(action: string, verb: string)}
	{#if data.candidates.length > 0}
		<form method="POST" {action} use:enhance class="flex flex-wrap items-center gap-2">
			<select
				name="personId"
				required
				class="rounded-md border border-sage bg-white px-2 py-1.5 text-sm text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none"
			>
				<option value="" disabled selected>Choose a person…</option>
				{#each data.candidates as candidate (candidate.id)}
					<option value={candidate.id}>{candidate.name}</option>
				{/each}
			</select>
			{#if action === '?/addPartner'}
				<select
					name="status"
					class="rounded-md border border-sage bg-white px-2 py-1.5 text-sm text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none"
				>
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

	<div class="flex items-start gap-4">
		<PersonAvatar photoUrl={data.photoUrl} initials={personInitials(person)} size={96} />
		<div class="flex flex-1 flex-col gap-1">
			<h1 class="text-2xl font-semibold text-ink">{name}</h1>
			{#if person.nickname && (person.given_names || person.surname)}
				<p class="text-sm text-ink/60">“{person.nickname}”</p>
			{/if}
			{#if person.birth_surname}
				<p class="text-sm text-ink/60">Born {person.birth_surname}</p>
			{/if}
		</div>
		{#if data.canEdit}
			<a
				href={resolve('/trees/[treeId]/persons/[personId]/edit', {
					treeId: data.tree.id,
					personId: person.id
				})}
				class="rounded-md border border-sage px-3 py-1.5 text-sm font-medium text-ink/80 hover:bg-cream"
			>
				Edit
			</a>
		{/if}
	</div>

	<dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
		{#if person.sex || person.gender}
			<dt class="font-medium text-ink/60">Sex / gender</dt>
			<dd class="text-ink">
				{[person.sex, person.gender]
					.filter((v): v is string => Boolean(v))
					.map(cap)
					.join(' · ')}
			</dd>
		{/if}
		{#if person.notes}
			<dt class="font-medium text-ink/60">Notes</dt>
			<dd class="whitespace-pre-line text-ink">{person.notes}</dd>
		{/if}
	</dl>

	<!-- Relationships -->
	<section class="flex flex-col gap-5 border-t border-sage pt-6">
		<h2 class="text-sm font-medium text-ink/80">Relationships</h2>

		{#if form?.relError}
			<p class="text-sm text-red-600">{form.relError}</p>
		{/if}

		{#if !data.canEdit && !hasRelationships}
			<p class="text-sm text-ink/55">No relationships recorded.</p>
		{/if}

		<!-- Parents -->
		{#if data.canEdit || data.parents.length > 0}
			<div class="flex flex-col gap-2">
				<h3 class="text-xs font-medium tracking-wide text-ink/45 uppercase">Parents</h3>
				{#if data.parents.length > 0}
					<ul class="flex flex-col gap-1 text-sm">
						{#each data.parents as parent (parent.linkId)}
							<li class="flex items-center gap-3">
								{@render personLink(parent)}
								{#if data.canEdit}
									{@render removeButton('?/removeLink', 'linkId', parent.linkId)}
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
				{#if data.canEdit}
					{@render addForm('?/addParent', 'Add parent')}
				{/if}
			</div>
		{/if}

		<!-- Partners -->
		{#if data.canEdit || data.partners.length > 0}
			<div class="flex flex-col gap-2">
				<h3 class="text-xs font-medium tracking-wide text-ink/45 uppercase">Partners</h3>
				{#if data.partners.length > 0}
					<ul class="flex flex-col gap-1 text-sm">
						{#each data.partners as partner (partner.partnershipId)}
							<li class="flex items-center gap-3">
								{@render personLink(partner)}
								<span class="text-ink/45">{partner.status === 'former' ? '(former)' : ''}</span>
								{#if data.canEdit}
									<form method="POST" action="?/setPartnerStatus" use:enhance>
										<input type="hidden" name="partnershipId" value={partner.partnershipId} />
										<input
											type="hidden"
											name="status"
											value={partner.status === 'former' ? 'current' : 'former'}
										/>
										<button type="submit" class="text-xs text-ink/40 hover:text-ink">
											{partner.status === 'former' ? 'Mark current' : 'Mark former'}
										</button>
									</form>
									{@render removeButton(
										'?/removePartnership',
										'partnershipId',
										partner.partnershipId
									)}
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
				{#if data.canEdit}
					{@render addForm('?/addPartner', 'Add partner')}
				{/if}
			</div>
		{/if}

		<!-- Children -->
		{#if data.canEdit || data.children.length > 0}
			<div class="flex flex-col gap-2">
				<h3 class="text-xs font-medium tracking-wide text-ink/45 uppercase">Children</h3>
				{#if data.children.length > 0}
					<ul class="flex flex-col gap-1 text-sm">
						{#each data.children as child (child.linkId)}
							<li class="flex items-center gap-3">
								{@render personLink(child)}
								{#if data.canEdit}
									{@render removeButton('?/removeLink', 'linkId', child.linkId)}
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
				{#if data.canEdit}
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
				{/if}
			</div>
		{/if}
	</section>

	<!-- Events -->
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
										class="text-xs text-ink/40 hover:text-ink"
									>
										Edit
									</button>
									<form method="POST" action="?/deleteEvent" use:enhance class="inline">
										<input type="hidden" name="eventId" value={event.id} />
										<button type="submit" class="ml-2 text-xs text-ink/40 hover:text-red-600">
											Remove
										</button>
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
						<button type="button" onclick={cancelEdit} class="text-xs text-ink/40 hover:text-ink">
							Cancel
						</button>
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
							<EventForm places={data.places} defaultPlace={data.defaultPlace} />
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
