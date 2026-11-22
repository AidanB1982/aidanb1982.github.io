"use strict";

// Existing Blackwood Management Hub: admin verification happens in behind-files-admin.js.
// RLS in the staged migration is the actual security boundary. No privileged keys or
// author desk, book, financial or ARC permissions are changed by this interface.
(function () {
  const $ = id => document.getElementById(id);
  const list = $("sgeul-admin-applications");
  const status = $("sgeul-admin-status");
  const refreshButton = $("sgeul-admin-refresh");
  if (!list || !status || !refreshButton) return;

  let client = null;
  let owner = null;
  let epoch = 0;
  let busy = false;
  const make = (tag, className, value) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (value !== undefined) el.textContent = String(value);
    return el;
  };
  const clear = () => {
    list.replaceChildren();
    busy = false;
    refreshButton.disabled = true;
  };
  const isCurrent = (version, user) => version === epoch && user === owner && client;

  async function refresh() {
    if (!owner || !client || busy) return;
    const version = ++epoch, user = owner;
    status.textContent = "Loading private author induction requests…";
    refreshButton.disabled = true;
    const { data, error } = await client.from("sgeul_author_inductions")
      .select("user_id,publishing_name,biography,genres,website_url,motivation,status,submitted_at,reviewed_at")
      .order("submitted_at", { ascending: false }).limit(100);
    if (!isCurrent(version, user)) return;
    refreshButton.disabled = false;
    list.replaceChildren();
    if (error) {
      status.textContent =
        "Author induction review is unavailable. Check that the staged migration is approved, installed and accessible to this administrator.";
      return;
    }
    const rows = data || [];
    status.textContent = rows.length
      ? rows.length + " author induction request" + (rows.length === 1 ? "" : "s") + " on record. Review each request before making a decision."
      : "No author induction requests have been received.";
    for (const row of rows) list.append(renderCard(row));
  }

  function renderCard(row) {
    const card = make("article", "sgeul-induction-card");
    const heading = make("h3", "", row.publishing_name || "Unnamed author");
    const state = make("p", "sgeul-induction-state", "Status: " + row.status);
    const summary = make("p", "", row.biography || "");
    const details = make("p", "sgeul-induction-note", "Genres: " + (row.genres || "Not supplied"));
    const why = make("p", "", row.motivation || "");
    const since = make("p", "sgeul-induction-note",
      "Requested: " + new Date(row.submitted_at).toLocaleDateString("en-GB"));
    card.append(heading, state, summary, details, make("h4", "", "Why Sgeul?"), why, since);
    if (row.website_url) {
      const link = make("a", "", "Applicant's website (external)");
      try {
        const url = new URL(row.website_url);
        if (url.protocol === "https:" && !url.username && !url.password) {
          link.href = url.href;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          card.append(link);
        }
      } catch {}
    }
    const actions = make("div", "sgeul-induction-actions");
    function add(label, nextStatus) {
      const button = make("button", "bfa-button", label);
      button.type = "button";
      button.onclick = () => void review(row, nextStatus);
      actions.append(button);
    }
    if (row.status === "submitted") {
      add("Approve induction", "approved");
      add("Decline application", "declined");
    } else if (row.status === "approved") {
      add("Suspend induction", "suspended");
    } else if (row.status === "suspended") {
      add("Restore induction", "approved");
    }
    card.append(actions);
    return card;
  }

  async function review(row, decision) {
    if (!client || !owner || busy) return;
    const title = decision === "approved" ? "approve" : decision === "declined" ? "decline" :
      decision === "suspended" ? "suspend" : "restore";
    if (!window.confirm("Do you want to " + title + " induction for " + row.publishing_name +
      "? This does not grant author publishing rights or a public profile.")) return;
    const version = ++epoch, user = owner;
    busy = true;
    refreshButton.disabled = true;
    list.querySelectorAll("button").forEach(button => { button.disabled = true; });
    status.textContent = "Recording the induction decision…";
    try {
      const { data, error } = await client.from("sgeul_author_inductions")
        .update({ status: decision }).eq("user_id", row.user_id)
        .eq("status", row.status).select("status").maybeSingle();
      if (!isCurrent(version, user)) return;
      if (error || !data)
        throw Error("This decision could not be saved. Check the administrator permissions and current application state.");
      status.textContent = "Decision recorded. Refreshing the list…";
    } catch (error) {
      if (isCurrent(version, user)) status.textContent = error.message;
    } finally {
      busy = false;
      if (isCurrent(version, user)) void refresh();
    }
  }

  function activate(userId, verifiedClient) {
    if (!userId || !verifiedClient) return;
    owner = userId;
    client = verifiedClient;
    refreshButton.disabled = false;
    void refresh();
  }
  function suspend() {
    epoch++;
    client = null;
    owner = null;
    clear();
    status.textContent = "Administrator verification required.";
  }
  refreshButton.onclick = () => void refresh();
  refreshButton.disabled = true;
  window.BlackwoodAuthorInduction = { activate, suspend, lock: suspend };
})();
