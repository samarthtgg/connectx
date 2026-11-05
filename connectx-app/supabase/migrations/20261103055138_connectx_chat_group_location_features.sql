-- ConnectX feature foundation: chat organization, scheduling, group collaboration, and live location.
alter table public.chat_preferences
  add column if not exists is_pinned boolean not null default false,
  add column if not exists is_archived boolean not null default false,
  add column if not exists unread_at timestamptz,
  add column if not exists draft text;

create table if not exists public.scheduled_messages (
  id uuid primary key default gen_random_uuid(), sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 5000),
  scheduled_for timestamptz not null, sent_at timestamptz, created_at timestamptz not null default now(),
  constraint scheduled_messages_not_self check (sender_id <> receiver_id)
);
create index if not exists scheduled_messages_due_idx on public.scheduled_messages(scheduled_for) where sent_at is null;
alter table public.scheduled_messages enable row level security;
create policy "scheduled_messages_read_participants" on public.scheduled_messages for select to authenticated using ((select auth.uid()) = sender_id or (select auth.uid()) = receiver_id);
create policy "scheduled_messages_sender_insert" on public.scheduled_messages for insert to authenticated with check ((select auth.uid()) = sender_id and sent_at is null and scheduled_for > now());
create policy "scheduled_messages_sender_update" on public.scheduled_messages for update to authenticated using ((select auth.uid()) = sender_id and sent_at is null) with check ((select auth.uid()) = sender_id and sent_at is null and scheduled_for > now());
create policy "scheduled_messages_sender_delete" on public.scheduled_messages for delete to authenticated using ((select auth.uid()) = sender_id and sent_at is null);

create table if not exists public.group_announcements (
  id uuid primary key default gen_random_uuid(), group_id uuid not null references public.chat_groups(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 3000), created_at timestamptz not null default now()
);
create index if not exists group_announcements_group_created_idx on public.group_announcements(group_id, created_at desc);
alter table public.group_announcements enable row level security;
create policy "group_announcements_members_read" on public.group_announcements for select to authenticated using (exists (select 1 from public.chat_group_members m where m.group_id = group_announcements.group_id and m.user_id = (select auth.uid())));
create policy "group_announcements_admin_insert" on public.group_announcements for insert to authenticated with check (author_id = (select auth.uid()) and exists (select 1 from public.chat_group_members m where m.group_id = group_announcements.group_id and m.user_id = (select auth.uid()) and m.role = 'admin'));
create policy "group_announcements_admin_delete" on public.group_announcements for delete to authenticated using (exists (select 1 from public.chat_group_members m where m.group_id = group_announcements.group_id and m.user_id = (select auth.uid()) and m.role = 'admin'));

