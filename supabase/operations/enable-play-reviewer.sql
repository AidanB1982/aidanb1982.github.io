-- Create normal reading/ARC access for a confirmed, owner-created Play reviewer.
-- Replace the single UUID and email placeholders. Never include the password.
-- Complimentary membership: one year, no payment/order/purchase record is created.
begin;
lock table public.member_profiles, public.bp_reading_memberships,
 public.arc_file_assignments, public.arc_file_issuances, public.bp_arc_reading_grants,
 public.bp_arc_reading_pilots, public.bp_arc_reading_editions in share row exclusive mode;
create temporary table play_reviewer_target(member_id uuid,email text) on commit drop;
insert into play_reviewer_target values('00000000-0000-0000-0000-000000000000','reviewer@example.invalid');
do $$
declare target uuid;target_email text;assignment_key bigint;matches integer;required_fields text;
 sequence_name text;largest bigint;previous bigint;loop_table text;
begin
 select member_id,email into target,target_email from play_reviewer_target;
 if replace(target::text,'-','')=repeat('0',32) or target_email=('reviewer' || '@example.invalid') then raise exception 'Replace reviewer UUID and email before running this operation.';end if;
 if not exists(select 1 from auth.users where id=target and lower(email)=lower(target_email)
 and email_confirmed_at is not null and (banned_until is null or banned_until<=now())) then
  raise exception 'The exact confirmed, non-banned Auth user/email was not found.';
 end if;
 if exists(select 1 from public.member_profiles where id=target and
 (lower(email) is distinct from lower(target_email) or is_admin is distinct from false or member_status is distinct from 'active')) then
  raise exception 'Existing reviewer profile has conflicting identity, inactive status or admin access; review it first.';
 end if;
 select string_agg(column_name,', ') into required_fields from information_schema.columns
 where table_schema='public' and table_name='member_profiles' and is_nullable='NO'
 and column_default is null and is_identity='NO' and is_generated='NEVER'
 and column_name not in('id','email','display_name','reader_name','member_status','member_tier','points_total','is_arc_member','is_admin','joined_at','updated_at');
 if required_fields is not null then raise exception 'Unexpected required member profile fields: %',required_fields;end if;
 if not exists(select 1 from public.arc_files where id=3 and slug='gualachulain' and is_active
 and (downloads_open_at is null or downloads_open_at<=now()) and (downloads_close_at is null or downloads_close_at>now())) then
  raise exception 'Confirmed Gualachulain ARC campaign 3 must be open; no campaign will be reactivated.';
 end if;
 if not exists(select 1 from public.bp_arc_reading_editions m
 join public.bp_reading_files f on f.edition_id=m.edition_id and f.storage_bucket=m.storage_bucket and f.storage_path=m.storage_path
 join public.book_editions e on e.id=m.edition_id and e.book_id=1 and e.format='ebook' and e.status not in('withdrawn','archived','unavailable')
 join storage.buckets b on b.id=f.storage_bucket and b.public=false
 join storage.objects o on o.bucket_id=f.storage_bucket and o.name=f.storage_path
 where m.arc_file_id=3 and m.edition_id=2 and m.enabled and f.storage_bucket='bp-reading-editions'
 and f.file_format='epub' and f.access_status in('admin_testing','published')) then
  raise exception 'The existing pinned Gualachulain private reader mapping/file is not ready.';
 end if;
 if not exists(select 1 from public.bp_reading_catalog c join public.bp_reading_files f on f.edition_id=c.edition_id
 join public.bp_reading_releases r on r.edition_id=c.edition_id and r.storage_bucket=f.storage_bucket and r.storage_path=f.storage_path and r.enabled
 join storage.buckets b on b.id=f.storage_bucket and b.public=false
 join storage.objects o on o.bucket_id=f.storage_bucket and o.name=f.storage_path
 where c.edition_id=10 and c.available and lower(c.title)='the black bothy'
 and f.storage_bucket='bp-reading-editions' and f.file_format='epub' and f.access_status='admin_testing') then
  raise exception 'The released Black Bothy library edition 10 must be ready for reviewer testing.';
 end if;
 if exists(select 1 from public.bp_reading_memberships where user_id=target and (revoked_at is not null or payment_reference is not null)) then
  raise exception 'An existing revoked or payment-linked membership must not be overwritten.';
 end if;
 if exists(select 1 from public.bp_arc_reading_pilots where member_id=target and not enabled) then
  raise exception 'An explicitly disabled reviewer ARC account must be reviewed before re-enabling.';
 end if;
 if exists(select 1 from public.arc_file_assignments where member_id=target and arc_file_id<>3 and status='active') then
  raise exception 'Other legacy download assignments need review first.';
 end if;
 select count(*),min(id) into matches,assignment_key from public.arc_file_assignments where member_id=target and arc_file_id=3;
 if matches>1 then raise exception 'Duplicate Gualachulain assignments need individual review.';end if;
 if matches=1 and not exists(select 1 from public.arc_file_assignments where id=assignment_key and status in('active','reader_active')) then
  raise exception 'A closed/revoked ARC assignment will not be reactivated.';
 end if;
 if exists(select 1 from public.bp_arc_reading_grants where assignment_id=assignment_key and
 (member_id<>target or arc_file_id<>3 or edition_id<>2 or not enabled)) then
  raise exception 'A conflicting or disabled ARC grant must be reviewed first.';
 end if;
 insert into public.member_profiles(id,email,display_name,reader_name,member_status,member_tier,points_total,is_arc_member,is_admin,joined_at,updated_at)
 values(target,target_email,'Google Play Reviewer','Google Play Reviewer','active','Reader',0,true,false,now(),now()) on conflict(id) do nothing;
 update public.member_profiles set is_arc_member=true,updated_at=now() where id=target;
 insert into public.bp_reading_memberships(user_id,access_until,payment_reference)
 values(target,now()+interval '1 year',null)
 on conflict(user_id) do update set access_until=greatest(public.bp_reading_memberships.access_until,excluded.access_until),updated_at=now();
 -- Only advance lagging sequences; imported IDs and existing issuance history stay intact.
 foreach loop_table in array array['arc_file_assignments','arc_file_issuances'] loop
  sequence_name:=pg_get_serial_sequence('public.'||loop_table,'id');
  if sequence_name is not null then
   execute format('select max(id) from public.%I',loop_table) into largest;
   execute format('select last_value from %s',sequence_name::regclass) into previous;
   if largest is not null and largest>=previous then perform setval(sequence_name::regclass,largest,true);end if;
  end if;
 end loop;
 if matches=0 then
  insert into public.arc_file_assignments(member_id,arc_file_id,application_id,status)
  values(target,3,'','reader_active') returning id into assignment_key;
 else update public.arc_file_assignments set status='reader_active',updated_at=now() where id=assignment_key;
 end if;
 insert into public.bp_arc_reading_grants(assignment_id,member_id,arc_file_id,edition_id,enabled)
 values(assignment_key,target,3,2,true) on conflict(assignment_id) do nothing;
 insert into public.bp_arc_reading_pilots(member_id,enabled) values(target,true) on conflict(member_id) do nothing;
 perform set_config('request.jwt.claim.sub',target::text,true);
 if not public.bp_reading_can_read(10) or not public.bp_arc_reading_eligible(target,assignment_key) then
  raise exception 'Reviewer eligibility verification failed; entire setup rolled back.';
 end if;
end $$;
commit;
select p.id,p.display_name,p.member_status,p.member_tier,p.is_admin,p.is_arc_member,
 m.access_until as complimentary_reading_until,(m.payment_reference is null) as no_payment_record,
 a.id as arc_assignment_id,a.status as arc_status,c.title as arc_title
 from public.member_profiles p join public.bp_reading_memberships m on m.user_id=p.id
 join public.arc_file_assignments a on a.member_id=p.id and a.arc_file_id=3
 join public.bp_arc_reading_grants g on g.assignment_id=a.id and g.enabled
 join public.bp_reading_catalog c on c.edition_id=g.edition_id
 where p.id=(select id from auth.users where lower(email)=lower('reviewer@example.invalid'));
