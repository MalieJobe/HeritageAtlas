<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { personName } from '$lib/person';
	import PhotoGallery from '$lib/components/PhotoGallery.svelte';
	import EventRowFields from '$lib/components/EventRowFields.svelte';
	import MiniFamily from '$lib/components/MiniFamily.svelte';
	import RelationAdder from '$lib/components/RelationAdder.svelte';
	import { useI18n } from '$lib/i18n';
	import type { ActionData, PageData } from './$types';

	const t = useI18n().t;

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let person = $derived(data.person);
	let name = $derived(personName(person));

	// Birth and death are limited to one each — don't offer a used one when adding.
	let usedSingletonTypes = $derived(
		(['birth', 'death'] as const).filter((t) => data.events.some((e) => e.type === t))
	);

	const inputClass =
		'rounded-md border border-sage bg-white px-3 py-2 text-sm text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none';

	// Inline event rows: null = just adding, otherwise editing that event id.
	let editingId = $state<string | null>(null);
	let formKey = $state(0);
	function startEdit(id: string) {
		editingId = id;
	}
	function cancelEdit() {
		editingId = null;
		formKey += 1;
	}
	// Default SvelteKit enhance resets the <form> on success, which blanks inputs
	// bound with `value={…}` — and because saving often re-submits the same value,
	// Svelte sees no data change and never re-asserts it, so the field stays empty
	// until the (slow) full reload finishes. Keeping the form un-reset fixes that
	// "fields disappear for a moment" jank (3.5a).
	const keepEnhance =
		() =>
		async ({ update }: { update: (opts?: { reset?: boolean }) => Promise<void> }) => {
			await update({ reset: false });
		};

	// Shared enhance handler for the add/edit event rows: keep the inputs, then
	// reset the row on success.
	const saveEnhance =
		() =>
		async ({
			update,
			result
		}: {
			update: (opts?: { reset?: boolean }) => Promise<void>;
			result: { type: string };
		}) => {
			await update({ reset: false });
			if (result.type === 'success') {
				editingId = null;
				formKey += 1;
			}
		};

	let relOpen = $state(false);
	let confirmingDelete = $state(false);

	// --- Relationship management (3.5b) ---
	let relMessage = $state<string | null>(null);
	// After adding a 2nd parent we may ask whether the two parents are partners.
	let partnerPrompt = $state<{ aId: string; bId: string; aName: string; bName: string } | null>(
		null
	);
	// A newly created relative to navigate to once any follow-up prompt is resolved.
	let pendingJumpId = $state<string | null>(null);
	// Two-step confirm for removing a link, keyed by `${kind}:${id}`.
	let confirmingRemove = $state<string | null>(null);
	// Child section: whether the co-parent is being created vs picked from existing.
	let coCreate = $state(false);

	function personUrl(id: string) {
		return resolve('/trees/[treeId]/persons/[personId]', { treeId: data.tree.id, personId: id });
	}

	function jumpTo(id: string) {
		relOpen = false;
		goto(personUrl(id));
	}

	function closeRel() {
		relOpen = false;
		relMessage = null;
		partnerPrompt = null;
		pendingJumpId = null;
		confirmingRemove = null;
		coCreate = false;
	}

	// Handles the data returned by every RelationAdder submit: surface errors, raise
	// the "are these parents partners?" prompt, and jump to a freshly created relative.
	function handleRelResult(result: Record<string, unknown> | undefined) {
		relMessage = (result?.relError as string) ?? null;
		if (result?.relError) return;
		coCreate = false;
		const createdId = (result?.createdId as string) ?? null;
		const prompt = result?.promptPartners as typeof partnerPrompt;
		if (prompt) {
			partnerPrompt = prompt;
			pendingJumpId = createdId; // jump (if any) happens after the prompt is answered
			return;
		}
		if (createdId) jumpTo(createdId);
	}

	// After the partner prompt is answered (linked or dismissed), continue any pending jump.
	function afterPartnerPrompt() {
		partnerPrompt = null;
		const id = pendingJumpId;
		pendingJumpId = null;
		if (id) jumpTo(id);
	}

	const promptEnhance = () => {
		return async ({ update }: { update: (opts?: { reset?: boolean }) => Promise<void> }) => {
			await update({ reset: false });
			afterPartnerPrompt();
		};
	};
