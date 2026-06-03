-- Short, URL-friendly primary keys.
-- Replace the uuid primary keys (and the foreign keys + RLS helper functions that
-- depend on them) with 6-character base-31 ids, so URLs read
--   /trees/ab3k9p/persons/q7m2xt  instead of two 36-char uuids.
-- Existing rows are remapped in place, so the seeded tree and all of its
-- relationships survive the change. ~887M id space; a collision would be caught
-- by the primary key. profiles.id / *_user_id / owner_id stay uuid (auth.users).

-- 0. Short-id generator ----------------------------------------------------
create or replace function public.gen_short_id(len int default 6)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
	-- lowercase letters + digits, minus the visually ambiguous 0/1/i/l/o
	alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
	result text := '';
	i int;
begin
	for i in 1..len loop
		result := result || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
	end loop;
	return result;
end;
$$;

-- 1. Drop the RLS policies that touch the columns we're retyping -----------
drop policy "Members can read events" on public.events;
drop policy "Editors can insert events" on public.events;
drop policy "Editors can update events" on public.events;
drop policy "Editors can delete events" on public.events;

drop policy "Members can read parent-child links" on public.parent_child_links;
drop policy "Editors can insert parent-child links" on public.parent_child_links;
drop policy "Editors can update parent-child links" on public.parent_child_links;
drop policy "Editors can delete parent-child links" on public.parent_child_links;

drop policy "Members can read partnerships" on public.partnerships;
drop policy "Editors can insert partnerships" on public.partnerships;
drop policy "Editors can update partnerships" on public.partnerships;
drop policy "Editors can delete partnerships" on public.partnerships;

drop policy "Members can read persons" on public.persons;
drop policy "Editors can insert persons" on public.persons;
drop policy "Editors can update persons" on public.persons;
drop policy "Editors can delete persons" on public.persons;

drop policy "Members can read places" on public.places;
drop policy "Editors can insert places" on public.places;
drop policy "Editors can update places" on public.places;
drop policy "Editors can delete places" on public.places;

drop policy "Owners manage invitations" on public.invitations;

drop policy "Members can read co-membership" on public.tree_members;
drop policy "Owners manage membership" on public.tree_members;
drop policy "Invitees can join a tree they were invited to" on public.tree_members;

drop policy "Members can read their trees" on public.trees;

-- Photo-bucket policies (storage.objects) gate on the tree-id path segment.
drop policy "Members can read person photos" on storage.objects;
drop policy "Editors can upload person photos" on storage.objects;
drop policy "Editors can update person photos" on storage.objects;
drop policy "Editors can delete person photos" on storage.objects;

-- 2. Drop the tree-id helper functions (recreated below with a text param) -
drop function private.is_tree_member(uuid);
drop function private.can_edit_tree(uuid);
drop function private.is_tree_owner(uuid);

-- 3. Drop the constraints on the columns we're retyping --------------------
alter table public.events
	drop constraint events_person_id_tree_id_fkey,
	drop constraint events_place_id_tree_id_fkey,
	drop constraint events_tree_id_fkey;
alter table public.parent_child_links
	drop constraint parent_child_links_child_id_tree_id_fkey,
	drop constraint parent_child_links_parent_id_tree_id_fkey,
	drop constraint parent_child_links_tree_id_fkey,
	drop constraint parent_child_links_parent_id_child_id_key,
	drop constraint parent_child_distinct;
alter table public.partnerships
	drop constraint partnerships_partner_a_tree_id_fkey,
	drop constraint partnerships_partner_b_tree_id_fkey,
	drop constraint partnerships_tree_id_fkey,
	drop constraint partnership_distinct_ordered;
alter table public.places
	drop constraint places_tree_id_fkey,
	drop constraint places_id_tree_id_key;
alter table public.persons
	drop constraint persons_tree_id_fkey,
	drop constraint persons_id_tree_id_key;
alter table public.invitations
	drop constraint invitations_tree_id_fkey,
	drop constraint invitations_tree_id_email_key;
alter table public.tree_members
	drop constraint tree_members_tree_id_fkey;

