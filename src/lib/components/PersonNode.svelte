<script lang="ts" module>
	import { NODE_WIDTH } from '$lib/graph/layout';

	// The cloud/blob silhouette traced from the Figma design. Its natural bounding
	// box is ~x[42,165] y[14,132]; BLOB_OFFSET re-centres it inside the node card.
	const BLOB_PATH =
		'M122.201 129.307C114.665 128.058 107.238 126.827 98.8767 132.247C86.5609 141.257 68.0723 135.237 63.704 120.313C62.8392 117.359 62.2608 114.053 61.6824 110.747C60.1233 101.836 58.5634 92.9199 51.3905 90.8575C43.6907 87.7564 42.061 73.9869 51.4606 71.9748C60.9603 69.9414 60.3011 65.6886 57.1084 57.6511C52.327 47.0576 58.208 33.9638 69.4561 30.6756C73.6511 29.4507 79.1377 29.6615 82.2492 31.2984C93.4661 37.1991 100.687 28.3117 103.583 24.747C103.913 24.3403 104.188 24.003 104.405 23.7647C112.809 14.5508 119.905 24.8839 120.954 26.9911C125.147 35.4223 131.279 37.1145 140.548 36.5433C148.835 36.1041 156.556 41.4492 158.898 49.4552C160.283 54.1844 159.25 59.0243 157.468 63.0426C155.686 67.0604 155.78 71.9952 160.417 77.673C165.055 83.3509 162.481 87.8828 158.554 91.2256C153.22 96.2204 152.176 99.8129 154.046 105.621C156.472 113.156 155.108 124.871 139.701 129.374C133.517 131.182 127.829 130.239 122.201 129.307Z';
	const BLOB_OFFSET = { x: -18.5, y: -10 };
	// Blob bounding box once offset, used to fit the photo image.
	const BLOB_BOX = { x: 23.5, y: 4, w: 123, h: 118 };

	const NAME_RECT = { x: 1.5, y: 124, w: NODE_WIDTH - 3, h: 56, rx: 10 };

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
	{#if person.photoUrl}
		<clipPath id={clipId}>
			<path d={BLOB_PATH} transform="translate({BLOB_OFFSET.x},{BLOB_OFFSET.y})" />
		</clipPath>
	{/if}

	<!-- Blob (cloud) — always cream, with the photo clipped into it when present. -->
	<path
		d={BLOB_PATH}
		transform="translate({BLOB_OFFSET.x},{BLOB_OFFSET.y})"
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

	<!-- Name card — colour encodes sex (sage male, clay female, cream other). -->
	<rect
		x={NAME_RECT.x}
		y={NAME_RECT.y}
		width={NAME_RECT.w}
		height={NAME_RECT.h}
		rx={NAME_RECT.rx}
		fill={rectFill}
		stroke={selected ? '#0D0F0B' : '#0D0F0B'}
		stroke-opacity={selected ? 0.55 : 0.08}
		stroke-width={selected ? 1.5 : 1}
	/>
	<text
		x={NODE_WIDTH / 2}
		y={NAME_RECT.y + NAME_RECT.h / 2}
		text-anchor="middle"
		dominant-baseline="central"
		font-family="Georgia, 'Times New Roman', serif"
		font-size="15"
		fill="#0D0F0B">{label}</text
	>
</g>
