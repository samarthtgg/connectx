-- Keep raw poll vote rows private while preserving aggregate results.
drop policy if exists "group_poll_votes_members_read" on public.group_poll_votes;
drop policy if exists "group_poll_votes_self_read" on public.group_poll_votes;
create policy "group_poll_votes_self_read"
on public.group_poll_votes
for select to authenticated
using (user_id = (select auth.uid()));

-- A single-answer poll must not accept multiple rows for the same voter.
drop policy if exists "group_poll_votes_self_insert" on public.group_poll_votes;
create policy "group_poll_votes_self_insert"
on public.group_poll_votes
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.group_polls p
    join public.chat_group_members m on m.group_id = p.group_id
    where p.id = group_poll_votes.poll_id
      and m.user_id = (select auth.uid())
      and p.is_closed = false
      and (
        p.allow_multiple_answers
        or not exists (
          select 1
          from public.group_poll_votes existing
          where existing.poll_id = p.id
            and existing.user_id = (select auth.uid())
        )
      )
      and exists (
        select 1
        from public.group_poll_options o
        where o.id = group_poll_votes.option_id
          and o.poll_id = p.id
      )
  )
);

-- Voting changes are allowed only while the voter remains a group member
-- and the poll is still open.
drop policy if exists "group_poll_votes_self_update" on public.group_poll_votes;
create policy "group_poll_votes_self_update"
on public.group_poll_votes
for update to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.group_polls p
    join public.chat_group_members m on m.group_id = p.group_id
    where p.id = group_poll_votes.poll_id
      and m.user_id = (select auth.uid())
      and p.is_closed = false
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.group_polls p
    join public.chat_group_members m on m.group_id = p.group_id
    where p.id = group_poll_votes.poll_id
      and m.user_id = (select auth.uid())
      and p.is_closed = false
  )
  and exists (
    select 1
    from public.group_poll_options o
    where o.id = group_poll_votes.option_id
      and o.poll_id = group_poll_votes.poll_id
  )
);

drop policy if exists "group_poll_votes_self_delete" on public.group_poll_votes;
create policy "group_poll_votes_self_delete"
on public.group_poll_votes
for delete to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.group_polls p
    join public.chat_group_members m on m.group_id = p.group_id
    where p.id = group_poll_votes.poll_id
      and m.user_id = (select auth.uid())
      and p.is_closed = false
  )
);

-- A former member must not retain creator-only poll management rights.
drop policy if exists "group_polls_creator_update" on public.group_polls;
create policy "group_polls_creator_update"
on public.group_polls
for update to authenticated
using (
  exists (
    select 1 from public.chat_group_members m
    where m.group_id = group_polls.group_id
      and m.user_id = (select auth.uid())
  )
  and (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.chat_group_members m
      where m.group_id = group_polls.group_id
        and m.user_id = (select auth.uid())
        and m.role = 'admin'
    )
  )
)
with check (
  exists (
    select 1 from public.chat_group_members m
    where m.group_id = group_polls.group_id
      and m.user_id = (select auth.uid())
  )
  and (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.chat_group_members m
      where m.group_id = group_polls.group_id
        and m.user_id = (select auth.uid())
        and m.role = 'admin'
    )
  )
);

drop policy if exists "group_polls_creator_delete" on public.group_polls;
create policy "group_polls_creator_delete"
on public.group_polls
for delete to authenticated
using (
  exists (
    select 1 from public.chat_group_members m
    where m.group_id = group_polls.group_id
      and m.user_id = (select auth.uid())
  )
  and (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.chat_group_members m
      where m.group_id = group_polls.group_id
        and m.user_id = (select auth.uid())
        and m.role = 'admin'
    )
  )
);

drop policy if exists "group_poll_options_creator_delete" on public.group_poll_options;
create policy "group_poll_options_creator_delete"
on public.group_poll_options
for delete to authenticated
using (
  exists (
    select 1
    from public.group_polls p
    join public.chat_group_members m on m.group_id = p.group_id
    where p.id = group_poll_options.poll_id
      and m.user_id = (select auth.uid())
      and (p.created_by = (select auth.uid()) or m.role = 'admin')
  )
);

-- Keep the RPC authorization aligned with the table policies.
create or replace function public.connectx_delete_group_poll(p_poll_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_group uuid;
  v_creator uuid;
begin
  if v_user is null then
    raise exception 'You must be signed in.';
  end if;

  select group_id, created_by
    into v_group, v_creator
  from public.group_polls
  where id = p_poll_id;

  if v_group is null then
    return false;
  end if;

  if not exists (
    select 1 from public.chat_group_members
    where group_id = v_group and user_id = v_user
  ) then
    raise exception 'You are not a member of this group.';
  end if;

  if v_creator <> v_user and not exists (
    select 1 from public.chat_group_members
    where group_id = v_group and user_id = v_user and role = 'admin'
  ) then
    raise exception 'Only the poll creator or a group admin can delete this poll.';
  end if;

  delete from public.group_polls where id = p_poll_id;
  return found;
end;
$function$;

revoke all on function public.connectx_delete_group_poll(uuid) from public;
revoke all on function public.connectx_delete_group_poll(uuid) from anon;
grant execute on function public.connectx_delete_group_poll(uuid) to authenticated;
