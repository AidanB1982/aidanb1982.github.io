"use strict";
/*
 * Browser-local public business contact provenance.
 * A verified independent bookshop is NOT a confirmed stockist, and a
 * published business address is NOT permission to send marketing emails.
 * No automatic collection, recipient import or sending is performed here.
 */
(function (root) {
  function businessEmail(value) {
    const email = String(value || "").trim().toLowerCase();
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? email : "";
  }

  function publicSourceUrl(value) {
    if (!value || typeof value !== "string") return "";
    try {
      const url = new URL(value.trim());
      return ["https:", "http:"].includes(url.protocol) &&
        url.hostname && !url.username && !url.password ? url.href : "";
    } catch {
      return "";
    }
  }

  function validCheckedDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }
    const date = new Date(value + "T12:00:00Z");
    return !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value;
  }

  function isReady(shop) {
    if (!shop || !shop.email || shop.status === "opted-out") return false;
    // Preserve existing manually-created records and their previous behaviour.
    if (shop.reviewOrigin !== "public-directory") return true;
    if (root.BlackwoodVerification?.statusOf(shop) !== "verified-independent") {
      return false;
    }
    const review = shop.contactReview;
    return review?.approved === true &&
      Boolean(businessEmail(shop.email)) &&
      businessEmail(review.email) === businessEmail(shop.email) &&
      Boolean(publicSourceUrl(review.sourceUrl)) &&
      validCheckedDate(review.checkedAt);
  }

  function createReview(input, shop, checkedAt) {
    const email = businessEmail(input?.email);
    if (!email) {
      throw new Error("Enter a valid public business email address.");
    }
    const sourceUrl = publicSourceUrl(input?.sourceUrl);
    if (!sourceUrl) {
      throw new Error("Provide the public webpage where the business email was checked.");
    }
    if (!validCheckedDate(checkedAt)) {
      throw new Error("A valid check date is required.");
    }
    const notes = String(input?.notes || "").trim().slice(0, 2000);
    const approved = input?.approved === true;
    if (approved && root.BlackwoodVerification?.statusOf(shop) !==
        "verified-independent") {
      throw new Error("Verify this shop's independence before approving outreach.");
    }
    if (approved && shop?.status === "opted-out") {
      throw new Error("Do not approve a bookshop marked Do not contact.");
    }
    const old = shop?.contactReview || {};
    const unchanged = old.email === email &&
      old.sourceUrl === sourceUrl &&
      old.notes === notes && old.approved === approved &&
      validCheckedDate(old.checkedAt);
    return {
      email, sourceUrl, notes, approved,
      checkedAt: unchanged ? old.checkedAt : checkedAt
    };
  }

  if (root) {
    root.BlackwoodContactReview = Object.freeze({
      businessEmail, publicSourceUrl, validCheckedDate, isReady, createReview
    });
  }
})(typeof window === "undefined" ? null : window);
