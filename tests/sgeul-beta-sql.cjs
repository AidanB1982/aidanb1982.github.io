const { PGlite } = require("@electric-sql/pglite"),
  { readFileSync } = require("node:fs"),
  assert = require("node:assert/strict");
const A = "00000000-0000-0000-0000-000000000001",
  B = "00000000-0000-0000-0000-000000000002",
  C = "00000000-0000-0000-0000-000000000003",
  D = "00000000-0000-0000-0000-000000000004";
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;create table member_profiles(id uuid primary key references auth.users,email text,reader_name text,member_status text,is_admin boolean);create table book_editions(id bigint primary key,book_id bigint,format text,status text);create schema storage;create table storage.buckets(id text,public boolean);create table storage.objects(bucket_id text,name text);
insert into auth.users values('${A}','a@example.test',null,null),('${B}','b@example.test',now(),null),('${C}','c@example.test',now(),null),('${D}','d@example.test',now(),null);
insert into member_profiles select id,email,'Test Reader','active',false from auth.users;
insert into book_editions values(10,4,'ebook','scheduled'),(13,6,'ebook','scheduled');insert into storage.buckets values('bp-reading-editions',false);insert into storage.objects values('bp-reading-editions','BLACK_BOTHY.epub');`);
    await db.exec(
      readFileSync("supabase/migrations/20261025_bp_reading.sql", "utf8")
    );
    await db.exec(
      `create table bp_reading_files(edition_id bigint,storage_bucket text,storage_path text,file_format text,access_status text);insert into bp_reading_titles values('4','The Black Bothy'),('6','Holdfast');insert into bp_reading_catalog(edition_id,book_id,title,available) values(10,'4','The Black Bothy',true),(13,'6','Holdfast',true);insert into bp_reading_files values(10,'bp-reading-editions','BLACK_BOTHY.epub','epub','admin_testing');insert into bp_reading_releases values(10,'bp-reading-editions','BLACK_BOTHY.epub',true,now());insert into bp_reading_memberships(user_id,access_until) values('${B}',now()+interval '1 year');insert into bp_reading_purchases(user_id,book_id) values('${C}','6');`
    );
    const migration = readFileSync(
      "supabase/migrations/20261103120000_sgeul_beta_reading.sql",
      "utf8"
    );
    await db.exec(migration);
    await db.exec(migration);
    const operation = (email) =>
      readFileSync(
        "supabase/operations/enable-sgeul-beta-testers.sql",
        "utf8"
      ).replace("replace-with-accepted-member@example.invalid", email);
    const rows = async (sql) => (await db.query(sql)).rows;
    const access = async (user, edition, beta = false) => {
      await db.exec(
        `set request.jwt.claim.sub='${user}';set role authenticated`
      );
      try {
        return (
          await rows(
            `select public.${
              beta ? "bp_reading_beta_can_read" : "bp_reading_can_read"
            }(${edition}) ok`
          )
        )[0].ok;
      } finally {
        await db.exec("reset role");
      }
    };
    assert.equal(await access(A, 10), false);
    assert.equal(await access(B, 10), true);
    assert.equal(await access(C, 13), true);
    await assert.rejects(
      () => db.exec(operation("a@example.test")),
      /confirmed active non-admin/
    );
    await db.exec("rollback");
    assert.equal(
      (await rows("select count(*)::int n from bp_reading_beta_grants"))[0].n,
      0
    );
    await db.exec(
      `update auth.users set email_confirmed_at=now() where id='${A}'`
    );
    await db.exec(operation("a@example.test"));
    await db.exec(operation("a@example.test"));
    assert.equal(await access(A, 10), true);
    assert.equal(await access(A, 10, true), true);
    assert.equal(await access(A, 13), false);
    assert.equal(
      await access(B, 10, true),
      false,
      "paid access is not a beta launch exemption"
    );
    assert.equal(await access(C, 10), false);
    assert.equal(await access(C, 13), true);
    assert.equal(
      (await rows("select count(*)::int n from bp_reading_beta_grants"))[0].n,
      1
    );
    assert.equal(
      (await rows("select count(*)::int n from bp_reading_memberships"))[0].n,
      1
    );
    assert.equal(
      (await rows("select count(*)::int n from bp_reading_purchases"))[0].n,
      1,
      "beta fabricates no purchases"
    );
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${A}'`);
    await assert.rejects(
      () => db.query("select * from bp_reading_beta_grants"),
      (e) => e.code === "42501"
    );
    await assert.rejects(
      () =>
        db.query(
          `insert into bp_reading_beta_grants(user_id,edition_id,cohort,access_until) values('${A}',13,'forged',now()+interval '1 year')`
        ),
      (e) => e.code === "42501"
    );
    await db.exec("reset role");
    for (const [deny, restore] of [
      [
        "update bp_reading_beta_grants set revoked_at=now()",
        "update bp_reading_beta_grants set revoked_at=null",
      ],
      [
        "update bp_reading_beta_grants set access_until=now()-interval '1 second'",
        "update bp_reading_beta_grants set access_until=now()+interval '45 days'",
      ],
      [
        `update member_profiles set member_status='inactive' where id='${A}'`,
        `update member_profiles set member_status='active' where id='${A}'`,
      ],
      [
        "update book_editions set status='withdrawn' where id=10",
        "update book_editions set status='scheduled' where id=10",
      ],
    ]) {
      await db.exec(deny);
      assert.equal(await access(A, 10), false, deny);
      await db.exec(restore);
    }
    await db.exec("update bp_reading_beta_grants set revoked_at=now()");
    await assert.rejects(
      () => db.exec(operation("a@example.test")),
      /revoked or different-cohort/
    );
    await db.exec("rollback");
    await db.exec("update bp_reading_beta_grants set revoked_at=null");
    await db.exec(
      `insert into auth.users select ('00000000-0000-0000-0001-'||lpad(i::text,12,'0'))::uuid,'extra-'||i||'@example.test',now(),null from generate_series(1,99) i;insert into member_profiles select id,email,'Extra','active',false from auth.users where email like 'extra-%';insert into bp_reading_beta_grants(user_id,edition_id,cohort,access_until) select id,10,'sgeul-android-2026-beta',now()+interval '45 days' from auth.users where email like 'extra-%';`
    );
    await assert.rejects(
      () => db.exec(operation("d@example.test")),
      /exceed 100/
    );
    await db.exec("rollback");
    assert.equal(
      (await rows("select count(*)::int n from bp_reading_beta_grants"))[0].n,
      100
    );
    console.log(
      "PASS Sgeul beta SQL: confirmed accepted users only, one-book temporary rights, no paid records, unchanged memberships/purchases, expiry/revocation/status denial, private grants, reruns and 100-reader cap."
    );
  } finally {
    await db.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
