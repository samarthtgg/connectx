UPDATE storage.buckets
SET allowed_mime_types = array_append(allowed_mime_types, 'image/gif')
WHERE id = 'connectx-avatars'
  AND NOT ('image/gif' = ANY(allowed_mime_types));
