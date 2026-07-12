-- ============================================================================
-- 00011_avatar_storage.sql
-- Profile picture storage: a public `avatars` bucket + per-user RLS on
-- storage.objects so each user can only read/write their own <userId>/ folder.
--
-- The `profiles.avatar_url` column already exists (00001_initial_schema.sql),
-- so no table change is needed — this migration provisions where the file
-- actually lives.
-- ============================================================================

-- 1. Bucket (public so the image is servable by a plain <Image source={{uri}}>).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,                                   -- 5 MB cap
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
  set public            = excluded.public,
      file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2. RLS on storage.objects for the avatars bucket.
--    Public read (bucket is public, but storage RLS still gates SELECT).
drop policy if exists "Avatars are viewable by everyone" on storage.objects;
create policy "Avatars are viewable by everyone"
  on storage.objects for select
  using ( bucket_id = 'avatars' );

--    Insert only into the caller's own folder: <auth.uid()>/...
drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

--    Update / delete only their own folder.
drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update to authenticated
  using ( bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text );

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete to authenticated
  using ( bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text );
