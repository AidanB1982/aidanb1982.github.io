begin;
-- Assign valid readers even when others still need their legitimate application link.
-- References are never generated. Existing assignments/reviews/file paths stay intact.
create or replace function public.bp_arc_assign_campaign_v2(
 p_file_id bigint,p_members uuid[],p_due date,p_application_refs jsonb
) returns table(created_count integer,existing_count integer,blocked_count integer,blocked_readers jsonb)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 member_uuid uuid; application_ref text; supplied_ref boolean;
 created integer:=0; retained integer:=0; blocked jsonb:='[]'::jsonb;
begin
 if p_members is null or cardinality(p_members) not between 1 and 200 or cardinality(p_members)<>(select count(distinct x) from unnest(p_members) x) then raise exception 'Choose 1 to 200 distinct ARC members'; end if;
 if p_due is null or p_due<current_date then raise exception 'Choose a current or future review due date'; end if;
 if p_application_refs is null or jsonb_typeof(p_application_refs)<>'object' then raise exception 'Provide valid ARC application references'; end if;
 if exists(select 1 from jsonb_each(p_application_refs) e where not(e.key=any(p_members::text[])) or jsonb_typeof(e.value)<>'string' or length(trim(e.value#>>'{}')) not between 1 and 200) then raise exception 'Provide valid ARC application references'; end if;
 perform pg_advisory_xact_lock(hashtextextended('bp-arc-'||p_file_id::text,0));
 if not exists(select 1 from public.arc_files where id=p_file_id and is_active=true and (downloads_close_at is null or downloads_close_at>now())) then raise exception 'This ARC campaign is inactive or closed'; end if;
 if (select count(*) from public.member_profiles where id=any(p_members) and is_arc_member=true and member_status='active')<>cardinality(p_members) then raise exception 'Some selected readers are not active ARC team members'; end if;
 -- Serialize new reference claims across campaigns, in a consistent order.
 for application_ref in select distinct trim(value) from jsonb_each_text(p_application_refs) order by 1 loop
  perform pg_advisory_xact_lock(hashtextextended('bp-arc-application-'||application_ref,0));
 end loop;
 foreach member_uuid in array p_members loop
  if exists(select 1 from public.arc_file_assignments where member_id=member_uuid and arc_file_id=p_file_id) then
   retained:=retained+1; continue;
  end if;
  application_ref:=null; supplied_ref:=false;
  select nullif(trim(application_id),'') into application_ref from public.arc_file_assignments
   where member_id=member_uuid and nullif(trim(application_id),'') is not null order by created_at desc,id desc limit 1;
  if application_ref is null then
   application_ref:=nullif(trim(p_application_refs->>member_uuid::text),'');supplied_ref:=application_ref is not null;
  end if;
  if application_ref is null then
   blocked:=blocked||jsonb_build_array(jsonb_build_object('member_id',member_uuid,'reason','missing_application_reference'));continue;
  end if;
  if supplied_ref and (
   exists(select 1 from public.arc_file_assignments where application_id=application_ref and member_id<>member_uuid)
   or exists(select 1 from jsonb_each_text(p_application_refs) e where e.key<>member_uuid::text and trim(e.value)=application_ref)
  ) then
   blocked:=blocked||jsonb_build_array(jsonb_build_object('member_id',member_uuid,'reason','application_reference_conflict'));continue;
  end if;
  insert into public.arc_file_assignments(member_id,arc_file_id,application_id,status,review_due_date)
   values(member_uuid,p_file_id,application_ref,'active',p_due);
  created:=created+1;
 end loop;
 return query select created,retained,jsonb_array_length(blocked),blocked;
end $$;
revoke all on function public.bp_arc_assign_campaign_v2(bigint,uuid[],date,jsonb) from public,anon,authenticated;
grant execute on function public.bp_arc_assign_campaign_v2(bigint,uuid[],date,jsonb) to service_role;

-- Older deployed clients keep working and no longer lose the whole batch over a missing link.
create or replace function public.bp_arc_assign_campaign(p_file_id bigint,p_members uuid[],p_due date)
returns table(created_count integer,existing_count integer)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 return query select r.created_count,r.existing_count
 from public.bp_arc_assign_campaign_v2(p_file_id,p_members,p_due,'{}'::jsonb) r;
end $$;
revoke all on function public.bp_arc_assign_campaign(bigint,uuid[],date) from public,anon,authenticated;
grant execute on function public.bp_arc_assign_campaign(bigint,uuid[],date) to service_role;
notify pgrst, 'reload schema';
commit;
