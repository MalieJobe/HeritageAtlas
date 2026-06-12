<script lang="ts">
	import { untrack } from 'svelte';
	import { useI18n } from '$lib/i18n';
	import {
		EMPTY_FUZZY_DATE_PARTS,
		fuzzyDateFromParts,
		formatFuzzyDate,
		type DateQualifier,
		type FuzzyDateParts
	} from '$lib/fuzzyDate';

	const t = useI18n().t;

	let { value = EMPTY_FUZZY_DATE_PARTS }: { value?: FuzzyDateParts } = $props();

	// Local editing state, seeded once from the (possibly prefilled) value. Native
	// input names mean the server reads these straight off FormData — no hidden
	// fields. untrack makes the one-time seed explicit (the prop never changes after
	// mount, so we don't want to track it).
	const seed = untrack(() => value);
	let qualifier = $state<DateQualifier | ''>(seed.qualifier ?? '');
	let year = $state(seed.year?.toString() ?? '');
	let month = $state(seed.month?.toString() ?? '');
	let day = $state(seed.day?.toString() ?? '');
	let endYear = $state(seed.endYear?.toString() ?? '');
	let endMonth = $state(seed.endMonth?.toString() ?? '');
	let endDay = $state(seed.endDay?.toString() ?? '');

	const num = (s: string) => {
		const n = Number.parseInt(s, 10);
		return Number.isFinite(n) ? n : null;
	};

	let preview = $derived(
		formatFuzzyDate(
			fuzzyDateFromParts({
				year: num(year),
				month: num(month),
				day: num(day),
				qualifier: qualifier || null,
				endYear: num(endYear),
				endMonth: num(endMonth),
				endDay: num(endDay)
			})
		)
	);

	// Precision is implied by how much is filled in — surfaced as a hint so the
	// reusable input doubles as a precision picker (task 5.8). A day is meaningless
	// without a month, so the day fields are disabled (and cleared) until a month is
	// chosen.
	let precision = $derived(day ? 'day' : month ? 'month' : year ? 'year' : null);
	$effect(() => {
		if (!month && day) day = '';
	});
	$effect(() => {
		if (!endMonth && endDay) endDay = '';
	});

	function clear() {
		qualifier = '';
		year = month = day = '';
		endYear = endMonth = endDay = '';
	}

	let MONTHS = $derived([
		t('map.date.month1'),
		t('map.date.month2'),
		t('map.date.month3'),
		t('map.date.month4'),
		t('map.date.month5'),
		t('map.date.month6'),
		t('map.date.month7'),
		t('map.date.month8'),
		t('map.date.month9'),
		t('map.date.month10'),
		t('map.date.month11'),
		t('map.date.month12')
	]);

	const inputClass =
		'rounded-md border border-sage bg-white px-2 py-1.5 text-sm text-ink focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none';

	// Shown as a compact field; the controls live in a popover so rows stay clean.
	// The popover is toggled with `hidden` (not removed) so its inputs still submit.
	let open = $state(false);
	let containerEl = $state<HTMLDivElement>();
	$effect(() => {
		if (!open) return;
		const onDown = (e: PointerEvent) => {
			if (containerEl && !containerEl.contains(e.target as Node)) open = false;
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') open = false;
		};
		document.addEventListener('pointerdown', onDown);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('pointerdown', onDown);
			document.removeEventListener('keydown', onKey);
		};
	});
</script>

