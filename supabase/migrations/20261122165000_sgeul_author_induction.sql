-- Sgeul author induction foundation (STAGED: do not apply to production automatically).
-- Existing Blackwood Auth, reader entitlements, ARC, author_records and royalties are untouched.
-- Profile drafts are PRIVATE. This does not create public author profiles, grant Author Desk
-- access, accept manuscripts or grant publishing/ebook distribution rights.
--
-- Migration must be owner-reviewed and applied before enabling the Sgeul author UI.
-- Review privacy notice / retention / capacity and complete negative RLS tests first.

begin;

create table public.sgeul_author_inductions (
  user_id uuid primary key references public.member_profiles(id) on delete cascade,
  publishing_name text not null check (char_length(btrim(publishing_name)) between 2 and 100),
  biography text not null check (char_length(btrim(biography)) between 40 and 1200),
  genres text not null default '' check (char_length(genres) <= 180),
  website_url text not null default '' check (
    char_length(website_url) <= 300 and (website_url = '' or website_url ~ '^https://[^[:space:]]+$')
  ),
  motivation text not null check (char_length(btrim(motivation)) between 25 and 1000),
  charter_acknowledged boolean not null check (charter_acknowledged = true),
  privacy_acknowledged boolean not null check (privacy_acknowledged = true),
  status text not null default 'submitted'
    check (status in ('submitted','approved','declined','suspended')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.member_profiles(id),
  constraint sgeul_author_review_consistency check (
    (status='submitted' and reviewed_at is null and reviewed_by is null)
    or (status <> 'submitted' and reviewed_at is not null and reviewed_by is not null)
  )
);

create table public.sgeul_author_profiles (
  user_id uuid primary key references public.sgeul_author_inductions(user_id) on delete cascade,
  publishing_name text not null check (char_length(btrim(publishing_name)) between 2 and 100),
  biography text not null check (char_length(btrim(biography)) between 40 and 1200),
  genres text not null default '' check (char_length(genres) <= 180),
  website_url text not null default '' check (
    char_length(website_url) <= 300 and (website_url = '' or website_url ~ '^https://[^[:space:]]+$')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.sgeul_author_profiles is
  'Private draft of a Sgeul author identity. No public select, publishing entitlement or Author Desk author_records linkage.';

-- Limit writeable columns as well as rows: applicants may NEVER set review decisions,
-- administrator identities, author desk flags or public visibility.
revoke all on public.sgeul_author_inductions, public.sgeul_author_profiles
  from public, anon, authenticated;
grant select on public.sgeul_author_inductions, public.sgeul_author_profiles
  to authenticated;
grant insert (user_id,publishing_name,biography,genres,website_url,motivation,
              charter_acknowledged,privacy_acknowledged)
  on public.sgeul_author_inductions to authenticated;
grant update (status) on public.sgeul_author_inductions to authenticated;
grant insert (user_id,publishing_name,biography,genres,website_url)
  on public.sgeul_author_profiles to authenticated;
grant update (publishing_name,biography,genres,website_url)
  on public.sgeul_author_profiles to authenticated;
grant all on public.sgeul_author_inductions, public.sgeul_author_profiles
  to service_role;

alter table public.sgeul_author_inductions enable row level security;
alter table public.sgeul_author_profiles enable row level security;

create policy sgeul_induction_read_own on public.sgeul_author_inductions
  for select to authenticated using (user_id=(select auth.uid()));
create policy sgeul_induction_admin_read on public.sgeul_author_inductions
  for select to authenticated using (
    exists (select 1 from public.member_profiles p
      where p.id=(select auth.uid()) and p.member_status='active' and p.is_admin=true)
  );
create policy sgeul_induction_apply on public.sgeul_author_inductions
  for insert to authenticated with check (
    user_id=(select auth.uid()) and status='submitted'
    and reviewed_at is null and reviewed_by is null
    and charter_acknowledged=true and privacy_acknowledged=true
    and exists (select 1 from public.member_profiles p
      where p.id=(select auth.uid()) and p.member_status='active')
  );
create policy sgeul_induction_admin_review on public.sgeul_author_inductions
  for update to authenticated using (
    exists (select 1 from public.member_profiles p
      where p.id=(select auth.uid()) and p.member_status='active' and p.is_admin=true)
  ) with check (
    exists (select 1 from public.member_profiles p
      where p.id=(select auth.uid()) and p.member_status='active' and p.is_admin=true)
  );

-- Non-privileged trigger stamps the decision itself and rejects unsafe transitions.
-- Function EXECUTE is revoked: it is not intended as a public RPC endpoint.
create function public.sgeul_induction_stamp_review()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if old.status = new.status then
    raise exception 'Choose a different induction status';
  end if;
  if not (
    (old.status='submitted' and new.status in ('approved','declined'))
    or (old.status='approved' and new.status='suspended')
    or (old.status='suspended' and new.status='approved')
  ) then
    raise exception 'Induction status transition is not permitted';
  end if;
  new.reviewed_at := now();
  new.reviewed_by := (select auth.uid());
  return new;
end;
$$;
revoke all on function public.sgeul_induction_stamp_review() from public,anon,authenticated;
create trigger sgeul_induction_review_stamp
  before update on public.sgeul_author_inductions
  for each row execute function public.sgeul_induction_stamp_review();

create policy sgeul_author_profile_read_own on public.sgeul_author_profiles
  for select to authenticated using (
    user_id=(select auth.uid())
    and exists (select 1 from public.sgeul_author_inductions i
      where i.user_id=(select auth.uid()) and i.status='approved')
  );
create policy sgeul_author_profile_admin_read on public.sgeul_author_profiles
  for select to authenticated using (
    exists (select 1 from public.member_profiles p
      where p.id=(select auth.uid()) and p.member_status='active' and p.is_admin=true)
  );
create policy sgeul_author_profile_create on public.sgeul_author_profiles
  for insert to authenticated with check (
    user_id=(select auth.uid())
    and exists (select 1 from public.sgeul_author_inductions i
      where i.user_id=(select auth.uid()) and i.status='approved')
  );
create policy sgeul_author_profile_edit_own on public.sgeul_author_profiles
  for update to authenticated using (
    user_id=(select auth.uid())
    and exists (select 1 from public.sgeul_author_inductions i
      where i.user_id=(select auth.uid()) and i.status='approved')
  ) with check (
    user_id=(select auth.uid())
    and exists (select 1 from public.sgeul_author_inductions i
      where i.user_id=(select auth.uid()) and i.status='approved')
  );

commit;
