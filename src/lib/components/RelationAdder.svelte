<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import { enhance } from '$app/forms';
	import { useI18n } from '$lib/i18n';
	import FuzzyDateInput from '$lib/components/FuzzyDateInput.svelte';
	import PlacePicker from '$lib/components/PlacePicker.svelte';
	import type { Place, PlaceSelection } from '$lib/place';

	const t = useI18n().t;

	let {
		action,
		verb,
		noun,
		candidates,
		places = [],
		defaultPlace = null,
		requireExtra = false,
		onresult,
		extra
	}: {
		/** Form action, e.g. '?/addParent'. */
		action: string;
		/** Submit-button label, e.g. 'Add parent'. */
		verb: string;
		/** Lower-case relation noun for placeholder/copy, e.g. 'parent'. */
		noun: string;
		/** Existing people offered for linking. */
		candidates: { id: string; name: string }[];
		places?: Place[];
		/** Pre-fills the birthplace when creating a new relative (editable). */
		defaultPlace?: PlaceSelection | null;
		/** When true, picking an existing person stages them (so `extra` controls — a
		 *  status or co-parent — can be set) instead of submitting immediately. */
		requireExtra?: boolean;
		/** Called with the action's returned data after each submit. */
		onresult: (data: Record<string, unknown> | undefined) => void;
		/** Extra form controls submitted alongside (partner status / child co-parent). */
		extra?: Snippet;
	} = $props();

	let view = $state<'search' | 'staged' | 'create'>('search');
	let query = $state('');
	let open = $state(false);
	let selId = $state('');
	let selName = $state('');
	let given = $state('');
	let placeSel = $state<PlaceSelection | null>(null);
	let comboEl = $state<HTMLDivElement>();
	let formEl = $state<HTMLFormElement>();

	let matches = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return q ? candidates.filter((c) => c.name.toLowerCase().includes(q)) : candidates;
	});

	async function pickExisting(c: { id: string; name: string }) {
		selId = c.id;
		selName = c.name;
		open = false;
		view = 'staged';
		// Simple relations (no extra controls) submit straight away — wait for the
		// staged hidden inputs (mode, personId) to render first.
		if (!requireExtra) {
			await tick();
			formEl?.requestSubmit();
		}
	}

	function startCreate() {
		open = false;
		given = query;
		placeSel = defaultPlace;
		view = 'create';
	}

	function reset() {
		view = 'search';
		query = '';
		selId = '';
		selName = '';
		given = '';
		placeSel = null;
		open = false;
	}

	const onSubmit = () => {
		return async ({
			result,
			update
		}: {
			result: { type: string; data?: Record<string, unknown> };
			update: (opts?: { reset?: boolean }) => Promise<void>;
		}) => {
			await update({ reset: false });
			if (result.type === 'success') reset();
			onresult(result.data);
		};
	};

	const inputClass =
		'rounded-md border border-sage bg-white px-3 py-2 text-sm text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none';
</script>

<form bind:this={formEl} method="POST" {action} use:enhance={onSubmit} class="flex flex-col gap-2">
	{#if view === 'search'}
		<div
			class="relative"
			bind:this={comboEl}
			onfocusout={(e) => {
				if (comboEl && !comboEl.contains(e.relatedTarget as Node)) open = false;
			}}
		>
			<input
				type="text"
				role="combobox"
				aria-controls="reladd-{noun}-list"
				aria-expanded={open}
				autocomplete="off"
				bind:value={query}
				onfocus={() => (open = true)}
				placeholder={t('map.relation.searchPlaceholder', { noun })}
				class="{inputClass} w-full"
			/>
			{#if open}
				<div
					id="reladd-{noun}-list"
					class="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-sage bg-paper shadow-lg"
				>
					{#each matches as c (c.id)}
						<button
							type="button"
							onclick={() => pickExisting(c)}
							class="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-cream"
						>
							{c.name}
						</button>
					{:else}
						<p class="px-3 py-2 text-xs text-ink/45">{t('map.relation.noPeople')}</p>
					{/each}
					<button
						type="button"
						onclick={startCreate}
						class="block w-full border-t border-sage/60 bg-cream/40 px-3 py-2 text-left text-sm font-medium text-ink hover:bg-cream"
					>
						{t('map.relation.createNew', {
							noun,
							suffix: query.trim() ? ` “${query.trim()}”` : ''
						})}
					</button>
				</div>
			{/if}
		</div>
	{:else if view === 'staged'}
		<input type="hidden" name="mode" value="existing" />
		<input type="hidden" name="personId" value={selId} />
		<p class="text-sm text-ink">
			{t('map.relation.link')} <span class="font-medium">{selName}</span>
		</p>
		{@render extra?.()}
		<div class="flex items-center gap-2">
			<button
				type="submit"
				class="rounded-md bg-clay px-3 py-1.5 text-sm font-medium text-ink hover:bg-clay/80"
			>
				{verb}
			</button>
			<button type="button" onclick={reset} class="text-xs text-ink/50 hover:text-ink"
				>{t('common.cancel')}</button
			>
		</div>
	{:else}
		<!-- Create-new quick add: name + sex + DOB + birthplace. -->
		<input type="hidden" name="mode" value="create" />
		<input type="hidden" name="type" value="birth" />
		<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
			<label class="flex flex-col gap-1 text-xs font-medium text-ink/70">
				{t('common.givenNames')}
				<input name="given_names" type="text" bind:value={given} class={inputClass} />
			</label>
			<label class="flex flex-col gap-1 text-xs font-medium text-ink/70">
				{t('common.surname')}
				<input name="surname" type="text" class={inputClass} />
			</label>
			<label class="flex flex-col gap-1 text-xs font-medium text-ink/70">
				{t('common.birthSurname')}
				<input name="birth_surname" type="text" class={inputClass} />
			</label>
			<label class="flex flex-col gap-1 text-xs font-medium text-ink/70">
				{t('common.sex')}
				<select name="sex" class={inputClass}>
					<option value="">{t('common.sexUnspecified')}</option>
					<option value="female">{t('common.sexFemale')}</option>
					<option value="male">{t('common.sexMale')}</option>
					<option value="other">{t('common.sexOther')}</option>
				</select>
			</label>
		</div>
		<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
			<div class="flex flex-col gap-1 text-xs font-medium text-ink/70">
				{t('common.born')}
				<FuzzyDateInput />
			</div>
			<div class="flex flex-col gap-1 text-xs font-medium text-ink/70">
				{t('map.relation.birthplace')}
				<PlacePicker {places} selection={placeSel} onchange={(s) => (placeSel = s)} />
				<input
					type="hidden"
					name="place_selection"
					value={placeSel ? JSON.stringify(placeSel) : ''}
				/>
			</div>
		</div>
		{@render extra?.()}
		<div class="flex items-center gap-2">
			<button
				type="submit"
				class="rounded-md bg-clay px-3 py-1.5 text-sm font-medium text-ink hover:bg-clay/80"
			>
				{t('map.relation.createAndVerb', { verb: verb.toLowerCase() })}
			</button>
			<button type="button" onclick={reset} class="text-xs text-ink/50 hover:text-ink"
				>{t('common.cancel')}</button
			>
		</div>
	{/if}
</form>
