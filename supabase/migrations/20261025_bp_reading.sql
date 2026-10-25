-- BP Reading: catalogue, access records and private reader state.
-- Review in a Supabase staging project before applying to production.
-- This does NOT enable public EPUB delivery or create payment entitlements.
begin;

create table public.bp_reading_titles (
  book_id text primary key check (length(book_id) between 1 and 100),
  title text not null check (length(title) between 1 and 300)
);

create table public.bp_reading_catalog (
  edition_id bigint primary key check (edition_id > 0),
  book_id text not null references public.bp_reading_titles(book_id) on delete restrict,
  title text not null check (length(title) between 1 and 300),
  author text not null default '',
  description text not null default '',
  cover_url text not null default '',
  series text not null default '',
  series_order numeric,
  available boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.bp_reading_catalog is 'Approved reading editions. edition_id must match the protected delivery service; never put storage paths or signed URLs here.';

-- An explicit customer release never changes the existing registry schema or
-- automatically publishes admin-testing files. Approval pins the exact private path.
create table public.bp_reading_releases (
  edition_id bigint primary key references public.bp_reading_catalog(edition_id) on delete restrict,
  storage_bucket text not null check (storage_bucket = 'bp-reading-editions'),
  storage_path text not null check (length(trim(storage_path)) > 0),
  enabled boolean not null default false,
  approved_at timestamptz not null default now()
);
alter table public.bp_reading_releases enable row level security;
revoke all on public.bp_reading_releases from anon, authenticated;
grant all on public.bp_reading_releases to service_role;

create table public.bp_reading_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_until timestamptz not null,
  revoked_at timestamptz,
  payment_reference text unique,
  updated_at timestamptz not null default now()
);
create table public.bp_reading_purchases (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null references public.bp_reading_titles(book_id) on delete restrict,
  purchased_at timestamptz not null default now(),
  revoked_at timestamptz,
  payment_reference text unique,
  primary key (user_id, book_id)
);
comment on table public.bp_reading_purchases is 'Permanent in-reader access independent of membership expiry. Only a verified payment webhook or trusted administrator may grant access.';

create table public.bp_reading_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  edition_id bigint not null references public.bp_reading_catalog(edition_id) on delete restrict,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 400000),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, edition_id)
);

alter table public.bp_reading_titles enable row level security;
alter table public.bp_reading_catalog enable row level security;
alter table public.bp_reading_memberships enable row level security;
alter table public.bp_reading_purchases enable row level security;
alter table public.bp_reading_state enable row level security;

-- Catalogue metadata may be visible to signed-in readers; unpublished titles stay hidden.
create policy bp_reading_titles_read on public.bp_reading_titles for select to authenticated using (exists (select 1 from public.bp_reading_catalog c where c.book_id = bp_reading_titles.book_id and c.available));
create policy bp_reading_catalog_read on public.bp_reading_catalog for select to authenticated using (available);
create policy bp_reading_membership_read on public.bp_reading_memberships for select to authenticated using (user_id = (select auth.uid()));
create policy bp_reading_purchase_read on public.bp_reading_purchases for select to authenticated using (user_id = (select auth.uid()));
create policy bp_reading_state_read on public.bp_reading_state for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.bp_reading_titles, public.bp_reading_catalog, public.bp_reading_memberships, public.bp_reading_purchases, public.bp_reading_state from anon, authenticated;
grant select on public.bp_reading_titles, public.bp_reading_catalog, public.bp_reading_memberships, public.bp_reading_purchases, public.bp_reading_state to authenticated;
grant all on public.bp_reading_titles, public.bp_reading_catalog, public.bp_reading_memberships, public.bp_reading_purchases, public.bp_reading_state to service_role;

-- The delivery function must call this with the requesting user's JWT, not a
-- user ID supplied by the browser. Each delivery request requires a fresh check.
create function public.bp_reading_can_read(p_edition_id bigint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.bp_reading_catalog c
    where c.edition_id = p_edition_id and c.available
    and (
      exists (select 1 from public.bp_reading_memberships m where m.user_id = auth.uid() and m.revoked_at is null and m.access_until > now())
      or exists (select 1 from public.bp_reading_purchases p where p.user_id = auth.uid() and p.book_id = c.book_id and p.revoked_at is null)
    )
  );
$$;
revoke all on function public.bp_reading_can_read(bigint) from public, anon;
grant execute on function public.bp_reading_can_read(bigint) to authenticated;

-- Optimistic concurrency: stale devices cannot silently overwrite newer work.
-- State writes are available only through this bounded, caller-scoped function.
create function public.bp_reading_save_state(p_edition_id bigint, p_payload jsonb, p_expected_revision bigint)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  saved_revision bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text) > 400000 or p_expected_revision < 0 or p_expected_revision is null then
    raise exception 'Invalid reader state' using errcode = '22023';
  end if;
  if not exists (select 1 from public.bp_reading_catalog where edition_id = p_edition_id and available) then
    raise exception 'Reading edition unavailable' using errcode = '42501';
  end if;
  if p_expected_revision = 0 then
    insert into public.bp_reading_state(user_id, edition_id, payload)
    values (auth.uid(), p_edition_id, p_payload)
    on conflict do nothing returning revision into saved_revision;
  else
    update public.bp_reading_state
      set payload = p_payload, revision = revision + 1, updated_at = now()
      where user_id = auth.uid() and edition_id = p_edition_id and revision = p_expected_revision
      returning revision into saved_revision;
  end if;
  if saved_revision is null then raise exception 'Reader state changed on another device' using errcode = '40001'; end if;
  return saved_revision;
end;
$$;
revoke all on function public.bp_reading_save_state(bigint, jsonb, bigint) from public, anon;
grant execute on function public.bp_reading_save_state(bigint, jsonb, bigint) to authenticated;

-- Seed only the existing, known delivery edition. Other books require approved
-- EPUB files, rights checks, and verified delivery IDs before publishing metadata.
insert into public.bp_reading_titles(book_id,title) values ('gualachulain','Gualachulain');
insert into public.bp_reading_catalog(edition_id,book_id,title,author,cover_url,series,series_order,available)
values (2,'gualachulain','Gualachulain','Aidan Blackwood','/assets/book7.png','The Cursed Bothies',2,true);
commit;
