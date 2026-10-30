begin;
-- Issuance is already called by legacy delivery Edge Functions with service credentials.
-- Keep its identity/email-bearing records behind those verified server calls.
revoke all on function public.create_arc_issuance(bigint,uuid,bigint,text,text,text) from public,anon,authenticated;
grant execute on function public.create_arc_issuance(bigint,uuid,bigint,text,text,text) to service_role;
-- Explicit per-reader pilot and per-campaign edition mapping; no team-wide grants.
create table public.bp_arc_reading_pilots(member_id uuid primary key references public.member_profiles(id),enabled boolean not null default false);
create table public.bp_arc_reading_editions(arc_file_id bigint primary key references public.arc_files(id),edition_id bigint not null references public.bp_reading_catalog(edition_id),storage_bucket text not null check(storage_bucket='bp-reading-editions'),storage_path text not null check(length(trim(storage_path))>0),enabled boolean not null default false);
create table public.bp_arc_reading_grants(assignment_id bigint primary key references public.arc_file_assignments(id) on delete cascade,member_id uuid not null references public.member_profiles(id),arc_file_id bigint not null references public.arc_files(id),edition_id bigint not null references public.bp_reading_catalog(edition_id),enabled boolean not null default false);
create table public.bp_arc_reading_acceptances(assignment_id bigint not null references public.arc_file_assignments(id),member_id uuid not null references public.member_profiles(id),terms_version text not null,accepted_at timestamptz not null default now(),primary key(assignment_id,member_id,terms_version));
create table public.bp_arc_reading_activity(assignment_id bigint primary key references public.arc_file_assignments(id),member_id uuid not null references public.member_profiles(id),open_count bigint not null default 0,last_opened_at timestamptz);
alter table public.bp_arc_reading_grants enable row level security;
alter table public.bp_arc_reading_pilots enable row level security;
alter table public.bp_arc_reading_editions enable row level security;
alter table public.bp_arc_reading_acceptances enable row level security;
alter table public.bp_arc_reading_activity enable row level security;
revoke all on public.bp_arc_reading_pilots,public.bp_arc_reading_editions,public.bp_arc_reading_acceptances,public.bp_arc_reading_activity,public.bp_arc_reading_grants from public,anon,authenticated;
grant all on public.bp_arc_reading_pilots,public.bp_arc_reading_editions,public.bp_arc_reading_acceptances,public.bp_arc_reading_activity,public.bp_arc_reading_grants to service_role;

create function public.bp_arc_reading_eligible(p_member_id uuid,p_assignment_id bigint)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.arc_file_assignments a
 join public.bp_arc_reading_grants grant_row on grant_row.assignment_id=a.id and grant_row.member_id=a.member_id and grant_row.arc_file_id=a.arc_file_id and grant_row.enabled
 join public.member_profiles p on p.id=a.member_id
 join public.bp_arc_reading_pilots pilot on pilot.member_id=p.id and pilot.enabled
 join public.arc_files f on f.id=a.arc_file_id
 join public.bp_arc_reading_editions m on m.arc_file_id=f.id and m.edition_id=grant_row.edition_id and m.enabled
 join public.bp_reading_files registry on registry.edition_id=m.edition_id and registry.storage_bucket='bp-reading-editions' and registry.file_format='epub' and registry.access_status in('admin_testing','published') and registry.storage_bucket=m.storage_bucket and registry.storage_path=m.storage_path
 join public.book_editions edition on edition.id=m.edition_id and edition.format='ebook' and edition.status not in('withdrawn','archived','unavailable')
 where p.id=p_member_id and p.member_status='active' and p.is_arc_member
 and a.id=p_assignment_id and a.status='reader_active' and f.is_active
 and exists(select 1 from storage.buckets where id='bp-reading-editions' and public=false)
 and (f.downloads_open_at is null or f.downloads_open_at<=now())
 and (f.downloads_close_at is null or f.downloads_close_at>now()));
$$;
revoke all on function public.bp_arc_reading_eligible(uuid,bigint) from public,anon,authenticated;
grant execute on function public.bp_arc_reading_eligible(uuid,bigint) to service_role;

create function public.bp_arc_reading_check(p_member_id uuid,p_assignment_id bigint)
returns boolean language sql stable security definer set search_path='' as $$
 select public.bp_arc_reading_eligible(p_member_id,p_assignment_id) and exists(select 1 from public.bp_arc_reading_acceptances where assignment_id=p_assignment_id and member_id=p_member_id and terms_version='ARC Copyright Terms v1');
$$;
revoke all on function public.bp_arc_reading_check(uuid,bigint) from public,anon,authenticated;
grant execute on function public.bp_arc_reading_check(uuid,bigint) to service_role;

