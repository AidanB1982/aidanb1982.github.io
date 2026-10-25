begin;
-- Existing ARC tables are retained. No ARC files, assignments or reviews are deleted.
create table public.bp_marketing_posts (
 id uuid primary key default gen_random_uuid(),
 created_by uuid not null references public.member_profiles(id),
 title text not null check(length(trim(title)) between 1 and 200),
 book_title text not null default '' check(length(book_title)<=300),
 channel text not null check(channel in ('Facebook','Instagram','TikTok','Email','Behind the Files','Other')),
 cadence text not null default 'none' check(cadence in ('none','monthly') and (cadence<>'monthly' or channel='Email')),
 cadence_anchor smallint check(cadence_anchor between 1 and 31),
 media_url text not null default '' check(length(media_url)<=2000 and (media_url='' or media_url ~ '^https://[^[:space:]]+$')),
 content text not null check(length(trim(content)) between 1 and 12000),
 status text not null default 'draft' check(status in ('draft','approved','scheduled','published')),
 scheduled_at timestamptz,
 published_at timestamptz,
 revision integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(status<>'scheduled' or scheduled_at is not null),
 check((status='published')=(published_at is not null))
);
create unique index bp_monthly_mailing_slot on public.bp_marketing_posts ((date_trunc('month',scheduled_at at time zone 'Europe/London'))) where channel='Email' and cadence='monthly' and scheduled_at is not null;
alter table public.bp_marketing_posts enable row level security;
create policy bp_marketing_admin_read on public.bp_marketing_posts for select to authenticated
 using(exists(select 1 from public.member_profiles where id=auth.uid() and is_admin=true));
revoke all on public.bp_marketing_posts from anon,authenticated;
grant select on public.bp_marketing_posts to authenticated;
grant all on public.bp_marketing_posts to service_role;

create function public.bp_marketing_save_post(p_id uuid,p_revision integer,p_payload jsonb)
returns public.bp_marketing_posts language plpgsql security definer set search_path=public,pg_temp as $$
declare old public.bp_marketing_posts; result public.bp_marketing_posts; target_status text;
begin
 if not exists(select 1 from public.member_profiles where id=auth.uid() and is_admin=true) then raise exception 'Administrator access required' using errcode='42501'; end if;
 target_status:=p_payload->>'status';
 if target_status='scheduled' and (nullif(p_payload->>'scheduled_at','')::timestamptz is null or nullif(p_payload->>'scheduled_at','')::timestamptz<=now()) then raise exception 'Choose a future scheduled time'; end if;
 if p_id is null then
  insert into public.bp_marketing_posts(created_by,title,book_title,channel,content,cadence,cadence_anchor,media_url,status,scheduled_at,published_at)
  values(auth.uid(),p_payload->>'title',coalesce(p_payload->>'book_title',''),p_payload->>'channel',p_payload->>'content',coalesce(p_payload->>'cadence','none'),nullif(p_payload->>'cadence_anchor','')::smallint,coalesce(p_payload->>'media_url',''),target_status,nullif(p_payload->>'scheduled_at','')::timestamptz,case when target_status='published' then now() end) returning * into result;
 else
  select * into old from public.bp_marketing_posts where id=p_id for update;
  if old.id is null or old.revision<>p_revision then raise exception 'This post changed. Reload before editing.' using errcode='40001'; end if;
  update public.bp_marketing_posts set title=p_payload->>'title',book_title=coalesce(p_payload->>'book_title',''),channel=p_payload->>'channel',content=p_payload->>'content',cadence=coalesce(p_payload->>'cadence','none'),cadence_anchor=nullif(p_payload->>'cadence_anchor','')::smallint,media_url=coalesce(p_payload->>'media_url',''),status=target_status,scheduled_at=nullif(p_payload->>'scheduled_at','')::timestamptz,published_at=case when target_status='published' then coalesce(old.published_at,now()) end,revision=old.revision+1,updated_at=now() where id=p_id returning * into result;
 end if;
 return result;
end $$;
revoke all on function public.bp_marketing_save_post(uuid,integer,jsonb) from public,anon;
grant execute on function public.bp_marketing_save_post(uuid,integer,jsonb) to authenticated;

