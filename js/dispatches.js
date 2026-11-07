/* Shared published-dispatch reader. Audience enforcement also lives in database RLS. */
(function () {
  "use strict";
  const columns =
    "id,title,category,excerpt,body,image_url,audience,published,pinned,published_at,revision";
  const endpoint =
    "https://bmnlynjldlnxfvunqbqq.supabase.co/rest/v1/bp_dispatches";
  const publicKey = "sb_publishable_eL7qdDe_6XWGhzmdsql_7w_7dg6psC0";
  const fallbackImage = "/assets/ArchiveFilesBG.png";
  function safeImage(value) {
    try {
      const raw = String(value || "").trim();
      if (raw.startsWith("/assets/") && !raw.startsWith("//")) return raw;
      const url = new URL(raw);
      return url.protocol === "https:" ? url.href : fallbackImage;
    } catch {
      return fallbackImage;
    }
  }
  function normalise(row) {
    return {
      id: String(row.id || ""),
      title: String(row.title || "Untitled File"),
      category: String(row.category || "Behind the Files"),
      excerpt: String(row.excerpt || ""),
      body: String(row.body || ""),
      image: safeImage(row.image_url),
      audience: row.audience === "public" ? "public" : "members",
      published: row.published === true,
      pinned: row.pinned === true,
      publishedAt: String(row.published_at || ""),
      revision: Number(row.revision || 0),
    };
  }
  function published(rows, publicOnly) {
    return (Array.isArray(rows) ? rows : [])
      .filter(
        (row) =>
          row &&
          row.published === true &&
          ["public", "members"].includes(row.audience) &&
          (!publicOnly || row.audience === "public") &&
          Number.isFinite(Date.parse(row.published_at)) &&
          Date.parse(row.published_at) <= Date.now()
      )
      .map(normalise)
      .sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          Date.parse(b.publishedAt) - Date.parse(a.publishedAt) ||
          a.id.localeCompare(b.id)
      );
  }
  async function loadPublic({ signal } = {}) {
    const url = new URL(endpoint);
    url.search = new URLSearchParams({
      select: columns,
      audience: "eq.public",
      published: "eq.true",
      order: "pinned.desc,published_at.desc,id.asc",
      limit: "3",
    });
    // This deliberately never reads a stored session or sends an admin JWT.
    const response = await fetch(url, {
      headers: { apikey: publicKey, Accept: "application/json" },
      credentials: "omit",
      cache: "no-store",
      signal: signal || AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      // Before the owner installs the feed table, show the ordinary empty state.
      if (response.status === 404) {
        const problem = await response.json().catch(() => ({}));
        if (["PGRST205", "42P01"].includes(problem.code)) return [];
      }
      throw Error("Published updates could not be loaded.");
    }
    const rows = await response.json();
    if (!Array.isArray(rows))
      throw Error("Published updates could not be loaded.");
    return published(rows, true).slice(0, 3);
  }
  async function loadMember(client) {
    const result = await client
      .from("bp_dispatches")
      .select(columns)
      .eq("published", true)
      .order("pinned", { ascending: false })
      .order("published_at", { ascending: false });
    if (result.error) throw result.error;
    return published(result.data, false);
  }
  window.BlackwoodDispatches = { loadPublic, loadMember, safeImage };
})();
