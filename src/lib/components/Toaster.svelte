<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { toasts, type ToastKind } from '$lib/toast.svelte';

	const STYLES: Record<ToastKind, string> = {
		success: 'border-sage bg-sage/25 text-ink',
		info: 'border-clay bg-cream text-ink',
		error: 'border-red-300 bg-red-50 text-red-800'
	};
	const ICON: Record<ToastKind, string> = { success: '✓', info: 'ℹ', error: '✕' };
</script>

<div
	class="pointer-events-none fixed right-3 bottom-3 z-[100] flex w-[min(92vw,22rem)] flex-col gap-2"
	role="region"
	aria-label="Notifications"
	aria-live="polite"
>
	{#each toasts.items as toast (toast.id)}
		<div
			in:fly={{ y: 12, duration: 200 }}
			out:fade={{ duration: 150 }}
			class="pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-md backdrop-blur {STYLES[
				toast.kind
			]}"
		>
			<span class="mt-px font-semibold" aria-hidden="true">{ICON[toast.kind]}</span>
			<p class="min-w-0 flex-1 break-words">{toast.message}</p>
			<button
				type="button"
				class="-mr-1 shrink-0 rounded px-1 text-ink/40 hover:text-ink"
				aria-label="Dismiss"
				onclick={() => toasts.dismiss(toast.id)}>✕</button
			>
		</div>
	{/each}
</div>