create table public.bp_arc_mail_batches (
 id uuid primary key default gen_random_uuid(),
 created_by uuid not null references public.member_profiles(id),
 arc_file_id bigint not null references public.arc_files(id),
 kind text not null check(kind in ('available','reminder')),
 recipients jsonb not null check(jsonb_typeof(recipients)='array' and jsonb_array_length(recipients) between 1 and 200),
 created_at timestamptz not null default now()
);
create table public.bp_arc_notices (
 id uuid primary key default gen_random_uuid(),
 assignment_id bigint not null references public.arc_file_assignments(id),
 kind text not null check(kind in ('available','reminder')),
 last_batch uuid not null references public.bp_arc_mail_batches(id),
 state text not null check(state in ('sending','submitted','failed','unknown')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(assignment_id,kind)
);
create table public.bp_operations_usage (
 admin_id uuid not null references public.member_profiles(id),
 hour timestamptz not null,
 count integer not null,
 primary key(admin_id,hour)
);
alter table public.bp_arc_mail_batches enable row level security;
alter table public.bp_arc_notices enable row level security;
alter table public.bp_operations_usage enable row level security;
revoke all on public.bp_arc_mail_batches,public.bp_arc_notices,public.bp_operations_usage from anon,authenticated;
grant all on public.bp_arc_mail_batches,public.bp_arc_notices,public.bp_operations_usage to service_role;

create function public.bp_arc_claim_notice(p_assignment_id bigint,p_kind text,p_batch_id uuid)
returns setof public.bp_arc_notices language sql security definer set search_path=public,pg_temp as $$
 insert into public.bp_arc_notices(assignment_id,kind,last_batch,state) values(p_assignment_id,p_kind,p_batch_id,'sending')
 on conflict(assignment_id,kind) do update set state='sending',last_batch=p_batch_id,updated_at=now() where bp_arc_notices.state='failed' and bp_arc_notices.last_batch<>p_batch_id returning *;
$$;
create function public.bp_operations_consume_ai(p_admin_id uuid)
returns boolean language sql security definer set search_path=public,pg_temp as $$
 with used as (insert into public.bp_operations_usage(admin_id,hour,count) values(p_admin_id,date_trunc('hour',now()),1)
 on conflict(admin_id,hour) do update set count=bp_operations_usage.count+1 where bp_operations_usage.count<30 returning count)
 select exists(select 1 from used);
$$;
create function public.bp_arc_assign_campaign(p_file_id bigint,p_members uuid[],p_due date)
returns table(created_count integer,existing_count integer) language plpgsql security definer set search_path=public,pg_temp as $$
declare member_uuid uuid; created integer:=0; retained integer:=0;
begin
 if cardinality(p_members) not between 1 and 200 or cardinality(p_members)<>(select count(distinct x) from unnest(p_members) x) then raise exception 'Choose 1 to 200 distinct ARC members'; end if;
 if p_due is null or p_due<current_date then raise exception 'Choose a current or future review due date'; end if;
 perform pg_advisory_xact_lock(hashtextextended('bp-arc-'||p_file_id::text,0));
 if not exists(select 1 from public.arc_files where id=p_file_id and is_active=true and (downloads_close_at is null or downloads_close_at>now())) then raise exception 'This ARC campaign is inactive or closed'; end if;
 if (select count(*) from public.member_profiles where id=any(p_members) and is_arc_member=true and member_status='active')<>cardinality(p_members) then raise exception 'Some selected readers are not active ARC team members'; end if;
 foreach member_uuid in array p_members loop
  if exists(select 1 from public.arc_file_assignments where member_id=member_uuid and arc_file_id=p_file_id) then retained:=retained+1;
  else
   insert into public.arc_file_assignments(member_id,arc_file_id,application_id,status,review_due_date)
   values(member_uuid,p_file_id,(select application_id from public.arc_file_assignments where member_id=member_uuid and application_id is not null order by created_at desc limit 1),'active',p_due);
   created:=created+1;
  end if;
 end loop;
 return query select created,retained;
end $$;
revoke all on function public.bp_arc_claim_notice(bigint,text,uuid),public.bp_operations_consume_ai(uuid),public.bp_arc_assign_campaign(bigint,uuid[],date) from public,anon,authenticated;
grant execute on function public.bp_arc_claim_notice(bigint,text,uuid),public.bp_operations_consume_ai(uuid),public.bp_arc_assign_campaign(bigint,uuid[],date) to service_role;
commit;
