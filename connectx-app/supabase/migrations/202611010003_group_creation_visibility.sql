-- Allow a group creator to read the group they just created.
-- This is required because the app reads the inserted group before adding
-- the creator to chat_group_members. Existing members retain access.
drop policy if exists "ConnectX group members read groups" on public.chat_groups;
create policy "ConnectX group members read groups" on public.chat_groups
  for select to authenticated
  using (
    created_by = (select auth.uid())
    or public.is_connectx_group_member(id)
  );
