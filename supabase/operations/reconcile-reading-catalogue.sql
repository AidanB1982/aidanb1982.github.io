-- Owner-authorised catalogue reconciliation and two approved uploads, 27 October 2026.
-- Run the WHOLE file as administrator in Supabase SQL Editor.
-- Generates real IDs, preserves existing records and releases ONLY the two named files.
-- No auth accounts, memberships, payments, commercial identifiers or launch flags are created/changed.
begin;
select pg_advisory_xact_lock(hashtext('bp-reading-catalogue-reconciliation'));

do $preflight$
declare missing text;
begin
  if not exists(select 1 from public.book_records b join public.book_editions e on e.book_id=b.id
    where b.id=4 and lower(btrim(b.title))='the black bothy' and e.id=10 and e.format='ebook') then
    raise exception 'Stopped: confirmed Black Bothy book 4 / ebook 10 do not match this database.';
  end if;
  if not exists(select 1 from storage.buckets where id='bp-reading-editions' and public=false) then
    raise exception 'Stopped: bp-reading-editions must exist and remain private.';
  end if;
  if not exists(select 1 from storage.objects where bucket_id='bp-reading-editions' and name='The_Black_Bothy/The Black Bothy.epub')
    or not exists(select 1 from storage.objects where bucket_id='bp-reading-editions' and name='The_Crossing/The Crossing.epub') then
    raise exception 'Stopped: both approved EPUB objects must exist at the exact supplied paths.';
  end if;
  select string_agg(table_name||'.'||column_name,', ') into missing
  from information_schema.columns where table_schema='public' and is_nullable='NO'
    and column_default is null and is_identity='NO' and is_generated='NEVER' and (
      (table_name='book_records' and column_name not in('internal_reference','title','production_stage')) or
      (table_name='book_editions' and column_name not in('book_id','edition_reference','edition_name','format')) or
      (table_name='publishing_titles' and column_name not in('title','author_name')) or
      (table_name='publishing_editions' and column_name not in('title_id','format')) or
      (table_name='book_contributors' and column_name not in('book_id','author_id')) or
      (table_name='bp_reading_files' and column_name not in('edition_id','storage_bucket','storage_path','file_format','access_status'))
    );
  if missing is not null then raise exception 'Stopped: unexpected mandatory columns need review: %',missing;end if;
end
$preflight$;

-- Imported explicit IDs can leave identity sequences behind existing rows.
-- Block concurrent table writes during repair; never lower a sequence already ahead.
-- Sequence advances are not rolled back by PostgreSQL; harmless gaps may remain on failure.
lock table public.book_records,public.book_editions,public.book_contributors,public.bp_reading_files
  in share row exclusive mode;
do $identity_sequences$
declare target_table text;sequence_name text;highest_id bigint;sequence_value bigint;
begin
  foreach target_table in array array['book_records','book_editions','book_contributors','bp_reading_files'] loop
    if not exists(select 1 from information_schema.columns where table_schema='public' and table_name=target_table and column_name='id') then continue;end if;
    sequence_name:=pg_get_serial_sequence(format('public.%I',target_table),'id');
    if sequence_name is null then continue;end if;
    execute format('select max(id) from public.%I',target_table) into highest_id;
    execute format('select last_value from %s',sequence_name::regclass) into sequence_value;
    if highest_id is not null and highest_id>=sequence_value then
      perform setval(sequence_name::regclass,highest_id,true);
    end if;
  end loop;
end
$identity_sequences$;

