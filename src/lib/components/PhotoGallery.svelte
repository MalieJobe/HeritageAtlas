<script lang="ts">
	import { enhance } from '$app/forms';
	import { useI18n } from '$lib/i18n';
	import Lightbox from '$lib/components/Lightbox.svelte';

	const t = useI18n().t;

	type Photo = { id: string; url: string };

	let { photos, canEdit = false }: { photos: Photo[]; canEdit?: boolean } = $props();

	// Writable derived: mirrors the loaded photos, but drag-reorder can override it
	// for an instant feel until the save round-trips and `photos` updates.
	let items = $derived(photos.map((p) => ({ ...p })));

	let lightboxIndex = $state<number | null>(null);

	let fileInput = $state<HTMLInputElement>();
	let uploadForm = $state<HTMLFormElement>();
	let reorderForm = $state<HTMLFormElement>();
	let orderValue = $state('');

	let dragIndex = $state<number | null>(null);

	function onDragStart(i: number) {
		dragIndex = i;
	}
	function onDragOver(e: DragEvent, j: number) {
		e.preventDefault();
		if (dragIndex === null || dragIndex === j) return;
		const next = [...items];
		const [moved] = next.splice(dragIndex, 1);
		next.splice(j, 0, moved);
		items = next;
		dragIndex = j;
	}
	function onDragEnd() {
		dragIndex = null;
		const order = items.map((p) => p.id).join(',');
		// Only persist if the order actually changed.
		if (order !== photos.map((p) => p.id).join(',')) {
			orderValue = order;
			reorderForm?.requestSubmit();
		}
	}
</script>

<div class="flex flex-wrap items-center gap-2">
	{#each items as photo, i (photo.id)}
		<div
			class="group relative h-24 w-24 overflow-hidden rounded-md border border-sage"
			class:opacity-50={dragIndex === i}
			draggable={canEdit}
			role="listitem"
			ondragstart={() => onDragStart(i)}
			ondragover={(e) => onDragOver(e, i)}
			ondragend={onDragEnd}
		>
			<button
				type="button"
				onclick={() => (lightboxIndex = i)}
				class="block h-full w-full cursor-zoom-in"
				aria-label={t('map.photo.openPhoto')}
			>
				<img src={photo.url} alt="" class="h-full w-full object-cover" draggable="false" />
			</button>
			{#if canEdit}
				<form method="POST" action="?/deletePhoto" use:enhance class="absolute top-1 right-1">
					<input type="hidden" name="photoId" value={photo.id} />
					<button
						type="submit"
						aria-label={t('map.photo.deletePhoto')}
						class="grid h-5 w-5 cursor-pointer place-items-center rounded-full bg-ink/70 text-xs text-paper opacity-0 transition group-hover:opacity-100 hover:bg-ink"
					>
						✕
					</button>
				</form>
			{/if}
			{#if i === 0}
				<span
					class="absolute bottom-0 left-0 w-full bg-ink/55 py-0.5 text-center text-[10px] text-paper"
					>{t('map.photo.profile')}</span
				>
			{/if}
		</div>
	{/each}

	{#if canEdit}
		<!-- Plus tile: opens the file picker, uploads on selection. -->
		<button
			type="button"
			onclick={() => fileInput?.click()}
			aria-label={t('map.photo.addPhoto')}
			class="grid h-24 w-24 place-items-center rounded-md border border-dashed border-sage text-3xl text-ink/40 hover:border-clay hover:text-clay"
		>
			+
		</button>
		<form
			bind:this={uploadForm}
			method="POST"
			action="?/uploadPhoto"
			enctype="multipart/form-data"
			use:enhance
			class="hidden"
		>
			<input
				bind:this={fileInput}
				name="photo"
				type="file"
				accept="image/*"
				onchange={() => uploadForm?.requestSubmit()}
			/>
		</form>
		<form bind:this={reorderForm} method="POST" action="?/reorderPhotos" use:enhance class="hidden">
			<input type="hidden" name="order" value={orderValue} />
		</form>
	{/if}
</div>

{#if items.length === 0}
	<p class="mt-1 text-sm text-ink/45">{t('map.photo.noPhotos')}</p>
{/if}

{#if lightboxIndex !== null}
	<Lightbox photos={items} startIndex={lightboxIndex} onclose={() => (lightboxIndex = null)} />
{/if}
