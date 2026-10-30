-- Prepared for the 30 October inventory: 20 legacy Gualachulain assignments.
-- BEFORE RUNNING: verify live legacy EPUB AND PDF endpoints deny reader_active
-- assignments. This file does not change or verify those external endpoints.
-- No UUID edits. Existing assignments only; The Crossing remains unchanged.
begin;
lock table public.arc_file_assignments,public.member_profiles,public.arc_files,
 public.bp_arc_reading_grants,public.bp_arc_reading_pilots,
 public.bp_arc_reading_editions,public.bp_reading_files in share row exclusive mode;
create temporary table arc_team_targets on commit drop as
 select id as assignment_id,member_id from public.arc_file_assignments
 where arc_file_id=3 and status='active';
do $$
begin
 if (select count(*) from arc_team_targets)>20 then raise exception 'Inventory changed: more than 20 pending assignments. Review a fresh rollout report.';end if;
 if not exists(select 1 from public.arc_files where id=3 and slug='gualachulain' and is_active
 and (downloads_open_at is null or downloads_open_at<=now()) and (downloads_close_at is null or downloads_close_at>now())) then raise exception 'Gualachulain campaign is not open.';end if;
 if not exists(select 1 from public.bp_arc_reading_editions m
 join public.bp_reading_catalog c on c.edition_id=m.edition_id
 join public.book_editions e on e.id=m.edition_id and e.book_id=1 and e.format='ebook' and e.status not in('withdrawn','archived','unavailable')
 join public.bp_reading_files r on r.edition_id=m.edition_id and r.storage_bucket=m.storage_bucket and r.storage_path=m.storage_path
 join storage.buckets b on b.id=r.storage_bucket and b.public=false
 join storage.objects o on o.bucket_id=r.storage_bucket and o.name=r.storage_path
 where m.arc_file_id=3 and m.edition_id=2 and m.enabled and lower(c.title) like 'gualachulain%'
 and r.storage_bucket='bp-reading-editions' and r.file_format='epub' and r.access_status in('published','admin_testing')) then raise exception 'Confirmed private Gualachulain edition/mapping/file is not ready.';end if;
 if exists(select 1 from arc_team_targets t left join public.member_profiles p on p.id=t.member_id
 where p.id is null or p.member_status is distinct from 'active' or p.is_arc_member is distinct from true) then raise exception 'An assigned profile needs review; no profile roles will be changed.';end if;
 if exists(select 1 from public.arc_file_assignments a where a.arc_file_id=3 and a.member_id in(select member_id from arc_team_targets) group by a.member_id having count(*)>1) then raise exception 'Duplicate campaign assignments need individual review.';end if;
 if exists(select 1 from arc_team_targets t join public.bp_arc_reading_grants g on g.assignment_id=t.assignment_id
 where g.member_id<>t.member_id or g.arc_file_id<>3 or g.edition_id<>2 or not g.enabled) then raise exception 'A conflicting or disabled grant requires review; it will not be overwritten.';end if;
 if exists(select 1 from arc_team_targets t join public.bp_arc_reading_pilots p on p.member_id=t.member_id where not p.enabled) then raise exception 'A disabled reader requires review; it will not be re-enabled.';end if;
end $$;
insert into public.bp_arc_reading_pilots(member_id,enabled)
 select distinct member_id,true from arc_team_targets on conflict(member_id) do nothing;
insert into public.bp_arc_reading_grants(assignment_id,member_id,arc_file_id,edition_id,enabled)
 select assignment_id,member_id,3,2,true from arc_team_targets on conflict(assignment_id) do nothing;
update public.arc_file_assignments a set status='reader_active',updated_at=now()
 from arc_team_targets t where a.id=t.assignment_id;
do $$ begin
 if exists(select 1 from arc_team_targets t where not public.bp_arc_reading_eligible(t.member_id,t.assignment_id)) then raise exception 'Post-migration eligibility failed; entire batch rolled back.';end if;
end $$;
select count(*) as assignments_migrated,count(distinct member_id) as readers_migrated from arc_team_targets;
commit;
