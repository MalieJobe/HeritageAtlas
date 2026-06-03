<script lang="ts" module>
	import { NODE_WIDTH } from '$lib/graph/layout';

	// Cloud/blob silhouette from the Figma design (natural box ~x[31,145] y[-5,112]),
	// horizontally centred in the 167-wide card. Drawn in FRONT of the name card so
	// it overlaps the card's top edge.
	const BLOB_PATH =
		'M102.201 109.307C94.6647 108.058 87.2378 106.827 78.8767 112.247C66.5609 121.257 48.0723 115.237 43.704 100.313C42.8392 97.3588 42.2608 94.0532 41.6824 90.747C40.1233 81.8358 38.5634 72.9199 31.3905 70.8575C23.6907 67.7564 22.061 53.9869 31.4606 51.9748C40.9603 49.9414 40.3011 45.6886 37.1084 37.6511C32.327 27.0576 38.208 13.9638 49.4561 10.6756C53.6511 9.45073 59.1377 9.66154 62.2492 11.2984C73.4661 17.1991 80.6868 8.31166 83.5831 4.74698C83.9134 4.34034 84.1876 4.00296 84.4049 3.7647C92.8086 -5.4492 99.9054 4.88391 100.954 6.99113C105.147 15.4223 111.279 17.1145 120.548 16.5433C128.835 16.1041 136.556 21.4492 138.898 29.4552C140.283 34.1844 139.25 39.0243 137.468 43.0426C135.686 47.0604 135.78 51.9952 140.417 57.673C145.055 63.3509 142.481 67.8828 138.554 71.2256C133.22 76.2204 132.176 79.8129 134.046 85.621C136.472 93.1556 135.108 104.871 119.701 109.374C113.517 111.182 107.829 110.239 102.201 109.307Z';
	// Generously larger than the blob's bounding box so the photo fills the whole
	// silhouette (the image is clipped to the path, so the overscan is hidden).
	const BLOB_BOX = { x: 18, y: -12, w: 132, h: 134 };

	const NAME_RECT = { x: 0.5, y: 108, w: NODE_WIDTH - 1, h: 57, rx: 10 };

	const SEX_FILL: Record<string, string> = {
		male: '#C3CEB6',
		female: '#E9BA9C',
		other: '#F6F3DB'
	};
</script>

<script lang="ts">
	import type { GraphPerson } from '$lib/graph/types';

	let {
		person,
		selected = false,
		onselect
	}: {
		person: GraphPerson;
		selected?: boolean;
		onselect?: (id: string) => void;
	} = $props();

	let clipId = $derived(`blob-${person.id}`);
	let rectFill = $derived(SEX_FILL[person.sex ?? ''] ?? SEX_FILL.other);
	// Keep names from overflowing the card; SVG has no native ellipsis.
	let label = $derived(person.name.length > 22 ? `${person.name.slice(0, 21)}…` : person.name);
</script>

<g
	role="button"
	tabindex="0"
	aria-label={person.name}
	class="cursor-pointer focus:outline-none"
	onclick={() => onselect?.(person.id)}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onselect?.(person.id);
		}
	}}
>
	<!-- Name card (behind the blob) — colour encodes sex (sage male, clay female, cream other). -->
	<rect
		x={NAME_RECT.x}
		y={NAME_RECT.y}
		width={NAME_RECT.w}
		height={NAME_RECT.h}
		rx={NAME_RECT.rx}
		fill={rectFill}
		stroke="#0D0F0B"
		stroke-opacity={selected ? 0.55 : 0.08}
		stroke-width={selected ? 1.5 : 1}
	/>
	<text
		x={NODE_WIDTH / 2}
		y={NAME_RECT.y + 22}
		text-anchor="middle"
		dominant-baseline="central"
		font-family="Georgia, 'Times New Roman', serif"
		font-size="15"
		fill="#0D0F0B">{label}</text
	>
	{#if person.birthYear != null}
		<text
			x={10}
			y={NAME_RECT.y + NAME_RECT.h - 11}
			text-anchor="start"
			font-family="Georgia, 'Times New Roman', serif"
			font-size="11"
			fill="#0D0F0B"
			fill-opacity="0.75">✳ {person.birthYear}</text
		>
	{/if}
	{#if person.deathYear != null}
		<text
			x={NODE_WIDTH - 10}
			y={NAME_RECT.y + NAME_RECT.h - 11}
			text-anchor="end"
			font-family="Georgia, 'Times New Roman', serif"
			font-size="11"
			fill="#0D0F0B"
			fill-opacity="0.75">† {person.deathYear}</text
		>
	{/if}

	{#if person.photoUrl}
		<clipPath id={clipId}>
			<path d={BLOB_PATH} />
		</clipPath>
	{/if}

	<!-- Blob (cloud) — always cream, with the photo clipped into it when present. -->
	<path
		d={BLOB_PATH}
		fill="#F6F3DB"
		stroke="#0D0F0B"
		stroke-opacity={selected ? 0.4 : 0.12}
		stroke-width="1"
	/>
	{#if person.photoUrl}
		<image
			href={person.photoUrl}
			x={BLOB_BOX.x}
			y={BLOB_BOX.y}
			width={BLOB_BOX.w}
			height={BLOB_BOX.h}
			preserveAspectRatio="xMidYMid slice"
			clip-path="url(#{clipId})"
		/>
	{:else}
		<text
			x={BLOB_BOX.x + BLOB_BOX.w / 2}
			y={BLOB_BOX.y + BLOB_BOX.h / 2}
			text-anchor="middle"
			dominant-baseline="central"
			font-family="Georgia, 'Times New Roman', serif"
			font-size="34"
			fill="#0D0F0B"
			fill-opacity="0.45">{person.initials}</text
		>
	{/if}
</g>
