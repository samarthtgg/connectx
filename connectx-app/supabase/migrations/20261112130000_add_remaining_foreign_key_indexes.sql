create index if not exists chat_disappearing_settings_updated_by_idx
  on public.chat_disappearing_settings (updated_by);
create index if not exists chat_disappearing_settings_user_two_idx
  on public.chat_disappearing_settings (user_two);
create index if not exists close_friends_friend_id_idx
  on public.close_friends (friend_id);
create index if not exists scheduled_messages_group_id_idx
  on public.scheduled_messages (group_id);
create index if not exists status_views_viewer_id_idx
  on public.status_views (viewer_id);