</script>

<svelte:head><title>{t('person.title', { name })}</title></svelte:head>

{#snippet relRow(rel: { id: string; name: string })}
	<a
		href={resolve('/trees/[treeId]/persons/[personId]', { treeId: data.tree.id, personId: rel.id })}
		class="flex-1 truncate text-ink underline-offset-2 hover:underline">{rel.name}</a
	>
{/snippet}

<!-- Two-step confirm before removing a link (3.5b). `token` is unique per row. -->
{#snippet removeButton(action: string, idName: string, idValue: string, token: string)}
	{#if confirmingRemove === token}
		<form
			method="POST"
			{action}
			use:enhance={() =>
				async ({ update }) => {
					await update({ reset: false });
					confirmingRemove = null;
				}}
			class="flex items-center gap-1.5"
		>
			<input type="hidden" name={idName} value={idValue} />
			<button type="submit" class="text-xs font-medium text-red-600 hover:text-red-700"
				>{t('common.remove')}</button
			>
			<button
				type="button"
				onclick={() => (confirmingRemove = null)}
				class="text-xs text-ink/40 hover:text-ink">{t('common.cancel')}</button
			>
		</form>
	{:else}
		<button
			type="button"
			onclick={() => (confirmingRemove = token)}
			class="text-xs text-ink/40 hover:text-red-600">{t('common.remove')}</button
		>
	{/if}
{/snippet}

<div class="flex flex-col gap-6">
	<a
		href={resolve('/trees/[treeId]', { treeId: data.tree.id })}
		class="text-sm text-ink/60 hover:text-ink"
	>
		{t('person.backToTree', { treeName: data.tree.name })}
	</a>

	<!-- Row 1: base info | mini family graph -->
	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Left: photos + editable base info -->
		<section class="flex flex-col gap-5">
			<div class="flex flex-col gap-1">
				<PhotoGallery photos={data.photos} canEdit={data.canEdit} />
				{#if form?.photoError}
					<p class="text-xs text-red-600">{form.photoError}</p>
				{/if}
			</div>

			{#if data.canEdit}
				<form
					method="POST"
					action="?/savePerson"
					use:enhance={keepEnhance}
					class="flex flex-col gap-3"
				>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
							{t('common.givenNames')}
							<input
								name="given_names"
								type="text"
								value={person.given_names ?? ''}
								class={inputClass}
							/>
						</label>
						<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
							{t('common.surname')}
							<input name="surname" type="text" value={person.surname ?? ''} class={inputClass} />
						</label>
						<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
							{t('common.birthSurname')}
							<input
								name="birth_surname"
								type="text"
								value={person.birth_surname ?? ''}
								class={inputClass}
							/>
						</label>
						<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
							{t('common.nickname')}
							<input name="nickname" type="text" value={person.nickname ?? ''} class={inputClass} />
						</label>
					</div>
					<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
						{t('common.sex')}
						<select name="sex" class={inputClass}>
							<option value="" selected={!person.sex}>{t('common.sexUnspecified')}</option>
							<option value="female" selected={person.sex === 'female'}
								>{t('common.sexFemale')}</option
							>
							<option value="male" selected={person.sex === 'male'}>{t('common.sexMale')}</option>
							<option value="other" selected={person.sex === 'other'}>{t('common.sexOther')}</option
							>
						</select>
					</label>
					<label class="flex flex-col gap-1 text-sm font-medium text-ink/80">
						{t('common.notes')}
						<textarea name="notes" rows="3" class={inputClass}>{person.notes ?? ''}</textarea>
					</label>
					<div class="flex items-center gap-3">
						<button
							type="submit"
							class="rounded-md bg-clay px-4 py-2 text-sm font-medium text-ink hover:bg-clay/80"
							>{t('common.save')}</button
						>
						{#if form?.personError}
							<p class="text-sm text-red-600">{form.personError}</p>
						{:else if form?.personSaved}
							<p class="text-sm text-green-700">{t('person.saved')}</p>
						{/if}
					</div>
				</form>

				<!-- Delete -->
				<div class="mt-1">
					{#if confirmingDelete}
						<form method="POST" action="?/deletePerson" use:enhance class="flex items-center gap-2">
							<span class="text-sm text-ink/70">{t('person.deleteConfirm', { name })}</span>
							<button
								type="submit"
								class="rounded-md bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700"
								>{t('person.deleteYes')}</button
							>
							<button
								type="button"
								onclick={() => (confirmingDelete = false)}
								class="text-sm text-ink/60 hover:text-ink">{t('common.cancel')}</button
							>
						</form>
					{:else}
						<button
							type="button"
							onclick={() => (confirmingDelete = true)}
							class="text-xs font-medium text-red-700/80 hover:text-red-700"
							>{t('person.deletePerson')}</button
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

		<!-- Right: mini family graph (fills the left column's height) -->
		<section class="flex h-full min-h-75 flex-col gap-2">
			<div class="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-sage bg-paper">
				<MiniFamily graph={data.miniGraph} treeId={data.tree.id} centerId={data.centerId} />
				{#if data.canEdit}
					<button
						type="button"
						onclick={() => (relOpen = true)}
						class="absolute top-3 right-3 rounded-md border border-sage bg-white/90 px-2.5 py-1 text-xs font-medium text-ink/80 shadow-sm backdrop-blur hover:bg-cream"
					>
						{t('person.manageRelationships')}
					</button>
				{/if}
			</div>
			<p class="text-center text-xs text-ink/45">{t('person.clickRelative')}</p>
		</section>
	</div>

	<!-- Row 2: events (inline table — add/edit happen as rows, no separate card) -->
	<section class="flex flex-col gap-3 border-t border-sage pt-6">
		<h2 class="text-sm font-medium text-ink/80">{t('person.events')}</h2>
		{#if form?.eventError}
			<p class="text-sm text-red-600">{form.eventError}</p>
		{/if}

		{#if data.events.length === 0 && !data.canEdit}
			<p class="text-sm text-ink/55">{t('person.events.noEvents')}</p>
		{:else}
			<div
				class="grid grid-cols-[max-content_minmax(150px,1fr)_minmax(220px,1.6fr)_max-content] gap-x-3 text-sm"
			>
				{#snippet header(text: string)}
					<div class="border-b border-sage pb-1.5 text-xs font-medium tracking-wide text-ink/45">
						{text}
					</div>
				{/snippet}
				{@render header(t('person.events.colEvent'))}
				{@render header(t('person.events.colDate'))}
				{@render header(t('person.events.colPlace'))}
				<div class="border-b border-sage pb-1.5"></div>

				{#each data.events as event (event.id)}
					{#if data.canEdit && editingId === event.id}
						<form class="contents" method="POST" action="?/updateEvent" use:enhance={saveEnhance}>
							<input type="hidden" name="eventId" value={event.id} />
							<EventRowFields
								places={data.places}
								event={event.initial}
								hideTypes={usedSingletonTypes}
							/>
							<div class="border-b border-sage/40 py-2 text-right whitespace-nowrap">
								<button
									type="submit"
									class="rounded-md bg-clay px-2.5 py-1 text-xs font-medium text-ink hover:bg-clay/80"
									>{t('common.save')}</button
								>
								<button
									type="button"
									onclick={cancelEdit}
									class="ml-2 text-xs text-ink/40 hover:text-ink">{t('common.cancel')}</button
								>
							</div>
						</form>
					{:else}
						<div class="border-b border-sage/40 py-2">
							<span aria-hidden="true">{event.icon}</span>
							<span class="font-medium text-ink">{event.label}</span>
						</div>
						<div class="border-b border-sage/40 py-2 text-ink/70">{event.date || '—'}</div>
						<div class="border-b border-sage/40 py-2 text-ink/70">{event.place || '—'}</div>
						<div class="border-b border-sage/40 py-2 text-right whitespace-nowrap">
							{#if data.canEdit}
								<button
									type="button"
									onclick={() => startEdit(event.id)}
									class="text-xs text-ink/40 hover:text-ink">{t('common.edit')}</button
								>
								<form method="POST" action="?/deleteEvent" use:enhance class="inline">
									<input type="hidden" name="eventId" value={event.id} />
									<button type="submit" class="ml-2 text-xs text-ink/40 hover:text-red-600"
										>{t('common.remove')}</button
									>
								</form>
							{/if}
						</div>
					{/if}
				{/each}

				<!-- Inline add row -->
				{#if data.canEdit}
					{#key `add:${formKey}`}
						<form class="contents" method="POST" action="?/addEvent" use:enhance={saveEnhance}>
							<EventRowFields
								places={data.places}
								defaultPlace={data.defaultPlace}
								defaultType={data.defaultType}
								hideTypes={usedSingletonTypes}
							/>
							<div class="border-b border-sage/40 py-2 text-right whitespace-nowrap">
								<button
									type="submit"
									class="rounded-md bg-clay px-3 py-1.5 text-xs font-medium text-ink hover:bg-clay/80"
									>{t('person.events.addEvent')}</button
								>
							</div>
						</form>
					{/key}
				{/if}
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
			if (e.target === e.currentTarget) closeRel();
		}}
	>
		<div
			class="flex max-h-[85vh] w-full max-w-lg flex-col overflow-y-auto rounded-lg border border-sage bg-paper p-5 shadow-xl"
		>
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-base font-semibold text-ink">{t('person.relations.heading')}</h2>
				<button
					type="button"
					onclick={closeRel}
					class="text-ink/40 hover:text-ink"
					aria-label={t('common.close')}>✕</button
				>
			</div>

			{#if relMessage}
				<p class="mb-2 text-sm text-red-600">{relMessage}</p>
			{/if}

			<!-- After a second parent is added, ask whether the two parents are a couple. -->
			{#if partnerPrompt}
				<div class="mb-3 rounded-md border border-clay bg-cream/60 p-3 text-sm">
					<p class="text-ink">
						{t('person.relations.partnerPrompt', {
							aName: partnerPrompt.aName,
							bName: partnerPrompt.bName
						})}
					</p>
					<div class="mt-2 flex gap-2">
						<form method="POST" action="?/linkPartners" use:enhance={promptEnhance}>
							<input type="hidden" name="aId" value={partnerPrompt.aId} />
							<input type="hidden" name="bId" value={partnerPrompt.bId} />
							<button
								type="submit"
								class="rounded-md bg-clay px-3 py-1 text-xs font-medium text-ink hover:bg-clay/80"
								>{t('person.relations.partnerPromptYes')}</button
							>
						</form>
						<button
							type="button"
							onclick={afterPartnerPrompt}
							class="rounded-md border border-sage px-3 py-1 text-xs text-ink/70 hover:bg-cream"
							>{t('person.relations.partnerPromptNo')}</button
						>
					</div>
				</div>
			{/if}

			<div class="flex flex-col gap-5">
				<!-- Parents -->
				<div class="flex flex-col gap-2">
					<h3 class="text-xs font-medium tracking-wide text-ink/45 uppercase">
						{t('person.relations.parents')}
					</h3>
					{#each data.parents as p (p.linkId)}
						<div class="flex items-center gap-3 text-sm">
							{@render relRow(p)}
							{@render removeButton('?/removeLink', 'linkId', p.linkId, `parent:${p.linkId}`)}
						</div>
					{/each}
					<RelationAdder
						action="?/addParent"
						verb={t('person.relations.addParent')}
						noun="parent"
						candidates={data.candidates}
						places={data.places}
						onresult={handleRelResult}
					/>
				</div>

				<!-- Partners -->
				<div class="flex flex-col gap-2">
					<h3 class="text-xs font-medium tracking-wide text-ink/45 uppercase">
						{t('person.relations.partners')}
					</h3>
					{#each data.partners as p (p.partnershipId)}
						<div class="flex items-center gap-3 text-sm">
							{@render relRow(p)}
							<span class="text-ink/45"
								>{p.status === 'former' ? t('person.relations.former') : ''}</span
							>
							<form method="POST" action="?/setPartnerStatus" use:enhance>
								<input type="hidden" name="partnershipId" value={p.partnershipId} />
								<input
									type="hidden"
									name="status"
									value={p.status === 'former' ? 'current' : 'former'}
								/>
								<button type="submit" class="text-xs text-ink/40 hover:text-ink"
									>{p.status === 'former'
										? t('person.relations.markCurrent')
										: t('person.relations.markFormer')}</button
								>
							</form>
							{@render removeButton(
								'?/removePartnership',
								'partnershipId',
								p.partnershipId,
								`partnership:${p.partnershipId}`
							)}
						</div>
					{/each}
					<RelationAdder
						action="?/addPartner"
						verb={t('person.relations.addPartner')}
						noun="partner"
						candidates={data.candidates}
						places={data.places}
						requireExtra
						onresult={handleRelResult}
					>
						{#snippet extra()}
							<label class="flex items-center gap-2 text-xs font-medium text-ink/70">
								{t('person.relations.partnerStatus')}
								<select name="status" class={inputClass}>
									<option value="current">{t('person.relations.partnerStatusCurrent')}</option>
									<option value="former">{t('person.relations.partnerStatusFormer')}</option>
								</select>
							</label>
						{/snippet}
					</RelationAdder>
				</div>

				<!-- Children -->
				<div class="flex flex-col gap-2">
					<h3 class="text-xs font-medium tracking-wide text-ink/45 uppercase">
						{t('person.relations.children')}
					</h3>
					{#each data.children as c (c.linkId)}
						<div class="flex items-center gap-3 text-sm">
							{@render relRow(c)}
							{@render removeButton('?/removeLink', 'linkId', c.linkId, `child:${c.linkId}`)}
						</div>
					{/each}
					<RelationAdder
						action="?/addChild"
						verb={t('person.relations.addChild')}
						noun="child"
						candidates={data.candidates}
						places={data.places}
						defaultPlace={data.defaultPlace}
						requireExtra
						onresult={handleRelResult}
					>
						{#snippet extra()}
							<div class="flex flex-col gap-1.5 rounded-md border border-sage/60 bg-cream/30 p-2">
								<span class="text-xs font-medium text-ink/70"
									>{t('person.relations.otherParent')}</span
								>
								{#if coCreate}
									<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
										<input
											name="co_given_names"
											placeholder={t('common.givenNames')}
											class="{inputClass} sm:col-span-1"
										/>
										<input
											name="co_surname"
											placeholder={t('common.surname')}
											class="{inputClass} sm:col-span-1"
										/>
										<select name="co_sex" class="{inputClass} sm:col-span-1">
											<option value="">{t('person.relations.coSexPlaceholder')}</option>
											<option value="female">{t('common.sexFemale')}</option>
											<option value="male">{t('common.sexMale')}</option>
											<option value="other">{t('common.sexOther')}</option>
										</select>
									</div>
									<button
										type="button"
										onclick={() => (coCreate = false)}
										class="self-start text-xs text-ink/50 hover:text-ink"
										>{t('person.relations.pickExisting')}</button
									>
								{:else}
									<select name="coparent_id" class={inputClass}>
										<option value="">{t('person.relations.noneUnknown')}</option>
										{#each data.allPeople as ap (ap.id)}
											<option value={ap.id}>{ap.name}</option>
										{/each}
									</select>
									<button
										type="button"
										onclick={() => (coCreate = true)}
										class="self-start text-xs text-ink/50 hover:text-ink"
										>{t('person.relations.createCoparent')}</button
									>
								{/if}
							</div>
						{/snippet}
					</RelationAdder>
				</div>

				<!-- Siblings — linked through shared parents. -->
				<div class="flex flex-col gap-2">
					<h3 class="text-xs font-medium tracking-wide text-ink/45 uppercase">
						{t('person.relations.siblings')}
					</h3>
					{#each data.siblings as s (s.id)}
						<div class="flex items-center gap-3 text-sm">{@render relRow(s)}</div>
					{/each}
					{#if data.parents.length === 0}
						<p class="text-xs text-ink/45">
							{t('person.relations.noParentForSibling')}
						</p>
					{:else}
						<RelationAdder
							action="?/addSibling"
							verb={t('person.relations.addSibling')}
							noun="sibling"
							candidates={data.candidates}
							places={data.places}
							defaultPlace={data.defaultPlace}
							onresult={handleRelResult}
						/>
						<p class="text-xs text-ink/45">
							{t('person.relations.siblingHint', { parentCount: data.parents.length })}
						</p>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
