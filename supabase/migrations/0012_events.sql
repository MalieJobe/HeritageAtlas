-- Events: a dated thing that happened to a person at a place. Events (not the
-- person row) carry the dates that drive the map timeline (Phase 2). Tree-scoped
-- like persons/places, with composite FKs so a person and place referenced by an
-- event always live in the same tree.
--
-- The date is a fuzzy date (src/lib/fuzzyDate.ts), stored as the four flat
-- columns sharing the `event` prefix that the helper reads/writes:
--   event_date        best-guess / lower-bound calendar date
--   event_date_end    upper bound, only meaningful when qualifier = 'between'
--   event_qualifier   how to read the date
--   event_precision   how much of the date is known
--
-- `label` names a 'custom' event (e.g. "Emigrated"); ignored for built-in types.
-- `place_id` is nullable: an undated/place-less event is still a valid fact.

create type public.event_type as enum (
	'birth', 'death', 'marriage', 'residence', 'occupation', 'custom'
);

create table public.events (
	id uuid primary key default gen_random_uuid(),
	tree_id uuid not null references public.trees (id) on delete cascade,
	person_id uuid not null,
	type public.event_type not null default 'custom',
	event_date date,
	event_date_end date,
	event_qualifier public.date_qualifier,
	event_precision public.date_precision,
	place_id uuid,
	label text,
	note text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint events_date_range check (event_date_end is null or event_qualifier = 'between'),
	foreign key (person_id, tree_id) references public.persons (id, tree_id) on delete cascade,
	-- Removing a place leaves its events intact, just unplaced.
	foreign key (place_id, tree_id) references public.places (id, tree_id) on delete set null
);

create index events_tree_id_idx on public.events (tree_id);
create index events_person_id_idx on public.events (person_id);
create index events_place_id_idx on public.events (place_id);

alter table public.events enable row level security;

create trigger events_touch_updated_at
	before update on public.events
	for each row execute function public.touch_updated_at();

create policy "Members can read events"
	on public.events for select
	using (private.is_tree_member(tree_id));

create policy "Editors can insert events"
	on public.events for insert
	with check (private.can_edit_tree(tree_id));

create policy "Editors can update events"
	on public.events for update
	using (private.can_edit_tree(tree_id))
	with check (private.can_edit_tree(tree_id));

create policy "Editors can delete events"
	on public.events for delete
	using (private.can_edit_tree(tree_id));
