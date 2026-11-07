const { PGlite } = require("@electric-sql/pglite");
const { readFileSync } = require("node:fs");
const assert = require("node:assert/strict");
const ADMIN = "00000000-0000-0000-0000-000000000001";
const MEMBER = "00000000-0000-0000-0000-000000000002";
const INACTIVE = "00000000-0000-0000-0000-000000000003";
const UNCONFIRMED = "00000000-0000-0000-0000-000000000004";
const BANNED = "00000000-0000-0000-0000-000000000005";
const NO_PROFILE = "00000000-0000-0000-0000-000000000006";
const INACTIVE_ADMIN = "00000000-0000-0000-0000-000000000007";

(async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, banned_until timestamptz);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
      $$;
      grant usage on schema auth to anon, authenticated;
      create table public.member_profiles(id uuid primary key references auth.users(id), member_status text, is_admin boolean);
      alter table public.member_profiles enable row level security;
      revoke all on public.member_profiles, auth.users from anon, authenticated;
      insert into auth.users values
        ('${ADMIN}','admin@example.test',now(),null),
        ('${MEMBER}','member@example.test',now(),null),
        ('${INACTIVE}','inactive@example.test',now(),null),
        ('${UNCONFIRMED}','unconfirmed@example.test',null,null),
        ('${BANNED}','banned@example.test',now(),now()+interval '1 year'),
        ('${NO_PROFILE}','noprofile@example.test',now(),null),
        ('${INACTIVE_ADMIN}','inactiveadmin@example.test',now(),null);
      insert into member_profiles values
        ('${ADMIN}','active',true), ('${MEMBER}','active',false),
        ('${INACTIVE}','inactive',false), ('${UNCONFIRMED}','active',false),
        ('${BANNED}','active',false), ('${INACTIVE_ADMIN}','inactive',true);
    `);
    const migration = readFileSync(
      "supabase/migrations/20261107140000_dispatch_audiences.sql",
      "utf8",
    );
    await db.exec(migration);
    await db.exec(migration); // Reapplying retains data/policies and does not duplicate triggers.
    async function as(role, user, task) {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        user || "",
      ]);
      await db.exec("set role " + role);
      try {
        return await task();
      } finally {
        await db.exec("reset role");
      }
    }
    const rows = async (sql, params) => (await db.query(sql, params)).rows;
    const save = async (payload, expected = null) =>
      (
        await rows(
          "select * from public.bp_dispatch_save($1::jsonb,$2::bigint)",
          [JSON.stringify(payload), expected],
        )
      )[0];
    const example = (id, fields = {}) => ({
      id,
      title: "A new dispatch",
      category: "Weekly Dispatch",
      excerpt: "A short excerpt",
      body: "A complete plain-text update.\n\nSecond paragraph.",
      image_url: "/assets/ArchiveFilesBG.png",
      audience: "members",
      published: false,
      pinned: false,
      published_at: "2026-01-01T00:00:00Z",
      ...fields,
    });
    async function denied(task, code) {
      await assert.rejects(
        task,
        (error) => error.code === code,
        "Expected SQLSTATE " + code,
      );
    }
    await as("authenticated", ADMIN, async () => {
      await save(example("public", { audience: "public", published: true }));
      await save(example("members", { published: true }));
      await save(example("public-draft", { audience: "public" }));
      await save(example("member-draft"));
    });
    await db.exec(
      "insert into bp_dispatches(id,title,body,audience,published,published_at) values('future-public','Future','Future unpublished timing','public',true,now()+interval '1 year')",
    );
    const feedFields =
      "id,title,category,excerpt,body,image_url,audience,published,pinned,published_at,revision";
    const visible = () =>
      rows("select " + feedFields + " from bp_dispatches order by id");
    await as("anon", null, async () => {
      assert.deepEqual(
        (await visible()).map((x) => x.id),
        ["public"],
      );
      assert.equal(
        (await rows("select count(*)::int total from bp_dispatches"))[0].total,
        1,
        "anonymous counts do not reveal private drafts/posts",
      );
      await denied(() => rows("select created_by from bp_dispatches"), "42501");
      await denied(() => save(example("anon-write")), "42501");
      await denied(
        () => rows("select public.bp_dispatch_is_member()"),
        "42501",
      );
    });
    await as("authenticated", MEMBER, async () => {
      assert.deepEqual(
        (await visible()).map((x) => x.id),
        ["members", "public"],
      );
      assert.equal(
        (await rows("select public.bp_dispatch_is_member() ok"))[0].ok,
        true,
      );
      assert.equal(
        (await rows("select public.bp_dispatch_is_admin() ok"))[0].ok,
        false,
      );
      await denied(() => save(example("member-write")), "42501");
      await denied(
        () =>
          db.exec(
            "insert into bp_dispatches(id,title,body) values('direct','Unsafe','Unsafe')",
          ),
        "42501",
      );
      await denied(
        () =>
          db.exec(
            "update bp_dispatches set audience='public' where id='members'",
          ),
        "42501",
      );
      await denied(
        () => db.exec("delete from bp_dispatches where id='members'"),
        "42501",
      );
      await denied(() => rows("select * from auth.users"), "42501");
      await denied(() => rows("select * from member_profiles"), "42501");
    });
    for (const user of [
      INACTIVE,
      UNCONFIRMED,
      BANNED,
      NO_PROFILE,
      INACTIVE_ADMIN,
    ]) {
      await as("authenticated", user, async () => {
        assert.deepEqual(
          (await visible()).map((x) => x.id),
          ["public"],
        );
        assert.equal(
          (await rows("select public.bp_dispatch_is_member() ok"))[0].ok,
          false,
        );
        await denied(
          () => save(example("ineligible-" + user.slice(-1))),
          "42501",
        );
      });
    }
    await as("authenticated", ADMIN, async () => {
      assert.equal(
        (await visible()).length,
        5,
        "only active confirmed admins see drafts and future posts",
      );
      const first = await save(example("edit-me"));
      assert.equal(first.revision, 1);
      assert.equal(first.created_by, ADMIN);
      assert.equal(first.audience, "members");
      await denied(
        () => save(example("edit-me")),
        "40001",
        "same stable ID cannot be duplicated on a retry",
      );
      const second = await save(
        example("edit-me", { title: "Edited safely", published: true }),
        first.revision,
      );
      assert.equal(second.revision, 2);
      assert.equal(second.created_at.getTime(), first.created_at.getTime());
      assert.equal(second.created_by, ADMIN);
      await denied(
        () =>
          save(
            example("edit-me", { title: "Stale overwrite" }),
            first.revision,
          ),
        "40001",
      );
      await denied(() => save(example("missing-post"), 99), "40001");
      await denied(() => save(example("edit-me"), -1), "22023");
      const third = await save(
        example("edit-me", { audience: "public", published: true }),
        second.revision,
      );
      assert.equal(third.revision, 3);
      const fourth = await save(
        example("edit-me", { audience: "members", published: true }),
        third.revision,
      );
      assert.equal(fourth.revision, 4);
      const fifth = await save(
        example("edit-me", { published: false }),
        fourth.revision,
      );
      assert.equal(fifth.revision, 5);
      const implicit = await save({
        title: "Default-private draft",
        body: "Complete draft",
      });
      assert.match(implicit.id, /^bfa-/);
      assert.equal(implicit.audience, "members");
      assert.equal(implicit.published, false);
      for (const [index, fields] of [
        { title: "" },
        { body: "" },
        { title: "x".repeat(201) },
        { body: "x".repeat(50001) },
        { audience: "everyone" },
        { image_url: "javascript:alert(1)" },
        { image_url: "/assets/\ntracking.png" },
        { published: "true" },
        { pinned: null },
        { created_by: MEMBER },
        { published_at: "invalid" },
        { published_at: "infinity" },
        { published: true, published_at: "2999-01-01T00:00:00Z" },
        { title: { bad: "object" } },
      ].entries())
        await denied(() => save(example("invalid-" + index, fields)), "22023");
      await denied(() => save([]), "22023");
      await denied(() => save(null), "22023");
    });
    await as("anon", null, async () =>
      assert.deepEqual(
        (await visible()).map((x) => x.id),
        ["public"],
      ),
    );
    // Actual publish/reclassify/unpublish operations affect public and member access immediately.
    let live;
    await as("authenticated", ADMIN, async () => {
      live = await save(
        example("live", { audience: "public", published: true }),
      );
    });
    await as("anon", null, async () =>
      assert.equal(
        (await visible()).some((x) => x.id === "live"),
        true,
      ),
    );
    await as("authenticated", ADMIN, async () => {
      live = await save(
        example("live", { audience: "members", published: true }),
        live.revision,
      );
    });
    await as("anon", null, async () =>
      assert.equal(
        (await visible()).some((x) => x.id === "live"),
        false,
      ),
    );
    await as("authenticated", MEMBER, async () =>
      assert.equal(
        (await visible()).some((x) => x.id === "live"),
        true,
      ),
    );
    await as("authenticated", ADMIN, async () => {
      live = await save(example("live", { published: false }), live.revision);
    });
    await as("authenticated", MEMBER, async () =>
      assert.equal(
        (await visible()).some((x) => x.id === "live"),
        false,
      ),
    );
    // Demoting an administrator invalidates writes without granting a new role or cookie.
    await db.exec(
      `update member_profiles set is_admin=false where id='${ADMIN}'`,
    );
    await as(
      "authenticated",
      ADMIN,
      async () => await denied(() => save(example("after-demotion")), "42501"),
    );
    console.log(
      "PASS dispatch schema: rerunnable migration, anonymous public-only feed/no creator IDs, confirmed active members only, draft/future privacy, no direct writes, admin save/CAS, validation, audit fields, audience changes/unpublish and demotion denial.",
    );
  } finally {
    await db.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
