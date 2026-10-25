begin;
-- Book access is an approved member's active assignment. The download service
-- creates/reuses its issuance_code later through create_arc_issuance.
-- Historical application IDs are metadata, not a prerequisite for a new grant.
create or replace function public.bp_arc_grant_campaign(p_file_id bigint,p_members uuid[],p_due date)
returns table(created_count integer,existing_count integer)
language plpgsql security definer set search_path=public,pg_temp as $$
declare member_uuid uuid; legacy_ref text; created integer:=0; retained integer:=0;
begin
 if p_members is null or cardinality(p_members) not between 1 and 200
 or cardinality(p_members)<>(select count(distinct x) from unnest(p_members) x)
 then raise exception 'Choose 1 to 200 distinct ARC members'; end if;
 if p_due is null or p_due<current_date then raise exception 'Choose a current or future review due date'; end if;
 perform pg_advisory_xact_lock(hashtextextended('bp-arc-'||p_file_id::text,0));
 if not exists(select 1 from public.arc_files where id=p_file_id and is_active=true and (downloads_close_at is null or downloads_close_at>now()))
 then raise exception 'This ARC campaign is inactive or closed'; end if;
 if (select count(*) from public.member_profiles where id=any(p_members) and is_arc_member=true and member_status='active')<>cardinality(p_members)
 then raise exception 'Some selected readers are not active ARC team members'; end if;
 foreach member_uuid in array p_members loop
  -- Keep all earlier records, including reviews, revoked access and issued copies.
  if exists(select 1 from public.arc_file_assignments where member_id=member_uuid and arc_file_id=p_file_id) then retained:=retained+1;continue;end if;
  legacy_ref:=null;
  select nullif(trim(application_id),'') into legacy_ref from public.arc_file_assignments
   where member_id=member_uuid and nullif(trim(application_id),'') is not null order by created_at desc,id desc limit 1;
  insert into public.arc_file_assignments(member_id,arc_file_id,application_id,status,review_due_date)
   values(member_uuid,p_file_id,coalesce(legacy_ref,''),'active',p_due);
  created:=created+1;
 end loop;
 return query select created,retained;
end $$;
revoke all on function public.bp_arc_grant_campaign(bigint,uuid[],date) from public,anon,authenticated;
grant execute on function public.bp_arc_grant_campaign(bigint,uuid[],date) to service_role;

-- The already-deployed Edge Function can continue calling either older name.
create or replace function public.bp_arc_assign_campaign(p_file_id bigint,p_members uuid[],p_due date)
returns table(created_count integer,existing_count integer)
language plpgsql security definer set search_path=public,pg_temp as $$
begin return query select r.created_count,r.existing_count from public.bp_arc_grant_campaign(p_file_id,p_members,p_due) r;end $$;
create or replace function public.bp_arc_assign_campaign_v2(p_file_id bigint,p_members uuid[],p_due date,p_application_refs jsonb)
returns table(created_count integer,existing_count integer,blocked_count integer,blocked_readers jsonb)
language plpgsql security definer set search_path=public,pg_temp as $$
begin return query select r.created_count,r.existing_count,0,'[]'::jsonb from public.bp_arc_grant_campaign(p_file_id,p_members,p_due) r;end $$;
revoke all on function public.bp_arc_assign_campaign(bigint,uuid[],date),public.bp_arc_assign_campaign_v2(bigint,uuid[],date,jsonb) from public,anon,authenticated;
grant execute on function public.bp_arc_assign_campaign(bigint,uuid[],date),public.bp_arc_assign_campaign_v2(bigint,uuid[],date,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
