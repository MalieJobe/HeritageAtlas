-- Persons: an individual in a family tree. Dates (birth/death/etc.) are modeled
-- as events in Phase 2, not on the person row.

create table public.persons (
	id uuid primary key default gen_random_uuid(),
	tree_id uuid not null references public.trees (id) on delete cascade,
	given_names text,
	surname text,
	birth_surname text, -- maiden / surname at birth, if different
	nickname text,
	sex text, -- biological sex; free text, constrained in the UI
	gender text, -- gender identity, optional
	notes text,
	profile_photo_path text, -- object path in the Storage bucket (task 1.16)
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	-- Lets relationship tables reference (person_id, tree_id) so an edge's
	-- endpoints are guaranteed to live in the same tree as the edge.
	unique (id, tree_id)
);

create index persons_tree_id_idx on public.persons (tree_id);

alter table public.persons enable row level security;

create trigger persons_touch_updated_at
	before update on public.persons
	for each row execute function public.touch_updated_at();

-- Read for any tree member; create/update/delete for editors and owners.
create policy "Members can read persons"
	on public.persons for select
	using (private.is_tree_member(tree_id));

create policy "Editors can insert persons"
	on public.persons for insert
	with check (private.can_edit_tree(tree_id));

create policy "Editors can update persons"
	on public.persons for update
	using (private.can_edit_tree(tree_id))
	with check (private.can_edit_tree(tree_id));

create policy "Editors can delete persons"
	on public.persons for delete
	using (private.can_edit_tree(tree_id));
