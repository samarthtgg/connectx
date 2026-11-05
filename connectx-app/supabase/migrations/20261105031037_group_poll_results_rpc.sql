create or replace function public.connectx_group_poll_results(
  p_group_id uuid,
  p_poll_ids uuid[]
)
returns table (
  poll_id uuid,
  option_id uuid,
  vote_count bigint,
  voted_by_me boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  if p_group_id is null
     or p_poll_ids is null
     or cardinality(p_poll_ids) = 0
     or cardinality(p_poll_ids) > 30 then
    raise exception 'Invalid poll results request.';
  end if;

  if not exists (
    select 1
    from public.chat_group_members m
    where m.group_id = p_group_id
      and m.user_id = v_user_id
  ) then
    raise exception 'You are not a member of this group.';
  end if;

  return query
  select
    p.id,
    o.id,
    count(v.id)::bigint,
    coalesce(bool_or(v.user_id = v_user_id), false)
  from public.group_polls p
  join public.group_poll_options o
    on o.poll_id = p.id
  left join public.group_poll_votes v
    on v.poll_id = p.id
   and v.option_id = o.id
  where p.group_id = p_group_id
    and p.id = any(p_poll_ids)
  group by p.id, o.id;
end;
$function$;

revoke all on function public.connectx_group_poll_results(uuid, uuid[]) from public;
revoke all on function public.connectx_group_poll_results(uuid, uuid[]) from anon;
grant execute on function public.connectx_group_poll_results(uuid, uuid[]) to authenticated;
