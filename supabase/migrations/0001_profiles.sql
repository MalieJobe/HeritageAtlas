-- Profiles: one row per auth user, auto-created on signup via trigger.
-- Holds account-level display info (not genealogical person data).

create table public.profiles (
	id uuid primary key references auth.users (id) on delete cascade,
	display_name text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A user may read and update only their own profile row.
create policy "Profiles are viewable by their owner"
	on public.profiles for select
	using ((select auth.uid()) = id);

create policy "Users can update their own profile"
	on public.profiles for update
	using ((select auth.uid()) = id)
	with check ((select auth.uid()) = id);

-- Keep updated_at current on every change.
create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

create trigger profiles_touch_updated_at
	before update on public.profiles
	for each row execute function public.touch_updated_at();

-- Auto-create a profile when a new auth user signs up. SECURITY DEFINER lets the
-- trigger insert past RLS; the empty search_path is the documented hardening for
-- definer functions.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	insert into public.profiles (id, display_name)
	values (new.id, new.raw_user_meta_data ->> 'display_name');
	return new;
end;
$$;

create trigger on_auth_user_created
	after insert on auth.users
	for each row execute function public.handle_new_user();
