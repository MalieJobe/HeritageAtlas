import { defineConfig, devices } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

// Load e2e credentials from a gitignored .env.test if present (so local runs are
// one command). CI / other envs can set E2E_EMAIL / E2E_PASSWORD directly.
if (existsSync('.env.test')) {
	for (const line of readFileSync('.env.test', 'utf8').split('\n')) {
		const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
		if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
	}
}

const PORT = 5173;

export default defineConfig({
	testDir: 'e2e',
	// e2e mutates shared data (trees), so keep it serial within a worker.
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? 'list' : [['list']],
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: 'on-first-retry'
	},
	projects: [
		// Logs in once with the seeded account and saves the session for reuse.
		{ name: 'setup', testMatch: /auth\.setup\.ts/ },
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
			dependencies: ['setup']
		}
	],
	webServer: {
		command: 'pnpm dev',
		url: `http://localhost:${PORT}`,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});
