<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import FamilyGraph from '$lib/components/FamilyGraph.svelte';
	import MapView from '$lib/components/MapView.svelte';
	import Timeline from '$lib/components/Timeline.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Live read-only demo state (the Windsor tree).
	let demo = $derived(data.demo);
	const fallbackMax = new Date().getFullYear();
	let demoYear = $state(untrack(() => demo?.timeline?.max ?? fallbackMax));
	let demoSelected = $state<string | null>(null);

	const steps = [
		['Add your family', 'Add people and link parents, partners, and children into a tree.'],
		['Add places & dates', 'Record births, deaths, and where they lived — with real coordinates.'],
		[
			'Watch them move',
			'Scrub the timeline and watch your family travel the map, decade by decade.'
		]
	];

	const features = [
		['🌳', 'Interactive tree', 'A clean, pannable family tree that lays itself out automatically.'],
		['🗺️', 'Historical map', 'See where everyone lived, plotted on a real map of the world.'],
		[
			'🕰️',
			'Time-travel slider',
			'Sweep through the years and watch people move, age, and pass on.'
		],
		['⤓', 'GEDCOM import', 'Bring an existing tree from Ancestry, MyHeritage, and more (soon).']
	];
</script>

<svelte:head><title>HeritageAtlas — map your family across time</title></svelte:head>

<div class="flex flex-col gap-20 py-8">
	<!-- Hero -->
	<section class="flex flex-col items-center gap-6 pt-8 text-center">
		<h1 class="max-w-3xl text-4xl font-bold tracking-tight text-ink sm:text-5xl">
			Map your family across time.
		</h1>
		<p class="max-w-xl text-lg text-ink/65">
			Build your family tree and watch your ancestors move across the world, decade by decade.
		</p>
		<div class="flex flex-wrap items-center justify-center gap-3">
			<a
				href={resolve('/auth/signup')}
				class="rounded-lg bg-clay px-5 py-2.5 font-medium text-ink shadow-sm hover:bg-clay/80"
			>
				Start your family tree
			</a>
			<a href="#demo" class="px-4 py-2.5 font-medium text-ink/70 hover:text-ink">
				Explore the demo ↓
			</a>
		</div>
	</section>

	<!-- Demo (live embed lands here in 3.5) -->
	<section id="demo" class="flex scroll-mt-20 flex-col gap-4">
		<div class="flex flex-col gap-1 text-center">
			<h2 class="text-2xl font-semibold text-ink">See it in action: the House of Windsor</h2>
			<p class="text-sm text-ink/60">
				A real, interactive tree — scrub the years and watch the royals move across Europe.
			</p>
		</div>
		{#if demo}
			<div class="overflow-hidden rounded-xl border border-sage bg-paper shadow-sm">
				<div class="flex h-96">
					<div class="min-w-0 flex-1 border-r border-sage">
						<FamilyGraph
							graph={demo.graph}
							treeId={demo.tree.id}
							selectedId={demoSelected}
							year={demoYear}
							fill
							readonly
							onselect={(id) => (demoSelected = id)}
						/>
					</div>
					<div class="min-w-0 flex-1">
						<MapView
							persons={demo.map.persons}
							year={demoYear}
							selectedId={demoSelected}
							height={null}
							onselect={(id) => (demoSelected = id)}
						/>
					</div>
				</div>
				<Timeline
					bind:year={demoYear}
					defaultMin={demo.timeline?.min ?? 1900}
					defaultMax={demo.timeline?.max ?? fallbackMax}
				/>
			</div>
		{:else}
			<div
				class="grid h-96 place-items-center rounded-xl border border-dashed border-sage bg-paper text-sm text-ink/40"
			>
				Demo unavailable
			</div>
		{/if}
	</section>

	<!-- How it works -->
	<section class="flex flex-col gap-6">
		<h2 class="text-center text-2xl font-semibold text-ink">How it works</h2>
		<ol class="grid gap-6 sm:grid-cols-3">
			{#each steps as [title, body], i (title)}
				<li class="flex flex-col gap-2">
					<span
						class="grid h-8 w-8 place-items-center rounded-full bg-sage/50 text-sm font-bold text-ink"
					>
						{i + 1}
					</span>
					<h3 class="font-semibold text-ink">{title}</h3>
					<p class="text-sm text-ink/60">{body}</p>
				</li>
			{/each}
		</ol>
	</section>

	<!-- Features -->
	<section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		{#each features as [icon, title, body] (title)}
			<div class="flex flex-col gap-2 rounded-xl border border-sage bg-white p-5">
				<span class="text-2xl">{icon}</span>
				<h3 class="font-semibold text-ink">{title}</h3>
				<p class="text-sm text-ink/60">{body}</p>
			</div>
		{/each}
	</section>

	<!-- Closing CTA -->
	<section class="flex flex-col items-center gap-4 rounded-2xl bg-cream/60 px-6 py-12 text-center">
		<h2 class="text-2xl font-semibold text-ink">Start mapping your family today.</h2>
		<a
			href={resolve('/auth/signup')}
			class="rounded-lg bg-clay px-5 py-2.5 font-medium text-ink shadow-sm hover:bg-clay/80"
		>
			Create your free account
		</a>
	</section>

	<!-- Footer -->
	<footer class="flex flex-col items-center gap-2 border-t border-sage pt-6 text-sm text-ink/50">
		<p>HeritageAtlas — record your family's history and see it on the map.</p>
		<nav class="flex gap-4">
			<a href={resolve('/auth/login')} class="hover:text-ink">Log in</a>
			<a href={resolve('/auth/signup')} class="hover:text-ink">Sign up</a>
		</nav>
	</footer>
</div>
