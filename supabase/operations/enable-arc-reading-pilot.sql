-- Run AFTER the ARC pilot migration and Edge Function deployment.
-- Replace the all-zero UUID with the intended test account. No other readers migrate.
begin;
lock table public.arc_file_assignments,public.arc_file_issuances in share row exclusive mode;
do $$
declare target uuid:='00000000-0000-0000-0000-000000000000'; assignment_key bigint; matches integer; sequence_name text; largest bigint; previous bigint; table_name text;
begin
 if replace(target::text,'-','')=repeat('0',32) then raise exception 'Replace the target UUID before running this operation.';end if;
 if not exists(select 1 from public.member_profiles where id=target and member_status='active' and is_admin=false) then raise exception 'An active non-admin test account is required.';end if;
 if not exists(select 1 from public.arc_files where id=3 and slug='gualachulain' and is_active=true and (downloads_open_at is null or downloads_open_at<=now()) and (downloads_close_at is null or downloads_close_at>now())) then raise exception 'Confirmed Gualachulain campaign 3 is not available.';end if;
 if not exists(select 1 from public.bp_reading_catalog c join public.book_editions e on e.id=c.edition_id join public.book_records b on b.id=e.book_id where c.edition_id=2 and lower(c.title) like 'gualachulain%' and b.id=1 and e.format='ebook') then raise exception 'Confirmed Gualachulain edition 2 / book 1 does not match.';end if;
 if not exists(select 1 from storage.buckets where id='bp-reading-editions' and public=false) then raise exception 'Reading bucket must remain private.';end if;
 if not exists(select 1 from public.bp_reading_files f join storage.objects o on o.bucket_id=f.storage_bucket and o.name=f.storage_path where f.edition_id=2 and f.storage_bucket='bp-reading-editions' and f.file_format='epub' and f.access_status in('admin_testing','published')) then raise exception 'The Gualachulain EPUB registry/file is not ready.';end if;
 -- Preserve imported IDs, advancing only lagging identity sequences.
 foreach table_name in array array['arc_file_assignments','arc_file_issuances'] loop
  sequence_name:=pg_get_serial_sequence('public.'||table_name,'id');
  if sequence_name is not null then
   execute format('select max(id) from public.%I',table_name) into largest;
   execute format('select last_value from %s',sequence_name::regclass) into previous;
   if largest is not null and largest>=previous then perform setval(sequence_name::regclass,largest,true);end if;
  end if;
 end loop;
 if exists(select 1 from public.arc_file_assignments where member_id=target and arc_file_id<>3 and status='active') then raise exception 'Other legacy ARC grants exist; review them before enabling ARC status for this pilot.';end if;
 if exists(select 1 from public.bp_arc_reading_editions m join public.bp_reading_files f on f.edition_id=2 where m.arc_file_id=3 and (m.edition_id<>2 or m.storage_bucket<>f.storage_bucket or m.storage_path<>f.storage_path)) then raise exception 'An existing campaign mapping points to a different edition; review it first.';end if;
 select count(*),min(id) into matches,assignment_key from public.arc_file_assignments where member_id=target and arc_file_id=3;
 if matches>1 then raise exception 'Multiple assignments exist; choose the correct retained assignment before migrating.';end if;
 if matches=1 and not exists(select 1 from public.arc_file_assignments where id=assignment_key and status in('active','reader_active')) then raise exception 'Existing assignment is closed/revoked; it will not be reactivated automatically.';end if;
 if matches=0 then
  insert into public.arc_file_assignments(member_id,arc_file_id,application_id,status) values(target,3,'','reader_active') returning id into assignment_key;
 else update public.arc_file_assignments set status='reader_active',updated_at=now() where id=assignment_key;
 end if;
 update public.member_profiles set is_arc_member=true,updated_at=now() where id=target;
 if exists(select 1 from public.bp_arc_reading_grants where assignment_id=assignment_key and (member_id<>target or arc_file_id<>3 or edition_id<>2)) then raise exception 'An existing ARC grant has a different identity; review it first.';end if;
 insert into public.bp_arc_reading_grants(assignment_id,member_id,arc_file_id,edition_id,enabled) values(assignment_key,target,3,2,true) on conflict(assignment_id) do update set enabled=true;
 insert into public.bp_arc_reading_pilots(member_id,enabled) values(target,true) on conflict(member_id) do update set enabled=true;
 insert into public.bp_arc_reading_editions(arc_file_id,edition_id,storage_bucket,storage_path,enabled) select 3,2,storage_bucket,storage_path,true from public.bp_reading_files where edition_id=2 on conflict(arc_file_id) do update set enabled=true;
end $$;
commit;
select p.member_tier,p.is_admin,p.is_arc_member,a.id as assignment_id,a.status,c.title
from public.bp_arc_reading_pilots pilot join public.member_profiles p on p.id=pilot.member_id
join public.arc_file_assignments a on a.member_id=p.id and a.arc_file_id=3
join public.bp_reading_catalog c on c.edition_id=2 where pilot.enabled;