<div class="relative" bind:this={containerEl}>
	<button
		type="button"
		onclick={() => (open = !open)}
		aria-haspopup="dialog"
		aria-expanded={open}
		class="w-full rounded-md border border-sage bg-white px-3 py-1.5 text-left text-sm text-ink hover:border-clay focus:border-clay focus:ring-1 focus:ring-clay focus:outline-none"
	>
		{#if preview}<span class="text-ink">{preview}</span>{:else}<span class="text-ink/40"
				>{t('map.date.addDate')}</span
			>{/if}
	</button>

	<!-- Opens upward so it never runs off the bottom of the page. -->
	<div
		class:hidden={!open}
		class="absolute bottom-full z-20 mb-1 w-64 space-y-2 rounded-md border border-sage bg-paper p-3 shadow-lg"
	>
		<div class="flex flex-wrap items-end gap-2">
			<label class="flex flex-col gap-1 text-xs font-medium text-ink/60">
				{t('map.date.qualifier')}
				<select name="qualifier" bind:value={qualifier} class={inputClass}>
					<option value="">{t('map.date.exact')}</option>
					<option value="about">{t('map.date.about')}</option>
					<option value="before">{t('map.date.before')}</option>
					<option value="after">{t('map.date.after')}</option>
					<option value="between">{t('map.date.between')}</option>
					<option value="estimated">{t('map.date.estimated')}</option>
				</select>
			</label>
			<label class="flex flex-col gap-1 text-xs font-medium text-ink/60">
				{t('map.date.year')}
				<input
					name="year"
					type="text"
					inputmode="numeric"
					placeholder="1900"
					bind:value={year}
					class="{inputClass} w-24"
				/>
			</label>
			<label class="flex flex-col gap-1 text-xs font-medium text-ink/60">
				{t('map.date.month')}
				<select name="month" bind:value={month} class={inputClass}>
					<option value="">—</option>
					{#each MONTHS as label, i (i)}
						<option value={String(i + 1)}>{label}</option>
					{/each}
				</select>
			</label>
			<label class="flex flex-col gap-1 text-xs font-medium text-ink/60">
				{t('map.date.day')}
				<input
					name="day"
					type="text"
					inputmode="numeric"
					min="1"
					max="31"
					placeholder="—"
					disabled={!month}
					title={month ? undefined : 'Pick a month first'}
					bind:value={day}
					class="{inputClass} w-16 disabled:cursor-not-allowed disabled:bg-cream/60 disabled:text-ink/30"
				/>
			</label>
		</div>

		{#if qualifier === 'between'}
			<div class="flex flex-wrap items-end gap-2">
				<span class="pb-1.5 text-xs font-medium text-ink/45">{t('map.date.and')}</span>
				<label class="flex flex-col gap-1 text-xs font-medium text-ink/60">
					{t('map.date.endYear')}
					<input
						name="end_year"
						type="text"
						inputmode="numeric"
						placeholder="1905"
						bind:value={endYear}
						class="{inputClass} w-24"
					/>
				</label>
				<label class="flex flex-col gap-1 text-xs font-medium text-ink/60">
					{t('map.date.month')}
					<select name="end_month" bind:value={endMonth} class={inputClass}>
						<option value="">—</option>
						{#each MONTHS as label, i (i)}
							<option value={String(i + 1)}>{label}</option>
						{/each}
					</select>
				</label>
				<label class="flex flex-col gap-1 text-xs font-medium text-ink/60">
					{t('map.date.day')}
					<input
						name="end_day"
						type="text"
						inputmode="numeric"
						min="1"
						max="31"
						placeholder="—"
						disabled={!endMonth}
						title={endMonth ? undefined : 'Pick a month first'}
						bind:value={endDay}
						class="{inputClass} w-16 disabled:cursor-not-allowed disabled:bg-cream/60 disabled:text-ink/30"
					/>
				</label>
			</div>
		{/if}

		<div class="flex items-center justify-between gap-2 border-t border-sage/60 pt-2">
			<p class="text-xs text-ink/55">
				{#if preview}
					{t('map.date.readsAs')} <span class="font-medium text-ink/80">{preview}</span>
					{#if precision}<span class="text-ink/40">
							· {t('map.date.precision', { precision })}</span
						>{/if}
				{:else}
					{t('map.date.noDate')}
				{/if}
			</p>
			<div class="flex items-center gap-1">
				{#if preview}
					<button
						type="button"
						onclick={clear}
						class="rounded px-2 py-1 text-xs text-ink/55 hover:bg-cream hover:text-ink"
					>
						{t('map.date.clear')}
					</button>
				{/if}
				<button
					type="button"
					onclick={() => (open = false)}
					class="rounded bg-clay px-2.5 py-1 text-xs font-medium text-ink hover:bg-clay/80"
				>
					{t('map.date.done')}
				</button>
			</div>
		</div>
	</div>
</div>
