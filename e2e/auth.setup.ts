import { test as setup, expect } from '@playwright/test';

const AUTH_FILE = 'e2e/.auth/user.json';

/**
 * Logs in once with the seeded test account and persists the session, so the
 * other specs start authenticated. The suite never signs up — the account must
 * already exist (see README e2e section). Credentials come from env / .env.test.
 */
setup('authenticate seeded user', async ({ page }) => {
	const email = process.env.E2E_EMAIL;
	const password = process.env.E2E_PASSWORD;
	if (!email || !password) {
		throw new Error('Set E2E_EMAIL and E2E_PASSWORD (e.g. in .env.test) to run e2e tests.');
	}

	await page.goto('/auth/login');
	// Wait for hydration before filling: the email input is value-bound, so a fill
	// before hydration gets reset to '' when the client takes over.
	await page.waitForLoadState('networkidle');
	await page.fill('input[name=email]', email);
	await page.fill('input[name=password]', password);
	await expect(page.locator('input[name=email]')).toHaveValue(email);
	await page.click('button[type=submit]');

	// Login lands on the dashboard (or onboarding if the account has no tree yet).
	await page.waitForURL(/\/(dashboard|start)/, { timeout: 15_000 });
	await page.context().storageState({ path: AUTH_FILE });
});
