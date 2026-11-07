-- Behind the Files: one editor, public updates and genuinely member-only updates.
-- No legacy dispatch body is embedded here. Import existing posts separately.
begin;

create table if not exists public.bp_dispatches (
  id text primary key default ('bfa-' || gen_random_uuid()::text)
    check (id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'),
  title text not null check (length(trim(title)) between 1 and 200),
  category text not null default 'Weekly Dispatch'
    check (length(trim(category)) between 1 and 100),
  excerpt text not null default '' check (length(excerpt) <= 1500),
  body text not null check (length(trim(body)) between 1 and 50000),
  image_url text not null default '/assets/ArchiveFilesBG.png'
    check (length(image_url) <= 2000 and
      (image_url = '' or image_url ~ '^(/assets/|https://)' ) and
      image_url !~ E'[\\n\\r]'),
  audience text not null default 'members' check (audience in ('public', 'members')),
  published boolean not null default false,
  pinned boolean not null default false,
  published_at timestamptz not null default now() check (isfinite(published_at)),
  revision bigint not null default 1 check (revision > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.bp_dispatches is
  'Plain-text dispatches. Published public posts are readable by everyone; published members posts require a confirmed active non-banned member. Drafts are administrator-only.';
create index if not exists bp_dispatches_feed_idx
  on public.bp_dispatches (pinned desc, published_at desc) where published;

-- These helpers answer only for the caller; there is no arbitrary-user argument.
create or replace function public.bp_dispatch_is_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.member_profiles p join auth.users u on u.id = p.id
    where p.id = auth.uid() and p.member_status = 'active'
      and u.email_confirmed_at is not null
      and (u.banned_until is null or u.banned_until <= now())
  );
$$;
create or replace function public.bp_dispatch_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.bp_dispatch_is_member() and exists (
    select 1 from public.member_profiles p
    where p.id = auth.uid() and p.is_admin = true
  );
$$;
revoke all on function public.bp_dispatch_is_member() from public, anon;
revoke all on function public.bp_dispatch_is_admin() from public, anon;
grant execute on function public.bp_dispatch_is_member() to authenticated, service_role;
grant execute on function public.bp_dispatch_is_admin() to authenticated, service_role;

alter table public.bp_dispatches enable row level security;
revoke all on public.bp_dispatches from public, anon, authenticated;
-- Do not expose the internal creator's Auth UUID to anonymous readers.
grant select (id, title, category, excerpt, body, image_url, audience, published,
  pinned, published_at, revision, created_at, updated_at)
  on public.bp_dispatches to anon;
grant select on public.bp_dispatches to authenticated;
grant all on public.bp_dispatches to service_role;

drop policy if exists bp_dispatch_public_read on public.bp_dispatches;
create policy bp_dispatch_public_read on public.bp_dispatches
  for select to anon, authenticated
  using (audience = 'public' and published and published_at <= now());
drop policy if exists bp_dispatch_member_read on public.bp_dispatches;
create policy bp_dispatch_member_read on public.bp_dispatches
  for select to authenticated
  using (audience = 'members' and published and published_at <= now()
    and public.bp_dispatch_is_member());
drop policy if exists bp_dispatch_admin_read on public.bp_dispatches;
create policy bp_dispatch_admin_read on public.bp_dispatches
  for select to authenticated using (public.bp_dispatch_is_admin());

create or replace function public.bp_dispatch_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.bp_dispatch_touch() from public, anon, authenticated;
drop trigger if exists bp_dispatch_touch on public.bp_dispatches;
create trigger bp_dispatch_touch before update on public.bp_dispatches
  for each row execute function public.bp_dispatch_touch();

create or replace function public.bp_dispatch_save(
  p_payload jsonb,
  p_expected_revision bigint default null
)
returns public.bp_dispatches language plpgsql security definer set search_path = '' as $$
declare
  previous public.bp_dispatches;
  result public.bp_dispatches;
  target_id text;
  target_title text;
  target_category text;
  target_excerpt text;
  target_body text;
  target_image text;
  target_audience text;
  target_published boolean;
  target_pinned boolean;
  target_date timestamptz;
begin
  if not public.bp_dispatch_is_admin() then
    raise exception 'Active administrator access is required.' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or octet_length(p_payload::text) > 225000 then
    raise exception 'Provide a valid dispatch object.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(p_payload) k where k not in (
    'id', 'title', 'category', 'excerpt', 'body', 'image_url', 'audience',
    'published', 'pinned', 'published_at'
  )) then
    raise exception 'The dispatch contains unsupported fields.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_each(p_payload) v where v.key in (
    'id', 'title', 'category', 'excerpt', 'body', 'image_url', 'audience', 'published_at'
  ) and jsonb_typeof(v.value) not in ('string', 'null')) then
    raise exception 'Dispatch text fields must be strings.' using errcode = '22023';
  end if;
  if (p_payload ? 'published' and jsonb_typeof(p_payload->'published') <> 'boolean')
     or (p_payload ? 'pinned' and jsonb_typeof(p_payload->'pinned') <> 'boolean') then
    raise exception 'Published and pinned must be true or false.' using errcode = '22023';
  end if;
  if p_expected_revision is not null and p_expected_revision < 0 then
    raise exception 'Invalid dispatch revision.' using errcode = '22023';
  end if;

  target_id := coalesce(nullif(trim(p_payload->>'id'), ''), 'bfa-' || gen_random_uuid()::text);
  target_title := trim(coalesce(p_payload->>'title', ''));
  target_category := trim(coalesce(p_payload->>'category', 'Weekly Dispatch'));
  target_excerpt := coalesce(p_payload->>'excerpt', '');
  target_body := coalesce(p_payload->>'body', '');
  target_image := trim(coalesce(p_payload->>'image_url', '/assets/ArchiveFilesBG.png'));
  target_audience := coalesce(p_payload->>'audience', 'members');
  target_published := coalesce((p_payload->>'published')::boolean, false);
  target_pinned := coalesce((p_payload->>'pinned')::boolean, false);
  if target_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'
     or length(target_title) not between 1 and 200
     or length(target_category) not between 1 and 100
     or length(target_excerpt) > 1500
     or length(trim(target_body)) not between 1 and 50000
     or length(target_image) > 2000
     or (target_image <> '' and target_image !~ '^(/assets/|https://)')
     or target_image ~ E'[\\n\\r]'
     or target_audience not in ('public', 'members') then
    raise exception 'Check the title, body, image and audience fields.' using errcode = '22023';
  end if;

  select * into previous from public.bp_dispatches where id = target_id for update;
  if found then
    if p_expected_revision is null or p_expected_revision <> previous.revision then
      raise exception 'This dispatch changed. Reload before editing.' using errcode = '40001';
    end if;
  elsif p_expected_revision is not null and p_expected_revision <> 0 then
    raise exception 'This dispatch no longer exists. Reload before editing.' using errcode = '40001';
  end if;
  begin
    target_date := coalesce(nullif(p_payload->>'published_at', '')::timestamptz,
      previous.published_at, now());
  exception when others then
    raise exception 'Choose a valid publication date.' using errcode = '22023';
  end;
  if not isfinite(target_date) or (target_published and target_date > now()) then
    raise exception 'Published updates need today or an earlier publication date.' using errcode = '22023';
  end if;

  if previous.id is null then
    begin
      insert into public.bp_dispatches (id, title, category, excerpt, body,
        image_url, audience, published, pinned, published_at, created_by)
      values (target_id, target_title, target_category, target_excerpt, target_body,
        target_image, target_audience, target_published, target_pinned, target_date, auth.uid())
      returning * into result;
    exception when unique_violation then
      raise exception 'This dispatch was already saved. Reload before editing.' using errcode = '40001';
    end;
  else
    update public.bp_dispatches set title = target_title, category = target_category,
      excerpt = target_excerpt, body = target_body, image_url = target_image,
      audience = target_audience, published = target_published, pinned = target_pinned,
      published_at = target_date
    where id = target_id returning * into result;
  end if;
  return result;
end;
$$;
revoke all on function public.bp_dispatch_save(jsonb, bigint) from public, anon;
grant execute on function public.bp_dispatch_save(jsonb, bigint) to authenticated;

notify pgrst, 'reload schema';
commit;
