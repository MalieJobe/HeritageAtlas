import { test, expect } from '@playwright/test';
import { createTree, deleteTree, createPerson, postAction } from './helpers';

const PASSWORD = 'sekret123';

test.describe('password-protected public share links', () => {
	let treeId: string;
	let token: string;

	test.beforeAll(async ({ request }) => {
		treeId = await createTree(request, `E2E Share ${Date.now()}`);
		await createPerson(request, treeId, { given_names: 'Shared', surname: 'Person' });

		// Owner enables the share link with a password.
		const res = await postAction(request, `/trees/${treeId}/settings?/share`, {
			password: PASSWORD
		});
		expect(res.result.type, 'share action should succeed').toBe('success');

		// Read the generated token off the settings page.
		const html = await (await request.get(`/trees/${treeId}/settings`)).text();
		token = html.match(/\/share\/([a-f0-9]{16,})/)?.[1] ?? '';
		expect(token, 'share token present in settings').toBeTruthy();
	});

	test.afterAll(async ({ request }) => {
		if (treeId) await deleteTree(request, treeId);
	});

	test('owner sees the share URL in settings', async ({ page }) => {
		await page.goto(`/trees/${treeId}/settings`);
		await expect(page.getByText('Public share link')).toBeVisible();
		await expect(page.locator(`input[value*="/share/${token}"]`)).toBeVisible();
	});

	test('an anonymous visitor must enter the password, then sees a read-only tree', async ({
		browser,
		baseURL
	}) => {
		const base = baseURL ?? 'http://localhost:5173';
		const anon = await browser.newContext({ baseURL: base });
		const page = await anon.newPage();
		try {
			// Gate: no data shown without the password.
			await page.goto(`/share/${token}`);
			await expect(page.getByText(/password-protected/i)).toBeVisible();
			await expect(page.getByText('Shared Person')).toHaveCount(0);

			// Wrong password is rejected.
			await page.fill('input[name=password]', 'totally-wrong');
			await page.click('button[type=submit]');
			await expect(page.getByText(/incorrect/i)).toBeVisible();

			// Correct password unlocks a read-only view.
			await page.fill('input[name=password]', PASSWORD);
			await page.click('button[type=submit]');
			await expect(page.getByText('Shared, read-only view')).toBeVisible();
			await expect(page.getByText('Shared Person').first()).toBeVisible();
			// No editing affordances: no link into the editable person/tree routes.
			await expect(page.locator(`a[href*="/trees/${treeId}/persons/"]`)).toHaveCount(0);
		} finally {
			await anon.close();
		}
	});

	test('an unknown token 404s', async ({ browser, baseURL }) => {
		const anon = await browser.newContext({ baseURL: baseURL ?? 'http://localhost:5173' });
		const page = await anon.newPage();
		try {
			const res = await page.goto('/share/deadbeefdeadbeefdeadbeef');
			expect(res?.status()).toBe(404);
		} finally {
			await anon.close();
		}
	});

	test('stopping sharing disables the link', async ({ request, browser, baseURL }) => {
		const res = await postAction(request, `/trees/${treeId}/settings?/unshare`, {});
		expect(res.result.type).toBe('success');

		const anon = await browser.newContext({ baseURL: baseURL ?? 'http://localhost:5173' });
		const page = await anon.newPage();
		try {
			const resp = await page.goto(`/share/${token}`);
			expect(resp?.status()).toBe(404);
		} finally {
			await anon.close();
		}
	});
});
