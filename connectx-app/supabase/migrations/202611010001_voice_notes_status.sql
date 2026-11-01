-- ConnectX voice notes and 24-hour status updates
alter table public.messages
  add column if not exists message_type text not null default 'text';
alter table public.messages
  drop constraint if exists messages_message_type_check;
alter table public.messages
  add constraint messages_message_type_check
  check (message_type in ('text', 'voice'));

create table if not exists public.status_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  caption text,
  media_url text,
  media_type text not null default 'text',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint status_updates_media_type_check check (media_type in ('text', 'image', 'video')),
  constraint status_updates_content_check check (
    (caption is not null and char_length(caption) <= 700)
    or media_url is not null
  )
);

create index if not exists connectx_status_active_idx
  on public.status_updates (expires_at desc, created_at desc);

alter table public.status_updates enable row level security;

drop policy if exists "Users can view active statuses" on public.status_updates;
create policy "Users can view active statuses"
on public.status_updates for select to authenticated
using (
  expires_at > now()
  and (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.friend_requests fr
      where fr.status = 'accepted'
        and (
          (fr.sender_id = (select auth.uid()) and fr.receiver_id = status_updates.user_id)
          or
          (fr.receiver_id = (select auth.uid()) and fr.sender_id = status_updates.user_id)
        )
    )
  )
);

drop policy if exists "Users can publish their own statuses" on public.status_updates;
create policy "Users can publish their own statuses"
on public.status_updates for insert to authenticated
with check (
  user_id = (select auth.uid())
  and expires_at > now()
  and expires_at <= now() + interval '24 hours 5 minutes'
);

drop policy if exists "Users can delete their own statuses" on public.status_updates;
create policy "Users can delete their own statuses"
on public.status_updates for delete to authenticated
using (user_id = (select auth.uid()));

grant select, insert, delete on public.status_updates to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('connectx-voice-notes', 'connectx-voice-notes', true, 10485760,
   array['audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/wav']),
  ('connectx-status-media', 'connectx-status-media', true, 5242880,
   array['image/jpeg','image/png','image/webp','video/mp4'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ConnectX voice notes are publicly readable" on storage.objects;
create policy "ConnectX voice notes are publicly readable"
on storage.objects for select
using (bucket_id = 'connectx-voice-notes');

drop policy if exists "Users can upload their own voice notes" on storage.objects;
create policy "Users can upload their own voice notes"
on storage.objects for insert to authenticated
with check (bucket_id = 'connectx-voice-notes' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can delete their own voice notes" on storage.objects;
create policy "Users can delete their own voice notes"
on storage.objects for delete to authenticated
using (bucket_id = 'connectx-voice-notes' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "ConnectX status media are publicly readable" on storage.objects;
create policy "ConnectX status media are publicly readable"
on storage.objects for select
using (bucket_id = 'connectx-status-media');

drop policy if exists "Users can upload their own status media" on storage.objects;
create policy "Users can upload their own status media"
on storage.objects for insert to authenticated
with check (bucket_id = 'connectx-status-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can delete their own status media" on storage.objects;
create policy "Users can delete their own status media"
on storage.objects for delete to authenticated
using (bucket_id = 'connectx-status-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

do $$
begin
  alter publication supabase_realtime add table public.status_updates;
exception when duplicate_object then null;
end $$;
