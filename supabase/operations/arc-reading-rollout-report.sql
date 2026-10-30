-- Read-only rollout inventory. No UUID replacement or writes required.
-- Run in Supabase SQL Editor after the ARC pilot/offline migrations.
with assignment_counts as (
 select a.arc_file_id,
 count(*) filter(where a.status='active') as legacy_assignments,
 count(*) filter(where a.status='reader_active') as migrated_assignments,
 count(*) filter(where a.status='active' and p.member_status='active' and p.is_arc_member=true) as eligible_legacy_assignments,
 count(*) filter(where a.status='active' and (p.id is null or p.member_status is distinct from 'active' or p.is_arc_member is distinct from true)) as profiles_needing_review,
 count(*) filter(where a.status not in('active','reader_active')) as retained_history
 from public.arc_file_assignments a left join public.member_profiles p on p.id=a.member_id group by a.arc_file_id
), campaigns as (
 select f.id as campaign_id,f.slug,f.is_active,f.downloads_open_at,f.downloads_close_at,
 coalesce(a.legacy_assignments,0) as legacy_assignments,
 coalesce(a.migrated_assignments,0) as migrated_assignments,
 coalesce(a.eligible_legacy_assignments,0) as eligible_legacy_assignments,
 coalesce(a.profiles_needing_review,0) as profiles_needing_review,
 coalesce(a.retained_history,0) as retained_history,
 m.edition_id,c.title as mapped_title,m.enabled as mapping_enabled,
 exists(select 1 from public.bp_reading_files r join public.book_editions e on e.id=r.edition_id
 join storage.buckets b on b.id=r.storage_bucket and b.public=false
 join storage.objects o on o.bucket_id=r.storage_bucket and o.name=r.storage_path
 where r.edition_id=m.edition_id and r.storage_bucket=m.storage_bucket and r.storage_path=m.storage_path
 and r.storage_bucket='bp-reading-editions' and r.file_format='epub' and r.access_status in('published','admin_testing')
 and e.format='ebook' and e.status not in('withdrawn','archived','unavailable')) as mapped_private_file_ready
 from public.arc_files f left join assignment_counts a on a.arc_file_id=f.id
 left join public.bp_arc_reading_editions m on m.arc_file_id=f.id
 left join public.bp_reading_catalog c on c.edition_id=m.edition_id
 where a.arc_file_id is not null
)
select jsonb_build_object(
 'campaigns',coalesce((select jsonb_agg(to_jsonb(c) order by campaign_id) from campaigns c),'[]'::jsonb),
 'reading_editions',coalesce((select jsonb_agg(jsonb_build_object('edition_id',c.edition_id,'title',c.title,'file_registered',exists(select 1 from public.bp_reading_files r where r.edition_id=c.edition_id and r.file_format='epub' and r.access_status in('published','admin_testing'))) order by c.title) from public.bp_reading_catalog c),'[]'::jsonb),
 'legacy_endpoint_checks','Verify live legacy EPUB and PDF endpoints reject the migrated pilot assignment before team rollout. Existing downloaded copies cannot be recalled.',
 'changes_made',false
) as arc_rollout_report;
