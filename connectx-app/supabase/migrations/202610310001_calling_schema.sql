-- ConnectX 1-to-1 audio/video call signaling.
-- WebRTC media is peer-to-peer; this schema stores call offers, answers and ICE candidates.

create table if not exists public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'ringing'
    check (status in ('ringing', 'accepted', 'rejected', 'ended', 'missed')),
  offer jsonb not null,
  answer jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint call_sessions_not_self check (caller_id <> receiver_id)
);

create index if not exists call_sessions_receiver_status_idx
  on public.call_sessions (receiver_id, status, created_at desc);
create index if not exists call_sessions_caller_created_idx
  on public.call_sessions (caller_id, created_at desc);

create table if not exists public.call_ice_candidates (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.call_sessions(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  candidate jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists call_ice_candidates_call_created_idx
  on public.call_ice_candidates (call_id, created_at);

alter table public.call_sessions enable row level security;
alter table public.call_ice_candidates enable row level security;

drop policy if exists "Call participants can view sessions" on public.call_sessions;
create policy "Call participants can view sessions"
on public.call_sessions for select to authenticated
using (caller_id = (select auth.uid()) or receiver_id = (select auth.uid()));

drop policy if exists "Users can start calls to friends" on public.call_sessions;
create policy "Users can start calls to friends"
on public.call_sessions for insert to authenticated
with check (
  caller_id = (select auth.uid())
  and receiver_id <> (select auth.uid())
  and status = 'ringing'
  and exists (
    select 1 from public.friend_requests fr
    where fr.status = 'accepted'
      and (
        (fr.sender_id = (select auth.uid()) and fr.receiver_id = call_sessions.receiver_id)
        or
        (fr.receiver_id = (select auth.uid()) and fr.sender_id = call_sessions.receiver_id)
      )
  )
);

drop policy if exists "Call participants can update sessions" on public.call_sessions;
create policy "Call participants can update sessions"
on public.call_sessions for update to authenticated
using (caller_id = (select auth.uid()) or receiver_id = (select auth.uid()))
with check (caller_id = (select auth.uid()) or receiver_id = (select auth.uid()));

drop policy if exists "Call participants can view ICE candidates" on public.call_ice_candidates;
create policy "Call participants can view ICE candidates"
on public.call_ice_candidates for select to authenticated
using (
  exists (
    select 1 from public.call_sessions cs
    where cs.id = call_ice_candidates.call_id
      and (cs.caller_id = (select auth.uid()) or cs.receiver_id = (select auth.uid()))
  )
);

drop policy if exists "Call participants can add ICE candidates" on public.call_ice_candidates;
create policy "Call participants can add ICE candidates"
on public.call_ice_candidates for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.call_sessions cs
    where cs.id = call_ice_candidates.call_id
      and (cs.caller_id = (select auth.uid()) or cs.receiver_id = (select auth.uid()))
  )
);

grant select, insert, update on public.call_sessions to authenticated;
grant select, insert on public.call_ice_candidates to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.call_sessions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.call_ice_candidates;
exception when duplicate_object then null;
end $$;
