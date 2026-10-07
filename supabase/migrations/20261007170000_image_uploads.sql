-- Enable authenticated users to add images to the public meme library.
--
-- Before this migration the `images` table had only a public-read policy and
-- lacked the `user_id` / `storage_path` columns the upload route writes, and the
-- `meme-images` bucket had no storage policies. Uploads were therefore rejected
-- by RLS and the insert failed.

alter table public.images enable row level security;
alter table public.images add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.images add column if not exists storage_path text;

-- Uploaders may insert rows they own; everyone can read the library.
-- Column-level grant matches the least-privilege pattern used elsewhere.
grant insert (image_url, description, user_id, storage_path) on public.images to authenticated;

drop policy if exists "Authenticated upload images" on public.images;
create policy "Authenticated upload images"
  on public.images for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Storage access for the public `meme-images` bucket.
drop policy if exists "Public read meme images" on storage.objects;
create policy "Public read meme images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'meme-images');

drop policy if exists "Users upload meme images" on storage.objects;
create policy "Users upload meme images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'meme-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users delete own meme images" on storage.objects;
create policy "Users delete own meme images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'meme-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Match the app's 2 MB limit and the formats it accepts (it normalizes to WebP).
update storage.buckets
set file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'meme-images';
