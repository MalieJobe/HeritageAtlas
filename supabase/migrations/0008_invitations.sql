-- Invitations: an owner invites an email address to a tree with a role. There's
-- no email delivery (no SMTP yet) — the invite shows up in-app for whoever signs
-- in with that address. Accepting is modeled without a SECURITY DEFINER RPC:
-- a user may insert their OWN membership row when a matching invite exists, then
-- the invite is deleted. tree_name is denormalized so an invitee can see what
-- they're joining without a trees read policy (which would cause policy recursion).

create table public.invitations (
	id uuid primary key default gen_random_uuid(),
	tree_id uuid not null references public.trees (id) on delete cascade,
	tree_name text not null,
	email text not null check (email = lower(email)),
	role public.tree_role not null default 'viewer' check (role <> 'owner'),
	invited_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
	created_at timestamptz not null default now(),
	unique (tree_id, email)
);

create index invitations_email_idx on public.invitations (email);

alter table public.invitations enable row level security;

-- Owner-of-tree check via a private (non-exposed) SECURITY DEFINER helper, so the
-- invitations policy doesn't re-enter trees RLS (avoids recursion).
create function private.is_tree_owner(p_tree_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
	select exists (
		select 1 from public.trees
		where id = p_tree_id and owner_id = (select auth.uid())
	);
$$;

grant execute on function private.is_tree_owner(uuid) to anon, authenticated;

create policy "Owners manage invitations"
	on public.invitations for all
	using (private.is_tree_owner(tree_id))
	with check (private.is_tree_owner(tree_id));

create policy "Invitees can read their invitations"
	on public.invitations for select
	using (email = lower((select auth.jwt() ->> 'email')));

create policy "Invitees can delete their invitations"
	on public.invitations for delete
	using (email = lower((select auth.jwt() ->> 'email')));

-- Accept = the invited user inserts their own membership row, allowed only when a
-- matching pending invitation exists (same tree, email, and role — so role can't
-- be escalated). The app deletes the invite right after.
create policy "Invitees can join a tree they were invited to"
	on public.tree_members for insert
	with check (
		user_id = (select auth.uid())
		and exists (
			select 1 from public.invitations i
			where i.tree_id = tree_members.tree_id
				and i.email = lower((select auth.jwt() ->> 'email'))
				and i.role = tree_members.role
		)
	);
