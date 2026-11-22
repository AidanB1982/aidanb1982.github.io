"use strict";
/*
 * Private Bookshop Review Desk.
 * Loaded as an inert module; init is called only from the administrator-
 * approved bookshop-outreach.js application. Public candidates are safe,
 * verified metadata and saved records stay in existing browser storage.
 */
(function (root) {
  const $ = id => document.getElementById(id);
  const node = (tag, text, className) => {
    const value = document.createElement(tag);
    if (text !== undefined) value.textContent = text;
    if (className) value.className = className;
    return value;
  };
  const normalise = value =>
    String(value || "").toLocaleLowerCase("en-GB").trim();
  const PAGE_SIZE = 24;
  let api = null;
  let candidates = [];
  let loaded = false;
  let page = 0;
  let reviewDialog = null;
  let candidateError = "";

  function matchingShop(item) {
    return api.getShops().some(saved => api.sameBookshop(item, saved));
  }

  function statusText(shop) {
    const helper = root.BlackwoodVerification;
    return helper.LABELS[helper.statusOf(shop)];
  }

  function refreshQueue() {
    const wrap = $("reviewQueue");
    if (!wrap || !api) return;
    wrap.replaceChildren();
    const query = normalise($("reviewCandidateSearch").value);
    const rank = root.BlackwoodVerification.candidateScore;
    const matching = candidates
      .filter(item => !matchingShop(item) &&
        normalise(item.name + " " + item.town + " " + item.address).includes(query))
      .sort((a, b) => rank(b) - rank(a) ||
        a.name.localeCompare(b.name, "en-GB"));
    const maxPage = Math.max(0, Math.ceil(matching.length / PAGE_SIZE) - 1);
    page = Math.min(page, maxPage);
    const shown = matching.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    for (const item of shown) {
      const card = node("article", undefined, "review-candidate");
      card.append(node("h3", item.name));
      card.append(node("p", item.address || item.town || "Town not recorded"));
      if (item.website) {
        const a = node("a", "Check public website");
        a.href = item.website;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        card.append(a);
      }
      const save = node("button", "Save to private review", "btn small");
      save.type = "button";
      save.addEventListener("click", () => saveCandidate(item));
      card.append(save);
      wrap.append(card);
    }
    $("reviewPrev").disabled = page <= 0;
    $("reviewNext").disabled = page >= maxPage;
    $("reviewQueueStatus").textContent = !loaded ?
      candidateError || "Loading public candidates…" :
      matching.length + " unsaved candidate listings" +
      (query ? " matching your search" : "") +
      " · showing " + (shown.length ? page * PAGE_SIZE + 1 : 0) +
      "–" + (page * PAGE_SIZE + shown.length) +
      ". Check independence and trading status manually.";
  }

  async function loadCandidates() {
    loaded = false;
    candidateError = "";
    refreshQueue();
    try {
      const response = await fetch("/data/public-bookshops.json", {cache:"no-cache"});
      if (!response.ok) throw new Error("Directory unavailable");
      const data = await response.json();
      if (!Array.isArray(data.shops)) throw new Error("Directory format invalid");
      candidates = data.shops.filter(item => item &&
          typeof item.name === "string" && item.name.trim() &&
          api.validCoordinates(item))
        .map(item => ({
          name: item.name.trim(),
          town: String(item.town || ""),
          address: String(item.address || ""),
          website: api.safeWebsite(item.website),
          lat: item.lat, lng: item.lng
        }));
      loaded = true;
    } catch (error) {
      console.error("Bookshop review candidates:", error);
      candidateError =
        "Could not retrieve public candidates. Existing saved reviews are safe.";
    }
    refreshQueue();
  }

  function saveCandidate(item) {
    if (matchingShop(item)) {
      $("reviewQueueStatus").textContent =
        "Already saved. Use the saved-directory review button.";
      refreshQueue();
      return;
    }
    const saved = {
      id: api.newId(),
      osmId: "",
      name: item.name,
      town: item.town,
      email: "",
      website: item.website,
      lat: item.lat,
      lng: item.lng,
      status: "prospect",
      verification: {
        status: "unreviewed", sourceUrl: "", notes: "", checkedAt: ""
      },
      contactHistory: [],
      followUpDate: "",
      notes: [
        "Saved individually from the public bookshop discovery directory.",
        "Address: " + (item.address || "Not supplied"),
        "Independent status and trading status require manual verification.",
        "This is not a confirmed Blackwood Publishing stockist."
      ].join("\n")
    };
    if (!api.saveShops([...api.getShops(), saved])) {
      $("reviewQueueStatus").textContent =
        "Unable to save. Please export a JSON backup.";
      return;
    }
    api.render();
    refreshQueue();
    openReview(saved);
  }

  function openReview(shop) {
    if (!api || !root.BlackwoodVerification || !shop) return;
    if (!reviewDialog) makeDialog();
    const existing = shop.verification || {};
    $("rv-title").textContent = "Verify " + shop.name;
    $("rv-context").textContent =
      (shop.town || "Town not recorded") + " · Outreach: " +
      (api.statusLabels[shop.status] || "Prospect") +
      ". Verification does not give permission to email or confirm stockist status.";
    $("rv-status").value = root.BlackwoodVerification.statusOf(shop);
    $("rv-source").value = existing.sourceUrl || "";
    $("rv-notes").value = existing.notes || "";
    $("rv-result").textContent = "";
    reviewDialog.dataset.shopId = shop.id;
    reviewDialog.showModal();
  }

  function formField(labelText, control) {
    const label = node("label");
    label.append(node("span", labelText), control);
    return label;
  }

  function makeDialog() {
    const dialog = node("dialog", undefined, "review-modal");
    dialog.setAttribute("aria-label", "Manual verification of a saved bookshop");
    const title = node("h2", "Review bookshop");
    title.id = "rv-title";
    const context = node("p", "");
    context.id = "rv-context";
    const form = node("form");
    form.className = "review-form";
    const status = node("select");
    status.id = "rv-status";
    for (const [key, label] of Object.entries(root.BlackwoodVerification.LABELS)) {
      const option = node("option", label);
      option.value = key;
      status.append(option);
    }
    const source = node("input");
    source.id = "rv-source";
    source.type = "url";
    source.maxLength = 1000;
    source.placeholder = "https://bookshop.example/about";
    const notes = node("textarea");
    notes.id = "rv-notes";
    notes.rows = 4;
    notes.maxLength = 2000;
    notes.placeholder = "Evidence of independent trading, or reason for exclusion";
    const result = node("p");
    result.id = "rv-result";
    result.setAttribute("role", "status");
    const actions = node("div", undefined, "review-dialog-actions");
    const save = node("button", "Save verification", "btn");
    save.type = "submit";
    const cancel = node("button", "Cancel", "btn secondary");
    cancel.type = "button";
    cancel.addEventListener("click", () => dialog.close());
    actions.append(save, cancel);
    form.append(
      formField("Verification result", status),
      formField("Public evidence URL (required for independent verification)", source),
      formField("Review notes (do not include private personal data)", notes),
      result, actions
    );
    form.addEventListener("submit", event => {
      event.preventDefault();
      const shop = api.getShops().find(x => x.id === dialog.dataset.shopId);
      if (!shop) {
        result.textContent = "The saved bookshop could not be found.";
        return;
      }
      try {
        const verification = root.BlackwoodVerification.createReview({
          status: status.value, sourceUrl: source.value, notes: notes.value
        }, shop.verification || {}, api.localDate());
        if (!api.updateShopRecord(shop.id, {verification})) {
          result.textContent = "Review could not be saved. Export your backup.";
          return;
        }
        dialog.close();
        api.render();
        refreshQueue();
        $("reviewQueueStatus").textContent =
          shop.name + ": saved private verification record.";
      } catch (error) {
        result.textContent = error.message;
      }
    });
    dialog.append(title, context, form);
    document.body.append(dialog);
    reviewDialog = dialog;
  }

  function initialise(adapter) {
    if (!root.BlackwoodVerification || !$("reviewQueue")) return;
    api = adapter;
    $("reviewCandidateSearch").addEventListener("input", () => {
      page = 0;
      refreshQueue();
    });
    $("reviewReload").addEventListener("click", loadCandidates);
    $("reviewPrev").addEventListener("click", () => {
      page = Math.max(0, page - 1);
      refreshQueue();
    });
    $("reviewNext").addEventListener("click", () => {
      page += 1;
      refreshQueue();
    });
    loadCandidates();
  }

  root.BlackwoodReviewDesk = Object.freeze({
    initialise, openReview, refreshQueue, statusText
  });
})(window);
