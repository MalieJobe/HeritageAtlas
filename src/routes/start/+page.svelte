<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import PlacePicker from '$lib/components/PlacePicker.svelte';
	import type { PlaceSelection } from '$lib/place';
	import type { ActionData } from './$types';
	import { useI18n } from '$lib/i18n';

	const t = useI18n().t;

	let { form }: { form: ActionData } = $props();

	const STEPS = $derived([
		t('onboarding.stepYourFamily'),
		t('onboarding.stepYou'),
		t('onboarding.stepParents'),
		t('onboarding.stepPartner'),
		t('onboarding.stepChildren')
	]);
	let step = $state(0);

	let treeId = $state('');
	let selfId = $state('');
	let selfSurname = $state('');
	let partnerId = $state<string | null>(null);
	let children = $state([{ given: '', dob: '' }]);

	let birthPlace = $state<PlaceSelection | null>(null);
	let homePlace = $state<PlaceSelection | null>(null);

	const sexes = $derived([
		['female', t('common.sexFemale')],
		['male', t('common.sexMale')],
		['other', t('common.sexOther')]
	] as const);

	function advancer(apply?: (data: Record<string, unknown>) => void): SubmitFunction {
		return () =>
			async ({ result, update }) => {
				if (result.type === 'success') {
					apply?.(result.data ?? {});
					step += 1;
				} else {
					await update();
				}
			};
	}

	const inputClass =
		'w-full rounded-md border border-sage bg-white px-3 py-2 text-sm text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none';
	const label = 'flex flex-col gap-1 text-sm font-medium text-ink/80';
	const fieldHint = 'text-xs font-medium tracking-wide text-ink/45 uppercase';
	// Action buttons sit clearly apart from the fields above.
	const actions = 'mt-6 flex gap-2 border-t border-sage/30 pt-4';
	const primary = 'rounded-md bg-clay px-4 py-2 text-sm font-medium text-ink hover:bg-clay/80';
	const secondary = 'rounded-md border border-sage px-4 py-2 text-sm text-ink/70 hover:bg-cream';

	function finish() {
		goto(resolve('/trees/[treeId]', { treeId }));
	}
</script>

<svelte:head><title>{t('onboarding.title')}</title></svelte:head>

