<script lang="ts">
	import { untrack } from 'svelte';
	import {
		EMPTY_FUZZY_DATE_PARTS,
		fuzzyDateFromParts,
		formatFuzzyDate,
		type DateQualifier,
		type FuzzyDateParts
	} from '$lib/fuzzyDate';

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

	const MONTHS = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];

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
				>Add date</span
			>{/if}
	</button>

	<!-- Opens upward so it never runs off the bottom of the page. -->
	<div
		class:hidden={!open}
		class="absolute bottom-full z-20 mb-1 w-64 space-y-2 rounded-md border border-sage bg-paper p-3 shadow-lg"
	>
		<div class="flex flex-wrap items-end gap-2">
			<label class="flex flex-col gap-1 text-xs font-medium text-ink/60">
				Qualifier
				<select name="qualifier" bind:value={qualifier} class={inputClass}>
					<option value="">Exact</option>
					<option value="about">About</option>
					<option value="before">Before</option>
					<option value="after">After</option>
					<option value="between">Between</option>
					<option value="estimated">Estimated</option>
				</select>
			</label>
			<label class="flex flex-col gap-1 text-xs font-medium text-ink/60">
				Year
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
				Month
				<select name="month" bind:value={month} class={inputClass}>
					<option value="">—</option>
					{#each MONTHS as label, i (i)}
						<option value={String(i + 1)}>{label}</option>
					{/each}
				</select>
			</label>
			<label class="flex flex-col gap-1 text-xs font-medium text-ink/60">
				Day
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
				<span class="pb-1.5 text-xs font-medium text-ink/45">and</span>
				<label class="flex flex-col gap-1 text-xs font-medium text-ink/60">
					End year
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
					Month
					<select name="end_month" bind:value={endMonth} class={inputClass}>
						<option value="">—</option>
						{#each MONTHS as label, i (i)}
							<option value={String(i + 1)}>{label}</option>
						{/each}
					</select>
				</label>
				<label class="flex flex-col gap-1 text-xs font-medium text-ink/60">
					Day
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
					Reads as: <span class="font-medium text-ink/80">{preview}</span>
					{#if precision}<span class="text-ink/40"> · {precision} precision</span>{/if}
				{:else}
					No date
				{/if}
			</p>
			<div class="flex items-center gap-1">
				{#if preview}
					<button
						type="button"
						onclick={clear}
						class="rounded px-2 py-1 text-xs text-ink/55 hover:bg-cream hover:text-ink"
					>
						Clear
					</button>
				{/if}
				<button
					type="button"
					onclick={() => (open = false)}
					class="rounded bg-clay px-2.5 py-1 text-xs font-medium text-ink hover:bg-clay/80"
				>
					Done
				</button>
			</div>
		</div>
	</div>
</div>
