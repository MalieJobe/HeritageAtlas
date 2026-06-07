<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Header from '$lib/components/Header.svelte';
	import Toaster from '$lib/components/Toaster.svelte';
	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	let { children, data } = $props();

	let supabase = $derived(data.supabase);
	let session = $derived(data.session);

	// The tree home is a full-bleed split view (tree | map + timeline); every other
	// page sits in the usual centred, padded column.
	let fullBleed = $derived(page.route.id === '/trees/[treeId]');

	// Keep the server and client in sync: whenever the auth state changes (or the
	// token is refreshed), rerun load functions that depend on 'supabase:auth'.
	onMount(() => {
		const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
			if (newSession?.expires_at !== session?.expires_at) {
				invalidate('supabase:auth');
			}
		});

		return () => listener.subscription.unsubscribe();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- Full-bleed tree page is locked to exactly the viewport so the tree|map split
	 and the timeline always fit on screen; every other page can grow and scroll. -->
<div class="flex flex-col {fullBleed ? 'h-screen overflow-hidden' : 'min-h-screen'}">
	<Header user={data.user} />
	{#if fullBleed}
		<main class="flex min-h-0 flex-1 flex-col">
			{@render children()}
		</main>
	{:else}
		<main class="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
			{@render children()}
		</main>
	{/if}
</div>

<Toaster />
