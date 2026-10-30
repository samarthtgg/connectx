-- ConnectX initial messaging schema
-- Apply in Supabase SQL Editor after confirming the project is reachable.
-- RLS is enabled on every user-data table. Never expose the service-role key in the client.

create extension if not exists pgcrypto;

-- Public profile data; auth.users remains the source of authentication identity.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text not null default '',
  avatar_url text,
  bio text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_length check (username is null or char_length(username) between 3 and 24),
  constraint profiles_display_name_length check (char_length(display_name) <= 60),
  constraint profiles_bio_length check (char_length(bio) <= 160)
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friend_requests_not_self check (sender_id <> receiver_id),
  constraint friend_requests_pair_unique unique (sender_id, receiver_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  title text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_title_length check (title is null or char_length(title) <= 80)
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint messages_body_length check (char_length(body) between 1 and 5000)
);

create index if not exists friend_requests_receiver_status_idx
  on public.friend_requests (receiver_id, status, created_at desc);
create index if not exists friend_requests_sender_status_idx
  on public.friend_requests (sender_id, status, created_at desc);
create index if not exists conversation_members_user_idx
  on public.conversation_members (user_id, joined_at desc);
create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);

-- Create a profile automatically when a new Auth user is registered.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(new.email, 'user'), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Keep updated_at fresh for rows changed by a user.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists friend_requests_set_updated_at on public.friend_requests;
create trigger friend_requests_set_updated_at before update on public.friend_requests
for each row execute procedure public.set_updated_at();

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at before update on public.conversations
for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

-- Profiles: signed-in users can discover basic profiles; only owners can edit theirs.
drop policy if exists "Authenticated users can read profiles" on public.profiles;
create policy "Authenticated users can read profiles"
on public.profiles for select to authenticated using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Friend requests are visible only to sender and receiver. A user can create
-- requests as themselves and only the recipient can accept/decline them.
drop policy if exists "Participants can read friend requests" on public.friend_requests;
create policy "Participants can read friend requests"
on public.friend_requests for select to authenticated
using (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()));

drop policy if exists "Users can send friend requests" on public.friend_requests;
create policy "Users can send friend requests"
on public.friend_requests for insert to authenticated
with check (sender_id = (select auth.uid()) and receiver_id <> (select auth.uid()) and status = 'pending');

drop policy if exists "Recipients can respond to friend requests" on public.friend_requests;
create policy "Recipients can respond to friend requests"
on public.friend_requests for update to authenticated
using (receiver_id = (select auth.uid()) and status = 'pending')
with check (receiver_id = (select auth.uid()) and status in ('accepted', 'declined'));

drop policy if exists "Senders can cancel pending requests" on public.friend_requests;
create policy "Senders can cancel pending requests"
on public.friend_requests for delete to authenticated
using (sender_id = (select auth.uid()) and status = 'pending');

-- Conversations and their membership are readable only by members.
drop policy if exists "Members can read conversations" on public.conversations;
create policy "Members can read conversations"
on public.conversations for select to authenticated
using (exists (
  select 1 from public.conversation_members cm
  where cm.conversation_id = id and cm.user_id = (select auth.uid())
));

drop policy if exists "Creator can create conversations" on public.conversations;
create policy "Creator can create conversations"
on public.conversations for insert to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists "Members can read conversation members" on public.conversation_members;
create policy "Members can read conversation members"
on public.conversation_members for select to authenticated
using (exists (
  select 1 from public.conversation_members mine
  where mine.conversation_id = conversation_id and mine.user_id = (select auth.uid())
));

drop policy if exists "Creator can add initial members" on public.conversation_members;
create policy "Creator can add initial members"
on public.conversation_members for insert to authenticated
with check (exists (
  select 1 from public.conversations c
  where c.id = conversation_id and c.created_by = (select auth.uid())
));

drop policy if exists "Members can update their read receipt" on public.conversation_members;
create policy "Members can update their read receipt"
on public.conversation_members for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- Only conversation members can read messages; a sender can insert only as self.
drop policy if exists "Members can read messages" on public.messages;
create policy "Members can read messages"
on public.messages for select to authenticated
using (exists (
  select 1 from public.conversation_members cm
  where cm.conversation_id = conversation_id and cm.user_id = (select auth.uid())
));

drop policy if exists "Members can send messages as themselves" on public.messages;
create policy "Members can send messages as themselves"
on public.messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conversation_id and cm.user_id = (select auth.uid())
  )
);

drop policy if exists "Senders can edit their own messages" on public.messages;
create policy "Senders can edit their own messages"
on public.messages for update to authenticated
using (sender_id = (select auth.uid()) and deleted_at is null)
with check (sender_id = (select auth.uid()));

-- Do not add public/anon policies. Grant authenticated users only the operations
-- intended by the RLS policies above.
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.friend_requests to authenticated;
grant select, insert on public.conversations to authenticated;
grant select, insert, update on public.conversation_members to authenticated;
grant select, insert, update on public.messages to authenticated;

-- Supabase Realtime: add messages to the publication if not already present.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
