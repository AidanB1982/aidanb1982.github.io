begin;
-- Existing plans remain manual. Only explicit automatic scheduling enters the queue.
alter table public.bp_marketing_posts
 add column delivery_mode text not null default 'manual' check(delivery_mode in ('manual','automatic')),
 add column delivery_state text check(delivery_state in ('queued','processing','published','failed','unknown')),
 add column delivery_claim uuid,
 add column delivery_started_at timestamptz,
 add column provider_post_id text,
 add column delivery_error text;
create index bp_marketing_due on public.bp_marketing_posts(scheduled_at) where delivery_mode='automatic' and delivery_state='queued' and status='scheduled';
create or replace function public.bp_marketing_save_post(p_id uuid,p_revision integer,p_payload jsonb)
returns public.bp_marketing_posts language plpgsql security definer set search_path=public,pg_temp as $$
declare old public.bp_marketing_posts; result public.bp_marketing_posts; target_status text; mode text;
begin
 if not exists(select 1 from public.member_profiles where id=auth.uid() and is_admin=true) then raise exception 'Administrator access required' using errcode='42501'; end if;
 target_status:=p_payload->>'status';mode:=coalesce(p_payload->>'delivery_mode','manual');
 if mode not in ('manual','automatic') then raise exception 'Choose manual or automatic publishing';end if;
 if mode='automatic' then
  if p_payload->>'channel' not in ('Facebook','Instagram') or coalesce(p_payload->>'cadence','none')<>'none' then raise exception 'Automatic publishing supports Facebook and Instagram only';end if;
  if target_status='published' then raise exception 'Automatic publication is confirmed by the worker';end if;
  if p_payload->>'channel'='Instagram' and (length(p_payload->>'content')>2200 or coalesce(p_payload->>'media_url','')='') then raise exception 'Instagram needs a public JPEG image URL and a caption of at most 2200 characters';end if;
 end if;
 if target_status='scheduled' and (nullif(p_payload->>'scheduled_at','')::timestamptz is null or nullif(p_payload->>'scheduled_at','')::timestamptz<=now()) then raise exception 'Choose a future scheduled time'; end if;
 if p_id is null then
  insert into public.bp_marketing_posts(created_by,title,book_title,channel,content,cadence,cadence_anchor,media_url,delivery_mode,delivery_state,status,scheduled_at,published_at)
  values(auth.uid(),p_payload->>'title',coalesce(p_payload->>'book_title',''),p_payload->>'channel',p_payload->>'content',coalesce(p_payload->>'cadence','none'),nullif(p_payload->>'cadence_anchor','')::smallint,coalesce(p_payload->>'media_url',''),mode,case when mode='automatic' and target_status='scheduled' then 'queued' end,target_status,nullif(p_payload->>'scheduled_at','')::timestamptz,case when target_status='published' then now() end) returning * into result;
 else
  select * into old from public.bp_marketing_posts where id=p_id for update;
  if old.id is null or old.revision<>p_revision then raise exception 'This post changed. Reload before editing.' using errcode='40001'; end if;
  if old.delivery_state in ('processing','unknown','published') then raise exception 'This automatic delivery is locked. Check its publication status; do not resubmit it.' using errcode='55000';end if;
  update public.bp_marketing_posts set title=p_payload->>'title',book_title=coalesce(p_payload->>'book_title',''),channel=p_payload->>'channel',content=p_payload->>'content',cadence=coalesce(p_payload->>'cadence','none'),cadence_anchor=nullif(p_payload->>'cadence_anchor','')::smallint,media_url=coalesce(p_payload->>'media_url',''),delivery_mode=mode,delivery_state=case when mode='automatic' and target_status='scheduled' then 'queued' end,delivery_claim=null,provider_post_id=null,delivery_error=null,delivery_started_at=null,status=target_status,scheduled_at=nullif(p_payload->>'scheduled_at','')::timestamptz,published_at=case when target_status='published' then coalesce(old.published_at,now()) end,revision=old.revision+1,updated_at=now() where id=p_id returning * into result;
 end if;
 return result;
end $$;
revoke all on function public.bp_marketing_save_post(uuid,integer,jsonb) from public,anon;
grant execute on function public.bp_marketing_save_post(uuid,integer,jsonb) to authenticated;

-- Only the authenticated server worker may claim or acknowledge a publication.
create function public.bp_social_claim()
returns setof public.bp_marketing_posts language plpgsql security definer set search_path=public,pg_temp as $$
declare target uuid;
begin
 -- A lost process is ambiguous, never an automatic retry.
 update public.bp_marketing_posts set delivery_state='unknown',delivery_error='The worker stopped before confirmation. Check the social account before taking further action.',revision=revision+1,updated_at=now()
 where delivery_state='processing' and delivery_started_at<now()-interval '10 minutes';
 select id into target from public.bp_marketing_posts where delivery_mode='automatic' and delivery_state='queued' and status='scheduled' and scheduled_at<=now() and channel in ('Facebook','Instagram') order by scheduled_at,id for update skip locked limit 1;
 if target is null then return;end if;
 return query update public.bp_marketing_posts set delivery_state='processing',delivery_claim=gen_random_uuid(),delivery_started_at=now(),delivery_error=null,revision=revision+1,updated_at=now() where id=target returning *;
end $$;
create function public.bp_social_finish(p_id uuid,p_claim uuid,p_state text,p_provider_id text,p_error text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare updated integer;
begin
 if p_state is null or p_claim is null or p_state not in ('published','failed','unknown') or (p_state='published' and coalesce(trim(p_provider_id),'')='') then raise exception 'Invalid social delivery outcome';end if;
 update public.bp_marketing_posts set delivery_state=p_state,provider_post_id=p_provider_id,delivery_error=left(p_error,500),status=case when p_state='published' then 'published' else status end,published_at=case when p_state='published' then now() else published_at end,revision=revision+1,updated_at=now()
 where id=p_id and delivery_claim=p_claim and delivery_state='processing';
 get diagnostics updated=row_count;return updated=1;
end $$;
revoke all on function public.bp_social_claim(),public.bp_social_finish(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.bp_social_claim(),public.bp_social_finish(uuid,uuid,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
