-- Owner-approved BP Reading release, 27 October 2026.
-- Confirmed book_records.id = 4 and book_editions.id = 10 (ebook).
-- Run the whole file in Supabase SQL Editor as the project administrator.
-- Does not change memberships, payments, RLS, bucket privacy or launch flags.
begin;
do $release$
declare
  reading_key text;
  candidate_count integer;
  missing_columns text;
  bucket_name constant text := 'bp-reading-editions';
  object_path constant text := 'The_Black_Bothy/The Black Bothy.epub';
begin
  perform pg_advisory_xact_lock(hashtext('bp-reading-owner-release'));
  if not exists (
    select 1 from public.book_editions e join public.book_records b on b.id=e.book_id
    where e.id=10 and b.id=4 and e.format='ebook' and lower(btrim(b.title))='the black bothy'
  ) then raise exception 'Release stopped: edition 10 must be the ebook edition of book 4, The Black Bothy.'; end if;
  if not exists (select 1 from storage.buckets where id=bucket_name and public=false) then
    raise exception 'Release stopped: bp-reading-editions must exist and remain private.';
  end if;
  if not exists (select 1 from storage.objects where bucket_id=bucket_name and name=object_path) then
    raise exception 'Release stopped: the exact uploaded object The_Black_Bothy/The Black Bothy.epub was not found.';
  end if;
  -- Refuse to guess values for any extra mandatory fields in the existing registry.
  select string_agg(column_name, ', ' order by ordinal_position) into missing_columns
  from information_schema.columns
  where table_schema='public' and table_name='bp_reading_files'
    and is_nullable='NO' and column_default is null and is_identity='NO' and is_generated='NEVER'
    and column_name not in ('edition_id','storage_bucket','storage_path','file_format','access_status');
  if missing_columns is not null then
    raise exception 'Release stopped: registry also requires these fields: %. Send these column names so the script can be adapted.',missing_columns;
  end if;
  select count(*) into candidate_count from public.bp_reading_files where edition_id=10;
  if candidate_count>1 then raise exception 'Release stopped: duplicate file registry records exist for edition 10.'; end if;

  select book_id into reading_key from public.bp_reading_catalog where edition_id=10;
  if reading_key is null then
    select count(*) into candidate_count from public.bp_reading_titles where lower(btrim(title))='the black bothy';
    if candidate_count>1 then raise exception 'Release stopped: multiple reading-title identities match The Black Bothy.'; end if;
    select book_id into reading_key from public.bp_reading_titles where lower(btrim(title))='the black bothy';
    reading_key := coalesce(reading_key,'4'); -- actual confirmed book record, not a made-up edition ID
  end if;
  if exists (select 1 from public.bp_reading_titles where book_id=reading_key and lower(btrim(title))<>'the black bothy') then
    raise exception 'Release stopped: the existing reading identity belongs to another title.';
  end if;

  insert into public.bp_reading_titles(book_id,title) values(reading_key,'The Black Bothy')
    on conflict(book_id) do nothing;
  update public.bp_reading_files set storage_bucket=bucket_name,storage_path=object_path,
    file_format='epub',access_status='admin_testing' where edition_id=10;
  if not found then
    insert into public.bp_reading_files(edition_id,storage_bucket,storage_path,file_format,access_status)
      values(10,bucket_name,object_path,'epub','admin_testing');
  end if;
  insert into public.bp_reading_catalog(edition_id,book_id,title,author,description,cover_url,series,series_order,available)
    values(10,reading_key,'The Black Bothy','Aidan Blackwood',
      'The first door into the Archive. Isolation, grief, and the thing waiting in the dark.',
      '/assets/book3.jpg','The Archive Files',1,true)
    on conflict(edition_id) do update set title=excluded.title,author=excluded.author,
      description=excluded.description,cover_url=excluded.cover_url,series=excluded.series,
      series_order=excluded.series_order,available=true;
  insert into public.bp_reading_releases(edition_id,storage_bucket,storage_path,enabled)
    values(10,bucket_name,object_path,true)
    on conflict(edition_id) do update set storage_bucket=excluded.storage_bucket,
      storage_path=excluded.storage_path,enabled=true,approved_at=now();
end
$release$;
commit;

-- Successful completion returns a row; refresh BP Reading and test the actual EPUB.
select c.title,c.edition_id,c.available,r.enabled as release_enabled,
  f.storage_bucket,f.storage_path
from public.bp_reading_catalog c
join public.bp_reading_files f on f.edition_id=c.edition_id
join public.bp_reading_releases r on r.edition_id=c.edition_id
where c.edition_id=10;
