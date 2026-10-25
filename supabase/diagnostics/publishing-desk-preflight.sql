-- Read-only metadata check. This does not read reader/customer records.
select table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public' and (
 (table_name='member_profiles' and column_name in ('id','is_admin','is_arc_member','member_status','email','display_name','reader_name')) or
 (table_name='arc_files' and column_name in ('id','title','author_name','is_active','downloads_open_at','downloads_close_at')) or
 (table_name='arc_file_assignments' and column_name in ('id','member_id','arc_file_id','application_id','status','review_due_date','download_count','review_link','created_at'))
) order by table_name,ordinal_position;
