<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { osmRasterStyle } from '$lib/map/style';
	import { surnameColor } from '$lib/surnameColor';
	import { resolvePositions } from '$lib/map/positionResolver';
	import { spreadCoincident, clusterPoints, type Cluster } from '$lib/map/cluster';
	import type { MapPerson } from '$lib/map/types';

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

	// Who is where at this year, then fanned out so coincident people never sit on
	// the exact same spot. Recomputed when the year (or data) changes so the dots
	// are ready to move once the timeline slider drives `year`.
	let positions = $derived(resolvePositions(persons, year));
	let points = $derived(spreadCoincident(positions));

	let el: HTMLDivElement;
	// maplibre-gl touches `window`, so it's imported dynamically (client-only).
	let maplibre: typeof import('maplibre-gl') | undefined;
	let map: import('maplibre-gl').Map | undefined;
	let ready = $state(false);
	let fitted = false;

	// One marker per cluster (a lone person keeps a stable key so their dot is
	// reused across frames; a crowd is keyed by its membership). Plain Maps on
	// purpose — imperative DOM bookkeeping, not reactive state.
	/* eslint-disable svelte/prefer-svelte-reactivity */
	const markers = new Map<
		string,
		{ marker: import('maplibre-gl').Marker; element: HTMLButtonElement; memberIds: string[] }
	>();
	/* eslint-enable svelte/prefer-svelte-reactivity */

	const MERGE_PX = 46; // dots are 44px — merge anything that would overlap

	/** Build the dot element for a single person: avatar + surname-coloured ring. */
	function buildPersonElement(p: MapPerson): HTMLButtonElement {
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

	/** Build a count badge for a crowd; clicking it zooms in to split it apart. */
	function buildClusterElement(cluster: Cluster): HTMLButtonElement {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'ha-cluster';
		const n = cluster.members.length;
		button.title = `${n} people here — click to zoom in`;
		button.setAttribute('aria-label', `${n} people here`);

		const span = document.createElement('span');
		span.className = 'ha-cluster-count';
		span.textContent = String(n);
		button.appendChild(span);

		button.addEventListener('click', (event) => {
			event.stopPropagation();
			if (!map) return;
			beginProgrammatic();
			map.easeTo({
				center: [cluster.lng, cluster.lat],
				zoom: Math.min(map.getZoom() + 2, 18),
				duration: 500
			});
		});
		return button;
	}

	/** Re-cluster the current points and reconcile markers to match. */
	function render() {
		if (!map || !maplibre) return;
		const project = (lng: number, lat: number) => {
			const p = map!.project([lng, lat]);
			return { x: p.x, y: p.y };
		};
		const clusters = clusterPoints(points, project, MERGE_PX);

		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local bookkeeping
		const live = new Set<string>();
		for (const cluster of clusters) {
			live.add(cluster.key);
			const existing = markers.get(cluster.key);
			if (existing) {
				existing.marker.setLngLat([cluster.lng, cluster.lat]);
			} else {
				const element =
					cluster.members.length === 1
						? buildPersonElement(cluster.members[0].position.person)
						: buildClusterElement(cluster);
				const marker = new maplibre.Marker({ element, anchor: 'center' });
				marker.setLngLat([cluster.lng, cluster.lat]).addTo(map);
				markers.set(cluster.key, {
					marker,
					element,
					memberIds: cluster.members.map((m) => m.position.person.id)
				});
			}
		}

		for (const [key, entry] of markers) {
			if (!live.has(key)) {
				entry.marker.remove();
				markers.delete(key);
			}
		}

		applySelection();
	}

	// Coalesce the many `move` events fired during a pan/zoom into one render per frame.
	let renderQueued = false;
	function scheduleRender() {
		if (renderQueued) return;
		renderQueued = true;
		requestAnimationFrame(() => {
			renderQueued = false;
			render();
		});
	}

	/** Reflect the selected id onto the marker elements (lone dot, or the crowd holding them). */
	function applySelection() {
		for (const entry of markers.values()) {
			const isSolo = entry.memberIds.length === 1 && entry.memberIds[0] === selectedId;
			const holdsSelected =
				entry.memberIds.length > 1 && selectedId != null && entry.memberIds.includes(selectedId);
			entry.element.classList.toggle('ha-dot-selected', isSolo);
			entry.element.classList.toggle('ha-cluster-has-selected', holdsSelected);
			entry.element.style.zIndex = isSolo || holdsSelected ? '10' : '';
		}
	}

	// --- Camera fitting (bounding-box buttons) ---
	let followAlive = $state(false);
	// Distinguish our own camera moves from the user's, so a programmatic fit
	// doesn't switch the follow mode off.
	let programmatic = false;
	function beginProgrammatic() {
		programmatic = true;
	}

	/** Born by this year and not yet dead. People with no birth year count as present. */
	function isAlive(p: MapPerson, y: number): boolean {
		if (p.birthYear != null && y < p.birthYear) return false;
		if (p.deathYear != null && y > p.deathYear) return false;
		return true;
	}

	function easeToBounds(bounds: import('maplibre-gl').LngLatBounds, duration: number) {
		if (!map) return;
		beginProgrammatic();
		const ne = bounds.getNorthEast();
		const sw = bounds.getSouthWest();
		if (ne.lng === sw.lng && ne.lat === sw.lat) {
			map.easeTo({ center: bounds.getCenter(), zoom: Math.max(map.getZoom(), 8), duration });
		} else {
			map.fitBounds(bounds, { padding: 72, maxZoom: 12, duration });
		}
	}

	/** Fit everyone who is ever on the map — the full geographic extent across all years. */
	function fitEveryone() {
		if (!map || !maplibre) return;
		followAlive = false;
		const bounds = new maplibre.LngLatBounds();
		let any = false;
		for (const person of persons) {
			for (const event of person.events) {
				bounds.extend([event.lng, event.lat]);
				any = true;
			}
		}
		if (any) easeToBounds(bounds, 600);
	}

	function aliveBounds(): import('maplibre-gl').LngLatBounds | null {
		if (!maplibre) return null;
		const bounds = new maplibre.LngLatBounds();
		let any = false;
		for (const pt of points) {
			if (!isAlive(pt.position.person, year)) continue;
			bounds.extend([pt.lng, pt.lat]);
			any = true;
		}
		return any ? bounds : null;
	}

	// While following, keep the box around the living — throttled so the year
	// sweep stays smooth rather than re-fitting on every animation frame.
	let lastFollowFit = 0;
	function followFit(force = false) {
		const now = performance.now();
		if (!force && now - lastFollowFit < 220) return;
		lastFollowFit = now;
		const bounds = aliveBounds();
		if (bounds) easeToBounds(bounds, 420);
	}

	function toggleFollowAlive() {
		followAlive = !followAlive;
		if (followAlive) followFit(true);
	}

	// Re-fit the living as the year (and thus who's alive / where) changes.
	$effect(() => {
		void points;
		void year;
		if (ready && followAlive) followFit();
	});

	/** Fit the viewport to all dots once, on first render. */
	function fitInitial() {
		if (!map || !maplibre || fitted || positions.length === 0) return;
		if (positions.length === 1) {
			map.jumpTo({ center: [positions[0].lng, positions[0].lat], zoom: 6 });
		} else {
			const bounds = new maplibre.LngLatBounds();
			for (const pos of positions) bounds.extend([pos.lng, pos.lat]);
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
		// Reproject markers on every camera move (so crowds split as you zoom).
		map.on('move', scheduleRender);
		// A user-driven drag/zoom cancels follow mode; our own fits don't.
		map.on('moveend', () => {
			programmatic = false;
		});
		map.on('dragstart', () => {
			if (!programmatic) followAlive = false;
		});
		map.on('zoomstart', () => {
			if (!programmatic) followAlive = false;
		});
		map.on('load', () => {
			ready = true;
			fitInitial();
			render();
		});
	});

	// Re-cluster whenever the resolved points change (year scrub / data edits).
	$effect(() => {
		void points;
		if (ready) scheduleRender();
	});

	// Re-apply selection styling when the selected id changes from outside.
	$effect(() => {
		void selectedId;
		if (ready) applySelection();
	});

	// Glide to the selected dot when the selection changes (split-view sync, task
	// 2.14). Suppressed while following the living (that camera owns the view).
	let centeredFor: string | null = null;
	$effect(() => {
		const id = selectedId;
		if (!ready || !map) return;
		if (id === centeredFor) return;
		centeredFor = id;
		if (!id || followAlive) return;
		const pos = untrack(() => positions).find((p) => p.person.id === id);
		if (pos) {
			beginProgrammatic();
			map.easeTo({ center: [pos.lng, pos.lat], duration: 550 });
		}
	});

	// Keep the canvas sized to its container (the split-view divider resizes it).
	$effect(() => {
		if (!ready || !el) return;
		const ro = new ResizeObserver(() => map?.resize());
		ro.observe(el);
		return () => ro.disconnect();
	});

	onDestroy(() => {
		for (const entry of markers.values()) entry.marker.remove();
		markers.clear();
		map?.remove();
	});
</script>

<div
	class="relative {height == null ? 'h-full' : ''}"
	style={height == null ? undefined : `height:${height}px`}
>
	<div bind:this={el} class="h-full w-full overflow-hidden rounded-lg border border-sage"></div>

	<!-- Bounding-box fit controls (alongside the zoom controls top-right). -->
	<div
		class="absolute top-2 left-2 z-10 flex flex-col overflow-hidden rounded-md border border-sage bg-white/90 text-ink shadow-sm backdrop-blur"
	>
		<button
			type="button"
			class="grid h-8 w-8 place-items-center hover:bg-cream"
			title="Fit everyone"
			aria-label="Fit everyone in view"
			onclick={fitEveryone}
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="1.6"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />
			</svg>
		</button>
		<button
			type="button"
			class="grid h-8 w-8 place-items-center border-t border-sage hover:bg-cream {followAlive
				? 'bg-clay text-ink'
				: ''}"
			title="Follow the living — keep everyone alive at this year in view"
			aria-label="Follow the living"
			aria-pressed={followAlive}
			onclick={toggleFollowAlive}
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="1.6"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M1 8h3l2-4 3 8 2-4h3" />
			</svg>
		</button>
	</div>
</div>

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

	/* Crowd badge: a count that splits into individual dots as you zoom in. */
	:global(.ha-cluster) {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border-radius: 9999px;
		border: 3px solid #e9ba9c;
		background: #f6f3db;
		cursor: pointer;
		box-shadow: 0 1px 4px rgba(13, 15, 11, 0.35);
		transition:
			transform 0.12s ease,
			box-shadow 0.12s ease;
	}
	:global(.ha-cluster:hover) {
		transform: scale(1.08);
	}
	:global(.ha-cluster-count) {
		font-size: 15px;
		font-weight: 700;
		color: #0d0f0b;
	}
	:global(.ha-cluster-has-selected) {
		box-shadow:
			0 0 0 3px #e9ba9c,
			0 2px 8px rgba(13, 15, 11, 0.45);
	}
</style>
