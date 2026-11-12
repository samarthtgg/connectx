begin;

create or replace function public.connectx_guard_direct_message_update()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_changed_keys text[];
begin
  select coalesce(array_agg(old_row.key), array[]::text[])
    into v_changed_keys
  from jsonb_each(to_jsonb(old)) as old_row
  join jsonb_each(to_jsonb(new)) as new_row using (key)
  where old_row.value is distinct from new_row.value;

  if cardinality(v_changed_keys) = 0 then
    return new;
  end if;

  if v_changed_keys <@ array['read_at']::text[]
     and old.receiver_id = (select auth.uid()) then
    return new;
  end if;

  if v_changed_keys <@ array['content', 'edited_at']::text[]
     and old.sender_id = (select auth.uid()) then
    return new;
  end if;

  raise exception 'You are not allowed to change these message fields.';
end;
$function$;

drop trigger if exists connectx_guard_direct_message_update on public.messages;
create trigger connectx_guard_direct_message_update
before update on public.messages
for each row execute function public.connectx_guard_direct_message_update();

drop policy if exists "ConnectX authors edit direct messages" on public.messages;
drop policy if exists "Recipients can mark messages as read" on public.messages;

create policy "ConnectX participants update permitted message rows"
on public.messages
for update
to authenticated
using (
  sender_id = (select auth.uid())
  or receiver_id = (select auth.uid())
)
with check (
  sender_id = (select auth.uid())
  or receiver_id = (select auth.uid())
);

alter function public.connectx_delete_group_messages(uuid, uuid[]) set search_path = '';

commit;
