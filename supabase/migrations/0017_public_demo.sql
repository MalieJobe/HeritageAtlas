-- Public, unauthenticated read access for demo trees (the landing-page Windsor
-- demo). Only trees explicitly flagged `is_public` are exposed; everything else
-- stays behind the existing membership policies. These SELECT policies are
-- additive (RLS policies are OR'd), so they only widen read access for public
-- trees and never affect private ones.

alter table public.trees add column if not exists is_public boolean not null default false;
update public.trees set is_public = true where id = 'windsor';

create or replace function private.is_public_tree(p_tree_id text)
returns boolean language sql stable security definer set search_path = '' as $$
	select exists (select 1 from public.trees where id = p_tree_id and is_public);
$$;
grant execute on function private.is_public_tree(text) to anon, authenticated;

-- Anyone (incl. anonymous visitors) may read a public tree and its contents.
create policy "Anyone can read public trees"
	on public.trees for select using (is_public);
create policy "Anyone can read public tree persons"
	on public.persons for select using (private.is_public_tree(tree_id));
create policy "Anyone can read public tree places"
	on public.places for select using (private.is_public_tree(tree_id));
create policy "Anyone can read public tree events"
	on public.events for select using (private.is_public_tree(tree_id));
create policy "Anyone can read public tree partnerships"
	on public.partnerships for select using (private.is_public_tree(tree_id));
create policy "Anyone can read public tree parent-child links"
	on public.parent_child_links for select using (private.is_public_tree(tree_id));
