import { type APIRequestContext, expect } from '@playwright/test';

// SvelteKit form actions invoked via APIRequestContext return their result as a
// JSON ActionResult ({ type: 'redirect'|'success'|'failure', status, location, data }).
export interface ActionResult {
	type: 'redirect' | 'success' | 'failure' | 'error';
	status?: number;
	location?: string;
	data?: unknown;
}

/** POST a form action and return the parsed ActionResult plus the raw body text. */
export async function postAction(
	request: APIRequestContext,
	url: string,
	form: Record<string, string>
): Promise<{ result: ActionResult; raw: string }> {
	const res = await request.post(url, { form, maxRedirects: 0 });
	const raw = await res.text();
	return { result: JSON.parse(raw) as ActionResult, raw };
}

/** Create a tree via the dashboard action; returns its id. */
export async function createTree(request: APIRequestContext, name: string): Promise<string> {
	const { result } = await postAction(request, '/dashboard?/create', { name });
	expect(result.type, 'create-tree should redirect').toBe('redirect');
	const id = result.location?.match(/\/trees\/([^/?]+)/)?.[1];
	expect(id, 'tree id in redirect').toBeTruthy();
	return id as string;
}

/** Delete a tree (cleanup). Best-effort. */
export async function deleteTree(request: APIRequestContext, treeId: string): Promise<void> {
	await request.post(`/trees/${treeId}/settings?/delete`, { form: {}, maxRedirects: 0 });
}

/** Create a person via the new-person action; returns the new person id. */
export async function createPerson(
	request: APIRequestContext,
	treeId: string,
	fields: Record<string, string>
): Promise<string> {
	const { result } = await postAction(request, `/trees/${treeId}/persons/new`, fields);
	expect(result.type, 'create-person should redirect').toBe('redirect');
	const id = result.location?.match(/persons\/([^/?]+)/)?.[1];
	expect(id, 'person id in redirect').toBeTruthy();
	return id as string;
}
