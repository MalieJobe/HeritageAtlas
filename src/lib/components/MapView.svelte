<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { osmRasterStyle } from '$lib/map/style';
	import { surnameColor } from '$lib/surnameColor';
	import { resolvePositions } from '$lib/map/positionResolver';
	import type { MapPerson, ResolvedPosition } from '$lib/map/types';

	let {
		persons,
		year,
		selectedId = null,
		height = 560,
		onselect
	}: {
		persons: MapPerson[];
		/** Timeline year to resolve positions at (task 2.10). */
		year: number;
		/** Currently selected person id — shared so other panes can highlight (task 2.12). */
		selectedId?: string | null;
		/** Fixed pixel height; pass `null` to fill the parent (split view). */
		height?: number | null;
		onselect?: (id: string | null) => void;
	} = $props();

	// Who is where, at this year. Recomputed when the year (or data) changes so the
	// dots are ready to move once the timeline slider drives `year` (task 2.16).
	let positions = $derived(resolvePositions(persons, year));

	let el: HTMLDivElement;
	// maplibre-gl touches `window`, so it's imported dynamically (client-only).
	let maplibre: typeof import('maplibre-gl') | undefined;
	let map: import('maplibre-gl').Map | undefined;
	let ready = $state(false);
	let fitted = false;

	// One marker per person, reconciled in place so scrubbing the year animates
	// dots rather than tearing them all down. Plain Maps on purpose — these are
	// imperative DOM bookkeeping, not reactive state (the $effect drives updates).
	/* eslint-disable svelte/prefer-svelte-reactivity */
	const markers = new Map<string, import('maplibre-gl').Marker>();
	const elements = new Map<string, HTMLButtonElement>();
	/* eslint-enable svelte/prefer-svelte-reactivity */

	/** Build the dot element for a person: avatar + surname-coloured ring (task 2.11). */
	function buildElement(p: MapPerson): HTMLButtonElement {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'ha-dot';
		button.title = p.name;
		button.setAttribute('aria-label', p.name);
		button.style.borderColor = surnameColor(p.surname);

		if (p.photoUrl) {
			const img = document.createElement('img');
			img.src = p.photoUrl;
			img.alt = '';
			img.className = 'ha-dot-img';
			button.appendChild(img);
		} else {
			const span = document.createElement('span');
			span.className = 'ha-dot-initials';
			span.textContent = p.initials;
			button.appendChild(span);
		}

		button.addEventListener('click', (event) => {
			event.stopPropagation();
			onselect?.(p.id);
		});
		return button;
	}

	/** Add / move / remove markers to match the resolved positions. */
	function syncMarkers(current: ResolvedPosition[]) {
		if (!map || !maplibre) return;
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local bookkeeping, not reactive
		const live = new Set<string>();

		for (const pos of current) {
			const id = pos.person.id;
			live.add(id);
			let marker = markers.get(id);
			if (!marker) {
				const element = buildElement(pos.person);
				elements.set(id, element);
				marker = new maplibre.Marker({ element, anchor: 'center' });
				marker.setLngLat([pos.lng, pos.lat]).addTo(map);
				markers.set(id, marker);
			} else {
				marker.setLngLat([pos.lng, pos.lat]);
			}
		}

		// Drop anyone who no longer has a position at this year.
		for (const [id, marker] of markers) {
			if (!live.has(id)) {
				marker.remove();
				markers.delete(id);
				elements.delete(id);
			}
		}

		applySelection();
	}

	/** Reflect the selected id onto the marker elements. */
	function applySelection() {
		for (const [id, element] of elements) {
			element.classList.toggle('ha-dot-selected', id === selectedId);
			element.style.zIndex = id === selectedId ? '10' : '';
		}
	}

	/** Fit the viewport to all dots once, on first render. */
	function fitToPositions(current: ResolvedPosition[]) {
		if (!map || !maplibre || fitted || current.length === 0) return;
		if (current.length === 1) {
			map.jumpTo({ center: [current[0].lng, current[0].lat], zoom: 6 });
		} else {
			const bounds = new maplibre.LngLatBounds();
			for (const pos of current) bounds.extend([pos.lng, pos.lat]);
			map.fitBounds(bounds, { padding: 64, maxZoom: 9, animate: false });
		}
		fitted = true;
	}

	onMount(async () => {
		maplibre = await import('maplibre-gl');
		map = new maplibre.Map({
			container: el,
			style: osmRasterStyle,
			center: [10, 50],
			zoom: 3,
			attributionControl: { compact: true }
		});
		map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
		// Clicking empty map clears the selection.
		map.on('click', () => onselect?.(null));
		map.on('load', () => {
			ready = true;
			fitToPositions(positions);
			syncMarkers(positions);
		});
	});

	// Reconcile whenever the resolved positions change (year scrub / data edits).
	$effect(() => {
		if (ready) syncMarkers(positions);
	});

	// Re-apply selection styling when the selected id changes from outside.
	$effect(() => {
		void selectedId;
		if (ready) applySelection();
	});

	// Glide to the selected dot when the selection changes (split-view sync, task
	// 2.14). Only on a genuine selection change — untrack `positions` so scrubbing
	// the year doesn't keep chasing the dot around.
	let centeredFor: string | null = null;
	$effect(() => {
		const id = selectedId;
		if (!ready || !map) return;
		if (id === centeredFor) return;
		centeredFor = id;
		if (!id) return;
		const pos = untrack(() => positions).find((p) => p.person.id === id);
		if (pos) map.easeTo({ center: [pos.lng, pos.lat], duration: 550 });
	});

	// Keep the canvas sized to its container (the split-view divider resizes it).
	$effect(() => {
		if (!ready || !el) return;
		const ro = new ResizeObserver(() => map?.resize());
		ro.observe(el);
		return () => ro.disconnect();
	});

	onDestroy(() => {
		for (const marker of markers.values()) marker.remove();
		markers.clear();
		elements.clear();
		map?.remove();
	});
</script>

<div
	bind:this={el}
	class="w-full overflow-hidden rounded-lg border border-sage {height == null ? 'h-full' : ''}"
	style={height == null ? undefined : `height:${height}px`}
></div>

<style>
	/* Marker elements live outside the component's scoped subtree (MapLibre moves
	   them into its own container), so these are deliberately global. */
	:global(.ha-dot) {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		padding: 0;
		border-radius: 9999px;
		border: 3px solid var(--ha-dot-border, #c3ceb6);
		background: #fafbf9;
		overflow: hidden;
		cursor: pointer;
		box-shadow: 0 1px 4px rgba(13, 15, 11, 0.35);
		transition:
			transform 0.12s ease,
			box-shadow 0.12s ease;
	}
	:global(.ha-dot:hover) {
		transform: scale(1.08);
	}
	:global(.ha-dot-selected) {
		transform: scale(1.18);
		box-shadow:
			0 0 0 3px #e9ba9c,
			0 2px 8px rgba(13, 15, 11, 0.45);
	}
	:global(.ha-dot-img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	:global(.ha-dot-initials) {
		font-size: 14px;
		font-weight: 600;
		color: rgba(13, 15, 11, 0.7);
	}
</style>
