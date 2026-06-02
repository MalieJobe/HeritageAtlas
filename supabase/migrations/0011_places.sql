-- Places: a geographic location an event happened at. Tree-scoped (like persons),
-- so RLS follows tree membership and events can reference (place_id, tree_id) to
-- guarantee an event and its place live in the same tree. Reused within a tree
-- via find-or-create (task 2.6).
--
--   name             current/common name ("Berlin")
--   historical_name  name at the time, if different ("Königsberg")
--   lat / lng        coordinates; null for a place we couldn't locate yet
--   source           how the coords were set: geocoded (Nominatim) or manual (pin-drop)

create type public.place_source as enum ('geocoded', 'manual');

create table public.places (
	id uuid primary key default gen_random_uuid(),
	tree_id uuid not null references public.trees (id) on delete cascade,
	name text not null,
	historical_name text,
	lat double precision,
	lng double precision,
	source public.place_source not null default 'geocoded',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint places_lat_range check (lat is null or (lat between -90 and 90)),
	constraint places_lng_range check (lng is null or (lng between -180 and 180)),
	-- Lets events reference (place_id, tree_id) so an event's place is always in
	-- the same tree as the event.
	unique (id, tree_id)
);

create index places_tree_id_idx on public.places (tree_id);

alter table public.places enable row level security;

create trigger places_touch_updated_at
	before update on public.places
	for each row execute function public.touch_updated_at();

-- Read for any tree member; create/update/delete for editors and owners.
create policy "Members can read places"
	on public.places for select
	using (private.is_tree_member(tree_id));

create policy "Editors can insert places"
	on public.places for insert
	with check (private.can_edit_tree(tree_id));

create policy "Editors can update places"
	on public.places for update
	using (private.can_edit_tree(tree_id))
	with check (private.can_edit_tree(tree_id));

create policy "Editors can delete places"
	on public.places for delete
	using (private.can_edit_tree(tree_id));
