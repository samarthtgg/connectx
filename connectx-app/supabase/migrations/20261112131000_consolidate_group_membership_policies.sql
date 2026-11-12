begin;

drop policy if exists "ConnectX admins manage members" on public.chat_group_members;
drop policy if exists "ConnectX members leave groups" on public.chat_group_members;
drop policy if exists "ConnectX group creator adds self" on public.chat_group_members;
drop policy if exists "ConnectX members read membership" on public.chat_group_members;

create policy "ConnectX members read membership"
on public.chat_group_members for select to authenticated
using (public.is_connectx_group_member(group_id));

create policy "ConnectX admins update members"
on public.chat_group_members for update to authenticated
using (public.is_connectx_group_admin(group_id))
with check (public.is_connectx_group_admin(group_id));

create policy "ConnectX admins or creators add members"
on public.chat_group_members for insert to authenticated
with check (
  public.is_connectx_group_admin(group_id)
  or (
    user_id = (select auth.uid()) and role = 'admin'
    and exists (
      select 1 from public.chat_groups g
      where g.id = chat_group_members.group_id
        and g.created_by = (select auth.uid())
    )
  )
);

create policy "ConnectX admins or members remove membership"
on public.chat_group_members for delete to authenticated
using (public.is_connectx_group_admin(group_id) or user_id = (select auth.uid()));

commit;
