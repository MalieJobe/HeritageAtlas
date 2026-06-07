-- Password-protected public share links (Phase 3.x sharing).
--
-- A tree can be shared via an unguessable token in the URL, but viewing always
-- requires a password. Enforcement lives in the database (the password is checked
-- inside a SECURITY DEFINER function with pgcrypto), so the public anon key can
-- never read a shared tree's data without the password.

create extension if not exists pgcrypto with schema extensions;

alter table public.trees
	add column if not exists share_token text unique,
	add column if not exists share_password text; -- bcrypt hash (crypt/gen_salt)

-- Owner-only: create or rotate a tree's share link + password. Returns the token.
create or replace function public.set_tree_share(p_tree_id text, p_password text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
	v_token text;
begin
	if coalesce(length(p_password), 0) < 4 then
		raise exception 'Password must be at least 4 characters.';
	end if;
	if not exists (select 1 from public.trees where id = p_tree_id and owner_id = auth.uid()) then
		raise exception 'Only the tree owner can manage sharing.';
	end if;

	select share_token into v_token from public.trees where id = p_tree_id;
	if v_token is null then
		v_token := encode(extensions.gen_random_bytes(12), 'hex');
	end if;

	update public.trees
	set share_token = v_token,
		share_password = extensions.crypt(p_password, extensions.gen_salt('bf'))
	where id = p_tree_id;

	return v_token;
end;
$$;

-- Owner-only: turn sharing off.
create or replace function public.clear_tree_share(p_tree_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	if not exists (select 1 from public.trees where id = p_tree_id and owner_id = auth.uid()) then
		raise exception 'Only the tree owner can manage sharing.';
	end if;
	update public.trees set share_token = null, share_password = null where id = p_tree_id;
end;
$$;

-- Public: just the tree name for a token, for the password prompt. No tree data,
-- no password hash. Returns null name if the token is unknown.
create or replace function public.shared_tree_meta(p_token text)
returns text
language sql
security definer
set search_path = public
as $$
	select name from public.trees where share_token = p_token;
$$;

-- Public: the full tree payload, only when token + password both match. Returns
-- null otherwise (unknown token or wrong password) so callers can't tell them apart.
create or replace function public.get_shared_tree(p_token text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
	v_tree public.trees;
begin
	select * into v_tree from public.trees where share_token = p_token;
	if v_tree.id is null or v_tree.share_password is null then
		return null;
	end if;
	if v_tree.share_password <> extensions.crypt(p_password, v_tree.share_password) then
		return null;
	end if;

	return jsonb_build_object(
		'tree', jsonb_build_object('id', v_tree.id, 'name', v_tree.name),
		'persons', coalesce((
			select jsonb_agg(jsonb_build_object(
				'id', p.id, 'given_names', p.given_names, 'surname', p.surname,
				'nickname', p.nickname, 'sex', p.sex, 'notes', p.notes
			)) from public.persons p where p.tree_id = v_tree.id
		), '[]'::jsonb),
		'partnerships', coalesce((
			select jsonb_agg(jsonb_build_object(
				'id', pp.id, 'partner_a', pp.partner_a, 'partner_b', pp.partner_b, 'status', pp.status
			)) from public.partnerships pp where pp.tree_id = v_tree.id
		), '[]'::jsonb),
		'links', coalesce((
			select jsonb_agg(jsonb_build_object(
				'id', l.id, 'parent_id', l.parent_id, 'child_id', l.child_id
			)) from public.parent_child_links l where l.tree_id = v_tree.id
		), '[]'::jsonb),
		'events', coalesce((
			select jsonb_agg(jsonb_build_object(
				'person_id', e.person_id, 'type', e.type, 'event_date', e.event_date,
				'place', case when pl.id is null then null
					else jsonb_build_object('name', pl.name, 'lat', pl.lat, 'lng', pl.lng) end
			))
			from public.events e
			left join public.places pl on pl.id = e.place_id and pl.tree_id = e.tree_id
			where e.tree_id = v_tree.id
		), '[]'::jsonb)
	);
end;
$$;

-- Public read RPCs: anon may call (get_shared_tree enforces the password inside).
grant execute on function public.shared_tree_meta(text) to anon, authenticated;
grant execute on function public.get_shared_tree(text, text) to anon, authenticated;

-- Owner-management RPCs: authenticated only. Revoke the default PUBLIC execute so
-- anon can't even reach them (the owner check inside is the real gate regardless).
revoke execute on function public.set_tree_share(text, text) from public, anon;
revoke execute on function public.clear_tree_share(text) from public, anon;
grant execute on function public.set_tree_share(text, text) to authenticated;
grant execute on function public.clear_tree_share(text) to authenticated;
