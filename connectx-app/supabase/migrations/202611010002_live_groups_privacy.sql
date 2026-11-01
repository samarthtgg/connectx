-- ConnectX: live presence, group conversations, message controls and blocking.
-- Apply once in the Supabase SQL Editor. This migration is additive.

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

alter table public.messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_for_everyone boolean not null default false;

create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocked_users_not_self check (blocker_id <> blocked_id)
);

create table if not exists public.chat_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  description text,
  avatar_url text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_group_members (
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin','member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.chat_group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 5000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_for_everyone boolean not null default false
);

create index if not exists chat_group_messages_group_created_idx
  on public.chat_group_messages(group_id, created_at);
create index if not exists chat_group_members_user_idx
  on public.chat_group_members(user_id);

create or replace function public.is_connectx_group_member(target_group uuid, target_user uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_group_members m
    where m.group_id = target_group and m.user_id = target_user
  );
$$;

create or replace function public.is_connectx_group_admin(target_group uuid, target_user uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_group_members m
    where m.group_id = target_group and m.user_id = target_user and m.role = 'admin'
  );
$$;

create or replace function public.connectx_user_blocked(user_a uuid, user_b uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocked_users b
    where (b.blocker_id = user_a and b.blocked_id = user_b)
       or (b.blocker_id = user_b and b.blocked_id = user_a)
  );
$$;

alter table public.blocked_users enable row level security;
alter table public.chat_groups enable row level security;
alter table public.chat_group_members enable row level security;
alter table public.chat_group_messages enable row level security;

drop policy if exists "ConnectX read own blocks" on public.blocked_users;
create policy "ConnectX read own blocks" on public.blocked_users
  for select to authenticated using (blocker_id = (select auth.uid()));
drop policy if exists "ConnectX create own blocks" on public.blocked_users;
create policy "ConnectX create own blocks" on public.blocked_users
  for insert to authenticated with check (blocker_id = (select auth.uid()));
drop policy if exists "ConnectX remove own blocks" on public.blocked_users;
create policy "ConnectX remove own blocks" on public.blocked_users
  for delete to authenticated using (blocker_id = (select auth.uid()));

drop policy if exists "ConnectX group members read groups" on public.chat_groups;
create policy "ConnectX group members read groups" on public.chat_groups
  for select to authenticated using (public.is_connectx_group_member(id));
drop policy if exists "ConnectX users create groups" on public.chat_groups;
create policy "ConnectX users create groups" on public.chat_groups
  for insert to authenticated with check (created_by = (select auth.uid()));
drop policy if exists "ConnectX group admins update groups" on public.chat_groups;
create policy "ConnectX group admins update groups" on public.chat_groups
  for update to authenticated using (public.is_connectx_group_admin(id))
  with check (public.is_connectx_group_admin(id));

drop policy if exists "ConnectX members read membership" on public.chat_group_members;
create policy "ConnectX members read membership" on public.chat_group_members
  for select to authenticated using (public.is_connectx_group_member(group_id));
drop policy if exists "ConnectX group creator adds self" on public.chat_group_members;
create policy "ConnectX group creator adds self" on public.chat_group_members
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and role = 'admin'
    and exists (select 1 from public.chat_groups g where g.id = group_id and g.created_by = (select auth.uid()))
  );
drop policy if exists "ConnectX admins manage members" on public.chat_group_members;
create policy "ConnectX admins manage members" on public.chat_group_members
  for all to authenticated using (public.is_connectx_group_admin(group_id))
  with check (public.is_connectx_group_admin(group_id));
drop policy if exists "ConnectX members leave groups" on public.chat_group_members;
create policy "ConnectX members leave groups" on public.chat_group_members
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "ConnectX members read group messages" on public.chat_group_messages;
create policy "ConnectX members read group messages" on public.chat_group_messages
  for select to authenticated using (public.is_connectx_group_member(group_id));
drop policy if exists "ConnectX members send group messages" on public.chat_group_messages;
create policy "ConnectX members send group messages" on public.chat_group_messages
  for insert to authenticated with check (
    sender_id = (select auth.uid())
    and public.is_connectx_group_member(group_id)
  );
drop policy if exists "ConnectX authors edit group messages" on public.chat_group_messages;
create policy "ConnectX authors edit group messages" on public.chat_group_messages
  for update to authenticated using (sender_id = (select auth.uid()))
  with check (sender_id = (select auth.uid()) and public.is_connectx_group_member(group_id));

-- Ensure new direct messages cannot be sent across a block in either direction.
drop policy if exists "Users can send messages" on public.messages;
create policy "Users can send messages" on public.messages
  for insert to authenticated with check (
    sender_id = (select auth.uid())
    and receiver_id <> (select auth.uid())
    and char_length(content) between 1 and 5000
    and not public.connectx_user_blocked(sender_id, receiver_id)
    and exists (
      select 1 from public.friend_requests fr
      where fr.status = 'accepted'
        and (
          (fr.sender_id = (select auth.uid()) and fr.receiver_id = public.messages.receiver_id)
          or
          (fr.sender_id = public.messages.receiver_id and fr.receiver_id = (select auth.uid()))
        )
    )
  );

alter publication supabase_realtime add table public.chat_group_messages;
