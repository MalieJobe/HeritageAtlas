<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { osmRasterStyle } from '$lib/map/style';

	let {
		lat = null,
		lng = null,
		height = 260,
		onpick
	}: {
		lat?: number | null;
		lng?: number | null;
		height?: number;
		onpick: (coords: { lat: number; lng: number }) => void;
	} = $props();

	let el: HTMLDivElement;
	// maplibre-gl touches `window`, so it's imported dynamically (client-only).
	let maplibre: typeof import('maplibre-gl') | undefined;
	let map: import('maplibre-gl').Map | undefined;
	let marker: import('maplibre-gl').Marker | undefined;

	function setMarker(la: number, lo: number) {
		if (!map || !maplibre) return;
		if (marker) {
			marker.setLngLat([lo, la]);
		} else {
			marker = new maplibre.Marker({ color: '#E9BA9C' }).setLngLat([lo, la]).addTo(map);
		}
	}

	onMount(async () => {
		maplibre = await import('maplibre-gl');
		const hasStart = lat != null && lng != null;
		map = new maplibre.Map({
			container: el,
			style: osmRasterStyle,
			center: hasStart ? [lng!, lat!] : [10, 50],
			zoom: hasStart ? 9 : 3,
			attributionControl: { compact: true }
		});
		map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
		if (hasStart) setMarker(lat!, lng!);

		map.on('click', (e) => {
			setMarker(e.lngLat.lat, e.lngLat.lng);
			onpick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
		});
	});

	onDestroy(() => map?.remove());
</script>

<div
	bind:this={el}
	class="w-full overflow-hidden rounded-md border border-sage"
	style="height:{height}px"
></div>
<p class="mt-1 text-xs text-ink/45">Click the map to drop a pin.</p>
