import { test } from "node:test";
import assert from "node:assert/strict";
import { clearReadingStateForUser } from "../src/logout-cleanup.js";

function fixture(keys) {
  const values = new Map(keys.map(key => [key, "saved"]));
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    removeItem(key) { values.delete(key); },
    keys() { return [...values.keys()]; },
  };
}
test("sign-out clears primary, outbox and revision keys only for that account", () => {
  const storage = fixture([
    "bp-reading:A:edition:2:v2", "bp-reading:A:arc-assignment:4:v1",
    "bp-reading-outbox:A:2", "bp-reading-revision:A:2",
    "bp-reading:B:edition:2:v2", "bp-reading-outbox:B:2",
    "bp-reading-revision:B:2", "bp-reading:A-other:edition:2:v2",
    "other-setting",
  ]);
  clearReadingStateForUser(storage, "A");
  assert.deepEqual(storage.keys(), [
    "bp-reading:B:edition:2:v2", "bp-reading-outbox:B:2",
    "bp-reading-revision:B:2", "bp-reading:A-other:edition:2:v2",
    "other-setting",
  ]);
});
test("missing user identity does not delete anything", () => {
  const storage = fixture(["bp-reading:A:edition:2:v2"]);
  assert.throws(() => clearReadingStateForUser(storage, ""), /account is required/i);
  assert.deepEqual(storage.keys(), ["bp-reading:A:edition:2:v2"]);
});
