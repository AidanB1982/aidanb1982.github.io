"use strict";
/*
 * Private, administrator-initialised, browser-local backup restore.
 * Selection only previews: changes require a separate confirmation click.
 */
(function (root) {
  const $ = id => document.getElementById(id);
  let api = null;
  let pending = null;
  let pendingFileName = "";
  let pendingBaseline = "";

  function describe(message) {
    const status = $("backupRestoreStatus");
    if (status) status.textContent = message;
  }

  function resetPreview(message) {
    pending = null;
    pendingBaseline = "";
    pendingFileName = "";
    if ($("backupRestoreConfirm")) $("backupRestoreConfirm").disabled = true;
    if ($("backupRestorePreview")) $("backupRestorePreview").hidden = true;
    if (message) describe(message);
  }

  function snapshot() {
    return JSON.stringify(api.getShops());
  }

  async function inspectFile() {
    resetPreview();
    if (!api || !root.BlackwoodBackupRestore) return;
    const input = $("backupRestoreFile");
    const file = input?.files?.[0];
    if (!file) {
      describe("Choose an exported Blackwood bookshop JSON file to preview.");
      return;
    }
    if (file.size > root.BlackwoodBackupRestore.MAX_BYTES) {
      describe("That file exceeds the 5 MB safety limit. No data changed.");
      return;
    }
    try {
      const raw = await file.text();
      // The selected file could change while file.text is running.
      if (input.files?.[0] !== file) return;
      const backup = root.BlackwoodBackupRestore.parseBackup(raw);
      const baseline = snapshot();
      const plan = root.BlackwoodBackupRestore.planImport(
        api.getShops(), backup, api.sameBookshop
      );
      pending = backup;
      pendingBaseline = baseline;
      pendingFileName = file.name;
      $("backupRestorePreview").hidden = false;
      $("backupRestoreSummary").textContent =
        "File: " + file.name + ". " +
        plan.incoming + " backup records; " +
        plan.additions.length + " new bookshops to add; " +
        plan.skipped + " duplicates to skip; " +
        plan.existing + " existing records will remain unchanged.";
      $("backupRestoreConfirm").disabled = !plan.additions.length;
      describe(plan.additions.length ?
        "Preview only. No records have been imported. Confirm to add new records." :
        "Nothing new to import. Your existing records are unchanged.");
    } catch (error) {
      resetPreview("Import rejected: " + error.message + " No data changed.");
    }
  }

  function confirmRestore() {
    if (!api || !pending || !pendingBaseline) return;
    if (snapshot() !== pendingBaseline) {
      resetPreview("Your saved records changed since the preview. Select the backup again before importing.");
      return;
    }
    try {
      const plan = root.BlackwoodBackupRestore.planImport(
        api.getShops(), pending, api.sameBookshop
      );
      if (!plan.additions.length) {
        resetPreview("No new bookshops were available to add.");
        return;
      }
      const confirmed = root.confirm(
        "Add " + plan.additions.length + " bookshop records from " +
        pendingFileName + "?\n\n" +
        "Existing records will not be overwritten. This only changes " +
        "the current browser's private workspace."
      );
      if (!confirmed) return;
      // Detect modifications while the confirmation dialog was displayed.
      if (snapshot() !== pendingBaseline) {
        resetPreview("Saved records changed during confirmation. Import cancelled.");
        return;
      }
      if (!api.saveShops([...api.getShops(), ...plan.additions])) {
        resetPreview("Unable to write restored records. Current data should be checked; export a backup.");
        return;
      }
      const count = plan.additions.length;
      api.render();
      if ($("backupRestoreFile")) $("backupRestoreFile").value = "";
      resetPreview("Added " + count + " bookshop records. " +
        plan.skipped + " existing or duplicate records were skipped. " +
        "Existing records were not overwritten. Export a fresh backup now.");
    } catch (error) {
      resetPreview("Import stopped: " + error.message + " No data changed.");
    }
  }

  function initialise(adapter) {
    if (!root.BlackwoodBackupRestore || !$("backupRestoreFile")) return;
    api = adapter;
    $("backupRestoreFile").addEventListener("change", inspectFile);
    $("backupRestoreConfirm").addEventListener("click", confirmRestore);
    describe("Select a previously exported Blackwood JSON backup. Choosing a file does not change saved data.");
  }

  root.BlackwoodBackupDesk = Object.freeze({initialise});
})(window);
