-- ConnectX chat interactions: read receipts, reactions, and per-user chat clearing.
-- Clearing/hiding a chat affects only the current user's view; it never deletes the other user's history.

alter table public.messages
  add column if not exists read_at timestamptz;

create index if not exists connectx_messages_unread_idx
  on public.messages (receiver_id, read_at, created_at desc);

drop policy if exists "Recipients can mark messages as read" on public.messages;
create policy "Recipients can mark messages as read"
on public.messages for update to authenticated
using (receiver_id = (select auth.uid()))
with check (receiver_id = (select auth.uid()));

grant update (read_at) on public.messages to authenticated;

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('👍','❤️','😂','😮','😢','🔥')),
  created_at timestamptz not null default now(),
  constraint message_reactions_one_per_user unique (message_id, user_id)
);

create index if not exists connectx_message_reactions_message_idx
  on public.message_reactions (message_id, created_at);

alter table public.message_reactions enable row level security;

drop policy if exists "Chat participants can view reactions" on public.message_reactions;
create policy "Chat participants can view reactions"
on public.message_reactions for select to authenticated
using (
  exists (
    select 1 from public.messages m
    where m.id = message_reactions.message_id
      and (m.sender_id = (select auth.uid()) or m.receiver_id = (select auth.uid()))
  )
);

drop policy if exists "Users can react to messages they can read" on public.message_reactions;
create policy "Users can react to messages they can read"
on public.message_reactions for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.messages m
    where m.id = message_reactions.message_id
      and (m.sender_id = (select auth.uid()) or m.receiver_id = (select auth.uid()))
  )
);

drop policy if exists "Users can remove their own reactions" on public.message_reactions;
create policy "Users can remove their own reactions"
on public.message_reactions for delete to authenticated
using (user_id = (select auth.uid()));

grant select, insert, delete on public.message_reactions to authenticated;

create table if not exists public.chat_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  cleared_at timestamptz,
  hidden_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint chat_preferences_one_per_pair unique (user_id, friend_id),
  constraint chat_preferences_not_self check (user_id <> friend_id)
);

alter table public.chat_preferences enable row level security;

drop policy if exists "Users can view their chat preferences" on public.chat_preferences;
create policy "Users can view their chat preferences"
on public.chat_preferences for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can create their chat preferences" on public.chat_preferences;
create policy "Users can create their chat preferences"
on public.chat_preferences for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Users can update their chat preferences" on public.chat_preferences;
create policy "Users can update their chat preferences"
on public.chat_preferences for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their chat preferences" on public.chat_preferences;
create policy "Users can delete their chat preferences"
on public.chat_preferences for delete to authenticated
using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.chat_preferences to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.message_reactions;
exception when duplicate_object then null;
end $$;
