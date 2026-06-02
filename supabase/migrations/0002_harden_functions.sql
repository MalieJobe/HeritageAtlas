-- Security hardening for the functions added in 0001, per Supabase advisors.

-- Pin the search_path so the function can't be hijacked via a mutable path.
alter function public.touch_updated_at() set search_path = '';

-- handle_new_user only ever runs as an auth.users insert trigger. As a
-- SECURITY DEFINER function it must NOT be callable directly (it would be exposed
-- as a PostgREST RPC), so revoke EXECUTE from the API roles.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
