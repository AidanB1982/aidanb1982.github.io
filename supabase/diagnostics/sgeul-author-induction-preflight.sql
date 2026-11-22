-- Sgeul Author Induction: non-mutating production preflight.
-- Run in Blackwood Publishing Members Access after PR #18's migration.
-- Only pg_catalog/metadata and aggregate counts; no user records are returned.
-- A failed check means investigate BEFORE enabling applications.
-- Does not replace real authenticated JWT testing in a staging project.

with
  tables as (
    select c.relname, c.relrowsecurity
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relkind='r'
      and c.relname in ('sgeul_author_inductions','sgeul_author_profiles')
  ),
  policies as (
    select tablename,policyname,cmd
    from pg_policies
    where schemaname='public'
      and tablename in ('sgeul_author_inductions','sgeul_author_profiles')
  ),
  rules as (
    select 'two private tables exist' as test,
      (select count(*)=2 from tables) as passed
    union all select 'row level security enabled on both',
      (select count(*)=2 from tables where relrowsecurity)
    union all select 'eight expected RLS policies present',
      (select count(*)=8 from policies)
    union all select 'applicant can only read own request policy present',
      exists (select 1 from policies where policyname='sgeul_induction_read_own' and cmd='SELECT')
    union all select 'active admin review policy present',
      exists (select 1 from policies where policyname='sgeul_induction_admin_review' and cmd='UPDATE')
    union all select 'approved author draft policies present',
      exists (select 1 from policies where policyname='sgeul_author_profile_create' and cmd='INSERT')
      and exists (select 1 from policies where policyname='sgeul_author_profile_edit_own' and cmd='UPDATE')
    union all select 'anonymous cannot select induction requests',
      not has_table_privilege('anon','public.sgeul_author_inductions','SELECT')
    union all select 'anonymous cannot select private profiles',
      not has_table_privilege('anon','public.sgeul_author_profiles','SELECT')
    union all select 'anonymous cannot insert applications',
      not has_table_privilege('anon','public.sgeul_author_inductions','INSERT')
    union all select 'anonymous cannot update approvals',
      not has_table_privilege('anon','public.sgeul_author_inductions','UPDATE')
    union all select 'applicant cannot write own review status',
      not has_column_privilege('authenticated','public.sgeul_author_inductions','reviewed_by','UPDATE')
      and not has_column_privilege('authenticated','public.sgeul_author_inductions','reviewed_at','UPDATE')
    union all select 'profile drafts cannot change owner',
      not has_column_privilege('authenticated','public.sgeul_author_profiles','user_id','UPDATE')
    union all select 'review-stamp function not public RPC',
      exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='sgeul_induction_stamp_review'
          and not p.prosecdef
          and not has_function_privilege('anon',p.oid,'EXECUTE')
          and not has_function_privilege('authenticated',p.oid,'EXECUTE'))
    union all select 'review stamping trigger enabled',
      exists (select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
        join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relname='sgeul_author_inductions'
          and t.tgname='sgeul_induction_review_stamp' and t.tgenabled='O')
  )
select test, passed from rules order by test;

-- Aggregate only, safe for a live database.
select
  (select count(*) from public.sgeul_author_inductions) as total_requests,
  (select count(*) from public.sgeul_author_profiles) as total_private_drafts;
