DROP POLICY IF EXISTS live_locations_participants_read ON public.live_locations;
CREATE POLICY live_locations_participants_read
ON public.live_locations
FOR SELECT
TO authenticated
USING (
  expires_at > now()
  AND (
    sharer_id = (SELECT auth.uid())
    OR (
      recipient_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.friend_requests f
        WHERE f.status = 'accepted'
          AND (
            (f.sender_id = live_locations.sharer_id AND f.receiver_id = live_locations.recipient_id)
            OR
            (f.sender_id = live_locations.recipient_id AND f.receiver_id = live_locations.sharer_id)
          )
      )
    )
  )
);

DROP POLICY IF EXISTS live_locations_sharer_update ON public.live_locations;
CREATE POLICY live_locations_sharer_update
ON public.live_locations
FOR UPDATE
TO authenticated
USING (
  sharer_id = (SELECT auth.uid())
  AND expires_at > now()
  AND EXISTS (
    SELECT 1
    FROM public.friend_requests f
    WHERE f.status = 'accepted'
      AND (
        (f.sender_id = live_locations.sharer_id AND f.receiver_id = live_locations.recipient_id)
        OR
        (f.sender_id = live_locations.recipient_id AND f.receiver_id = live_locations.sharer_id)
      )
  )
)
WITH CHECK (
  sharer_id = (SELECT auth.uid())
  AND expires_at > now()
  AND expires_at <= (now() + interval '24 hours')
  AND EXISTS (
    SELECT 1
    FROM public.friend_requests f
    WHERE f.status = 'accepted'
      AND (
        (f.sender_id = live_locations.sharer_id AND f.receiver_id = live_locations.recipient_id)
        OR
        (f.sender_id = live_locations.recipient_id AND f.receiver_id = live_locations.sharer_id)
      )
  )
);
