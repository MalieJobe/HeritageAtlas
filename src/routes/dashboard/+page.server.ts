import { fail, redirect } from '@sveltejs/kit';
import { personName } from '$lib/person';
import type { Actions, PageServerLoad } from './$types';

/** Lower-bound year from an ISO date string, or null. */
function yearOf(iso: string | null): number | null {
	if (!iso) return null;
	const y = Number.parseInt(iso.slice(0, 4), 10);
	return Number.isFinite(y) ? y : null;
}

export type Anniversary = {
	name: string;
	kind: 'birth' | 'death';
	year: number;
	years: number; // years since
	treeId: string;
	treeName: string;
	personId: string;
};

export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
	if (!user) redirect(303, '/auth/login');

	const [{ data: memberships }, { data: profile }] = await Promise.all([
		supabase
			.from('tree_members')
			.select('role, tree:trees(id, name, owner_id)')
			.eq('user_id', user.id),
		supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
	]);

	const base = (memberships ?? [])
		.filter((r) => r.tree)
		.map((r) => ({
			id: r.tree!.id,
			name: r.tree!.name,
			role: r.role,
			isOwner: r.tree!.owner_id === user.id
		}));
	const treeIds = base.map((t) => t.id);

	// Per-tree stats in a few batched queries (grouped in JS), regardless of count.
	const peopleCount = new Map<string, number>();
	const placeCount = new Map<string, number>();
	const span = new Map<string, { min: number; max: number }>();
	if (treeIds.length > 0) {
		const [{ data: persons }, { data: places }, { data: events }] = await Promise.all([
			supabase.from('persons').select('id, tree_id').in('tree_id', treeIds),
			supabase.from('places').select('id, tree_id').in('tree_id', treeIds),
			supabase.from('events').select('tree_id, event_date').in('tree_id', treeIds)
		]);
		for (const p of persons ?? [])
			peopleCount.set(p.tree_id, (peopleCount.get(p.tree_id) ?? 0) + 1);
		for (const p of places ?? []) placeCount.set(p.tree_id, (placeCount.get(p.tree_id) ?? 0) + 1);
		for (const e of events ?? []) {
			const y = yearOf(e.event_date);
			if (y == null) continue;
			const cur = span.get(e.tree_id);
			if (!cur) span.set(e.tree_id, { min: y, max: y });
			else span.set(e.tree_id, { min: Math.min(cur.min, y), max: Math.max(cur.max, y) });
		}
	}

	const trees = base
		.map((t) => ({
			...t,
			peopleCount: peopleCount.get(t.id) ?? 0,
			placeCount: placeCount.get(t.id) ?? 0,
			yearSpan: span.get(t.id) ?? null
		}))
		.sort((a, b) => a.name.localeCompare(b.name));

	// On this day: births/deaths whose month+day match today, across all trees.
	const treeName = new Map(base.map((t) => [t.id, t.name]));
	const now = new Date();
	const mm = String(now.getMonth() + 1).padStart(2, '0');
	const dd = String(now.getDate()).padStart(2, '0');
	const thisYear = now.getFullYear();
	const anniversaries: Anniversary[] = [];
	if (treeIds.length > 0) {
		const { data: lifeEvents } = await supabase
			.from('events')
			.select('type, event_date, tree_id, person:persons(id, given_names, surname, nickname)')
			.in('tree_id', treeIds)
			.in('type', ['birth', 'death'])
			.not('event_date', 'is', null);
		for (const e of lifeEvents ?? []) {
			if (!e.person || !e.event_date) continue;
			if (e.event_date.slice(5, 10) !== `${mm}-${dd}`) continue;
			const year = yearOf(e.event_date);
			if (year == null) continue;
			anniversaries.push({
				name: personName(e.person),
				kind: e.type === 'death' ? 'death' : 'birth',
				year,
				years: thisYear - year,
				treeId: e.tree_id,
				treeName: treeName.get(e.tree_id) ?? '',
				personId: e.person.id
			});
		}
		anniversaries.sort((a, b) => b.years - a.years);
	}

	const email = user.email?.toLowerCase() ?? '';
	const { count: pendingInvites } = await supabase
		.from('invitations')
		.select('id', { count: 'exact', head: true })
		.eq('email', email);

	return {
		displayName: profile?.display_name ?? null,
		email: user.email ?? '',
		trees,
		anniversaries,
		pendingInvites: pendingInvites ?? 0
	};
};

export const actions: Actions = {
	create: async ({ request, locals: { supabase, user } }) => {
		if (!user) redirect(303, '/auth/login');
		const name = String((await request.formData()).get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Please enter a tree name.' });
		if (name.length > 200) return fail(400, { error: 'Name must be 200 characters or fewer.' });

		const { data, error: dbError } = await supabase
			.from('trees')
			.insert({ name, owner_id: user.id })
			.select('id')
			.single();
		if (dbError) return fail(400, { error: dbError.message });
		redirect(303, `/trees/${data.id}`);
	}
};
