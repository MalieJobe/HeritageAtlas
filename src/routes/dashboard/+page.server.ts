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

	// Per-tree stats + card visuals in a few batched queries (grouped in JS).
	const peopleCount = new Map<string, number>();
	const placeCount = new Map<string, number>();
	const span = new Map<string, { min: number; max: number }>();
	const avatarsByTree = new Map<string, string[]>(); // up to 5 signed photo URLs
	const pointsByTree = new Map<string, { lng: number; lat: number }[]>();
	const generations = new Map<string, number>();
	if (treeIds.length > 0) {
		const [{ data: persons }, { data: places }, { data: events }, { data: links }] =
			await Promise.all([
				supabase.from('persons').select('id, tree_id, profile_photo_path').in('tree_id', treeIds),
				supabase.from('places').select('tree_id, lat, lng').in('tree_id', treeIds),
				supabase.from('events').select('tree_id, event_date').in('tree_id', treeIds),
				supabase
					.from('parent_child_links')
					.select('tree_id, parent_id, child_id')
					.in('tree_id', treeIds)
			]);

		for (const p of persons ?? [])
			peopleCount.set(p.tree_id, (peopleCount.get(p.tree_id) ?? 0) + 1);
		for (const p of places ?? []) {
			placeCount.set(p.tree_id, (placeCount.get(p.tree_id) ?? 0) + 1);
			if (p.lat != null && p.lng != null) {
				const list = pointsByTree.get(p.tree_id) ?? [];
				list.push({ lng: p.lng, lat: p.lat });
				pointsByTree.set(p.tree_id, list);
			}
		}
		for (const e of events ?? []) {
			const y = yearOf(e.event_date);
			if (y == null) continue;
			const cur = span.get(e.tree_id);
			if (!cur) span.set(e.tree_id, { min: y, max: y });
			else span.set(e.tree_id, { min: Math.min(cur.min, y), max: Math.max(cur.max, y) });
		}

		// Longest parent→child chain per tree = generation depth.
		for (const id of treeIds) {
			const parents = new Map<string, string[]>();
			const nodes = new Set<string>();
			for (const l of links ?? []) {
				if (l.tree_id !== id) continue;
				nodes.add(l.parent_id);
				nodes.add(l.child_id);
				const arr = parents.get(l.child_id) ?? [];
				arr.push(l.parent_id);
				parents.set(l.child_id, arr);
			}
			const depthCache = new Map<string, number>();
			const depth = (n: string, seen: Set<string>): number => {
				if (depthCache.has(n)) return depthCache.get(n)!;
				if (seen.has(n)) return 1; // guard against cycles
				seen.add(n);
				const ps = parents.get(n) ?? [];
				const d = ps.length === 0 ? 1 : 1 + Math.max(...ps.map((p) => depth(p, seen)));
				seen.delete(n);
				depthCache.set(n, d);
				return d;
			};
			let maxD = 0;
			for (const n of nodes) maxD = Math.max(maxD, depth(n, new Set()));
			generations.set(id, maxD);
		}

		// Avatars: up to 5 photographed people per tree; sign bucket paths in bulk.
		const isPublic = (p: string) => /^(https?:\/\/|\/)/.test(p);
		const bucketPaths: string[] = [];
		const wanted = new Map<string, string[]>(); // tree -> raw paths (max 5)
		for (const p of persons ?? []) {
			if (!p.profile_photo_path) continue;
			const list = wanted.get(p.tree_id) ?? [];
			if (list.length >= 5) continue;
			list.push(p.profile_photo_path);
			wanted.set(p.tree_id, list);
			if (!isPublic(p.profile_photo_path)) bucketPaths.push(p.profile_photo_path);
		}
		const signed = new Map<string, string>();
		if (bucketPaths.length > 0) {
			const { data } = await supabase.storage
				.from('person-photos')
				.createSignedUrls(bucketPaths, 3600);
			for (const e of data ?? []) if (e.path && e.signedUrl) signed.set(e.path, e.signedUrl);
		}
		for (const [tid, paths] of wanted) {
			avatarsByTree.set(
				tid,
				paths.map((p) => (isPublic(p) ? p : (signed.get(p) ?? ''))).filter(Boolean)
			);
		}
	}

	const trees = base
		.map((t) => ({
			...t,
			peopleCount: peopleCount.get(t.id) ?? 0,
			placeCount: placeCount.get(t.id) ?? 0,
			generations: generations.get(t.id) ?? 0,
			yearSpan: span.get(t.id) ?? null,
			avatars: avatarsByTree.get(t.id) ?? [],
			points: pointsByTree.get(t.id) ?? []
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
