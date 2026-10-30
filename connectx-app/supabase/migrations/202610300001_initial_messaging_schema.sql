-- ConnectX messaging foundation. Apply once in Supabase SQL Editor.
-- All user content is protected by RLS. Never put the service-role key in the browser.

create extension if not exists pgcrypto;

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
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
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
  updated_at timestamptz not null default now()
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
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create index if not exists friend_requests_receiver_status_idx on public.friend_requests(receiver_id, status, created_at desc);
create index if not exists friend_requests_sender_status_idx on public.friend_requests(sender_id, status, created_at desc);
create index if not exists conversation_members_user_idx on public.conversation_members(user_id, joined_at desc);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(new.email, 'user'), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();
drop trigger if exists friend_requests_set_updated_at on public.friend_requests;
create trigger friend_requests_set_updated_at before update on public.friend_requests
for each row execute procedure public.set_updated_at();
drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at before update on public.conversations
for each row execute procedure public.set_updated_at();

create or replace function public.is_conversation_member(target_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = target_conversation
      and cm.user_id = (select auth.uid())
  );
$fn$;

revoke all on function public.is_conversation_member(uuid) from public, anon;
grant execute on function public.is_conversation_member(uuid) to authenticated;

-- A direct chat can be opened only after both users have an accepted friendship.
create or replace function public.create_direct_conversation(target_user uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  current_user_id uuid := auth.uid();
  new_conversation_id uuid;
begin
  if current_user_id is null then
    raise exception 'You must be signed in.';
  end if;
  if target_user is null or target_user = current_user_id then
    raise exception 'Choose another user.';
  end if;
  if not exists (
    select 1 from public.friend_requests fr
    where fr.status = 'accepted'
      and ((fr.sender_id = current_user_id and fr.receiver_id = target_user)
        or (fr.sender_id = target_user and fr.receiver_id = current_user_id))
  ) then
    raise exception 'You can message users after they accept your friend request.';
  end if;

  select c.id into new_conversation_id
  from public.conversations c
  where c.is_group = false
    and exists (select 1 from public.conversation_members a where a.conversation_id = c.id and a.user_id = current_user_id)
    and exists (select 1 from public.conversation_members b where b.conversation_id = c.id and b.user_id = target_user)
    and (select count(*) from public.conversation_members n where n.conversation_id = c.id) = 2
  limit 1;

  if new_conversation_id is null then
    insert into public.conversations (created_by) values (current_user_id)
    returning id into new_conversation_id;
    insert into public.conversation_members (conversation_id, user_id)
    values (new_conversation_id, current_user_id), (new_conversation_id, target_user);
  end if;

  return new_conversation_id;
end;
$fn$;

revoke all on function public.create_direct_conversation(uuid) from public, anon;
grant execute on function public.create_direct_conversation(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Authenticated users can read profiles" on public.profiles;
create policy "Authenticated users can read profiles" on public.profiles
for select to authenticated using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles
for update to authenticated using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "Participants can read friend requests" on public.friend_requests;
create policy "Participants can read friend requests" on public.friend_requests
for select to authenticated using (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()));

drop policy if exists "Users can send friend requests" on public.friend_requests;
create policy "Users can send friend requests" on public.friend_requests
for insert to authenticated with check (sender_id = (select auth.uid()) and receiver_id <> (select auth.uid()) and status = 'pending');

drop policy if exists "Recipients can respond to friend requests" on public.friend_requests;
create policy "Recipients can respond to friend requests" on public.friend_requests
for update to authenticated using (receiver_id = (select auth.uid()) and status = 'pending')
with check (receiver_id = (select auth.uid()) and status in ('accepted', 'declined'));

drop policy if exists "Members can read conversations" on public.conversations;
create policy "Members can read conversations" on public.conversations
for select to authenticated using (public.is_conversation_member(id));

drop policy if exists "Members can read conversation members" on public.conversation_members;
create policy "Members can read conversation members" on public.conversation_members
for select to authenticated using (public.is_conversation_member(conversation_id));

drop policy if exists "Members can update their read receipt" on public.conversation_members;
create policy "Members can update their read receipt" on public.conversation_members
for update to authenticated using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Members can read messages" on public.messages;
create policy "Members can read messages" on public.messages
for select to authenticated using (public.is_conversation_member(conversation_id));

drop policy if exists "Members can send messages as themselves" on public.messages;
create policy "Members can send messages as themselves" on public.messages
for insert to authenticated with check (
  sender_id = (select auth.uid()) and public.is_conversation_member(conversation_id)
);

drop policy if exists "Senders can edit their own messages" on public.messages;
create policy "Senders can edit their own messages" on public.messages
for update to authenticated using (
  sender_id = (select auth.uid()) and deleted_at is null and public.is_conversation_member(conversation_id)
) with check (
  sender_id = (select auth.uid()) and public.is_conversation_member(conversation_id)
);

-- Column-level grants prevent changing ownership and server-managed fields.
revoke all on public.profiles, public.friend_requests, public.conversations,
  public.conversation_members, public.messages from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, display_name, avatar_url, bio) on public.profiles to authenticated;
grant select, insert on public.friend_requests to authenticated;
grant update (status) on public.friend_requests to authenticated;
grant select on public.conversations to authenticated;
grant select on public.conversation_members to authenticated;
grant update (last_read_at) on public.conversation_members to authenticated;
grant select, insert on public.messages to authenticated;
grant update (body, edited_at, deleted_at) on public.messages to authenticated;

do $fn$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$fn$;
