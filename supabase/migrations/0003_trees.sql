-- Trees: the top-level container a user owns. People, relationships, and events
-- all belong to exactly one tree. Sharing with other users is layered on in 0004.

create table public.trees (
	id uuid primary key default gen_random_uuid(),
	name text not null check (char_length(name) between 1 and 200),
	owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index trees_owner_id_idx on public.trees (owner_id);

alter table public.trees enable row level security;

create trigger trees_touch_updated_at
	before update on public.trees
	for each row execute function public.touch_updated_at();

-- Owner-only access. Member (shared) read access is added in 0004 (task 1.6);
-- write access stays owner-only here and is granted to editors per-table on
-- persons/relationships, not on the tree row itself.
create policy "Owners have full access to their trees"
	on public.trees for all
	using ((select auth.uid()) = owner_id)
	with check ((select auth.uid()) = owner_id);
