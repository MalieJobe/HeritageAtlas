import { error } from '@sveltejs/kit';
import { fuzzyDateFromColumns } from '$lib/fuzzyDate';
import { buildGedcom, type ExportPerson, type ExportSex } from '$lib/gedcom/export';
import type { RequestHandler } from './$types';

function normalizeSex(value: string | null): ExportSex {
	return value === 'male' || value === 'female' || value === 'other' ? value : null;
}

/** Safe-ish filename from the tree name. */
function fileName(name: string): string {
	const base =
		name
			.replace(/[^\w\s-]+/g, '')
			.trim()
			.replace(/\s+/g, '-') || 'family-tree';
	return `${base}.ged`;
}

/** GET /trees/[treeId]/export → downloads the tree as GEDCOM 5.5.1 (task 5.7). */
export const GET: RequestHandler = async ({ params, locals: { supabase, user } }) => {
	if (!user) error(401, 'Not authenticated');
	const treeId = params.treeId;

	const { data: tree } = await supabase
		.from('trees')
		.select('id, name')
		.eq('id', treeId)
		.maybeSingle();
	if (!tree) error(404, 'Tree not found'); // RLS hides trees the user can't see

	const [{ data: persons }, { data: events }, { data: partnerships }, { data: links }] =
		await Promise.all([
			supabase
				.from('persons')
				.select('id, given_names, surname, nickname, sex, notes')
				.eq('tree_id', treeId),
			supabase
				.from('events')
				.select(
					'person_id, type, label, note, event_date, event_date_end, event_qualifier, event_precision, place:places(name)'
				)
				.eq('tree_id', treeId),
			supabase.from('partnerships').select('partner_a, partner_b').eq('tree_id', treeId),
			supabase.from('parent_child_links').select('parent_id, child_id').eq('tree_id', treeId)
		]);

	const eventsByPerson = new Map<string, ExportPerson['events']>();
	for (const e of events ?? []) {
		const list = eventsByPerson.get(e.person_id) ?? [];
		list.push({
			type: e.type,
			label: e.label,
			date: fuzzyDateFromColumns(e, 'event'),
			placeName: e.place?.name ?? null,
			note: e.note
		});
		eventsByPerson.set(e.person_id, list);
	}

	const exportPersons: ExportPerson[] = (persons ?? []).map((p) => ({
		id: p.id,
		given: p.given_names,
		surname: p.surname,
		nickname: p.nickname,
		sex: normalizeSex(p.sex),
		notes: p.notes,
		events: eventsByPerson.get(p.id) ?? []
	}));

	const gedcom = buildGedcom({
		treeName: tree.name,
		persons: exportPersons,
		partnerships: (partnerships ?? []).map((r) => ({ a: r.partner_a, b: r.partner_b })),
		parentChild: (links ?? []).map((r) => ({ parent: r.parent_id, child: r.child_id }))
	});

	return new Response(gedcom, {
		headers: {
			'Content-Type': 'text/vnd.familysearch.gedcom; charset=utf-8',
			'Content-Disposition': `attachment; filename="${fileName(tree.name)}"`
		}
	});
};
