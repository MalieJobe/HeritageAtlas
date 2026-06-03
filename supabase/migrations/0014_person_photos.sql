-- Multiple photos per person. The first (lowest position) is mirrored back to
-- persons.profile_photo_path, which still drives the avatars in the trees/map.

create table public.person_photos (
  id text primary key default public.gen_short_id(),
  tree_id text not null,
  person_id text not null,
  path text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint person_photos_person_fkey
    foreign key (person_id, tree_id) references public.persons (id, tree_id) on delete cascade
);

create index person_photos_person_position_idx on public.person_photos (person_id, position);

alter table public.person_photos enable row level security;

create policy "Members can read person photo rows"
  on public.person_photos for select
  using (private.is_tree_member(tree_id));

create policy "Editors can insert person photo rows"
  on public.person_photos for insert
  with check (private.can_edit_tree(tree_id));

create policy "Editors can update person photo rows"
  on public.person_photos for update
  using (private.can_edit_tree(tree_id))
  with check (private.can_edit_tree(tree_id));

create policy "Editors can delete person photo rows"
  on public.person_photos for delete
  using (private.can_edit_tree(tree_id));

-- Backfill: each person's existing single profile photo becomes their first image.
insert into public.person_photos (tree_id, person_id, path, position)
select tree_id, id, profile_photo_path, 0
from public.persons
where profile_photo_path is not null;
