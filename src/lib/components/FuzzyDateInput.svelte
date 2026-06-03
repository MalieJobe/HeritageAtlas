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
</script>

<div class="space-y-2">
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
				type="number"
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
				type="number"
				inputmode="numeric"
				min="1"
				max="31"
				placeholder="—"
				bind:value={day}
				class="{inputClass} w-16"
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
					type="number"
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
					type="number"
					inputmode="numeric"
					min="1"
					max="31"
					placeholder="—"
					bind:value={endDay}
					class="{inputClass} w-16"
				/>
			</label>
		</div>
	{/if}

	<p class="text-xs text-ink/55">
		{#if preview}Reads as: <span class="font-medium text-ink/80">{preview}</span>{:else}No date{/if}
	</p>
</div>
