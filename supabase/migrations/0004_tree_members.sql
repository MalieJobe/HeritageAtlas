-- Tree membership: which users can access a tree and with what role.
-- The tree's owner is auto-enrolled as an 'owner' member on creation, so
-- tree_members is the single source of truth for access checks.

create type public.tree_role as enum ('owner', 'editor', 'viewer');

create table public.tree_members (
	tree_id uuid not null references public.trees (id) on delete cascade,
	user_id uuid not null references auth.users (id) on delete cascade,
	role public.tree_role not null default 'viewer',
	created_at timestamptz not null default now(),
	primary key (tree_id, user_id)
);

create index tree_members_user_id_idx on public.tree_members (user_id);

alter table public.tree_members enable row level security;

-- Membership-check helpers live in a schema that PostgREST does NOT expose, so
-- they're callable from RLS policies (SECURITY DEFINER bypasses RLS, breaking the
-- trees <-> tree_members policy recursion) but never reachable as REST RPCs.
create schema if not exists private;
grant usage on schema private to anon, authenticated;

create function private.is_tree_member(p_tree_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
	select exists (
		select 1 from public.tree_members
		where tree_id = p_tree_id and user_id = (select auth.uid())
	);
$$;

create function private.can_edit_tree(p_tree_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
	select exists (
		select 1 from public.tree_members
		where tree_id = p_tree_id
			and user_id = (select auth.uid())
			and role in ('owner', 'editor')
	);
$$;

grant execute on function private.is_tree_member(uuid) to anon, authenticated;
grant execute on function private.can_edit_tree(uuid) to anon, authenticated;

-- Enroll the owner as an 'owner' member whenever a tree is created.
create function public.add_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	insert into public.tree_members (tree_id, user_id, role)
	values (new.id, new.owner_id, 'owner');
	return new;
end;
$$;

revoke execute on function public.add_owner_membership() from public, anon, authenticated;

create trigger trees_add_owner_membership
	after insert on public.trees
	for each row execute function public.add_owner_membership();

-- Members can read the trees they belong to (owner write access is from 0003).
create policy "Members can read their trees"
	on public.trees for select
	using (private.is_tree_member(id));

-- A member can see who else belongs to their trees.
create policy "Members can read co-membership"
	on public.tree_members for select
	using (private.is_tree_member(tree_id));

-- Only the tree owner manages membership (invite / change role / remove).
-- Checked against trees.owner_id (not tree_members) to stay independent here.
create policy "Owners manage membership"
	on public.tree_members for all
	using (
		exists (select 1 from public.trees where id = tree_id and owner_id = (select auth.uid()))
	)
	with check (
		exists (select 1 from public.trees where id = tree_id and owner_id = (select auth.uid()))
	);
