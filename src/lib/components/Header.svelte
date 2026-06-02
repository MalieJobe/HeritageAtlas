<script lang="ts">
	import { resolve } from '$app/paths';
	import type { User } from '@supabase/supabase-js';

	let { user = null }: { user?: User | null } = $props();
</script>

<header class="sticky top-0 z-10 border-b border-stone-200 bg-white/80 backdrop-blur">
	<div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
		<a href={resolve('/')} class="flex items-center gap-2 font-semibold text-stone-800">
			<span
				class="grid h-7 w-7 place-items-center rounded-md bg-amber-600 text-sm font-bold text-white"
			>
				H
			</span>
			HeritageAtlas
		</a>
		<nav class="flex items-center gap-3 text-sm">
			{#if user}
				<a href={resolve('/account')} class="text-stone-600 hover:text-stone-900">
					{user.email}
				</a>
				<form method="POST" action={resolve('/auth/logout')}>
					<button
						type="submit"
						class="rounded-md border border-stone-300 px-3 py-1 font-medium text-stone-700 hover:bg-stone-100"
					>
						Sign out
					</button>
				</form>
			{:else}
				<a
					href={resolve('/auth/login')}
					class="rounded-md bg-amber-600 px-3 py-1 font-medium text-white hover:bg-amber-700"
				>
					Sign in
				</a>
			{/if}
		</nav>
	</div>
</header>
