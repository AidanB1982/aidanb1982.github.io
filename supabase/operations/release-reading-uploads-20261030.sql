-- Owner-supplied EPUB uploads, 30 October 2026.
-- Run this entire file in Supabase SQL Editor. No UUID edits required.
-- Uses confirmed existing books/editions; preserves catalogue metadata and access rules.
begin;
create temporary table reading_uploads (
 title text,book_id bigint,edition_id bigint primary key,storage_path text
) on commit drop;
insert into reading_uploads values
 ('Love, Abused',5,35,'love_abused/love_abused.epub'),
 ('The Scheme',2,8,'the_scheme/The-Scheme.epub'),
 ('Red Streets',17,36,'red_streets/Red-Streets.epub'),
 ('Before the House Closed',14,30,'before_the_house_closed/before_the_house_closed.epub'),
 ('The Red-Clad Collector',24,42,'red-clad_collector/red_clad_collector.epub'),
 ('Corrour Bothy',9,17,'corrour_bothy/corrour_bothy.epub');
do $release$
declare item record;
begin
 perform pg_advisory_xact_lock(hashtext('bp-reading-owner-release'));
 if not exists(select 1 from storage.buckets where id='bp-reading-editions' and public=false) then
  raise exception 'Release stopped: bp-reading-editions must remain private.';
 end if;
 for item in select * from reading_uploads loop
  if not exists(select 1 from public.book_editions e join public.book_records b on b.id=e.book_id
   where e.id=item.edition_id and b.id=item.book_id and e.format='ebook'
   and e.status not in('withdrawn','archived','unavailable') and lower(btrim(b.title))=lower(item.title)) then
   raise exception 'Release stopped: confirmed book/ebook identity is unavailable or changed for %.',item.title;
  end if;
  if not exists(select 1 from public.bp_reading_catalog where edition_id=item.edition_id and lower(btrim(title))=lower(item.title)) then
   raise exception 'Release stopped: existing BP Reading catalogue entry is missing or mismatched for %.',item.title;
  end if;
  if not exists(select 1 from storage.objects where bucket_id='bp-reading-editions' and name=item.storage_path) then
   raise exception 'Release stopped: exact uploaded object not found: %',item.storage_path;
  end if;
  if (select count(*) from public.bp_reading_files where edition_id=item.edition_id)>1 then
   raise exception 'Release stopped: duplicate file registry entries for %.',item.title;
  end if;
  if exists(select 1 from public.bp_reading_files where edition_id=item.edition_id
   and (storage_bucket is distinct from 'bp-reading-editions' or storage_path is distinct from item.storage_path or file_format is distinct from 'epub'))
   or exists(select 1 from public.bp_reading_releases where edition_id=item.edition_id
   and (storage_bucket is distinct from 'bp-reading-editions' or storage_path is distinct from item.storage_path)) then
   raise exception 'Release stopped: % already points to another file; review before replacing it.',item.title;
  end if;
 end loop;
 -- All six identities and exact private object paths have passed before any release.
 for item in select * from reading_uploads loop
  update public.bp_reading_files set access_status='admin_testing' where edition_id=item.edition_id;
  if not found then
   insert into public.bp_reading_files(edition_id,storage_bucket,storage_path,file_format,access_status)
    values(item.edition_id,'bp-reading-editions',item.storage_path,'epub','admin_testing');
  end if;
  update public.bp_reading_catalog set available=true where edition_id=item.edition_id;
  insert into public.bp_reading_releases(edition_id,storage_bucket,storage_path,enabled)
   values(item.edition_id,'bp-reading-editions',item.storage_path,true)
   on conflict(edition_id) do update set enabled=true;
 end loop;
end $release$;
select c.title,u.book_id,u.edition_id,c.available,r.enabled as release_enabled
 from reading_uploads u join public.bp_reading_catalog c using(edition_id)
 join public.bp_reading_releases r using(edition_id) order by c.title;
commit;
