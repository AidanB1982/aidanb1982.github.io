-- Scoped, temporary book access for accepted Sgeul beta testers.
-- No anonymous signups/writes, paid records, ARC grants or public launch changes.
begin;
create table if not exists public.bp_reading_beta_grants (
 user_id uuid not null references public.member_profiles(id) on delete cascade,
 edition_id bigint not null references public.bp_reading_catalog(edition_id) on delete restrict,
 cohort text not null check(length(cohort) between 1 and 100),
 access_until timestamptz not null,
 revoked_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(user_id,edition_id)
);
alter table public.bp_reading_beta_grants enable row level security;
revoke all on public.bp_reading_beta_grants from public,anon,authenticated;
grant all on public.bp_reading_beta_grants to service_role;
create or replace function public.bp_reading_beta_can_read(p_edition_id bigint)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.bp_reading_beta_grants g
  join public.member_profiles p on p.id=g.user_id and p.member_status='active'
  join public.bp_reading_catalog c on c.edition_id=g.edition_id and c.available
  join public.book_editions e on e.id=c.edition_id and e.format='ebook' and e.status not in('withdrawn','archived','unavailable')
  where g.user_id=auth.uid() and g.edition_id=p_edition_id
   and g.revoked_at is null and g.access_until>now()
 );
$$;
revoke all on function public.bp_reading_beta_can_read(bigint) from public,anon;
grant execute on function public.bp_reading_beta_can_read(bigint) to authenticated,service_role;
create or replace function public.bp_reading_can_read(p_edition_id bigint)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists (
  select 1 from public.bp_reading_catalog c
  where c.edition_id=p_edition_id and c.available and (
   exists(select 1 from public.bp_reading_memberships m where m.user_id=auth.uid() and m.revoked_at is null and m.access_until>now())
   or exists(select 1 from public.bp_reading_purchases p where p.user_id=auth.uid() and p.book_id=c.book_id and p.revoked_at is null)
   or public.bp_reading_beta_can_read(p_edition_id)
  )
 );
$$;
revoke all on function public.bp_reading_can_read(bigint) from public,anon;
grant execute on function public.bp_reading_can_read(bigint) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
