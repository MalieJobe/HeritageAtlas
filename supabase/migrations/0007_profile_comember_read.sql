-- Let tree members see each other's profile (display name) so the members list
-- can show who belongs to a shared tree. Profiles otherwise stay private.

create function private.shares_tree_with(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
	select exists (
		select 1
		from public.tree_members me
		join public.tree_members them on them.tree_id = me.tree_id
		where me.user_id = (select auth.uid())
			and them.user_id = p_user_id
	);
$$;

grant execute on function private.shares_tree_with(uuid) to anon, authenticated;

-- Added alongside the existing owner-only select policy (permissive: ORed).
create policy "Profiles are viewable by co-members"
	on public.profiles for select
	using (private.shares_tree_with(id));
