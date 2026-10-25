-- Apply after the first two BP Reading migrations.
-- Reading ownership follows public.member_profiles.id, which the existing
-- site matches to the authenticated Supabase user ID. No email matching or
-- administrator flags are created/changed by this migration.
begin;

do $$
begin
  if exists (
    select 1 from (
      select user_id from public.bp_reading_memberships
      union all select user_id from public.bp_reading_purchases
      union all select user_id from public.bp_reading_state
      union all select user_id from public.bp_reading_checkout_intents
    ) readers
    left join public.member_profiles profile on profile.id=readers.user_id
    where profile.id is null
  ) then
    raise exception 'Some BP Reading records have no matching member_profiles row. Link the missing member profiles before applying this migration. No reader data has been deleted.';
  end if;
end;
$$;

alter table public.bp_reading_memberships
  drop constraint bp_reading_memberships_user_id_fkey,
  add constraint bp_reading_memberships_member_profile_fkey
    foreign key(user_id) references public.member_profiles(id) on delete cascade;
alter table public.bp_reading_purchases
  drop constraint bp_reading_purchases_user_id_fkey,
  add constraint bp_reading_purchases_member_profile_fkey
    foreign key(user_id) references public.member_profiles(id) on delete cascade;
alter table public.bp_reading_state
  drop constraint bp_reading_state_user_id_fkey,
  add constraint bp_reading_state_member_profile_fkey
    foreign key(user_id) references public.member_profiles(id) on delete cascade;
alter table public.bp_reading_checkout_intents
  drop constraint bp_reading_checkout_intents_user_id_fkey,
  add constraint bp_reading_checkout_intents_member_profile_fkey
    foreign key(user_id) references public.member_profiles(id) on delete cascade;

commit;
