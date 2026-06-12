<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { useI18n } from '$lib/i18n';
	import { osmRasterStyle } from '$lib/map/style';

	const t = useI18n().t;

	// A small, non-interactive map preview of a tree's places. Lazily initialised
	// when scrolled into view so a dashboard of cards stays snappy.
	let { points = [] }: { points: { lng: number; lat: number }[] } = $props();

	let el = $state<HTMLDivElement>();
	let map: import('maplibre-gl').Map | undefined;

	onMount(() => {
		if (points.length === 0 || !el) return;
		const node = el;
		const io = new IntersectionObserver(async (entries) => {
			if (!entries[0].isIntersecting || map) return;
			io.disconnect();
			const maplibre = await import('maplibre-gl');
			map = new maplibre.Map({
				container: node,
				style: osmRasterStyle,
				interactive: false,
				attributionControl: false
			});
			map.on('load', () => {
				if (!map) return;
				map.addSource('pts', {
					type: 'geojson',
					data: {
						type: 'FeatureCollection',
						features: points.map((p) => ({
							type: 'Feature',
							geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
							properties: {}
						}))
					}
				});
				map.addLayer({
					type: 'circle',
					id: 'pts',
					source: 'pts',
					paint: {
						'circle-radius': 4,
						'circle-color': '#E9BA9C',
						'circle-stroke-color': '#0D0F0B',
						'circle-stroke-width': 1,
						'circle-opacity': 0.9
					}
				});
				const b = new maplibre.LngLatBounds();
				for (const p of points) b.extend([p.lng, p.lat]);
				map.fitBounds(b, { padding: 16, maxZoom: 6, animate: false });
			});
		});
		io.observe(node);
		return () => io.disconnect();
	});

	onDestroy(() => map?.remove());
</script>

{#if points.length > 0}
	<div bind:this={el} class="h-full w-full bg-sage/20"></div>
{:else}
	<div class="grid h-full w-full place-items-center bg-sage/15 text-[10px] text-ink/40">
		{t('map.thumbnail.noPlaces')}
	</div>
{/if}
