<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { User } from '@supabase/supabase-js';

	let { user = null }: { user?: User | null } = $props();

	// When a tree/person page is loaded, its data carries the current tree — show it
	// as a breadcrumb (the logo already links back to the dashboard).
	let tree = $derived(page.data?.tree as { id: string; name: string } | undefined);

	let menuOpen = $state(false);
	let menuEl = $state<HTMLDivElement>();

	// Close the account menu on any click outside it (listener only attached while open).
	$effect(() => {
		if (!menuOpen) return;
		const onDocPointerDown = (e: PointerEvent) => {
			if (menuEl && !menuEl.contains(e.target as Node)) menuOpen = false;
		};
		document.addEventListener('pointerdown', onDocPointerDown);
		return () => document.removeEventListener('pointerdown', onDocPointerDown);
	});
</script>

<header class="sticky top-0 z-10 border-b border-sage bg-paper/80 backdrop-blur">
	<div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
		<a
			href={user ? resolve('/dashboard') : resolve('/')}
			class="flex items-center gap-2 font-semibold text-ink"
		>
			<span class="grid h-7 w-7 place-items-center rounded-md bg-ink text-sm font-bold text-paper">
				H
			</span>
			HeritageAtlas
		</a>
		{#if user && tree}
			<span class="text-ink/30">/</span>
			<a
				href={resolve('/trees/[treeId]', { treeId: tree.id })}
				class="mr-auto ml-2 min-w-0 truncate text-sm font-medium text-ink/70 hover:text-ink"
			>
				{tree.name}
			</a>
		{/if}
		<nav class="flex items-center gap-3 text-sm">
			{#if user}
				<div class="relative" bind:this={menuEl}>
					<button
						type="button"
						onclick={() => (menuOpen = !menuOpen)}
						aria-haspopup="menu"
						aria-expanded={menuOpen}
						class="flex items-center gap-1 rounded-md px-2 py-1 text-ink/70 hover:bg-cream hover:text-ink"
					>
						{user.email}
						<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
							<path
								d="M3 4.5L6 7.5L9 4.5"
								stroke="currentColor"
								stroke-width="1.3"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					</button>
					{#if menuOpen}
						<div
							role="menu"
							class="absolute right-0 mt-1 w-40 overflow-hidden rounded-md border border-sage bg-paper shadow-md"
						>
							<a
								href={resolve('/account')}
								role="menuitem"
								onclick={() => (menuOpen = false)}
								class="block px-3 py-2 text-ink/80 hover:bg-cream"
							>
								Account
							</a>
							<form method="POST" action={resolve('/auth/logout')} class="border-t border-sage/60">
								<button
									type="submit"
									role="menuitem"
									class="block w-full px-3 py-2 text-left text-ink/80 hover:bg-cream"
								>
									Sign out
								</button>
							</form>
						</div>
					{/if}
				</div>
			{:else}
				<a href={resolve('/auth/login')} class="font-medium text-ink/70 hover:text-ink"> Log in </a>
				<a
					href={resolve('/auth/signup')}
					class="rounded-md bg-clay px-3 py-1 font-medium text-ink hover:bg-clay/80"
				>
					Sign up
				</a>
			{/if}
		</nav>
	</div>
</header>
