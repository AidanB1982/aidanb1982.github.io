"use strict";
/*
 * Private Bookshop Follow-up Dashboard: read-only planning classifications.
 * Uses only existing browser-local outreach records. No automatic messages,
 * data migration, networking, or changes to follow-up dates.
 */
(function (root) {
  const BUCKETS = Object.freeze({
    overdue: "Overdue",
    today: "Due today",
    upcoming: "Next 14 days",
    unscheduled: "No date planned"
  });

  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }
    const date = new Date(value + "T12:00:00Z");
    return !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value;
  }

  function addDays(date, days) {
    if (!validDate(date)) return "";
    const next = new Date(date + "T12:00:00Z");
    next.setUTCDate(next.getUTCDate() + days);
    return next.toISOString().slice(0, 10);
  }

  function latestActivity(shop) {
    const history = Array.isArray(shop?.contactHistory) ?
      shop.contactHistory : [];
    const dated = history.filter(item => validDate(item?.date))
      .sort((a, b) => b.date.localeCompare(a.date));
    return dated.length ? dated[0].date : "";
  }

  function bucketOf(shop, today, daysAhead = 14) {
    if (!shop || !validDate(today)) return "";
    if (["opted-out", "stockist"].includes(shop.status)) return "";
    if (["closed", "not-independent"].includes(shop?.verification?.status)) {
      return "";
    }
    const date = shop.followUpDate;
    if (validDate(date)) {
      if (date < today) return "overdue";
      if (date === today) return "today";
      if (date <= addDays(today, daysAhead)) return "upcoming";
      return "";
    }
    // Do not interpret an uncontacted prospect as an overdue follow-up.
    return ["contacted", "interested"].includes(shop.status) ?
      "unscheduled" : "";
  }

  function build(shops, today, daysAhead = 14) {
    const groups = {
      overdue: [], today: [], upcoming: [], unscheduled: []
    };
    const records = Array.isArray(shops) ? shops : [];
    for (const shop of records) {
      const bucket = bucketOf(shop, today, daysAhead);
      if (!bucket) continue;
      groups[bucket].push({
        id: shop.id,
        name: String(shop.name || "Unnamed bookshop"),
        town: String(shop.town || ""),
        date: validDate(shop.followUpDate) ? shop.followUpDate : "",
        status: shop.status,
        lastActivity: latestActivity(shop)
      });
    }
    for (const [bucket, items] of Object.entries(groups)) {
      items.sort((a, b) => {
        if (bucket !== "unscheduled") {
          const byDate = a.date.localeCompare(b.date);
          if (byDate) return byDate;
        } else {
          const byActivity = b.lastActivity.localeCompare(a.lastActivity);
          if (byActivity) return byActivity;
        }
        return a.name.localeCompare(b.name, "en-GB");
      });
    }
    const totals = Object.fromEntries(
      Object.entries(groups).map(([bucket, items]) => [bucket, items.length])
    );
    totals.all = Object.values(groups).reduce((count, items) =>
      count + items.length, 0);
    return {groups, totals};
  }

  if (root) {
    root.BlackwoodFollowUps = Object.freeze({
      BUCKETS, validDate, addDays, latestActivity, bucketOf, build
    });
  }
})(typeof window === "undefined" ? null : window);
