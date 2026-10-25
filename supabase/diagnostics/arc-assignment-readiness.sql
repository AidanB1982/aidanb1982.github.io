-- Read-only aggregate diagnostic: no recipient addresses, no assignments or emails.
with campaign as (
 select id from public.arc_files where slug='gualachulain'
), team as (
 select p.id,
 exists(select 1 from public.arc_file_assignments a where a.member_id=p.id and a.arc_file_id in (select id from campaign)) as already_assigned,
 exists(select 1 from public.arc_file_assignments a where a.member_id=p.id and nullif(trim(a.application_id),'') is not null) as has_application_reference
 from public.member_profiles p where p.is_arc_member=true and p.member_status='active'
)
select (select count(*) from campaign) as matching_campaigns,
 count(*) as active_arc_team,
 count(*) filter(where already_assigned) as already_assigned_gualachulain,
 count(*) filter(where not already_assigned and has_application_reference) as ready_for_new_assignment,
 count(*) filter(where not already_assigned and not has_application_reference) as missing_application_reference
from team;
