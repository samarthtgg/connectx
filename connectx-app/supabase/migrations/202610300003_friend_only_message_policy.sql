-- Restrict direct messages to accepted friends.
-- Apply after 202610300002_existing_schema_messaging.sql.

drop policy if exists "Users can send messages" on public.messages;

create policy "Users can send messages"
on public.messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and receiver_id <> (select auth.uid())
  and char_length(content) between 1 and 5000
  and exists (
    select 1
    from public.friend_requests fr
    where fr.status = 'accepted'
      and (
        (fr.sender_id = (select auth.uid()) and fr.receiver_id = receiver_id)
        or
        (fr.sender_id = receiver_id and fr.receiver_id = (select auth.uid()))
      )
  )
);
