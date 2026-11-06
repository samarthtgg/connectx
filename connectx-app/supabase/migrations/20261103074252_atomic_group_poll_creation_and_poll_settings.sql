alter table public.group_polls
  add column if not exists allow_multiple_answers boolean not null default false,
  add column if not exists hide_voter_names boolean not null default false;

alter table public.group_poll_votes
  drop constraint if exists group_poll_votes_poll_id_user_id_key;
create unique index if not exists group_poll_votes_poll_option_user_key
  on public.group_poll_votes (poll_id, option_id, user_id);

create or replace function public.create_group_poll(
  p_group_id uuid,
  p_question text,
  p_options text[],
  p_allow_multiple_answers boolean default false,
  p_hide_voter_names boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_poll_id uuid;
  v_options text[];
begin
  if v_user_id is null then
    raise exception 'You must be signed in to create a poll.';
  end if;
  if p_group_id is null then
    raise exception 'Choose a group before creating a poll.';
  end if;
  if not exists (
    select 1 from public.chat_group_members m
    where m.group_id = p_group_id and m.user_id = v_user_id
  ) then
    raise exception 'You are not a member of this group.';
  end if;
  if char_length(btrim(coalesce(p_question, ''))) not between 1 and 255 then
    raise exception 'Enter a poll question (maximum 255 characters).';
  end if;

  select coalesce(array_agg(btrim(x)), array[]::text[])
  into v_options
  from unnest(coalesce(p_options, array[]::text[])) as x
  where char_length(btrim(x)) > 0;

  if coalesce(array_length(v_options, 1), 0) not between 2 and 10 then
    raise exception 'A poll needs between 2 and 10 non-empty options.';
  end if;
  if exists (
    select 1 from unnest(v_options) as option_label
    group by lower(option_label) having count(*) > 1
  ) then
    raise exception 'Poll options must be unique.';
  end if;

  insert into public.group_polls
    (group_id, created_by, question, allow_multiple_answers, hide_voter_names)
  values
    (p_group_id, v_user_id, btrim(p_question), coalesce(p_allow_multiple_answers, false), coalesce(p_hide_voter_names, false))
  returning id into v_poll_id;

  insert into public.group_poll_options (poll_id, label)
  select v_poll_id, option_label
  from unnest(v_options) as option_label;

  return v_poll_id;
end;
$$;

revoke all on function public.create_group_poll(uuid, text, text[], boolean, boolean) from public;
revoke all on function public.create_group_poll(uuid, text, text[], boolean, boolean) from anon;
grant execute on function public.create_group_poll(uuid, text, text[], boolean, boolean) to authenticated;
