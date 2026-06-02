<script lang="ts">
	import { resolve } from '$app/paths';
	import { personInitials, personName } from '$lib/person';
	import PersonAvatar from '$lib/components/PersonAvatar.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let person = $derived(data.person);
	let name = $derived(personName(person));

	function cap(value: string): string {
		return value.charAt(0).toUpperCase() + value.slice(1);
	}
</script>

<svelte:head><title>{name} · HeritageAtlas</title></svelte:head>

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

	<!-- Relationships summary -->
	<section class="flex flex-col gap-3 border-t border-sage pt-6">
		<h2 class="text-sm font-medium text-ink/80">Relationships</h2>

		{#if data.parents.length === 0 && data.partners.length === 0 && data.children.length === 0}
			<p class="text-sm text-ink/55">
				No relationships yet. (Adding partners and parent–child links comes next.)
			</p>
		{:else}
			<div class="flex flex-col gap-4">
				{#snippet personLink(rel: { id: string; name: string })}
					<a
						href={resolve('/trees/[treeId]/persons/[personId]', {
							treeId: data.tree.id,
							personId: rel.id
						})}
						class="text-ink underline-offset-2 hover:underline"
					>
						{rel.name}
					</a>
				{/snippet}

				{#if data.parents.length > 0}
					<div class="flex flex-col gap-1">
						<h3 class="text-xs font-medium tracking-wide text-ink/45 uppercase">Parents</h3>
						<ul class="flex flex-col gap-0.5 text-sm">
							{#each data.parents as parent (parent.id)}
								<li>{@render personLink(parent)}</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if data.partners.length > 0}
					<div class="flex flex-col gap-1">
						<h3 class="text-xs font-medium tracking-wide text-ink/45 uppercase">Partners</h3>
						<ul class="flex flex-col gap-0.5 text-sm">
							{#each data.partners as partner (partner.id)}
								<li>
									{@render personLink(partner)}
									{#if partner.status === 'former'}<span class="text-ink/45">(former)</span>{/if}
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if data.children.length > 0}
					<div class="flex flex-col gap-1">
						<h3 class="text-xs font-medium tracking-wide text-ink/45 uppercase">Children</h3>
						<ul class="flex flex-col gap-0.5 text-sm">
							{#each data.children as child (child.id)}
								<li>{@render personLink(child)}</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		{/if}
	</section>
</div>
