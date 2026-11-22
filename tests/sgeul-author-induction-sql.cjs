// Run against in-memory PGlite, not the live Blackwood Supabase database.
const { PGlite } = require("@electric-sql/pglite");
const { readFileSync } = require("node:fs");
const assert = require("node:assert/strict");
const A = "00000000-0000-0000-0000-000000000001";
const B = "00000000-0000-0000-0000-000000000002";
const ADMIN = "00000000-0000-0000-0000-000000000003";
const details = "'Miren Vale','A writer exploring old bargains, uneasy landscapes and the edges of memory.','Folk horror','','I would like to introduce readers to thoughtful new fiction.',true,true";

(async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role;"+
      "create schema auth;"+
      "create function auth.uid() returns uuid language sql stable as $$"+
      "select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;"+
      "grant usage on schema auth,public to anon,authenticated,service_role;"+
      "create table public.member_profiles (id uuid primary key, member_status text not null,is_admin boolean not null);"+
      "insert into public.member_profiles values"+
      "('"+A+"','active',false),('"+B+"','active',false),('"+ADMIN+"','active',true);"+
      "alter table public.member_profiles enable row level security;"+
      "grant select on public.member_profiles to authenticated;"+
      "create policy member_self on public.member_profiles for select to authenticated using(id=auth.uid());"
    );
    await db.exec(readFileSync("supabase/migrations/20261122165000_sgeul_author_induction.sql","utf8"));
    async function asUser(id, fn) {
      await db.exec("set request.jwt.claim.sub='"+id+"'; set role authenticated;");
      try { return await fn(); }
      finally { await db.exec("reset role;"); }
    }
    function apply(id) {
      return "insert into public.sgeul_author_inductions"+
        "(user_id,publishing_name,biography,genres,website_url,motivation,charter_acknowledged,privacy_acknowledged)"+
        " values ('"+id+"',"+details+")";
    }
    await asUser(A, () => db.exec(apply(A)));
    await asUser(B, () => assert.rejects(db.exec(apply(ADMIN))));
    const mine = await asUser(A, () => db.query("select status from public.sgeul_author_inductions"));
    assert.equal(mine.rows.length,1);
    assert.equal(mine.rows[0].status,"submitted");
    const stranger = await asUser(B, () => db.query("select user_id from public.sgeul_author_inductions"));
    assert.equal(stranger.rows.length,0);
    await asUser(A, () => db.exec("update public.sgeul_author_inductions set status='approved'"));
    assert.equal((await asUser(A, () => db.query("select status from public.sgeul_author_inductions"))).rows[0].status,"submitted");
    await asUser(B, () => assert.rejects(db.exec(
      "insert into public.sgeul_author_profiles(user_id,publishing_name,biography) values ('"+
      B+"','Imposter','A biography long enough to satisfy the database check and more.')"
    )));
    const queue = await asUser(ADMIN, () => db.query("select user_id,status from public.sgeul_author_inductions"));
    assert.equal(queue.rows.length,1);
    await asUser(ADMIN, () => db.exec(
      "update public.sgeul_author_inductions set status='approved' where user_id='"+A+"'"
    ));
    const approved = await asUser(A, () => db.query(
      "select status,reviewed_at,reviewed_by from public.sgeul_author_inductions"
    ));
    assert.equal(approved.rows[0].status,"approved");
    assert.equal(approved.rows[0].reviewed_by,ADMIN);
    assert.ok(approved.rows[0].reviewed_at);
    await asUser(A, () => db.exec(
      "insert into public.sgeul_author_profiles(user_id,publishing_name,biography) values ('"+
      A+"','Miren Vale','A private author biography describing work that explores the edges of memory.')"
    ));
    assert.equal((await asUser(A, () => db.query("select publishing_name from public.sgeul_author_profiles"))).rows.length,1);
    assert.equal((await asUser(B, () => db.query("select publishing_name from public.sgeul_author_profiles"))).rows.length,0);
    await asUser(A, () => assert.rejects(db.exec(
      "update public.sgeul_author_profiles set user_id='"+B+"' where user_id='"+A+"'"
    )));
    await asUser(ADMIN, () => db.exec(
      "update public.sgeul_author_inductions set status='suspended' where user_id='"+A+"'"
    ));
    assert.equal((await asUser(A, () => db.query("select user_id from public.sgeul_author_profiles"))).rows.length,0);
    assert.equal((await asUser(ADMIN, () => db.query("select user_id from public.sgeul_author_profiles"))).rows.length,1);
    await db.exec("set role anon;");
    try {
      await assert.rejects(db.exec("select * from public.sgeul_author_inductions;"));
      await assert.rejects(db.exec("select * from public.sgeul_author_profiles;"));
    } finally { await db.exec("reset role;"); }
    const sql = readFileSync("supabase/migrations/20261122165000_sgeul_author_induction.sql","utf8");
    assert.doesNotMatch(sql, /insert into public\.author_records|update public\.author_records|desk_access_enabled\s*=\s*true/i);
    assert.doesNotMatch(sql, /bp_reading_memberships|bp_reading_purchases|arc_file_assignments/);
    console.log("Sgeul private induction RLS and reviewer checks passed.");
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
