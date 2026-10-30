-- Add to an already deployed ARC pilot. No grant, membership or file is changed.
begin;
create or replace function public.bp_arc_reading_offline_until(p_member_id uuid,p_assignment_id bigint)
returns timestamptz language sql stable security definer set search_path='' as $$
 select least(now()+interval '7 days',coalesce(f.downloads_close_at,now()+interval '7 days'))
 from public.arc_file_assignments a join public.arc_files f on f.id=a.arc_file_id
 where a.id=p_assignment_id and a.member_id=p_member_id and public.bp_arc_reading_check(p_member_id,p_assignment_id);
$$;
revoke all on function public.bp_arc_reading_offline_until(uuid,bigint) from public,anon,authenticated;
grant execute on function public.bp_arc_reading_offline_until(uuid,bigint) to service_role;

create or replace function public.bp_arc_reading_open(p_member_id uuid,p_assignment_id bigint,p_accept_terms boolean default false,p_terms_version text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.arc_file_assignments; f public.arc_files; edition bigint; mapping public.bp_arc_reading_editions; file public.bp_reading_files; issuance public.arc_file_issuances; member_email text;
begin
 select * into a from public.arc_file_assignments where id=p_assignment_id for update;
 if not public.bp_arc_reading_eligible(p_member_id,p_assignment_id) then raise exception 'ARC reading access is unavailable.' using errcode='42501';end if;
 if p_accept_terms then
  if p_terms_version<>'ARC Copyright Terms v1' then raise exception 'Accept the current ARC copyright terms.' using errcode='22023';end if;
  insert into public.bp_arc_reading_acceptances(assignment_id,member_id,terms_version) values(a.id,p_member_id,p_terms_version) on conflict do nothing;
 end if;
 if not exists(select 1 from public.bp_arc_reading_acceptances where assignment_id=a.id and member_id=p_member_id and terms_version='ARC Copyright Terms v1') then raise exception 'Accept the ARC copyright terms before reading.' using errcode='42501';end if;
 select * into f from public.arc_files where id=a.arc_file_id;
 select * into mapping from public.bp_arc_reading_editions where arc_file_id=f.id and enabled;
 edition:=mapping.edition_id;
 select * into file from public.bp_reading_files where edition_id=edition and storage_bucket=mapping.storage_bucket and storage_path=mapping.storage_path;
 if file.edition_id is null or file.storage_bucket<>'bp-reading-editions' or file.file_format<>'epub' or file.access_status not in('admin_testing','published') then raise exception 'The mapped ARC edition is not ready.';end if;
 if not exists(select 1 from public.book_editions where id=edition and format='ebook' and status not in('withdrawn','archived','unavailable')) then raise exception 'The mapped ARC edition is unavailable.';end if;
 select email into member_email from public.member_profiles where id=p_member_id;
 perform pg_advisory_xact_lock(hashtextextended('arc-reading-issuance-'||a.id::text,0));
 select * into issuance from public.create_arc_issuance(a.id,p_member_id,f.id,'epub',member_email,f.slug);
 if issuance.id is null or issuance.member_id<>p_member_id or issuance.assignment_id<>a.id or issuance.arc_file_id<>f.id or issuance.format<>'epub' or nullif(issuance.issuance_code,'') is null then raise exception 'The ARC reference could not be verified.';end if;
 return jsonb_build_object('assignment_id',a.id,'edition_id',edition,'storage_bucket',file.storage_bucket,'storage_path',file.storage_path,'reference',issuance.issuance_code,'offline_until',public.bp_arc_reading_offline_until(p_member_id,a.id));
end $$;
revoke all on function public.bp_arc_reading_open(uuid,bigint,boolean,text) from public,anon,authenticated;
grant execute on function public.bp_arc_reading_open(uuid,bigint,boolean,text) to service_role;

notify pgrst,'reload schema';
commit;
