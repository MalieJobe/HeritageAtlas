-- Relationship edges between persons, split into two tables because partnerships
-- (symmetric, with type/status/dates) and parent-child links (directed, typed)
-- have genuinely different shapes.
--
-- Both reference persons via a composite FK on (person_id, tree_id) so an edge's
-- endpoints are always in the same tree as the edge itself. Deleting a person
-- cascades to its edges (the "dangling relationship" cleanup of task 1.15).

-- Fuzzy-date enums (the reusable shape formalized/documented in task 1.9, reused
-- by events in Phase 2). A fuzzy date is stored as a group of flat columns:
--   <name>_date       best-guess / lower-bound calendar date
--   <name>_date_end   upper bound, only meaningful when qualifier = 'between'
--   <name>_qualifier  how to read the date
--   <name>_precision  how much of the date is known
create type public.date_qualifier as enum (
	'exact', 'about', 'before', 'after', 'between', 'estimated'
);
create type public.date_precision as enum ('day', 'month', 'year');

create type public.partnership_type as enum ('marriage', 'civil_union', 'unmarried');
create type public.partnership_status as enum (
	'active', 'separated', 'divorced', 'widowed', 'ended'
);
create type public.parent_child_type as enum ('biological', 'adoptive', 'step', 'foster');

-- Partnerships -------------------------------------------------------------
create table public.partnerships (
	id uuid primary key default gen_random_uuid(),
	tree_id uuid not null references public.trees (id) on delete cascade,
	partner_a uuid not null,
	partner_b uuid not null,
	type public.partnership_type not null default 'marriage',
	status public.partnership_status not null default 'active',
	began_date date,
	began_date_end date,
	began_qualifier public.date_qualifier,
	began_precision public.date_precision,
	ended_date date,
	ended_date_end date,
	ended_qualifier public.date_qualifier,
	ended_precision public.date_precision,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	-- Canonical ordering of the (symmetric) pair avoids storing A-B and B-A as
	-- two different rows for the same partnership.
	constraint partnership_distinct_ordered check (partner_a < partner_b),
	constraint partnership_began_range check (began_date_end is null or began_qualifier = 'between'),
	constraint partnership_ended_range check (ended_date_end is null or ended_qualifier = 'between'),
	foreign key (partner_a, tree_id) references public.persons (id, tree_id) on delete cascade,
	foreign key (partner_b, tree_id) references public.persons (id, tree_id) on delete cascade
);

create index partnerships_tree_id_idx on public.partnerships (tree_id);
create index partnerships_partner_a_idx on public.partnerships (partner_a);
create index partnerships_partner_b_idx on public.partnerships (partner_b);

alter table public.partnerships enable row level security;

create trigger partnerships_touch_updated_at
	before update on public.partnerships
	for each row execute function public.touch_updated_at();

create policy "Members can read partnerships"
	on public.partnerships for select
	using (private.is_tree_member(tree_id));
create policy "Editors can insert partnerships"
	on public.partnerships for insert
	with check (private.can_edit_tree(tree_id));
create policy "Editors can update partnerships"
	on public.partnerships for update
	using (private.can_edit_tree(tree_id))
	with check (private.can_edit_tree(tree_id));
create policy "Editors can delete partnerships"
	on public.partnerships for delete
	using (private.can_edit_tree(tree_id));

-- Parent-child links -------------------------------------------------------
create table public.parent_child_links (
	id uuid primary key default gen_random_uuid(),
	tree_id uuid not null references public.trees (id) on delete cascade,
	parent_id uuid not null,
	child_id uuid not null,
	type public.parent_child_type not null default 'biological',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint parent_child_distinct check (parent_id <> child_id),
	-- One link per (parent, child) pair; the type is the nature of that link.
	unique (parent_id, child_id),
	foreign key (parent_id, tree_id) references public.persons (id, tree_id) on delete cascade,
	foreign key (child_id, tree_id) references public.persons (id, tree_id) on delete cascade
);

create index parent_child_links_tree_id_idx on public.parent_child_links (tree_id);
create index parent_child_links_parent_id_idx on public.parent_child_links (parent_id);
create index parent_child_links_child_id_idx on public.parent_child_links (child_id);

alter table public.parent_child_links enable row level security;

create trigger parent_child_links_touch_updated_at
	before update on public.parent_child_links
	for each row execute function public.touch_updated_at();

create policy "Members can read parent-child links"
	on public.parent_child_links for select
	using (private.is_tree_member(tree_id));
create policy "Editors can insert parent-child links"
	on public.parent_child_links for insert
	with check (private.can_edit_tree(tree_id));
create policy "Editors can update parent-child links"
	on public.parent_child_links for update
	using (private.can_edit_tree(tree_id))
	with check (private.can_edit_tree(tree_id));
create policy "Editors can delete parent-child links"
	on public.parent_child_links for delete
	using (private.can_edit_tree(tree_id));
