-- ConnectX migration for the EXISTING direct-message schema.
-- Preserves public.profiles (username, full_name, avatar_url),
-- public.friend_requests, and public.messages (sender_id, receiver_id, content).
-- Does not drop tables or delete user content.

create extension if not exists pgcrypto;

-- Ensure existing profiles get created for Auth users, and future signups do too.
create or replace function public.connectx_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, 'user'), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$fn$;

drop trigger if exists connectx_on_auth_user_created on auth.users;
create trigger connectx_on_auth_user_created
after insert on auth.users
for each row execute procedure public.connectx_handle_new_user();

insert into public.profiles (id, full_name)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(u.email, 'user'), '@', 1)
  )
from auth.users u
on conflict (id) do nothing;

-- Keep the existing direct-message design and add useful lookup indexes.
create index if not exists connectx_messages_sender_created_idx
  on public.messages (sender_id, created_at desc);
create index if not exists connectx_messages_receiver_created_idx
  on public.messages (receiver_id, created_at desc);
create index if not exists connectx_friend_requests_receiver_status_idx
  on public.friend_requests (receiver_id, status, created_at desc);
create index if not exists connectx_friend_requests_sender_status_idx
  on public.friend_requests (sender_id, status, created_at desc);

-- Normalize and constrain request states. The table was confirmed empty
-- during preparation; this also safely normalizes any future legacy NULLs.
update public.friend_requests set status = 'pending' where status is null;
alter table public.friend_requests alter column status set default 'pending';
alter table public.friend_requests alter column status set not null;

do $fn$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.friend_requests'::regclass
      and conname = 'connectx_friend_requests_status_check'
  ) then
    alter table public.friend_requests
      add constraint connectx_friend_requests_status_check
      check (status in ('pending', 'accepted', 'declined'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.friend_requests'::regclass
      and conname = 'connectx_friend_requests_not_self'
  ) then
    alter table public.friend_requests
      add constraint connectx_friend_requests_not_self
      check (sender_id <> receiver_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.messages'::regclass
      and conname = 'connectx_messages_content_length'
  ) then
    alter table public.messages
      add constraint connectx_messages_content_length
      check (char_length(content) between 1 and 5000);
  end if;
end;
$fn$;

alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.messages enable row level security;

-- Replace only the policies identified in the current database audit.
drop policy if exists "Authenticated users can view profiles" on public.profiles;
drop policy if exists "Users can create their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Authenticated users can view profiles"
on public.profiles for select to authenticated
using (true);
create policy "Users can update their own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "Receivers can update requests" on public.friend_requests;
drop policy if exists "Users can send requests" on public.friend_requests;
drop policy if exists "Users can view their requests" on public.friend_requests;
create policy "Users can view their requests"
on public.friend_requests for select to authenticated
using (
  (select auth.uid()) = sender_id
  or (select auth.uid()) = receiver_id
);
create policy "Users can send requests"
on public.friend_requests for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and receiver_id <> (select auth.uid())
  and status = 'pending'
  and exists (
    select 1 from public.profiles p where p.id = receiver_id
  )
);
create policy "Receivers can update requests"
on public.friend_requests for update to authenticated
using (
  receiver_id = (select auth.uid())
  and status = 'pending'
)
with check (
  receiver_id = (select auth.uid())
  and status in ('accepted', 'declined')
);

drop policy if exists "Senders can delete their own messages" on public.messages;
drop policy if exists "Users can read their own conversations" on public.messages;
drop policy if exists "Users can send messages" on public.messages;
create policy "Users can read their own conversations"
on public.messages for select to authenticated
using (
  sender_id = (select auth.uid())
  or receiver_id = (select auth.uid())
);
create policy "Users can send messages"
on public.messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and receiver_id <> (select auth.uid())
  and exists (
    select 1 from public.profiles p where p.id = receiver_id
  )
  and char_length(content) between 1 and 5000
);
create policy "Senders can delete their own messages"
on public.messages for delete to authenticated
using (sender_id = (select auth.uid()));

-- Remove broad table grants, then grant only the operations used by this schema.
revoke all on public.profiles, public.friend_requests, public.messages
from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (username, full_name, avatar_url) on public.profiles to authenticated;

grant select, insert on public.friend_requests to authenticated;
grant update (status) on public.friend_requests to authenticated;

grant select, insert, delete on public.messages to authenticated;

-- Enable realtime updates for the existing direct-message table.
do $fn$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$fn$;
