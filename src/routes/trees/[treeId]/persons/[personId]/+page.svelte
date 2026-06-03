<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { personInitials, personName } from '$lib/person';
	import PersonAvatar from '$lib/components/PersonAvatar.svelte';
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
				{/if}
			</div>
		{/if}
	</section>

	<!-- Events -->
	<section class="flex flex-col gap-3 border-t border-sage pt-6">
		<div class="flex items-center justify-between">
			<h2 class="text-sm font-medium text-ink/80">Events</h2>
			{#if data.canEdit}
				<a
					href={resolve('/trees/[treeId]/persons/[personId]/events/new', {
						treeId: data.tree.id,
						personId: person.id
					})}
					class="rounded-md border border-sage px-3 py-1.5 text-sm font-medium text-ink/80 hover:bg-cream"
				>
					Add event
				</a>
			{/if}
		</div>

		{#if data.events.length > 0}
			<ul class="flex flex-col gap-2 text-sm">
				{#each data.events as event (event.id)}
					<li class="flex items-start gap-3">
						<span aria-hidden="true" class="pt-0.5">{event.icon}</span>
						<div class="flex-1">
							<p class="text-ink">
								<span class="font-medium">{event.label}</span>
								{#if event.date}<span class="text-ink/60"> · {event.date}</span>{/if}
								{#if event.place}<span class="text-ink/60"> · {event.place}</span>{/if}
							</p>
							{#if event.note}
								<p class="text-xs whitespace-pre-line text-ink/55">{event.note}</p>
							{/if}
						</div>
						{#if data.canEdit}
							<a
								href={resolve('/trees/[treeId]/persons/[personId]/events/[eventId]/edit', {
									treeId: data.tree.id,
									personId: person.id,
									eventId: event.id
								})}
								class="text-xs text-ink/40 hover:text-ink"
							>
								Edit
							</a>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-sm text-ink/55">No events recorded.</p>
		{/if}
	</section>
</div>
