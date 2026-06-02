import { error } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/types';

type DB = SupabaseClient<Database>;

/**
 * Loads a tree and asserts the user may edit it (owner or editor). Throws 404 if
 * the tree isn't visible to the user, or 403 if they're only a viewer. RLS is the
 * real gate; this gives clean status codes and a friendly message.
 */
export async function requireEditableTree(
	supabase: DB,
	userId: string,
	treeId: string
): Promise<{ id: string; name: string }> {
	const { data: tree } = await supabase
		.from('trees')
		.select('id, name')
		.eq('id', treeId)
		.maybeSingle();
	if (!tree) {
		error(404, 'Tree not found');
	}

	const { data: membership } = await supabase
		.from('tree_members')
		.select('role')
		.eq('tree_id', treeId)
		.eq('user_id', userId)
		.maybeSingle();
	if (membership?.role !== 'owner' && membership?.role !== 'editor') {
		error(403, 'You do not have permission to edit this tree.');
	}

	return tree;
}
