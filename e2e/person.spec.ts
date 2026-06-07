import { test, expect } from '@playwright/test';
import { createTree, deleteTree, createPerson, postAction } from './helpers';

test.describe('persons & relationships', () => {
	let treeId: string;

	test.beforeAll(async ({ request }) => {
		treeId = await createTree(request, `E2E Persons ${Date.now()}`);
	});

	test.afterAll(async ({ request }) => {
		if (treeId) await deleteTree(request, treeId);
	});

	test('creates a person through the UI', async ({ page }) => {
		await page.goto(`/trees/${treeId}/persons/new`);
		await page.waitForLoadState('networkidle');
		await page.fill('input[name=given_names]', 'Ada');
		await page.fill('input[name=surname]', 'Lovelace');
		await page.click('button[type=submit]');

		// Lands on the new person's detail page.
		await expect(page).toHaveURL(/\/persons\/[^/]+$/);
		await expect(page.getByText('Ada Lovelace').first()).toBeVisible();

		// And the person shows up on the tree view.
		await page.goto(`/trees/${treeId}`);
		await expect(page.getByText('Ada Lovelace').first()).toBeVisible();
	});

	test('blocks ancestry loops (cannot make your mother your own child)', async ({ request }) => {
		const child = await createPerson(request, treeId, { given_names: 'Child', surname: 'Loop' });
		const mother = await createPerson(request, treeId, { given_names: 'Mother', surname: 'Loop' });

		// Valid: add `mother` as a parent of `child`.
		const ok = await postAction(request, `/trees/${treeId}/persons/${child}?/addParent`, {
			personId: mother
		});
		expect(ok.result.type, 'valid parent link should succeed').not.toBe('failure');

		// Loop: try to make `child` a parent of `mother` — closes a 2-node cycle.
		const loop = await postAction(request, `/trees/${treeId}/persons/${mother}?/addParent`, {
			personId: child
		});
		expect(loop.result.type, 'loop link should be rejected').toBe('failure');
		expect(loop.result.status).toBe(400);
		expect(loop.raw).toContain('loop');
	});

	test('rejects linking a person to themselves as a parent', async ({ request }) => {
		const self = await createPerson(request, treeId, { given_names: 'Solo', surname: 'Loop' });
		const res = await postAction(request, `/trees/${treeId}/persons/${self}?/addParent`, {
			personId: self
		});
		expect(res.result.type).toBe('failure');
	});

	test('blocks a multi-generation loop (grandparent as descendant)', async ({ request }) => {
		const gp = await createPerson(request, treeId, { given_names: 'Grand', surname: 'Gen' });
		const mom = await createPerson(request, treeId, { given_names: 'Mom', surname: 'Gen' });
		const me = await createPerson(request, treeId, { given_names: 'Me', surname: 'Gen' });

		// gp → mom → me
		await postAction(request, `/trees/${treeId}/persons/${mom}?/addParent`, { personId: gp });
		await postAction(request, `/trees/${treeId}/persons/${me}?/addParent`, { personId: mom });

		// Making `me` a parent of `gp` would loop the whole chain.
		const loop = await postAction(request, `/trees/${treeId}/persons/${gp}?/addParent`, {
			personId: me
		});
		expect(loop.result.type).toBe('failure');
		expect(loop.raw).toContain('loop');
	});
});
