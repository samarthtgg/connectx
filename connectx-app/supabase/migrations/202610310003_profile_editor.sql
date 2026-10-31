-- ConnectX profile editor: bio, privacy preferences, unique usernames and avatar storage.
alter table public.profiles
  add column if not exists bio text,
  add column if not exists is_private boolean not null default false,
  add column if not exists show_last_seen boolean not null default true;

alter table public.profiles
  drop constraint if exists profiles_bio_length_check;
alter table public.profiles
  add constraint profiles_bio_length_check check (bio is null or char_length(bio) <= 160);

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username))
  where username is not null and btrim(username) <> '';

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

grant update (username, full_name, avatar_url, bio, is_private, show_last_seen)
on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('connectx-avatars', 'connectx-avatars', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = true, file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "ConnectX avatars are publicly viewable" on storage.objects;
create policy "ConnectX avatars are publicly viewable"
on storage.objects for select
using (bucket_id = 'connectx-avatars');

drop policy if exists "Users can upload their own ConnectX avatar" on storage.objects;
create policy "Users can upload their own ConnectX avatar"
on storage.objects for insert to authenticated
with check (bucket_id = 'connectx-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can update their own ConnectX avatar" on storage.objects;
create policy "Users can update their own ConnectX avatar"
on storage.objects for update to authenticated
using (bucket_id = 'connectx-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'connectx-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can delete their own ConnectX avatar" on storage.objects;
create policy "Users can delete their own ConnectX avatar"
on storage.objects for delete to authenticated
using (bucket_id = 'connectx-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
