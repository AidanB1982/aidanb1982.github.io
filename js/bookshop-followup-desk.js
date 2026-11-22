"use strict";
/*
 * Read-only dashboard for private browser-local records. It is inert until
 * the authenticated outreach application supplies its in-memory adapter.
 */
(function (root) {
  const $ = id => document.getElementById(id);
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const PAGE_SIZE = 12;
  const ORDER = ["overdue", "today", "upcoming", "unscheduled"];
  let api = null;
  let showing = PAGE_SIZE;

  function prettyDate(value) {
    if (!root.BlackwoodFollowUps.validDate(value)) return "";
    return new Date(value + "T12:00:00Z").toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric", timeZone: "UTC"
    });
  }

  function render() {
    if (!api || !root.BlackwoodFollowUps || !$("followupList")) return;
    const core = root.BlackwoodFollowUps;
    const {groups, totals} = core.build(api.getShops(), api.localDate());
    const counts = $("followupCounts");
    counts.replaceChildren();

    for (const [key, title] of [
      ["overdue", "Overdue"], ["today", "Due today"],
      ["upcoming", "Next 14 days"], ["unscheduled", "Needs a date"]
    ]) {
      const item = element("div", undefined, "followup-count");
      item.append(element("strong", String(totals[key])),
        element("span", title));
      counts.append(item);
    }

    const selected = $("followupView").value;
    const selectedGroups = selected === "all" ? ORDER : [selected];
    const rows = selectedGroups.flatMap(bucket =>
      (groups[bucket] || []).map(item => ({...item, bucket})));
    const shown = rows.slice(0, showing);
    const list = $("followupList");
    list.replaceChildren();

    for (const item of shown) {
      const card = element("article", undefined, "followup-item");
      const heading = element("h3", item.name);
      const meta = element(
        "p",
        (item.town ? item.town + " · " : "") +
          core.BUCKETS[item.bucket] +
          (item.date ? " · " + prettyDate(item.date) : "")
      );
      card.append(heading, meta);
      if (item.lastActivity) {
        card.append(element(
          "p", "Last recorded activity: " + prettyDate(item.lastActivity),
          "followup-activity"
        ));
      }
      const open = element("button", "Open saved record", "btn small secondary");
      open.type = "button";
      open.addEventListener("click", () => api.focusSavedShop(item.id));
      card.append(open);
      list.append(card);
    }
    if (!rows.length) {
      list.append(element("p",
        "No saved bookshops currently match this follow-up view.",
        "followup-empty"));
    }
    $("followupStatus").textContent =
      "Showing " + shown.length + " of " + rows.length +
      " saved bookshops needing planning attention. No contact is initiated.";
    $("followupMore").hidden = shown.length >= rows.length;
  }

  function initialise(adapter) {
    if (!root.BlackwoodFollowUps || !$("followupDashboard")) return;
    api = adapter;
    $("followupView").addEventListener("change", () => {
      showing = PAGE_SIZE;
      render();
    });
    $("followupMore").addEventListener("click", () => {
      showing += PAGE_SIZE;
      render();
    });
    render();
  }

  root.BlackwoodFollowUpDesk = Object.freeze({initialise, render});
})(window);
