-- Storage for person profile photos. Private bucket; objects are named
-- "{tree_id}/{person_id}", so the first path segment identifies the tree and the
-- same membership helpers gate access. Reads for members, writes for editors.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'person-photos',
	'person-photos',
	false,
	5242880, -- 5 MB
	array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "Members can read person photos"
	on storage.objects for select
	to authenticated
	using (
		bucket_id = 'person-photos'
		and private.is_tree_member((storage.foldername(name))[1]::uuid)
	);

create policy "Editors can upload person photos"
	on storage.objects for insert
	to authenticated
	with check (
		bucket_id = 'person-photos'
		and private.can_edit_tree((storage.foldername(name))[1]::uuid)
	);

create policy "Editors can update person photos"
	on storage.objects for update
	to authenticated
	using (
		bucket_id = 'person-photos'
		and private.can_edit_tree((storage.foldername(name))[1]::uuid)
	)
	with check (
		bucket_id = 'person-photos'
		and private.can_edit_tree((storage.foldername(name))[1]::uuid)
	);

create policy "Editors can delete person photos"
	on storage.objects for delete
	to authenticated
	using (
		bucket_id = 'person-photos'
		and private.can_edit_tree((storage.foldername(name))[1]::uuid)
	);