-- 4. Retype every id / id-referencing column from uuid to text -------------
-- Drop the uuid defaults first; the default expression can't survive the cast.
alter table public.trees alter column id drop default;
alter table public.persons alter column id drop default;
alter table public.places alter column id drop default;
alter table public.events alter column id drop default;
alter table public.partnerships alter column id drop default;
alter table public.parent_child_links alter column id drop default;
alter table public.invitations alter column id drop default;

alter table public.trees alter column id type text using (id::text);

alter table public.tree_members alter column tree_id type text using (tree_id::text);

alter table public.persons alter column id type text using (id::text);
alter table public.persons alter column tree_id type text using (tree_id::text);

alter table public.partnerships alter column id type text using (id::text);
alter table public.partnerships alter column tree_id type text using (tree_id::text);
alter table public.partnerships alter column partner_a type text using (partner_a::text);
alter table public.partnerships alter column partner_b type text using (partner_b::text);

alter table public.parent_child_links alter column id type text using (id::text);
alter table public.parent_child_links alter column tree_id type text using (tree_id::text);
alter table public.parent_child_links alter column parent_id type text using (parent_id::text);
alter table public.parent_child_links alter column child_id type text using (child_id::text);

alter table public.places alter column id type text using (id::text);
alter table public.places alter column tree_id type text using (tree_id::text);

alter table public.events alter column id type text using (id::text);
alter table public.events alter column tree_id type text using (tree_id::text);
alter table public.events alter column person_id type text using (person_id::text);
alter table public.events alter column place_id type text using (place_id::text);

alter table public.invitations alter column id type text using (id::text);
alter table public.invitations alter column tree_id type text using (tree_id::text);

-- 5. Remap existing rows from uuid-strings to short ids --------------------
-- Maps keyed on the current (uuid-as-text) value. FKs are dropped, so the
-- updates below join only against these temp maps and can run in any order.
create temporary table map_trees on commit drop as
	select id as old, public.gen_short_id() as new from public.trees;
create temporary table map_persons on commit drop as
	select id as old, public.gen_short_id() as new from public.persons;
create temporary table map_places on commit drop as
	select id as old, public.gen_short_id() as new from public.places;

update public.tree_members tm set tree_id = m.new
	from map_trees m where m.old = tm.tree_id;

update public.persons p set id = mp.new, tree_id = mt.new
	from map_persons mp, map_trees mt
	where mp.old = p.id and mt.old = p.tree_id;

update public.places pl set id = mpl.new, tree_id = mt.new
	from map_places mpl, map_trees mt
	where mpl.old = pl.id and mt.old = pl.tree_id;

update public.partnerships x set
	id = public.gen_short_id(), tree_id = mt.new, partner_a = ma.new, partner_b = mb.new
	from map_trees mt, map_persons ma, map_persons mb
	where mt.old = x.tree_id and ma.old = x.partner_a and mb.old = x.partner_b;

update public.parent_child_links x set
	id = public.gen_short_id(), tree_id = mt.new, parent_id = mpa.new, child_id = mch.new
	from map_trees mt, map_persons mpa, map_persons mch
	where mt.old = x.tree_id and mpa.old = x.parent_id and mch.old = x.child_id;

update public.events x set id = public.gen_short_id(), tree_id = mt.new, person_id = mp.new
	from map_trees mt, map_persons mp
	where mt.old = x.tree_id and mp.old = x.person_id;
update public.events x set place_id = mpl.new
	from map_places mpl
	where x.place_id is not null and mpl.old = x.place_id;

update public.invitations x set id = public.gen_short_id(), tree_id = mt.new
	from map_trees mt where mt.old = x.tree_id;

update public.trees t set id = m.new from map_trees m where m.old = t.id;

-- New short ids reorder the canonical partnership pair, so re-canonicalise it.
update public.partnerships set
	partner_a = least(partner_a, partner_b),
	partner_b = greatest(partner_a, partner_b);