create function public.bp_arc_reading_catalogue()
returns table(assignment_id bigint,edition_id bigint,book_id text,title text,author text,cover_url text,series text,series_order numeric,review_due_date date,review_link text,can_read boolean,terms_accepted boolean)
language sql stable security definer set search_path='' as $$
 select a.id,c.edition_id,c.book_id,c.title,c.author,c.cover_url,c.series,c.series_order,a.review_due_date,a.review_link,public.bp_arc_reading_eligible(auth.uid(),a.id),
 exists(select 1 from public.bp_arc_reading_acceptances t where t.assignment_id=a.id and t.member_id=auth.uid() and t.terms_version='ARC Copyright Terms v1')
 from public.arc_file_assignments a join public.bp_arc_reading_grants grant_row on grant_row.assignment_id=a.id and grant_row.member_id=a.member_id and grant_row.arc_file_id=a.arc_file_id
 join public.bp_arc_reading_editions m on m.arc_file_id=a.arc_file_id and m.edition_id=grant_row.edition_id
 join public.bp_reading_catalog c on c.edition_id=m.edition_id
 where a.member_id=auth.uid() and m.enabled
 and exists(select 1 from public.bp_arc_reading_pilots pilot join public.member_profiles p on p.id=pilot.member_id where pilot.member_id=auth.uid() and pilot.enabled and p.member_status='active' and p.is_arc_member);
$$;
revoke all on function public.bp_arc_reading_catalogue() from public,anon;
grant execute on function public.bp_arc_reading_catalogue() to authenticated;

create function public.bp_arc_reading_open(p_member_id uuid,p_assignment_id bigint,p_accept_terms boolean default false,p_terms_version text default '')
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
 return jsonb_build_object('assignment_id',a.id,'edition_id',edition,'storage_bucket',file.storage_bucket,'storage_path',file.storage_path,'reference',issuance.issuance_code);
end $$;
revoke all on function public.bp_arc_reading_open(uuid,bigint,boolean,text) from public,anon,authenticated;
grant execute on function public.bp_arc_reading_open(uuid,bigint,boolean,text) to service_role;

create function public.bp_arc_reading_record_open(p_member_id uuid,p_assignment_id bigint)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not public.bp_arc_reading_check(p_member_id,p_assignment_id) then return false;end if;
 insert into public.bp_arc_reading_activity(assignment_id,member_id,open_count,last_opened_at) values(p_assignment_id,p_member_id,1,now())
 on conflict(assignment_id) do update set open_count=public.bp_arc_reading_activity.open_count+1,last_opened_at=now();
 return true;
end $$;
revoke all on function public.bp_arc_reading_record_open(uuid,bigint) from public,anon,authenticated;
grant execute on function public.bp_arc_reading_record_open(uuid,bigint) to service_role;
create function public.bp_arc_reading_review(p_assignment_id bigint,p_review_link text)
returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 if p_review_link is null or length(p_review_link)>2048 or p_review_link !~ '^https://[^[:space:]]+$' then raise exception 'Use a valid HTTPS review link.';end if;
 update public.arc_file_assignments a set review_link=p_review_link,updated_at=now()
 where a.id=p_assignment_id and a.member_id=auth.uid() and a.status='reader_active'
 and exists(select 1 from public.bp_arc_reading_pilots pilot join public.member_profiles p on p.id=pilot.member_id where pilot.member_id=auth.uid() and pilot.enabled and p.member_status='active' and p.is_arc_member);
 get diagnostics changed=row_count;
 if changed<>1 then raise exception 'This ARC review record is unavailable.' using errcode='42501';end if;
 return true;
end $$;
revoke all on function public.bp_arc_reading_review(bigint,text) from public,anon;
grant execute on function public.bp_arc_reading_review(bigint,text) to authenticated;
-- Legacy review update policies must not permit a reader to alter a migrated grant.
create function public.bp_arc_reading_guard_assignment()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if current_setting('role',true) in('authenticated','anon') and exists(select 1 from public.bp_arc_reading_grants where assignment_id=old.id) then
  if (to_jsonb(new)-array['review_link','updated_at']) is distinct from (to_jsonb(old)-array['review_link','updated_at']) then
   raise exception 'ARC reading grants are managed by Blackwood Publishing.' using errcode='42501';
  end if;
  if new.review_link<>'' and (length(new.review_link)>2048 or new.review_link !~ '^https://[^[:space:]]+$') then raise exception 'Use a valid HTTPS review link.';end if;
 end if;
 return new;
end $$;
revoke all on function public.bp_arc_reading_guard_assignment() from public,anon,authenticated;
create trigger bp_arc_reading_assignment_guard before update on public.arc_file_assignments for each row execute function public.bp_arc_reading_guard_assignment();
notify pgrst,'reload schema';
commit;
