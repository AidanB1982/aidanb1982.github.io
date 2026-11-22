"use strict";

/*
 * Human verification is separate from outreach status and stocking claims.
 * This is a helper for the administrator-only, browser-local outreach desk.
 * No discovery listing is verified merely because it appears on the map.
 */
(function (root) {
  const LABELS = Object.freeze({
    unreviewed: "Not yet checked",
    "needs-review": "Research needed",
    "verified-independent": "Manually verified independent",
    "not-independent": "Not an independent bookshop",
    closed: "Closed / no longer trading"
  });

  function evidenceUrl(value) {
    if (!value || typeof value !== "string") return "";
    try {
      const url = new URL(value.trim());
      return ["https:", "http:"].includes(url.protocol) &&
        url.hostname && !url.username && !url.password ? url.href : "";
    } catch {
      return "";
    }
  }

  function statusOf(shop) {
    const status = shop?.verification?.status;
    return Object.hasOwn(LABELS, status) ? status : "unreviewed";
  }

  function createReview({status, sourceUrl, notes}, oldReview, checkedAt) {
    if (!Object.hasOwn(LABELS, status)) {
      throw new Error("Choose a recognised verification status.");
    }
    const source = evidenceUrl(sourceUrl);
    const rawSource = String(sourceUrl || "").trim();
    if (rawSource && !source) {
      throw new Error("Verification evidence must be an HTTP or HTTPS URL.");
    }
    const note = String(notes || "").trim().slice(0, 2000);
    if (status === "verified-independent" && !source) {
      throw new Error("A verified independent shop needs an evidence URL.");
    }
    if (["not-independent", "closed"].includes(status) && !source && !note) {
      throw new Error("Record a source link or a reason for excluding this shop.");
    }
    if (status === "unreviewed") {
      return {status, sourceUrl: source, notes: note, checkedAt: ""};
    }
    const same = oldReview?.status === status &&
      oldReview?.sourceUrl === source &&
      oldReview?.notes === note &&
      /^\d{4}-\d{2}-\d{2}$/.test(oldReview.checkedAt || "");
    const date = String(checkedAt || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error("A valid review date is needed.");
    }
    return {
      status, sourceUrl: source, notes: note,
      checkedAt: same ? oldReview.checkedAt : date
    };
  }

  function candidateScore(shop) {
    return (shop?.website ? 3 : 0) +
      (shop?.town ? 2 : 0) + (shop?.address ? 1 : 0);
  }

  if (root) {
    root.BlackwoodVerification = Object.freeze({
      LABELS, evidenceUrl, statusOf, createReview, candidateScore
    });
  }
})(typeof window === "undefined" ? null : window);
