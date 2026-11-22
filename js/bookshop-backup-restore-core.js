"use strict";
/*
 * JSON backup import safety helpers.
 * Only restores new records from the existing outreach JSON array format.
 * Never replaces records, rewrites contact history or sends messages.
 */
(function (root) {
  const MAX_BYTES = 5 * 1024 * 1024;
  const MAX_RECORDS = 10000;
  const MAX_NODES = 100000;
  const STATUSES = new Set([
    "prospect", "contacted", "interested", "stockist", "opted-out"
  ]);
  const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

  function safeTree(value) {
    let visited = 0;
    function check(node, depth) {
      visited++;
      if (visited > MAX_NODES || depth > 16) {
        throw new Error("Backup is too large or deeply nested.");
      }
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        for (const item of node) check(item, depth + 1);
        return;
      }
      for (const [key, item] of Object.entries(node)) {
        if (FORBIDDEN_KEYS.has(key)) {
          throw new Error("Backup contains an unsafe property name.");
        }
        check(item, depth + 1);
      }
    }
    check(value, 0);
  }

  function validateShop(shop, index) {
    const invalid = reason => {
      throw new Error("Backup record " + (index + 1) + ": " + reason);
    };
    if (!shop || Array.isArray(shop) || typeof shop !== "object") {
      invalid("expected a bookshop object.");
    }
    for (const [field, max] of [
      ["id", 200], ["name", 300], ["town", 200]
    ]) {
      if (typeof shop[field] !== "string" ||
          !shop[field].trim() || shop[field].length > max) {
        invalid("missing or invalid " + field + ".");
      }
    }
    if (shop.status !== undefined && !STATUSES.has(shop.status)) {
      invalid("unrecognised outreach status.");
    }
    for (const field of ["email", "website", "notes", "osmId", "reviewOrigin",
      "followUpDate", "address"]) {
      if (shop[field] !== undefined && typeof shop[field] !== "string") {
        invalid("invalid " + field + ".");
      }
    }
    if (shop.notes && shop.notes.length > 50000) invalid("notes are too long.");
    if (shop.contactHistory !== undefined &&
        (!Array.isArray(shop.contactHistory) ||
          shop.contactHistory.length > 5000)) {
      invalid("invalid contact history.");
    }
    if (shop.contactHistory?.some(item =>
      !item || Array.isArray(item) || typeof item !== "object")) {
      invalid("invalid contact history entry.");
    }
    for (const field of ["verification", "contactReview"]) {
      if (shop[field] !== undefined &&
          (!shop[field] || typeof shop[field] !== "object" ||
            Array.isArray(shop[field]))) {
        invalid("invalid " + field + " object.");
      }
    }
    for (const field of ["lat", "lng"]) {
      const coord = shop[field];
      if (coord !== undefined && coord !== null &&
          (typeof coord !== "number" || !Number.isFinite(coord) ||
            Math.abs(coord) > (field === "lat" ? 90 : 180))) {
        invalid("invalid " + field + " coordinate.");
      }
    }
  }

  function parseBackup(raw) {
    if (typeof raw !== "string" || !raw.trim()) {
      throw new Error("Choose a nonempty JSON backup file.");
    }
    if (raw.length > MAX_BYTES) {
      throw new Error("This backup exceeds the 5 MB import limit.");
    }
    let rows;
    try {
      rows = JSON.parse(raw);
    } catch {
      throw new Error("The backup is not valid JSON.");
    }
    if (!Array.isArray(rows)) {
      throw new Error("Expected the bookshop JSON backup array, not an object.");
    }
    if (rows.length > MAX_RECORDS) {
      throw new Error("This backup contains too many records.");
    }
    safeTree(rows);
    const ids = new Set();
    rows.forEach((shop, index) => {
      validateShop(shop, index);
      if (ids.has(shop.id)) {
        throw new Error("The backup repeats a bookshop record ID.");
      }
      ids.add(shop.id);
    });
    return rows;
  }

  function planImport(existing, backup, sameBookshop) {
    if (!Array.isArray(existing) || !Array.isArray(backup) ||
        typeof sameBookshop !== "function") {
      throw new Error("Unable to compare saved bookshop records.");
    }
    const seen = [...existing];
    const additions = [];
    let skipped = 0;
    for (const record of backup) {
      if (seen.some(item => item.id === record.id ||
        sameBookshop(item, record))) {
        skipped++;
        continue;
      }
      additions.push(record);
      seen.push(record);
    }
    return {additions, skipped, existing: existing.length,
      incoming: backup.length};
  }

  if (root) {
    root.BlackwoodBackupRestore = Object.freeze({
      parseBackup, planImport, MAX_BYTES, MAX_RECORDS
    });
  }
})(typeof window === "undefined" ? null : window);
