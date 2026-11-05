begin;

-- Group-message edits only need the two fields used by the client editor.
-- Keep the existing RLS author check; remove broad row/column UPDATE rights.
revoke update on table public.chat_group_messages from anon, authenticated;
revoke update (
  id,
  group_id,
  sender_id,
  content,
  created_at,
  edited_at,
  deleted_for_everyone,
  message_type,
  media_path,
  media_expires_at,
  media_expired,
  reply_to_id,
  reply_to_content,
  reply_to_sender_id
) on table public.chat_group_messages from anon, authenticated;
grant update (content, edited_at) on table public.chat_group_messages to authenticated;

-- RLS identifies which direct-message rows a user may update, but does not
-- distinguish sender-edit fields from recipient read-receipt fields.
create or replace function public.connectx_guard_direct_message_update_scope()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return new;
  end if;

  if old.sender_id = v_user_id and old.receiver_id <> v_user_id then
    if new.read_at is distinct from old.read_at then
      raise exception 'Senders cannot change direct-message read receipts.';
    end if;
  elsif old.receiver_id = v_user_id and old.sender_id <> v_user_id then
    if new.content is distinct from old.content
       or new.edited_at is distinct from old.edited_at then
      raise exception 'Recipients may only update direct-message read receipts.';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists connectx_guard_direct_message_update_scope on public.messages;
create trigger connectx_guard_direct_message_update_scope
before update on public.messages
for each row
execute function public.connectx_guard_direct_message_update_scope();

commit;