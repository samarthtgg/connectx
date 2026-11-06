-- Clients may change a vote's selected option, but must not move or rewrite vote rows.
REVOKE UPDATE ON TABLE public.group_poll_votes FROM anon, authenticated;
REVOKE UPDATE (id, poll_id, option_id, user_id, created_at)
  ON TABLE public.group_poll_votes FROM anon, authenticated;
GRANT UPDATE (option_id) ON TABLE public.group_poll_votes TO authenticated;
