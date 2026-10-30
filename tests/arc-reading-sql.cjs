const {PGlite}=require('@electric-sql/pglite'),{readFileSync}=require('node:fs'),assert=require('node:assert/strict');
const A='00000000-0000-0000-0000-000000000001',B='00000000-0000-0000-0000-000000000002';
(async()=>{const db=new PGlite();try{
await db.exec(`create role anon;create role authenticated;create role service_role;
create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
create schema storage;create table storage.buckets(id text primary key,public boolean);create table storage.objects(bucket_id text,name text);
create table member_profiles(id uuid primary key,email text,member_status text,member_tier text,is_arc_member boolean,is_admin boolean,updated_at timestamptz default now());
create table book_records(id bigint primary key,title text);create table book_editions(id bigint primary key,book_id bigint,format text,status text);
create table bp_reading_catalog(edition_id bigint primary key,book_id text,title text,author text,cover_url text,series text,series_order numeric,available boolean);
create table bp_reading_files(edition_id bigint primary key,storage_bucket text,storage_path text,file_format text,access_status text);
create table bp_reading_memberships(user_id uuid,access_until timestamptz);
create table arc_files(id bigint primary key,title text,slug text,is_active boolean,downloads_open_at timestamptz,downloads_close_at timestamptz);
create table arc_file_assignments(id bigint generated always as identity primary key,member_id uuid references member_profiles,arc_file_id bigint references arc_files,application_id text not null,status text default 'active',review_due_date date,review_link text default '',download_count int default 0,last_downloaded_at timestamptz,updated_at timestamptz default now(),unique(member_id,arc_file_id,application_id));
create table arc_file_issuances(id bigint generated always as identity primary key,issuance_code text unique,assignment_id bigint references arc_file_assignments,member_id uuid,arc_file_id bigint,format text,email_at_issue text,download_count int default 0);
create function create_arc_issuance(p_assignment_id bigint,p_member_id uuid,p_arc_file_id bigint,p_format text,p_email_at_issue text,p_arc_slug text) returns arc_file_issuances language plpgsql set search_path=public as $$declare issuance arc_file_issuances;begin select * into issuance from arc_file_issuances where assignment_id=p_assignment_id and format=p_format limit 1;if found then return issuance;end if;insert into arc_file_issuances(issuance_code,assignment_id,member_id,arc_file_id,format,email_at_issue)values('GUA-ARC-'||gen_random_uuid()::text,p_assignment_id,p_member_id,p_arc_file_id,p_format,p_email_at_issue)returning * into issuance;return issuance;end$$;
insert into member_profiles values('${A}','a@example.invalid','active','Reader',false,false,now()),('${B}','b@example.invalid','active','Reader',true,false,now());
insert into bp_reading_memberships values('${A}',now()+interval '1 year');
insert into book_records values(1,'Gualachulain');insert into book_editions values(2,1,'ebook','scheduled');
insert into bp_reading_catalog values(2,'gualachulain','Gualachulain','Aidan Blackwood','/assets/book7.png','The Cursed Bothies',2,true);
insert into bp_reading_files values(2,'bp-reading-editions','PRIVATE_MASTER.epub','epub','admin_testing');
insert into arc_files values(3,'Gualachulain','gualachulain',true,now()-interval '1 day',null);
insert into arc_file_assignments(id,member_id,arc_file_id,application_id,status) overriding system value values(80,'${B}',3,'OLD','active');
insert into storage.buckets values('bp-reading-editions',false);insert into storage.objects values('bp-reading-editions','PRIVATE_MASTER.epub');
`);
await db.exec(readFileSync('supabase/migrations/20261030160000_arc_reading_pilot.sql','utf8'));
await db.exec(readFileSync('supabase/migrations/20261030170000_arc_reading_offline.sql','utf8'));await db.exec(readFileSync('supabase/migrations/20261030170000_arc_reading_offline.sql','utf8'));
const operation=readFileSync('supabase/operations/enable-arc-reading-pilot.sql','utf8').replace('00000000-0000-0000-0000-000000000000',A);
await db.exec(operation);await db.exec(operation);
const query=async(sql)=>(await db.query(sql)).rows;
const assignment=(await query(`select * from arc_file_assignments where member_id='${A}'`))[0];assert.equal(assignment.id,81,'lagging imported assignment sequence repaired');assert.equal(assignment.status,'reader_active');assert.equal(assignment.download_count,0);
assert.equal((await query(`select count(*)::int n from arc_file_assignments where member_id='${A}' and status='active'`))[0].n,0,'legacy EPUB active-assignment gate denies migrated record');
assert.equal((await query('select count(*)::int n from bp_reading_memberships'))[0].n,1,'paid history untouched');
const profile=(await query(`select * from member_profiles where id='${A}'`))[0];assert.equal(profile.member_tier,'Reader');assert.equal(profile.is_admin,false);assert.equal(profile.is_arc_member,true);
await db.exec(`set request.jwt.claim.sub='${A}';set role authenticated;`);
let catalogue=await query('select * from bp_arc_reading_catalogue()');assert.equal(catalogue.length,1);assert.equal(catalogue[0].can_read,true);assert.equal(catalogue[0].terms_accepted,false);assert(!JSON.stringify(catalogue).includes('PRIVATE_MASTER'));
await assert.rejects(()=>query(`select create_arc_issuance(81,'${A}',3,'epub','spoof@example.invalid','gualachulain')`),/permission denied/);
await assert.rejects(()=>query(`select bp_arc_reading_open('${A}',81,true,'ARC Copyright Terms v1')`),/permission denied/);
for(const table of ['bp_arc_reading_pilots','bp_arc_reading_editions','bp_arc_reading_activity','bp_arc_reading_acceptances','bp_arc_reading_grants'])await assert.rejects(()=>query('select * from '+table),/permission denied/);
await db.exec('reset role');
await db.exec("grant update on arc_file_assignments to authenticated;grant select on arc_file_assignments to authenticated;set role authenticated;");
await assert.rejects(()=>query("update arc_file_assignments set status='active' where id=81"),/managed by Blackwood/);
await assert.rejects(()=>query("update arc_file_assignments set application_id='forged' where id=81"),/managed by Blackwood/);
await assert.rejects(()=>query("update arc_file_assignments set download_count=99 where id=81"),/managed by Blackwood/);
await assert.rejects(()=>query("update arc_file_assignments set review_link='javascript:alert(1)' where id=81"),/HTTPS/);
await db.exec('reset role');
await assert.rejects(()=>query(`select bp_arc_reading_open('${A}',81,false,'')`),/Accept the ARC/);
await assert.rejects(()=>query(`select bp_arc_reading_open('${A}',81,true,'OLD')`),/current ARC/);
await assert.rejects(()=>query(`select bp_arc_reading_open('${B}',81,true,'ARC Copyright Terms v1')`),/unavailable/);
assert.equal((await query(`select bp_arc_reading_check('${A}',81) ok`))[0].ok,false,'active assignment still requires terms for continued access');
const opened=(await query(`select bp_arc_reading_open('${A}',81,true,'ARC Copyright Terms v1') r`))[0].r;
assert.equal((await query(`select bp_arc_reading_check('${A}',81) ok`))[0].ok,true);
const reopened=(await query(`select bp_arc_reading_open('${A}',81,false,'') r`))[0].r;assert.equal(opened.reference,reopened.reference);assert.equal(opened.edition_id,2);assert(Date.parse(opened.offline_until)>Date.now()+6*86400000);
await db.exec("update arc_files set downloads_close_at=now()+interval '2 days'");
const bounded=(await query(`select bp_arc_reading_open('${A}',81,false,'') r`))[0].r;assert(Date.parse(bounded.offline_until)<=Date.now()+2*86400000);
await db.exec('update arc_files set downloads_close_at=null');
assert.equal((await query('select count(*)::int n from arc_file_issuances'))[0].n,1,'permanent issuance reused');
await query(`select bp_arc_reading_record_open('${A}',81)`);assert.equal((await query('select open_count from bp_arc_reading_activity'))[0].open_count,1);assert.equal((await query(`select download_count from arc_file_assignments where id=81`))[0].download_count,0);
for(const [deny,restore] of [
 ["update bp_arc_reading_grants set enabled=false","update bp_arc_reading_grants set enabled=true"],
 ["update bp_arc_reading_pilots set enabled=false","update bp_arc_reading_pilots set enabled=true"],
 ["update bp_arc_reading_editions set enabled=false","update bp_arc_reading_editions set enabled=true"],
 [`update member_profiles set is_arc_member=false where id='${A}'`,`update member_profiles set is_arc_member=true where id='${A}'`],
 [`update member_profiles set member_status='inactive' where id='${A}'`,`update member_profiles set member_status='active' where id='${A}'`],
 ["update arc_files set downloads_open_at=now()+interval '1 day'","update arc_files set downloads_open_at=null"],
 ["update arc_files set downloads_close_at=now()-interval '1 second'","update arc_files set downloads_close_at=null"],
 ["update arc_files set is_active=false","update arc_files set is_active=true"],
 ["update book_editions set status='withdrawn'","update book_editions set status='scheduled'"],
 ["update bp_reading_files set storage_path='WRONG.epub'","update bp_reading_files set storage_path='PRIVATE_MASTER.epub'"],
 ["update bp_reading_files set access_status='disabled'","update bp_reading_files set access_status='admin_testing'"],
 ["update storage.buckets set public=true","update storage.buckets set public=false"],
 ["update arc_file_assignments set status='revoked' where id=81","update arc_file_assignments set status='reader_active' where id=81"]
]){await db.exec(deny);assert.equal((await query(`select bp_arc_reading_eligible('${A}',81) ok`))[0].ok,false,deny);await assert.rejects(()=>query(`select bp_arc_reading_open('${A}',81,false,'')`),/unavailable/);await db.exec(restore);}
await db.exec(`set request.jwt.claim.sub='${B}';set role authenticated;`);assert.equal((await query('select * from bp_arc_reading_catalogue()')).length,0,'another ARC flag alone grants nothing');await assert.rejects(()=>query("select bp_arc_reading_review(81,'https://example.invalid/review')"),/unavailable/);await db.exec('reset role');
await db.exec(`update arc_files set downloads_close_at=now()-interval '1 second';set request.jwt.claim.sub='${A}';set role authenticated;`);
catalogue=await query('select * from bp_arc_reading_catalogue()');assert.equal(catalogue[0].can_read,false,'closed assignment remains visible as history');
await query("select bp_arc_reading_review(81,'https://example.invalid/review')");await assert.rejects(()=>query("select bp_arc_reading_review(81,'javascript:alert(1)')"),/HTTPS/);await db.exec('reset role');
const rollout=(await query(readFileSync('supabase/operations/arc-reading-rollout-report.sql','utf8')))[0].arc_rollout_report;assert.equal(rollout.changes_made,false);assert(Array.isArray(rollout.campaigns));assert(Array.isArray(rollout.reading_editions));
await db.exec("update arc_files set downloads_close_at=null;insert into arc_files values(1,'The Crossing','the-crossing',false,null,null);insert into arc_file_assignments(member_id,arc_file_id,application_id,status) values('"+B+"',1,'OLD','active');update arc_file_assignments set review_link='https://example.invalid/retained',download_count=4 where id=80");
const team=readFileSync('supabase/operations/migrate-gualachulain-arc-team.sql','utf8');
await db.exec("update member_profiles set is_arc_member=false where id='"+B+"'");await assert.rejects(()=>db.exec(team),/profile needs review/);await db.exec('rollback');assert.equal((await query('select status from arc_file_assignments where id=80'))[0].status,'active','failed batch changes no assignments');await db.exec("update member_profiles set is_arc_member=true where id='"+B+"'");
const beforeProfiles=await query('select * from member_profiles order by id');
await db.exec(team);await db.exec(team);
assert.deepEqual(await query('select * from member_profiles order by id'),beforeProfiles,'team migration preserves profile roles and tiers');
const migrated=(await query('select * from arc_file_assignments where id=80'))[0];assert.equal(migrated.status,'reader_active');assert.equal(migrated.review_link,'https://example.invalid/retained');assert.equal(migrated.download_count,4);
assert.equal((await query("select status from arc_file_assignments where arc_file_id=1"))[0].status,'active','inactive Crossing campaign untouched');
assert.equal((await query("select bp_arc_reading_eligible('"+B+"',80) ok"))[0].ok,true);
console.log('PASS ARC SQL: isolated per-assignment access despite paid membership, terms, legacy issuance reuse, unchanged download/paid history, pilot limits, closed-history review, RLS, revocation/window/private-file denial and rerunnable grant');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1});
