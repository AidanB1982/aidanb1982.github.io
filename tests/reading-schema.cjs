// Runs the actual migration in embedded PostgreSQL, using a minimal Supabase auth/member-profile fixture.
const {PGlite} = require('@electric-sql/pglite');
const {readFileSync} = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;
    insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');`);
  await db.exec('create table public.member_profiles(id uuid primary key references auth.users(id),is_admin boolean not null default false); insert into public.member_profiles(id) select id from auth.users;');
  await db.exec(readFileSync('supabase/migrations/20261025_bp_reading.sql','utf8'));
  const user1 = '00000000-0000-0000-0000-000000000001';
  const user2 = '00000000-0000-0000-0000-000000000002';
  async function asUser(user, sql, params=[]) {
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${user}';`);
    try { return await db.query(sql,params); } finally { await db.exec('reset role'); }
  }
  async function denied(fn, code) {
    await assert.rejects(fn, e=>!code || e.code===code);
  }
  const canRead = async user => (await asUser(user,'select public.bp_reading_can_read(2) as allowed')).rows[0].allowed;
  assert.equal(await canRead(user1),false,'no free access by signing in');
  await db.exec(`insert into public.bp_reading_memberships(user_id,access_until) values ('${user1}',now()+interval '1 day')`);
  assert.equal(await canRead(user1),true,'active annual membership');
  assert.equal(await canRead(user2),false,'membership scoped to user');
  await db.exec(`update public.bp_reading_memberships set access_until=now()-interval '1 day'`);
  assert.equal(await canRead(user1),false,'expired membership');
  await db.exec(`insert into public.bp_reading_purchases(user_id,book_id) values ('${user1}','gualachulain')`);
  assert.equal(await canRead(user1),true,'permanent purchase survives membership expiry');
  await db.exec("insert into public.bp_reading_catalog(edition_id,book_id,title,available) values (3,'gualachulain','Gualachulain · updated edition',true)");
  assert.equal((await asUser(user1,'select public.bp_reading_can_read(3) as allowed')).rows[0].allowed,true,'purchase follows title to replacement edition');
  await db.exec(`update public.bp_reading_purchases set revoked_at=now()`);
  assert.equal(await canRead(user1),false,'revoked purchase');
  await denied(()=>asUser(user2,`insert into public.bp_reading_purchases(user_id,book_id) values ('${user2}','gualachulain')`),'42501');
  await denied(()=>asUser(user2,`update public.bp_reading_memberships set access_until=now()+interval '10 years'`),'42501');
  await denied(()=>asUser(user2,'select * from public.bp_reading_releases'),'42501');
  await denied(()=>asUser(user2,"insert into public.bp_reading_releases(edition_id,storage_bucket,storage_path,enabled) values (2,'bp-reading-editions','guessed.epub',true)"),'42501');
  const save = async (user, expected, payload={progress:10}) => (await asUser(user,'select public.bp_reading_save_state(2,$1::jsonb,$2) as revision',[JSON.stringify(payload),expected])).rows[0].revision;
  assert.equal(await save(user1,0),1);
  assert.equal(await save(user1,1,{progress:20}),2);
  await denied(()=>save(user1,1),'40001');
  await denied(()=>save(user1,0),'40001');
  assert.equal((await asUser(user2,'select * from public.bp_reading_state')).rows.length,0,'private reader state RLS');
  assert.equal(await save(user2,0),1,'separate own state');
  await denied(()=>asUser(user2,`update public.bp_reading_state set payload='{}'`),'42501');
  await denied(()=>save(user2,1,{note:'x'.repeat(400001)}),'22023');
  await denied(()=>save(user2,1,[]),'22023');
  await db.exec('set role anon');
  await denied(()=>db.query('select * from public.bp_reading_state'),'42501');
  await denied(()=>db.query('select public.bp_reading_can_read(2)'),'42501');
  await db.exec('reset role');
  await db.exec('update public.bp_reading_catalog set available=false');
  await denied(()=>save(user2,1),'42501');
  console.log('PASS PostgreSQL migration, access expiry, permanent/revoked purchases, denied self-grants, private RLS, concurrency conflicts, bounded payloads and anonymous denial');

  await db.exec(readFileSync('supabase/migrations/20261026_bp_reading_checkout.sql','utf8'));
  await db.exec(`delete from public.bp_reading_memberships where user_id='${user1}'`);
  const intent1='10000000-0000-0000-0000-000000000001';
  const intent2='10000000-0000-0000-0000-000000000002';
  await db.exec(`insert into public.bp_reading_checkout_intents(id,user_id,shopify_cart_id,created_at) values ('${intent1}','${user1}','cart1','2024-01-01'),('${intent2}','${user2}','cart2','2024-01-01')`);
  await denied(()=>asUser(user1,`select public.bp_reading_apply_membership_payment('${intent1}','paid-forged','2024-02-29')`),'42501');
  assert.equal((await asUser(user2,`select * from public.bp_reading_checkout_status('${intent1}')`)).rows.length,0,'checkout status belongs to account');
  assert.equal((await asUser(user1,`select * from public.bp_reading_checkout_status('${intent1}')`)).rows[0].status,'pending');
  const apply=async(id,payment,date)=>(await db.query('select public.bp_reading_apply_membership_payment($1,$2,$3) as until',[id,payment,date])).rows[0].until.toISOString();
  assert.equal(await apply(intent1,'shopify-order-1','2024-02-29T13:15:00Z'),'2025-02-28T13:15:00.000Z','12 calendar months including leap day');
  assert.equal(await apply(intent1,'shopify-order-1','2024-02-29T13:15:00Z'),'2025-02-28T13:15:00.000Z','duplicate notifications do not add years');
  await denied(()=>apply(intent2,'shopify-order-1','2024-02-29T13:15:00Z'),'22023');
  assert.equal(await apply(intent1,'shopify-order-2','2025-02-28T13:15:00Z'),'2026-02-28T13:15:00.000Z','renewal paid date plus calendar year');
  assert.equal((await asUser(user1,`select * from public.bp_reading_checkout_status('${intent1}')`)).rows[0].status,'paid');

  await denied(()=>asUser(user1,"select public.bp_reading_revoke_membership_payment('shopify-order-2')"),'42501');
  await db.query("select public.bp_reading_revoke_membership_payment('shopify-order-2')");
  let status=(await asUser(user1,`select * from public.bp_reading_checkout_status('${intent1}')`)).rows[0];
  assert.equal(status.access_until.toISOString(),'2025-02-28T13:15:00.000Z','refund preserves other valid receipt period');
  await db.query("select public.bp_reading_revoke_membership_payment('shopify-order-1')");
  status=(await asUser(user1,`select * from public.bp_reading_checkout_status('${intent1}')`)).rows[0];
  assert.equal(status.status,'refunded');assert.equal(status.access_until,null);
  await apply(intent1,'shopify-order-1','2024-02-29T13:15:00Z');
  assert.equal((await asUser(user1,`select * from public.bp_reading_checkout_status('${intent1}')`)).rows[0].status,'refunded','old paid event cannot resurrect refunded access');
  console.log('PASS payment ledger: server-only grants, private status polling, purchase-date + 12 months, leap days, idempotency, renewal and refund recalculation');

  const orphan='00000000-0000-0000-0000-000000000003';
  await db.exec(`insert into auth.users values ('${orphan}'); insert into public.bp_reading_memberships(user_id,access_until) values ('${orphan}',now())`);
  const profileMigration=readFileSync('supabase/migrations/20261027_bp_reading_member_profiles.sql','utf8');
  await assert.rejects(()=>db.exec(profileMigration),/no matching member_profiles/);
  await db.exec('rollback');
  assert.equal((await db.query(`select count(*)::int as count from public.bp_reading_memberships where user_id='${orphan}'`)).rows[0].count,1,'failed migration preserves orphaned records');
  await db.exec(`insert into public.member_profiles(id) values ('${orphan}')`);
  const before=await db.query('select user_id,edition_id,payload from public.bp_reading_state order by user_id');
  await db.exec(profileMigration);
  assert.deepEqual((await db.query('select user_id,edition_id,payload from public.bp_reading_state order by user_id')).rows,before.rows,'existing notes and progress preserved');
  assert.equal((await db.query("select count(*)::int as count from pg_constraint where contype='f' and confrelid='public.member_profiles'::regclass and conrelid in ('public.bp_reading_memberships'::regclass,'public.bp_reading_purchases'::regclass,'public.bp_reading_state'::regclass,'public.bp_reading_checkout_intents'::regclass)")).rows[0].count,4);
  const noProfile='00000000-0000-0000-0000-000000000004';
  await db.exec(`insert into auth.users values ('${noProfile}')`);
  await denied(()=>db.query(`insert into public.bp_reading_checkout_intents(user_id) values ('${noProfile}')`),'23503');
  console.log('PASS member_profiles ownership: all four links, preserved reader data, safe orphan rollback and prevention of checkout without a member profile');
  await db.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