-- 6. New defaults ----------------------------------------------------------
alter table public.trees alter column id set default public.gen_short_id();
alter table public.persons alter column id set default public.gen_short_id();
alter table public.places alter column id set default public.gen_short_id();
alter table public.events alter column id set default public.gen_short_id();
alter table public.partnerships alter column id set default public.gen_short_id();
alter table public.parent_child_links alter column id set default public.gen_short_id();
alter table public.invitations alter column id set default public.gen_short_id();

-- 7. Recreate unique / check constraints -----------------------------------
alter table public.persons add constraint persons_id_tree_id_key unique (id, tree_id);
alter table public.places add constraint places_id_tree_id_key unique (id, tree_id);
alter table public.parent_child_links
	add constraint parent_child_links_parent_id_child_id_key unique (parent_id, child_id);
alter table public.invitations add constraint invitations_tree_id_email_key unique (tree_id, email);

alter table public.parent_child_links
	add constraint parent_child_distinct check (parent_id <> child_id);
alter table public.partnerships
	add constraint partnership_distinct_ordered check (partner_a < partner_b);

-- 8. Recreate foreign keys -------------------------------------------------
alter table public.tree_members
	add constraint tree_members_tree_id_fkey foreign key (tree_id) references public.trees (id) on delete cascade;
alter table public.persons
	add constraint persons_tree_id_fkey foreign key (tree_id) references public.trees (id) on delete cascade;
alter table public.partnerships
	add constraint partnerships_tree_id_fkey foreign key (tree_id) references public.trees (id) on delete cascade,
	add constraint partnerships_partner_a_tree_id_fkey foreign key (partner_a, tree_id) references public.persons (id, tree_id) on delete cascade,
	add constraint partnerships_partner_b_tree_id_fkey foreign key (partner_b, tree_id) references public.persons (id, tree_id) on delete cascade;
alter table public.parent_child_links
	add constraint parent_child_links_tree_id_fkey foreign key (tree_id) references public.trees (id) on delete cascade,
	add constraint parent_child_links_parent_id_tree_id_fkey foreign key (parent_id, tree_id) references public.persons (id, tree_id) on delete cascade,
	add constraint parent_child_links_child_id_tree_id_fkey foreign key (child_id, tree_id) references public.persons (id, tree_id) on delete cascade;
alter table public.places
	add constraint places_tree_id_fkey foreign key (tree_id) references public.trees (id) on delete cascade;
alter table public.events
	add constraint events_tree_id_fkey foreign key (tree_id) references public.trees (id) on delete cascade,
	add constraint events_person_id_tree_id_fkey foreign key (person_id, tree_id) references public.persons (id, tree_id) on delete cascade,
	add constraint events_place_id_tree_id_fkey foreign key (place_id, tree_id) references public.places (id, tree_id) on delete set null;
alter table public.invitations
	add constraint invitations_tree_id_fkey foreign key (tree_id) references public.trees (id) on delete cascade;

-- 9. Recreate the tree-id helper functions with a text parameter -----------
create or replace function private.is_tree_member(p_tree_id text)
returns boolean language sql stable security definer set search_path = '' as $$
	select exists (
		select 1 from public.tree_members
		where tree_id = p_tree_id and user_id = (select auth.uid())
	);
$$;
create or replace function private.can_edit_tree(p_tree_id text)
returns boolean language sql stable security definer set search_path = '' as $$
	select exists (
		select 1 from public.tree_members
		where tree_id = p_tree_id and user_id = (select auth.uid())
			and role in ('owner', 'editor')
	);
$$;
create or replace function private.is_tree_owner(p_tree_id text)
returns boolean language sql stable security definer set search_path = '' as $$
	select exists (
		select 1 from public.trees
		where id = p_tree_id and owner_id = (select auth.uid())
	);
$$;
grant execute on function private.is_tree_member(text) to anon, authenticated;
grant execute on function private.can_edit_tree(text) to anon, authenticated;
grant execute on function private.is_tree_owner(text) to anon, authenticated;

-- 10. Recreate the policies (identical expressions) ------------------------
create policy "Members can read events" on public.events for select
	using (private.is_tree_member(tree_id));
create policy "Editors can insert events" on public.events for insert
	with check (private.can_edit_tree(tree_id));
