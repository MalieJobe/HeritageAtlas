<script lang="ts">
	import { resolve } from '$app/paths';

	// The auth slot below is a placeholder. It's replaced by a real sign-in / user
	// menu once sessions are wired up in Phase 1 (tasks 1.2–1.3).
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
			<span class="text-stone-400">Not signed in</span>
		</nav>
	</div>
</header>
