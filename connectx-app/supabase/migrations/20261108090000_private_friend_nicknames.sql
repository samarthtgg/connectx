-- Private per-user display names for direct-chat friends.
-- Existing chat_preferences RLS keeps each nickname scoped to its owner.
alter table public.chat_preferences
  add column if not exists nickname text
  check (nickname is null or char_length(btrim(nickname)) between 1 and 40);
