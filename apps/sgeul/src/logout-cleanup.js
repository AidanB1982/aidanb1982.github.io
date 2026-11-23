// Clear this user's reader data without affecting another account.
// Offline EPUB copies are cleared separately via OfflineLibrary.clear().
export function clearReadingStateForUser(storage, userId) {
  if (!storage || typeof userId !== "string" || !userId.trim())
    throw Error("An account is required to clear local reading state.");
  const prefixes = [
    "bp-reading:" + userId + ":",
    "bp-reading-outbox:" + userId + ":",
    "bp-reading-revision:" + userId + ":",
  ];
  for (let index = storage.length - 1; index >= 0; index--) {
    const key = storage.key(index);
    if (key && prefixes.some(prefix => key.startsWith(prefix)))
      storage.removeItem(key);
  }
}
