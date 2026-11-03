-- AFTER the beta migration and delivery-function deployment.
-- Replace the example with accepted testers' BLACKWOOD sign-in emails, one per row.
-- These are not necessarily the Google Play emails used for the tester invitation.
-- This operation does not create Auth users or send Google invitations.
begin;
lock table public.bp_reading_beta_grants,public.member_profiles,
 public.bp_reading_catalog,public.bp_reading_releases,public.bp_reading_files
 in share row exclusive mode;
create temporary table accepted_beta_testers(member_email text primary key) on commit drop;
insert into accepted_beta_testers values
 ('replace-with-accepted-member@example.invalid');
do $$
begin
 if not exists(select 1 from accepted_beta_testers) or exists(select 1 from accepted_beta_testers where member_email like '%@example.invalid') then raise exception 'Enter the accepted testers Blackwood member emails first.';end if;
 if (select count(*) from accepted_beta_testers)>100 then raise exception 'This beta cohort is limited to 100 accepted readers.';end if;
 if exists(select lower(trim(member_email)) from accepted_beta_testers group by 1 having count(*)>1) then raise exception 'Duplicate email entries need review.';end if;
 if exists(select 1 from accepted_beta_testers t where
  (select count(*) from auth.users u join public.member_profiles p on p.id=u.id
   where lower(u.email)=lower(trim(t.member_email)) and lower(p.email)=lower(u.email)
   and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now())
   and p.member_status='active' and p.is_admin=false)<>1) then
  raise exception 'Every accepted tester must have exactly one confirmed active non-admin Blackwood account/profile. Check the member emails.';
 end if;
 if not exists(select 1 from public.bp_reading_catalog c
 join public.book_editions e on e.id=c.edition_id and e.book_id=4 and e.format='ebook' and e.status not in('withdrawn','archived','unavailable')
 join public.bp_reading_files f on f.edition_id=c.edition_id and f.storage_bucket='bp-reading-editions' and f.file_format='epub' and f.access_status='admin_testing'
 join public.bp_reading_releases r on r.edition_id=c.edition_id and r.storage_bucket=f.storage_bucket and r.storage_path=f.storage_path and r.enabled
 join storage.buckets b on b.id=f.storage_bucket and b.public=false
 join storage.objects o on o.bucket_id=f.storage_bucket and o.name=f.storage_path
 where c.edition_id=10 and c.available and lower(c.title)='the black bothy') then raise exception 'Confirmed Black Bothy private release 10 must be ready.';end if;
 if exists(select 1 from public.bp_reading_beta_grants g join auth.users u on u.id=g.user_id
 join accepted_beta_testers t on lower(u.email)=lower(trim(t.member_email))
 where g.edition_id=10 and (g.revoked_at is not null or g.cohort<>'sgeul-android-2026-beta')) then raise exception 'A revoked or different-cohort grant needs review; it will not be overwritten.';end if;
 if (select count(*) from (
  select user_id from public.bp_reading_beta_grants where cohort='sgeul-android-2026-beta' and revoked_at is null and access_until>now()
  union select u.id from auth.users u join accepted_beta_testers t on lower(u.email)=lower(trim(t.member_email))
 ) accepted)>100 then raise exception 'The active beta cohort would exceed 100 readers.';end if;
end $$;
insert into public.bp_reading_beta_grants(user_id,edition_id,cohort,access_until)
 select u.id,10,'sgeul-android-2026-beta',now()+interval '45 days'
 from auth.users u join accepted_beta_testers t on lower(u.email)=lower(trim(t.member_email))
 on conflict(user_id,edition_id) do update set access_until=greatest(public.bp_reading_beta_grants.access_until,excluded.access_until),updated_at=now();
select p.id,p.reader_name,c.title,g.access_until
 from public.bp_reading_beta_grants g join public.member_profiles p on p.id=g.user_id
 join public.bp_reading_catalog c on c.edition_id=g.edition_id
 join accepted_beta_testers t on lower(p.email)=lower(trim(t.member_email))
 where g.edition_id=10 and g.cohort='sgeul-android-2026-beta';
commit;
