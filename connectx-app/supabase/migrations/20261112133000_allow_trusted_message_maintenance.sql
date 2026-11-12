create or replace function public.connectx_guard_direct_message_update()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_changed_keys text[];
  v_user_id uuid := auth.uid();
begin
  -- Trusted server-side jobs use the service role and have no end-user JWT.
  if v_user_id is null then
    return new;
  end if;

  select coalesce(array_agg(old_row.key), array[]::text[])
    into v_changed_keys
  from jsonb_each(to_jsonb(old)) as old_row
  join jsonb_each(to_jsonb(new)) as new_row using (key)
  where old_row.value is distinct from new_row.value;

  if cardinality(v_changed_keys) = 0 then
    return new;
  end if;

  if v_changed_keys <@ array['read_at']::text[]
     and old.receiver_id = v_user_id then
    return new;
  end if;

  if v_changed_keys <@ array['content', 'edited_at']::text[]
     and old.sender_id = v_user_id then
    return new;
  end if;

  raise exception 'You are not allowed to change these message fields.';
end;
$function$;
