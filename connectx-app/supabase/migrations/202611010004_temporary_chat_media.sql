-- Temporary chat media: private objects, five-minute access window, server cleanup.
-- Apply this migration before enabling the media composer in the app.

alter table public.messages
  add column if not exists media_path text,
  add column if not exists media_expires_at timestamptz,
  add column if not exists media_expired boolean not null default false;

alter table public.messages
  drop constraint if exists messages_message_type_check;
alter table public.messages
  add constraint messages_message_type_check
  check (message_type in ('text', 'voice', 'image', 'video', 'system'));

alter table public.chat_group_messages
  add column if not exists message_type text not null default 'text',
  add column if not exists media_path text,
  add column if not exists media_expires_at timestamptz,
  add column if not exists media_expired boolean not null default false;

alter table public.chat_group_messages
  drop constraint if exists chat_group_messages_message_type_check;
alter table public.chat_group_messages
  add constraint chat_group_messages_message_type_check
  check (message_type in ('text', 'image', 'video', 'system'));

create index if not exists connectx_direct_media_expiry_idx
  on public.messages (media_expires_at)
  where media_path is not null and media_expired = false;
create index if not exists connectx_group_media_expiry_idx
  on public.chat_group_messages (media_expires_at)
  where media_path is not null and media_expired = false;

-- Private bucket: files are delivered only through five-minute signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('connectx-temporary-chat-media', 'connectx-temporary-chat-media', false, 20971520,
        array['image/jpeg','image/png','image/webp','video/mp4'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ConnectX users upload temporary chat media" on storage.objects;
create policy "ConnectX users upload temporary chat media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'connectx-temporary-chat-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- No public SELECT policy is created. Reads use signed URLs from the app.
-- Cleanup uses the Edge Function service-role client, never client-side DELETE.