-- Internal crosswalk only. IDs from the UUID inventory are never used as numeric ebook IDs.
create table if not exists public.bp_reading_catalogue_links(
  catalogue_key text primary key,
  title text not null,
  author_name text not null,
  book_id bigint not null unique references public.book_records(id) on delete restrict,
  publishing_title_id uuid not null unique references public.publishing_titles(id) on delete restrict,
  edition_id bigint unique references public.book_editions(id) on delete restrict,
  public_text boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.bp_reading_catalogue_links enable row level security;
revoke all on public.bp_reading_catalogue_links from public,anon,authenticated;
grant all on public.bp_reading_catalogue_links to service_role;

create temporary table bp_catalogue_seed(
  catalogue_key text primary key,title text not null,author_name text not null,
  match_keys text[] not null,series text not null,series_order numeric,cover_url text not null,
  public_text boolean not null,inventory_id uuid
) on commit drop;
insert into bp_catalogue_seed
select value->>'key',value->>'title',value->>'author',
  array(select distinct lower(regexp_replace(name,'[^[:alnum:]]','','g'))
    from unnest(array[value->>'key',value->>'title']||array(select jsonb_array_elements_text(value->'aliases'))) names(name)),
  value->>'series',nullif(value->>'series_order','')::numeric,value->>'cover',(value->>'public_file')::boolean,null
from jsonb_array_elements('[{"key": "the-black-bothy", "title": "The Black Bothy", "author": "Aidan Blackwood", "aliases": [], "series": "The Archive Files", "series_order": 1, "cover": "/assets/book3.jpg", "public_file": false}, {"key": "the-drowned-fjord", "title": "The Drowned Fjord", "author": "Aidan Blackwood", "aliases": [], "series": "The Archive Files", "series_order": 2, "cover": "/assets/book4.jpg", "public_file": false}, {"key": "the-erased-archivist", "title": "The Erased Archivist", "author": "Aidan Blackwood", "aliases": [], "series": "The Archive Files", "series_order": 3, "cover": "/assets/book5.jpg", "public_file": false}, {"key": "holdfast", "title": "Holdfast", "author": "Aidan Blackwood", "aliases": [], "series": "The Archive Files", "series_order": 4, "cover": "/assets/book6.jpg", "public_file": false}, {"key": "dour-hill-house", "title": "Dour Hill House", "author": "Aidan Blackwood", "aliases": [], "series": "Independent Works", "series_order": null, "cover": "/assets/book1.jpg", "public_file": false}, {"key": "the-scheme", "title": "The Scheme", "author": "Aidan Blackwood", "aliases": [], "series": "Hard Silence", "series_order": 1, "cover": "/assets/book9.png", "public_file": false}, {"key": "red-streets", "title": "Red Streets", "author": "Aidan Blackwood", "aliases": [], "series": "Hard Silence", "series_order": 2, "cover": "/assets/book10.jpg", "public_file": false}, {"key": "corrour-bothy", "title": "Corrour Bothy", "author": "Aidan Blackwood", "aliases": [], "series": "The Cursed Bothies", "series_order": 1, "cover": "/assets/book2.jpg", "public_file": false}, {"key": "love-abused", "title": "Love, Abused", "author": "Campbell Stewart", "aliases": [], "series": "Independent Works", "series_order": null, "cover": "/assets/book15.jpg", "public_file": false}, {"key": "gualachulain-bothy", "title": "Gualachulain", "author": "Aidan Blackwood", "aliases": ["gualachulain", "Gualachulain Bothy", "Gualachulain Bothy: The Second Silence"], "series": "The Cursed Bothies", "series_order": 2, "cover": "/assets/book7.png", "public_file": false}, {"key": "the-crossing", "title": "The Crossing", "author": "Miren Vale", "aliases": [], "series": "Independent Works", "series_order": null, "cover": "/assets/book16.jpg", "public_file": false}, {"key": "the-red-clad-collector", "title": "The Red-Clad Collector", "author": "Aidan Blackwood", "aliases": [], "series": "Independent Works", "series_order": null, "cover": "/assets/book11.png", "public_file": false}, {"key": "accounting-sole-traders", "title": "Accounting for UK Sole Traders", "author": "Martin Hales", "aliases": [], "series": "Practical Guides", "series_order": null, "cover": "/assets/book14.jpg", "public_file": false}, {"key": "accounting-landlords", "title": "Accounting for UK Landlords", "author": "Martin Hales", "aliases": [], "series": "Practical Guides", "series_order": null, "cover": "/assets/book19.jpg", "public_file": false}, {"key": "camban", "title": "Camban", "author": "Aidan Blackwood", "aliases": ["Camban Bothy"], "series": "The Cursed Bothies", "series_order": 3, "cover": "/assets/book8.jpg", "public_file": false}, {"key": "sanare-per-mortem", "title": "Sanare Per Mortem", "author": "Aidan Blackwood", "aliases": ["sanae-per-mortem"], "series": "Independent Works", "series_order": null, "cover": "/assets/book12.jpg", "public_file": false}, {"key": "the-third-night", "title": "The Third Night", "author": "Aidan Blackwood", "aliases": [], "series": "Recovered Files", "series_order": null, "cover": "/assets/TheThirdNight.png", "public_file": true}, {"key": "the-gatestein-log", "title": "The Gåtestein Log", "author": "Aidan Blackwood", "aliases": [], "series": "Recovered Files", "series_order": null, "cover": "/assets/Gatestein.jpg", "public_file": true}, {"key": "introduction-to-accounts", "title": "Introduction to Accounts", "author": "Martin Hales", "aliases": ["Introduction to Accounts: Your Go-To Guide to Accounting Terms, What They Mean and Why We Use Them"], "series": "Practical Guides", "series_order": null, "cover": "/assets/book18.jpg", "public_file": false}, {"key": "staying-an-account", "title": "Staying: An Account", "author": "Miren Vale", "aliases": [], "series": "Independent Works", "series_order": null, "cover": "/assets/book12.jpg", "public_file": false}, {"key": "the-salt-widow", "title": "The Salt Widow", "author": "Miren Vale", "aliases": [], "series": "The Hollowing Veil", "series_order": null, "cover": "/assets/book12.jpg", "public_file": false}, {"key": "the-orphan-and-the-hollow-tree", "title": "The Orphan and the Hollow Tree", "author": "Miren Vale", "aliases": [], "series": "The Hollowing Veil", "series_order": 1, "cover": "/assets/book12.jpg", "public_file": false}, {"key": "before-the-house-closed", "title": "Before the House Closed", "author": "Aidan Blackwood", "aliases": [], "series": "Independent Works", "series_order": null, "cover": "/assets/book20.png", "public_file": false}, {"key": "the-money-reset", "title": "The Money Reset", "author": "Martin Hales", "aliases": [], "series": "Practical Guides", "series_order": null, "cover": "/assets/book17.png", "public_file": false}]'::jsonb);

-- Include existing inventory-only works, without merging similarly named Corrour records.
do $inventory$
declare entry record;seed_key text;match_count integer;keys text[];
begin
  for entry in select id,title,author_name from public.publishing_titles order by title,id loop
    if lower(regexp_replace(entry.title,'[^[:alnum:]]','','g'))='blackwoodmanuscriptauditworkbook' then continue;end if;
    select count(*),min(catalogue_key) into match_count,seed_key from bp_catalogue_seed
      where lower(regexp_replace(entry.title,'[^[:alnum:]]','','g'))=any(match_keys);
    if match_count>1 then raise exception 'Stopped: inventory title matches multiple catalogue works: %',entry.title;end if;
    if match_count=1 then
      if exists(select 1 from bp_catalogue_seed where catalogue_key=seed_key and inventory_id is not null and inventory_id<>entry.id) then
        raise exception 'Stopped: duplicate inventory titles need review: %',entry.title;
      end if;
      update bp_catalogue_seed set inventory_id=entry.id where catalogue_key=seed_key;
    else
      keys:=array[lower(regexp_replace(entry.title,'[^[:alnum:]]','','g'))];
      -- The supplied report has an existing Corrour record separate from Corrour Bothy.
      if keys[1]='corrourthefirstsummoning' then keys:=keys||array['corrour'];end if;
      insert into bp_catalogue_seed values('legacy-'||entry.id::text,entry.title,entry.author_name,keys,
        'Other Blackwood Works',null,'/assets/book12.jpg',false,entry.id);
    end if;
  end loop;
end
$inventory$;

do $reconcile$
declare
  item record;linked record;book_key bigint;ebook_key bigint;inventory_key uuid;
  author_key uuid;reading_key text;matches integer;actual_name text;file_path text;
begin
  for item in select * from bp_catalogue_seed order by catalogue_key loop
    book_key:=null;ebook_key:=null;inventory_key:=item.inventory_id;author_key:=null;reading_key:=null;
    select * into linked from public.bp_reading_catalogue_links where catalogue_key=item.catalogue_key;
    if found then
      book_key:=linked.book_id;ebook_key:=linked.edition_id;
      if inventory_key is not null and inventory_key<>linked.publishing_title_id then
        raise exception 'Stopped: the inventory mapping changed for %',item.title;
      end if;
      inventory_key:=linked.publishing_title_id;
      if not exists(select 1 from public.book_records b where b.id=book_key
        and lower(regexp_replace(b.title,'[^[:alnum:]]','','g'))=any(item.match_keys)) then
        raise exception 'Stopped: mapped book identity/title needs review for %',item.title;
      end if;
    end if;
    if inventory_key is null then
      insert into public.publishing_titles(title,author_name) values(item.title,item.author_name) returning id into inventory_key;
    else
      select author_name into actual_name from public.publishing_titles where id=inventory_key;
      if lower(btrim(actual_name))<>lower(btrim(item.author_name)) and not
        (item.catalogue_key='gualachulain-bothy' and lower(btrim(actual_name))='blackwood') then
        raise exception 'Stopped: author mismatch in existing inventory for %',item.title;
      end if;
    end if;
    if book_key is null then
      select count(*),min(b.id) into matches,book_key from public.book_records b
        where lower(regexp_replace(b.title,'[^[:alnum:]]','','g'))=any(item.match_keys);
      if matches>1 then raise exception 'Stopped: multiple Book Records match %. No automatic merge is safe.',item.title;end if;
      if matches=0 then
        insert into public.book_records(internal_reference,title,production_stage)
          values('BP-READING-'||upper(item.catalogue_key),item.title,'pre_publication') returning id into book_key;
      end if;
    end if;
    if exists(select 1 from public.bp_reading_catalogue_links l where l.book_id=book_key and l.catalogue_key<>item.catalogue_key) then
      raise exception 'Stopped: two catalogue entries resolve to the same existing book: %',item.title;
    end if;

    -- Reuse a verified author identity only; never invent an auth UUID or use Aidan for another author.
    select count(*) into matches from public.author_records where lower(btrim(publishing_name))=lower(btrim(item.author_name));
    if matches>1 then raise exception 'Stopped: multiple Author Desk identities match %',item.author_name;end if;
    if matches=1 then
      select id into author_key from public.author_records where lower(btrim(publishing_name))=lower(btrim(item.author_name));
      if exists(select 1 from public.book_contributors where book_id=book_key and contributor_role='author' and author_id<>author_key) then
        raise exception 'Stopped: an existing different author owns %; review the contributor mapping.',item.title;
      end if;
      insert into public.book_contributors(book_id,author_id) values(book_key,author_key)
        on conflict(book_id,author_id,contributor_role) do nothing;
    end if;

    if not item.public_text then
      if ebook_key is null then
        select count(*),min(e.id) into matches,ebook_key from public.book_editions e where e.book_id=book_key and e.format='ebook';
        if matches>1 then raise exception 'Stopped: multiple EPUB editions match %. Choose the real reading edition first.',item.title;end if;
        if matches=0 then
          insert into public.book_editions(book_id,edition_reference,edition_name,format)
            values(book_key,'BP-READING-'||upper(item.catalogue_key)||'-EPUB','EPUB reading edition','ebook') returning id into ebook_key;
        end if;
      elsif not exists(select 1 from public.book_editions where id=ebook_key and book_id=book_key and format='ebook') then
        raise exception 'Stopped: existing ebook mapping no longer matches %',item.title;
      end if;
      if not exists(select 1 from public.publishing_editions where title_id=inventory_key and format='ebook') then
        insert into public.publishing_editions(title_id,edition_title,format) values(inventory_key,item.title,'ebook');
      end if;
      select book_id into reading_key from public.bp_reading_catalog where edition_id=ebook_key;
      if reading_key is null then
        select count(*),min(book_id) into matches,reading_key from public.bp_reading_titles t
          where lower(regexp_replace(t.title,'[^[:alnum:]]','','g'))=any(item.match_keys);
        if matches>1 then raise exception 'Stopped: multiple reading identities match %',item.title;end if;
        reading_key:=coalesce(reading_key,book_key::text);
      end if;
      if exists(select 1 from public.bp_reading_titles t where t.book_id=reading_key
        and not lower(regexp_replace(t.title,'[^[:alnum:]]','','g'))=any(item.match_keys)) then
        raise exception 'Stopped: reading identity belongs to another title for %',item.title;
      end if;
      insert into public.bp_reading_titles(book_id,title) values(reading_key,item.title) on conflict(book_id) do nothing;
      insert into public.bp_reading_catalog(edition_id,book_id,title,author,cover_url,series,series_order,available)
        values(ebook_key,reading_key,item.title,item.author_name,item.cover_url,item.series,item.series_order,false)
        on conflict(edition_id) do nothing;
    end if;

    insert into public.bp_reading_catalogue_links(catalogue_key,title,author_name,book_id,publishing_title_id,edition_id,public_text)
      values(item.catalogue_key,item.title,item.author_name,book_key,inventory_key,ebook_key,item.public_text)
      on conflict(catalogue_key) do update set title=excluded.title,author_name=excluded.author_name,updated_at=now();

    file_path:=case item.catalogue_key when 'the-black-bothy' then 'The_Black_Bothy/The Black Bothy.epub'
      when 'the-crossing' then 'The_Crossing/The Crossing.epub' else null end;
    if file_path is not null then
      if item.catalogue_key='the-black-bothy' and (book_key<>4 or ebook_key<>10) then
        raise exception 'Stopped: the confirmed Black Bothy identity changed.';
      end if;
      if exists(select 1 from public.book_editions where id=ebook_key and status in('withdrawn','archived','unavailable')) then
        raise exception 'Stopped: the approved edition is withdrawn or unavailable: %',item.title;
      end if;
      insert into public.bp_reading_files(edition_id,storage_bucket,storage_path,file_format,access_status)
        values(ebook_key,'bp-reading-editions',file_path,'epub','admin_testing')
        on conflict(edition_id) do update set storage_bucket=excluded.storage_bucket,storage_path=excluded.storage_path,
          file_format=excluded.file_format,access_status=excluded.access_status,updated_at=now();
      update public.bp_reading_catalog set available=true where edition_id=ebook_key;
      insert into public.bp_reading_releases(edition_id,storage_bucket,storage_path,enabled)
        values(ebook_key,'bp-reading-editions',file_path,true)
        on conflict(edition_id) do update set storage_bucket=excluded.storage_bucket,storage_path=excluded.storage_path,enabled=true,approved_at=now();
    end if;
  end loop;
end
$reconcile$;
commit;

select l.title,l.author_name,l.book_id,l.edition_id,l.publishing_title_id,
  case when l.public_text then 'public_text' when coalesce(c.available,false) and coalesce(r.enabled,false) then 'released' else 'planned' end as reading_status,
  case when exists(select 1 from public.author_records a where lower(btrim(a.publishing_name))=lower(btrim(l.author_name)))
    then 'existing author identity' else 'author identity not created; no access granted' end as author_link_status
from public.bp_reading_catalogue_links l
left join public.bp_reading_catalog c on c.edition_id=l.edition_id
left join public.bp_reading_releases r on r.edition_id=l.edition_id
order by l.title;
