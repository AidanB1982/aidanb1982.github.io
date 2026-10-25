/* Optional Supabase persistence. Missing migrations never unlock paid content. */
export class ReadingAccount {
  constructor(client, userId, editionId, report, storage = localStorage) {
    this.client = client;
    this.userId = userId;
    this.editionId = editionId;
    this.report = report;
    this.storage = storage;
    this.outboxKey = `bp-reading-outbox:${userId}:${editionId}`;
    this.revision = 0;
    this.ready = false;
    this.stopped = false;
    this.conflict = false;
    this.pending = null;
    this.saving = false;
    this.timer = null;
  }
  async load() {
    let outbox = null;
    try { outbox = JSON.parse(this.storage.getItem(this.outboxKey)); } catch { /* Device storage may be unavailable. */ }
    try {
      const {data, error} = await this.client.from('bp_reading_state').select('payload,revision').eq('user_id',this.userId).eq('edition_id',this.editionId).maybeSingle();
      if (error) throw error;
      if (this.stopped) return null;
      this.revision = data?.revision || 0;
      this.ready = true;
      if (outbox?.payload && Number.isInteger(outbox.revision)) {
        if (outbox.revision !== this.revision) {
          this.conflict = true;
          this.report('Another device has newer reading data. Your unsynced local changes are preserved. Use “Load synced place” to choose the server copy.');
          return outbox.payload;
        }
        this.pending = outbox.payload;
        this.report('Restoring local changes waiting to sync…');
        return outbox.payload;
      }
      this.report('Reading sync connected');
      return data?.payload || null;
    } catch {
      this.report('Device-only mode · Supabase reader storage is not connected. Your place and notebook are saved in this browser.');
      return outbox?.payload || null;
    }
  }
  schedule(payload) {
    if (this.stopped) return;
    this.pending = structuredClone(payload);
    // Preserve unsynced work across refreshes and connectivity failures.
    try { this.storage.setItem(this.outboxKey,JSON.stringify({revision:this.revision,payload})); } catch { /* Main reader also reports local-save failures. */ }
    if (!this.ready || this.conflict) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), 1200);
  }
  async flush() {
    clearTimeout(this.timer);
    if (!this.ready || this.stopped || this.conflict || this.saving || !this.pending) return;
    this.saving = true;
    let succeeded = false;
    const payload = this.pending; this.pending = null;
    try {
      const {data,error} = await this.client.rpc('bp_reading_save_state', {p_edition_id:this.editionId,p_payload:payload,p_expected_revision:this.revision});
      if (error) throw error;
      if (!Number.isInteger(data) || data < 1) throw Error('Invalid sync response');
      this.revision = data;
      succeeded = true;
      if (this.pending) {
        try { this.storage.setItem(this.outboxKey,JSON.stringify({revision:this.revision,payload:this.pending})); } catch {}
      } else {
        try { this.storage.removeItem(this.outboxKey); } catch {}
      }
      if (!this.stopped) this.report('Reading synced · place, bookmarks, appearance & notebook');
    } catch (error) {
      if (!this.pending) this.pending = payload;
      if (error.code === '40001') {
        this.conflict = true;
        if (!this.stopped) this.report('Another device updated this book. Your local changes are preserved. Use “Load synced place” to choose the server copy.');
      } else if (!this.stopped) this.report('Sync paused · changes are saved on this device. Reopen the library when connected to retry.');
    } finally { this.saving = false; }
    if (succeeded && this.pending && !this.conflict && !this.stopped) {
      this.timer = setTimeout(() => void this.flush(), 1200);
    }
  }
  async useServerCopy() {
    if (this.saving) throw Error("A sync is in progress. Please try again in a moment.");
    const {data,error} = await this.client.from('bp_reading_state').select('payload,revision').eq('user_id',this.userId).eq('edition_id',this.editionId).maybeSingle();
    if (error || !data) throw Error('No synced reading place is available yet.');
    if (this.stopped) throw Error('Your session has ended.');
    clearTimeout(this.timer); this.pending = null; this.conflict = false; this.revision = data.revision; this.ready = true;
    try { this.storage.removeItem(this.outboxKey); } catch {}
    this.report('Loaded your synced reading data');
    return data.payload;
  }
  stop() { clearTimeout(this.timer); this.stopped = true; }
}
