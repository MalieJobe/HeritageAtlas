<script lang="ts">
	import { resolve } from '$app/paths';
	import type { User } from '@supabase/supabase-js';

	let { user = null }: { user?: User | null } = $props();
</script>

<header class="sticky top-0 z-10 border-b border-sage bg-paper/80 backdrop-blur">
	<div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
		<a href={resolve('/')} class="flex items-center gap-2 font-semibold text-ink">
			<span class="grid h-7 w-7 place-items-center rounded-md bg-ink text-sm font-bold text-paper">
				H
			</span>
			HeritageAtlas
		</a>
		<nav class="flex items-center gap-3 text-sm">
			{#if user}
				<a href={resolve('/trees')} class="font-medium text-ink/70 hover:text-ink"> Trees </a>
				<a href={resolve('/account')} class="text-ink/70 hover:text-ink">
					{user.email}
				</a>
				<form method="POST" action={resolve('/auth/logout')}>
					<button
						type="submit"
						class="rounded-md border border-sage px-3 py-1 font-medium text-ink/80 hover:bg-cream"
					>
						Sign out
					</button>
				</form>
			{:else}
				<a
					href={resolve('/auth/login')}
					class="rounded-md bg-clay px-3 py-1 font-medium text-ink hover:bg-clay/80"
				>
					Sign in
				</a>
			{/if}
		</nav>
	</div>
</header>
