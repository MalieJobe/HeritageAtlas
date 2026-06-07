import { test, expect } from '@playwright/test';
import { postAction } from './helpers';

// Regression: /account mixed a `default` action with named actions, which made
// SvelteKit 500 *every* account action (profile update, password change, AND
// account deletion). These assert the named actions route correctly now.
//
// (Per the agreed test strategy, real signup/account-deletion is verified
// manually, not automated — so this only exercises the non-destructive action.)
test.describe('account actions', () => {
	test('updateProfile succeeds (does not 500)', async ({ request }) => {
		const res = await postAction(request, '/account?/updateProfile', {
			displayName: 'E2E Tester'
		});
		expect(res.result.type, 'updateProfile should not error').toBe('success');
	});

	test('the account page renders the danger zone', async ({ page }) => {
		await page.goto('/account');
		await expect(page.getByRole('button', { name: 'Delete account' })).toBeVisible();
	});
});
