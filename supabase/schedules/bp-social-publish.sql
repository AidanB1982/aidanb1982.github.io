-- Run only after the worker is deployed and the matching secret is in Supabase Vault.
-- Enable pg_cron and pg_net in Database > Extensions first.
-- Vault secret name: bp_social_cron_secret (same value as Edge BP_SOCIAL_CRON_SECRET).
-- Starts a background request once per minute; the worker stays paused unless enabled.
do $$begin
 if not exists(select 1 from vault.decrypted_secrets where name='bp_social_cron_secret' and length(decrypted_secret)>=32)
 then raise exception 'Add bp_social_cron_secret in Vault before scheduling';end if;
end $$;
select cron.schedule('bp-social-publish','* * * * *',$job$
 select net.http_post(
  url:='https://bmnlynjldlnxfvunqbqq.supabase.co/functions/v1/bp-social-publish',
  headers:=jsonb_build_object('Content-Type','application/json','x-bp-social-secret',
   (select decrypted_secret from vault.decrypted_secrets where name='bp_social_cron_secret' limit 1)),
  body:='{}'::jsonb,timeout_milliseconds:=180000
 );
$job$);