create table if not exists public.group_polls (
  id uuid primary key default gen_random_uuid(), group_id uuid not null references public.chat_groups(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  question text not null check (char_length(btrim(question)) between 1 and 500),
  is_closed boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.group_poll_options (
  id uuid primary key default gen_random_uuid(), poll_id uuid not null references public.group_polls(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 160), created_at timestamptz not null default now()
);
create table if not exists public.group_poll_votes (
  id uuid primary key default gen_random_uuid(), poll_id uuid not null references public.group_polls(id) on delete cascade,
  option_id uuid not null references public.group_poll_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(),
  unique (poll_id, user_id)
);
create index if not exists group_polls_group_created_idx on public.group_polls(group_id, created_at desc);
create index if not exists group_poll_options_poll_idx on public.group_poll_options(poll_id);
create index if not exists group_poll_votes_poll_idx on public.group_poll_votes(poll_id);
alter table public.group_polls enable row level security;
alter table public.group_poll_options enable row level security;
alter table public.group_poll_votes enable row level security;
create policy "group_polls_members_read" on public.group_polls for select to authenticated using (exists (select 1 from public.chat_group_members m where m.group_id = group_polls.group_id and m.user_id = (select auth.uid())));
create policy "group_polls_members_create" on public.group_polls for insert to authenticated with check (created_by = (select auth.uid()) and exists (select 1 from public.chat_group_members m where m.group_id = group_polls.group_id and m.user_id = (select auth.uid())));
create policy "group_polls_creator_update" on public.group_polls for update to authenticated using (created_by = (select auth.uid()) or exists (select 1 from public.chat_group_members m where m.group_id = group_polls.group_id and m.user_id = (select auth.uid()) and m.role = 'admin')) with check (created_by = (select auth.uid()) or exists (select 1 from public.chat_group_members m where m.group_id = group_polls.group_id and m.user_id = (select auth.uid()) and m.role = 'admin'));
create policy "group_poll_options_members_read" on public.group_poll_options for select to authenticated using (exists (select 1 from public.group_polls p join public.chat_group_members m on m.group_id = p.group_id where p.id = group_poll_options.poll_id and m.user_id = (select auth.uid())));
create policy "group_poll_options_members_create" on public.group_poll_options for insert to authenticated with check (exists (select 1 from public.group_polls p join public.chat_group_members m on m.group_id = p.group_id where p.id = group_poll_options.poll_id and m.user_id = (select auth.uid()) and p.created_by = (select auth.uid())));
create policy "group_poll_options_creator_delete" on public.group_poll_options for delete to authenticated using (exists (select 1 from public.group_polls p where p.id = group_poll_options.poll_id and (p.created_by = (select auth.uid()) or exists (select 1 from public.chat_group_members m where m.group_id = p.group_id and m.user_id = (select auth.uid()) and m.role = 'admin'))));
create policy "group_poll_votes_members_read" on public.group_poll_votes for select to authenticated using (exists (select 1 from public.group_polls p join public.chat_group_members m on m.group_id = p.group_id where p.id = group_poll_votes.poll_id and m.user_id = (select auth.uid())));
create policy "group_poll_votes_self_insert" on public.group_poll_votes for insert to authenticated with check (user_id = (select auth.uid()) and exists (select 1 from public.group_polls p join public.chat_group_members m on m.group_id = p.group_id where p.id = group_poll_votes.poll_id and m.user_id = (select auth.uid()) and p.is_closed = false and exists (select 1 from public.group_poll_options o where o.id = group_poll_votes.option_id and o.poll_id = p.id)));
create policy "group_poll_votes_self_update" on public.group_poll_votes for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and exists (select 1 from public.group_polls p where p.id = group_poll_votes.poll_id and p.is_closed = false) and exists (select 1 from public.group_poll_options o where o.id = group_poll_votes.option_id and o.poll_id = group_poll_votes.poll_id));
create policy "group_poll_votes_self_delete" on public.group_poll_votes for delete to authenticated using (user_id = (select auth.uid()));

create table if not exists public.group_invites (
  id uuid primary key default gen_random_uuid(), group_id uuid not null references public.chat_groups(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade, token_hash text not null unique,
  expires_at timestamptz, max_uses integer check (max_uses is null or max_uses > 0),
  uses integer not null default 0 check (uses >= 0), revoked_at timestamptz, created_at timestamptz not null default now()
);
alter table public.group_invites enable row level security;
create policy "group_invites_admin_manage" on public.group_invites for all to authenticated using (exists (select 1 from public.chat_group_members m where m.group_id = group_invites.group_id and m.user_id = (select auth.uid()) and m.role = 'admin')) with check (created_by = (select auth.uid()) and exists (select 1 from public.chat_group_members m where m.group_id = group_invites.group_id and m.user_id = (select auth.uid()) and m.role = 'admin'));

create table if not exists public.live_locations (
  id uuid primary key default gen_random_uuid(), sharer_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision check (accuracy_m is null or accuracy_m >= 0),
  expires_at timestamptz not null, updated_at timestamptz not null default now(), created_at timestamptz not null default now(),
  constraint live_locations_not_self check (sharer_id <> recipient_id)
);
create index if not exists live_locations_participants_idx on public.live_locations(sharer_id, recipient_id, expires_at);
alter table public.live_locations enable row level security;
create policy "live_locations_participants_read" on public.live_locations for select to authenticated using ((select auth.uid()) in (sharer_id, recipient_id) and expires_at > now());
create policy "live_locations_friend_share_insert" on public.live_locations for insert to authenticated with check (sharer_id = (select auth.uid()) and expires_at > now() and expires_at <= now() + interval '24 hours' and exists (select 1 from public.friend_requests f where f.status = 'accepted' and ((f.sender_id = sharer_id and f.receiver_id = recipient_id) or (f.sender_id = recipient_id and f.receiver_id = sharer_id))));
create policy "live_locations_sharer_update" on public.live_locations for update to authenticated using (sharer_id = (select auth.uid()) and expires_at > now()) with check (sharer_id = (select auth.uid()) and expires_at > now() and expires_at <= now() + interval '24 hours');
create policy "live_locations_sharer_stop" on public.live_locations for delete to authenticated using (sharer_id = (select auth.uid()));

grant select, insert, update, delete on public.scheduled_messages to authenticated;
grant select, insert, delete on public.group_announcements to authenticated;
grant select, insert, update on public.group_polls to authenticated;
grant select, insert, delete on public.group_poll_options to authenticated;
grant select, insert, update, delete on public.group_poll_votes to authenticated;
grant select, insert, update, delete on public.group_invites to authenticated;
grant select, insert, update, delete on public.live_locations to authenticated;