<div class="mx-auto flex w-full max-w-md flex-col gap-6">
	<ol class="flex flex-wrap items-center gap-1.5 text-[11px] text-ink/40">
		{#each STEPS as s, i (s)}
			<li class="flex items-center gap-1.5">
				<span class={i <= step ? 'font-medium text-ink' : ''}>{s}</span>
				{#if i < STEPS.length - 1}<span class="text-ink/25">›</span>{/if}
			</li>
		{/each}
	</ol>

	{#if form?.error}
		<p class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
			{form.error}
		</p>
	{/if}

	{#if step === 0}
		<div class="flex flex-col gap-4">
			<div>
				<h1 class="text-2xl font-semibold text-ink">{t('onboarding.treeHeading')}</h1>
				<p class="mt-1 text-sm text-ink/60">{t('onboarding.treeSubtitle')}</p>
			</div>
			<form
				method="POST"
				action="?/createTree"
				use:enhance={advancer((d) => (treeId = String(d.treeId)))}
			>
				<label class={label}>
					{t('onboarding.treeNameLabel')}
					<input name="name" value={t('onboarding.treeNameDefault')} class={inputClass} />
				</label>
				<div class={actions}>
					<button type="submit" class={primary}>{t('common.continue')}</button>
				</div>
			</form>
		</div>
	{:else if step === 1}
		<div class="flex flex-col gap-4">
			<div>
				<h1 class="text-2xl font-semibold text-ink">{t('onboarding.selfHeading')}</h1>
				<p class="mt-1 text-sm text-ink/60">{t('onboarding.selfSubtitle')}</p>
			</div>
			<form
				method="POST"
				action="?/addSelf"
				enctype="multipart/form-data"
				use:enhance={advancer((d) => {
					selfId = String(d.selfId);
					selfSurname = String(d.selfSurname ?? '');
				})}
			>
				<input type="hidden" name="treeId" value={treeId} />
				<input
					type="hidden"
					name="birthPlace"
					value={birthPlace ? JSON.stringify(birthPlace) : ''}
				/>
				<input
					type="hidden"
					name="residencePlace"
					value={homePlace ? JSON.stringify(homePlace) : ''}
				/>

				<div class="flex flex-col gap-3">
					<div class="flex gap-2">
						<label class="{label} flex-1">
							{t('common.givenNames')}
							<input name="given" class={inputClass} />
						</label>
						<label class="{label} flex-1">
							{t('common.surname')}
							<input name="surname" class={inputClass} />
						</label>
					</div>
					<fieldset class="flex gap-3">
						{#each sexes as [value, text] (value)}
							<label class="flex items-center gap-1.5 text-sm text-ink/70">
								<input type="radio" name="sex" {value} />
								{text}
							</label>
						{/each}
					</fieldset>
					<label class={label}>
						{t('onboarding.dateOfBirth')}
						<input name="birthDate" type="date" class={inputClass} />
					</label>
					<div class="flex flex-col gap-1">
						<span class={fieldHint}>{t('onboarding.placeOfBirth')}</span>
						<PlacePicker selection={birthPlace} onchange={(s) => (birthPlace = s)} />
					</div>
					<div class="flex flex-col gap-1">
						<span class={fieldHint}>{t('onboarding.whereYouLiveNow')}</span>
						<PlacePicker selection={homePlace} onchange={(s) => (homePlace = s)} />
					</div>
					<label class={label}>
						{t('onboarding.photo')}
						<input
							name="photo"
							type="file"
							accept="image/*"
							class="text-sm text-ink/70 file:mr-3 file:rounded-md file:border file:border-sage file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-ink hover:file:bg-cream"
						/>
					</label>
				</div>
				<div class={actions}>
					<button type="submit" class={primary}>{t('common.continue')}</button>
				</div>
			</form>
		</div>
	{:else if step === 2}
		<div class="flex flex-col gap-4">
			<div>
				<h1 class="text-2xl font-semibold text-ink">{t('onboarding.parentsHeading')}</h1>
				<p class="mt-1 text-sm text-ink/60">{t('onboarding.parentsSubtitle')}</p>
			</div>
			<form method="POST" action="?/addParents" use:enhance={advancer()}>
				<input type="hidden" name="treeId" value={treeId} />
				<input type="hidden" name="selfId" value={selfId} />
				<div class="flex flex-col gap-4">
					{#each [['father', t('onboarding.father')], ['mother', t('onboarding.mother')]] as [key, title] (key)}
						<fieldset class="flex flex-col gap-2">
							<legend class={fieldHint}>{title}</legend>
							<div class="flex gap-2">
								<input name="{key}Given" placeholder={t('common.givenNames')} class={inputClass} />
								<input name="{key}Surname" placeholder={t('common.surname')} class={inputClass} />
							</div>
							<div class="flex gap-2">
								<label class="{label} flex-1 text-xs">
									{t('common.born')}
									<input name="{key}Dob" type="date" class={inputClass} />
								</label>
								<label class="{label} flex-1 text-xs">
									{t('common.died')}
									<input name="{key}Dod" type="date" class={inputClass} />
								</label>
							</div>
						</fieldset>
					{/each}
				</div>
				<div class={actions}>
					<button type="submit" class={primary}>{t('common.continue')}</button>
					<button type="button" onclick={() => (step += 1)} class={secondary}
						>{t('common.skip')}</button
					>
				</div>
			</form>
		</div>
	{:else if step === 3}
		<div class="flex flex-col gap-4">
			<div>
				<h1 class="text-2xl font-semibold text-ink">{t('onboarding.partnerHeading')}</h1>
				<p class="mt-1 text-sm text-ink/60">{t('onboarding.partnerSubtitle')}</p>
			</div>
			<form
				method="POST"
				action="?/addPartner"
				use:enhance={advancer((d) => (partnerId = d.partnerId ? String(d.partnerId) : null))}
			>
				<input type="hidden" name="treeId" value={treeId} />
				<input type="hidden" name="selfId" value={selfId} />
				<div class="flex flex-col gap-3">
					<div class="flex gap-2">
						<input name="given" placeholder={t('common.givenNames')} class={inputClass} />
						<input name="surname" placeholder={t('common.surname')} class={inputClass} />
					</div>
					<fieldset class="flex gap-3">
						{#each sexes as [value, text] (value)}
							<label class="flex items-center gap-1.5 text-sm text-ink/70">
								<input type="radio" name="sex" {value} />
								{text}
							</label>
						{/each}
					</fieldset>
				</div>
				<div class={actions}>
					<button type="submit" class={primary}>{t('common.continue')}</button>
					<button type="button" onclick={() => (step += 1)} class={secondary}
						>{t('common.skip')}</button
					>
				</div>
			</form>
		</div>
	{:else if step === 4}
		<div class="flex flex-col gap-4">
			<div>
				<h1 class="text-2xl font-semibold text-ink">{t('onboarding.childrenHeading')}</h1>
				<p class="mt-1 text-sm text-ink/60">{t('onboarding.childrenSubtitle')}</p>
			</div>
			<form method="POST" action="?/addChildren" use:enhance={advancer()}>
				<input type="hidden" name="treeId" value={treeId} />
				<input type="hidden" name="selfId" value={selfId} />
				{#if partnerId}<input type="hidden" name="partnerId" value={partnerId} />{/if}
				<input type="hidden" name="childSurname" value={selfSurname} />
				<div class="flex flex-col gap-2">
					{#each children as child, i (i)}
						<div class="flex gap-2">
							<input
								bind:value={child.given}
								name="childGiven"
								placeholder={t('common.givenNames')}
								class="{inputClass} flex-1"
							/>
							<input
								bind:value={child.dob}
								name="childDob"
								type="date"
								class="{inputClass} flex-1"
							/>
						</div>
					{/each}
				</div>
				<button
					type="button"
					onclick={() => (children = [...children, { given: '', dob: '' }])}
					class="mt-2 text-sm font-medium text-clay hover:underline"
				>
					{t('onboarding.addAnother')}
				</button>
				<div class={actions}>
					<button type="submit" class={primary}>{t('onboarding.finish')}</button>
					<button type="button" onclick={finish} class={secondary}>{t('common.skip')}</button>
				</div>
			</form>
		</div>
	{:else}
		<div class="flex flex-col items-start gap-4">
			<div>
				<h1 class="text-2xl font-semibold text-ink">{t('onboarding.doneHeading')}</h1>
				<p class="mt-1 text-sm text-ink/60">{t('onboarding.doneBody')}</p>
			</div>
			<button type="button" onclick={finish} class={primary}>{t('onboarding.openMyTree')}</button>
		</div>
	{/if}
</div>