create policy "Editors can update events" on public.events for update
	using (private.can_edit_tree(tree_id)) with check (private.can_edit_tree(tree_id));
create policy "Editors can delete events" on public.events for delete
	using (private.can_edit_tree(tree_id));

create policy "Members can read parent-child links" on public.parent_child_links for select
	using (private.is_tree_member(tree_id));
create policy "Editors can insert parent-child links" on public.parent_child_links for insert
	with check (private.can_edit_tree(tree_id));
create policy "Editors can update parent-child links" on public.parent_child_links for update
	using (private.can_edit_tree(tree_id)) with check (private.can_edit_tree(tree_id));
create policy "Editors can delete parent-child links" on public.parent_child_links for delete
	using (private.can_edit_tree(tree_id));

create policy "Members can read partnerships" on public.partnerships for select
	using (private.is_tree_member(tree_id));
create policy "Editors can insert partnerships" on public.partnerships for insert
	with check (private.can_edit_tree(tree_id));
create policy "Editors can update partnerships" on public.partnerships for update
	using (private.can_edit_tree(tree_id)) with check (private.can_edit_tree(tree_id));
create policy "Editors can delete partnerships" on public.partnerships for delete
	using (private.can_edit_tree(tree_id));

create policy "Members can read persons" on public.persons for select
	using (private.is_tree_member(tree_id));
create policy "Editors can insert persons" on public.persons for insert
	with check (private.can_edit_tree(tree_id));
create policy "Editors can update persons" on public.persons for update
	using (private.can_edit_tree(tree_id)) with check (private.can_edit_tree(tree_id));
create policy "Editors can delete persons" on public.persons for delete
	using (private.can_edit_tree(tree_id));

create policy "Members can read places" on public.places for select
	using (private.is_tree_member(tree_id));
create policy "Editors can insert places" on public.places for insert
	with check (private.can_edit_tree(tree_id));
create policy "Editors can update places" on public.places for update
	using (private.can_edit_tree(tree_id)) with check (private.can_edit_tree(tree_id));
create policy "Editors can delete places" on public.places for delete
	using (private.can_edit_tree(tree_id));

create policy "Owners manage invitations" on public.invitations for all
	using (private.is_tree_owner(tree_id)) with check (private.is_tree_owner(tree_id));

create policy "Members can read co-membership" on public.tree_members for select
	using (private.is_tree_member(tree_id));
create policy "Owners manage membership" on public.tree_members for all
	using (
		exists (
			select 1 from public.trees
			where trees.id = tree_members.tree_id and trees.owner_id = (select auth.uid())
		)
	)
	with check (
		exists (
			select 1 from public.trees
			where trees.id = tree_members.tree_id and trees.owner_id = (select auth.uid())
		)
	);
create policy "Invitees can join a tree they were invited to" on public.tree_members for insert
	with check (
		user_id = (select auth.uid())
		and exists (
			select 1 from public.invitations i
			where i.tree_id = tree_members.tree_id
				and i.email = lower((select auth.jwt() ->> 'email'))
				and i.role = tree_members.role
		)
	);

create policy "Members can read their trees" on public.trees for select
	using (private.is_tree_member(id));

-- Photo-bucket policies: the tree-id path segment is now plain text (no ::uuid).
create policy "Members can read person photos" on storage.objects for select to authenticated
	using (
		bucket_id = 'person-photos' and private.is_tree_member((storage.foldername(name))[1])
	);
create policy "Editors can upload person photos" on storage.objects for insert to authenticated
	with check (
		bucket_id = 'person-photos' and private.can_edit_tree((storage.foldername(name))[1])
	);
create policy "Editors can update person photos" on storage.objects for update to authenticated
	using (
		bucket_id = 'person-photos' and private.can_edit_tree((storage.foldername(name))[1])
	)
	with check (
		bucket_id = 'person-photos' and private.can_edit_tree((storage.foldername(name))[1])
	);
create policy "Editors can delete person photos" on storage.objects for delete to authenticated
	using (
		bucket_id = 'person-photos' and private.can_edit_tree((storage.foldername(name))[1])
	);
