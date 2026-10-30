-- Read-only ARC-reader preparation. No profile, assignment or entitlement changes.
-- Replace the all-zero UUID below with the intended test member's UUID.
-- No email addresses, private Storage paths, issuance codes or file bytes are returned.
with target as (
 select '00000000-0000-0000-0000-000000000000'::uuid as member_id
)
select jsonb_build_object(
 'test_profile',(
  select jsonb_build_object('found',true,'id',p.id,'member_status',p.member_status,
   'member_tier',p.member_tier,'is_arc_member',p.is_arc_member,'is_admin',p.is_admin)
  from public.member_profiles p join target t on t.member_id=p.id
 ),
 'existing_access',jsonb_build_object(
  'active_membership',exists(select 1 from public.bp_reading_memberships m join target t on t.member_id=m.user_id where m.revoked_at is null and m.access_until>now()),
  'gualachulain_purchase',exists(select 1 from public.bp_reading_purchases p join target t on t.member_id=p.user_id join public.bp_reading_titles b on b.book_id=p.book_id where p.revoked_at is null and lower(b.title) like 'gualachulain%')
 ),
 'test_assignments',coalesce((
  select jsonb_agg(jsonb_build_object('id',a.id,'arc_file_id',a.arc_file_id,'status',a.status,'review_due_date',a.review_due_date))
  from public.arc_file_assignments a join target t on t.member_id=a.member_id
 ),'[]'::jsonb),
 'gualachulain_campaigns',coalesce((
  select jsonb_agg(jsonb_build_object('id',f.id,'title',f.title,'slug',f.slug,'is_active',f.is_active,
   'downloads_open_at',f.downloads_open_at,'downloads_close_at',f.downloads_close_at))
  from public.arc_files f where lower(f.title) like 'gualachulain%' or lower(f.slug) like 'gualachulain%'
 ),'[]'::jsonb),
 'gualachulain_reading_editions',coalesce((
  select jsonb_agg(jsonb_build_object('edition_id',c.edition_id,'book_id',c.book_id,'title',c.title,'available',c.available))
  from public.bp_reading_catalog c where lower(c.title) like 'gualachulain%'
 ),'[]'::jsonb),
 'columns',coalesce((
  select jsonb_agg(jsonb_build_object('table',c.table_name,'column',c.column_name,'type',c.data_type,
   'nullable',c.is_nullable,'default',c.column_default,'identity',c.is_identity) order by c.table_name,c.ordinal_position)
  from information_schema.columns c where c.table_schema='public'
   and (c.table_name like 'arc\_%' escape '\' or c.table_name in('bp_reading_files','bp_reading_catalog','bp_reading_state'))
 ),'[]'::jsonb),
 'constraints',coalesce((
  select jsonb_agg(jsonb_build_object('table',r.relname,'name',c.conname,'definition',pg_get_constraintdef(c.oid)) order by r.relname,c.conname)
  from pg_constraint c join pg_class r on r.oid=c.conrelid join pg_namespace n on n.oid=r.relnamespace
  where n.nspname='public' and r.relname like 'arc\_%' escape '\'
 ),'[]'::jsonb),
 'functions',coalesce((
  select jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_arguments(p.oid),'result',pg_get_function_result(p.oid),'definition',pg_get_functiondef(p.oid)) order by p.proname)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prokind='f' and p.proname in('create_arc_issuance','bp_reading_can_read','bp_reading_save_state')
 ),'[]'::jsonb)
) as arc_reading_preflight;
