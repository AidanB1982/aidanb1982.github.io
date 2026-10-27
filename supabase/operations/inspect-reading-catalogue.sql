-- Run this whole file in Supabase SQL Editor. Inspection only: no live table writes.
-- Returns one catalogue_report JSON value. Contact details, customer records,
-- reading notes, payment records and private file paths are not collected.
do $inspect$
declare
  report jsonb;
  source_table text;
  source_rows jsonb;
  selected_fields text[];
begin
  report := jsonb_build_object('expected_titles', '[{"key": "the-black-bothy", "title": "The Black Bothy", "author": "Aidan Blackwood", "aliases": [], "public_recovered_file": false}, {"key": "the-drowned-fjord", "title": "The Drowned Fjord", "author": "Aidan Blackwood", "aliases": [], "public_recovered_file": false}, {"key": "the-erased-archivist", "title": "The Erased Archivist", "author": "Aidan Blackwood", "aliases": [], "public_recovered_file": false}, {"key": "holdfast", "title": "Holdfast", "author": "Aidan Blackwood", "aliases": [], "public_recovered_file": false}, {"key": "dour-hill-house", "title": "Dour Hill House", "author": "Aidan Blackwood", "aliases": [], "public_recovered_file": false}, {"key": "the-scheme", "title": "The Scheme", "author": "Aidan Blackwood", "aliases": [], "public_recovered_file": false}, {"key": "red-streets", "title": "Red Streets", "author": "Aidan Blackwood", "aliases": [], "public_recovered_file": false}, {"key": "corrour-bothy", "title": "Corrour Bothy", "author": "Aidan Blackwood", "aliases": [], "public_recovered_file": false}, {"key": "love-abused", "title": "Love, Abused", "author": "Campbell Stewart", "aliases": [], "public_recovered_file": false}, {"key": "gualachulain-bothy", "title": "Gualachulain", "author": "Aidan Blackwood", "aliases": ["gualachulain", "Gualachulain Bothy"], "public_recovered_file": false}, {"key": "the-crossing", "title": "The Crossing", "author": "Miren Vale", "aliases": [], "public_recovered_file": false}, {"key": "the-red-clad-collector", "title": "The Red-Clad Collector", "author": "Aidan Blackwood", "aliases": [], "public_recovered_file": false}, {"key": "accounting-sole-traders", "title": "Accounting for UK Sole Traders", "author": "Martin Hales", "aliases": [], "public_recovered_file": false}, {"key": "accounting-landlords", "title": "Accounting for UK Landlords", "author": "Martin Hales", "aliases": [], "public_recovered_file": false}, {"key": "camban", "title": "Camban", "author": "Aidan Blackwood", "aliases": [], "public_recovered_file": false}, {"key": "sanare-per-mortem", "title": "Sanare Per Mortem", "author": "Aidan Blackwood", "aliases": ["sanae-per-mortem"], "public_recovered_file": false}, {"key": "the-third-night", "title": "The Third Night", "author": "Aidan Blackwood", "aliases": [], "public_recovered_file": true}, {"key": "the-gatestein-log", "title": "The Gåtestein Log", "author": "Aidan Blackwood", "aliases": [], "public_recovered_file": true}, {"key": "introduction-to-accounts", "title": "Introduction to Accounts", "author": "Martin Hales", "aliases": [], "public_recovered_file": false}, {"key": "staying-an-account", "title": "Staying: An Account", "author": "Miren Vale", "aliases": [], "public_recovered_file": false}, {"key": "the-salt-widow", "title": "The Salt Widow", "author": "Miren Vale", "aliases": [], "public_recovered_file": false}, {"key": "the-orphan-and-the-hollow-tree", "title": "The Orphan and the Hollow Tree", "author": "Miren Vale", "aliases": [], "public_recovered_file": false}, {"key": "before-the-house-closed", "title": "Before the House Closed", "author": "Aidan Blackwood", "aliases": [], "public_recovered_file": false}, {"key": "the-money-reset", "title": "The Money Reset", "author": "Martin Hales", "aliases": [], "public_recovered_file": false}]'::jsonb);
  foreach source_table in array array[
    'book_records','book_editions','book_contributors','author_records',
    'publishing_titles','publishing_editions','bp_reading_titles','bp_reading_catalog','bp_reading_files'
  ] loop
    if to_regclass('public.'||source_table) is null then
      report := report || jsonb_build_object(source_table,jsonb_build_object('exists',false,'rows','[]'::jsonb));
      continue;
    end if;
    selected_fields := case source_table
      when 'book_records' then array['id','title','internal_reference']
      when 'book_editions' then array['id','book_id','format','edition_name','edition_reference','status']
      when 'book_contributors' then array['book_id','author_id','contributor_role','desk_visible']
      when 'author_records' then array['id','publishing_name']
      when 'publishing_titles' then array['id','title','author_name']
      when 'publishing_editions' then array['id','title_id','publishing_title_id','book_id','format','edition_title','isbn','asin']
      when 'bp_reading_titles' then array['book_id','title']
      when 'bp_reading_catalog' then array['edition_id','book_id','title','available']
      when 'bp_reading_files' then array['edition_id','file_format','access_status']
    end;
    execute format('select coalesce(jsonb_agg((select jsonb_object_agg(k,to_jsonb(t)->k) from unnest($1::text[]) as fields(k))),''[]''::jsonb) from public.%I t',source_table)
      into source_rows using selected_fields;
    report := report || jsonb_build_object(source_table,jsonb_build_object('exists',true,'rows',source_rows));
  end loop;
  report := report || jsonb_build_object('table_columns',(
    select jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',data_type,
      'nullable',is_nullable,'default',column_default,'identity',is_identity,'generated',is_generated)
      order by table_name,ordinal_position)
    from information_schema.columns where table_schema='public' and table_name in
      ('book_records','book_editions','book_contributors','author_records','publishing_titles','publishing_editions','bp_reading_files')
  ));
  report := report || jsonb_build_object('table_constraints',(
    select jsonb_agg(jsonb_build_object('table',c.relname,'name',con.conname,'definition',pg_get_constraintdef(con.oid)) order by c.relname,con.conname)
    from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('book_records','book_editions','book_contributors','author_records','publishing_titles','publishing_editions','bp_reading_files')
  ));
  -- Session-local hand-off to the final SELECT; no permanent report table/function.
  perform set_config('blackwood.catalogue_inspection',report::text,false);
end
$inspect$;
select current_setting('blackwood.catalogue_inspection')::jsonb as catalogue_report;
