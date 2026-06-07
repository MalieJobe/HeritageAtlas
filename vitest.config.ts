import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Standalone Vitest config — deliberately does NOT load the SvelteKit plugin
// (which needs the dev server / $app modules). Unit tests cover pure logic only,
// so we just map the `$lib` alias and run in Node.
export default defineConfig({
	resolve: {
		alias: {
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url))
		}
	},
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});
