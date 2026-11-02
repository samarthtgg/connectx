-- Run the cleanup Edge Function every minute.
-- The cleanup secret is read from Supabase Vault; it is never stored in this migration.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'connectx-temporary-chat-media-cleanup'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'connectx-temporary-chat-media-cleanup',
    '* * * * *',
    $job$
      select net.http_post(
        url := 'https://bmbgtesefdquwdymqluf.supabase.co/functions/v1/cleanup-temporary-chat-media',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-connectx-cleanup-secret',
          (select decrypted_secret
           from vault.decrypted_secrets
           where name = 'connectx_cleanup_secret'
           limit 1)
        ),
        body := '{}'::jsonb
      );
    $job$
  );
end;
$$;

-- Verify after running:
-- select jobname, schedule, active
-- from cron.job
-- where jobname = 'connectx-temporary-chat-media-cleanup';
