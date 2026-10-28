/* Device storage is not DRM. Never store tokens or private Storage URLs here. */
export const OFFLINE_WINDOW = 7 * 24 * 60 * 60 * 1000;
export const offlineBookKey = book => book.publicTextId ? `public:${book.publicTextId}` : `edition:${book.editionId}`;
export class OfflineLibrary {
  constructor(factory=globalThis.indexedDB,now=()=>Date.now()) {this.factory=factory;this.now=now;}
  async db() {
    if(!this.factory)throw Error('Offline storage is unavailable in this browser.');
    if(!this.pending)this.pending=new Promise((resolve,reject)=>{
      const request=this.factory.open('bp-reading-offline-v1',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('books',{keyPath:'key'});
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(Error('Close other reading tabs and try again.'));
    });
    return this.pending;
  }
  async transact(mode,action) {
    const db=await this.db();return new Promise((resolve,reject)=>{
      const tx=db.transaction('books',mode),request=action(tx.objectStore('books'));
      tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Offline storage failed.'));
    });
  }
  async save(userId,book,bytes,expiresAt) {
    const now=this.now();
    if(!userId||!(bytes instanceof ArrayBuffer)||bytes.byteLength<4||bytes.byteLength>100*1024*1024||
      !Number.isFinite(expiresAt)||expiresAt<=now||expiresAt>now+OFFLINE_WINDOW+60000)throw Error('A fresh online access check is required before saving.');
    const sig=new Uint8Array(bytes,0,4);if(sig[0]!==80||sig[1]!==75||sig[2]!==3||sig[3]!==4)throw Error('This book could not be saved.');
    const id=offlineBookKey(book);
    // Explicit allowlist: no session, auth token, signed URL, server path or admin identity.
    const metadata=Object.fromEntries(['id','editionId','bookId','publicTextId','title','author','cover','coverAlt','series','seriesOrder','collection','readingOrder','description'].map(k=>[k,book[k]??null]));
    if(!globalThis.crypto?.subtle)throw Error('Encrypted offline storage is unavailable in this browser.');
    const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(userId+':'+id)},encryptionKey,bytes);
    await this.transact('readwrite',store=>store.put({key:userId+':'+id,userId,id,book:metadata,ciphertext,encryptionKey,iv,expiresAt,lastSeen:now}));
  }
  async list(userId) {
    const rows=await this.transact('readonly',store=>store.getAll()),now=this.now(),valid=[];
    for(const row of rows) {
      if(row.userId!==userId)continue;
      if(row.expiresAt<=now||now+300000<row.lastSeen){await this.remove(userId,row.id);continue;}
      valid.push(row);
    }
    return valid;
  }
  async read(userId,book) {
    const row=(await this.list(userId)).find(row=>row.id===offlineBookKey(book));
    if(!row)throw Error('This book is not saved offline, or its offline access has expired. Reconnect to refresh it.');
    row.lastSeen=Math.max(row.lastSeen,this.now());await this.transact('readwrite',store=>store.put(row));
    return crypto.subtle.decrypt({name:'AES-GCM',iv:row.iv,additionalData:new TextEncoder().encode(userId+':'+row.id)},row.encryptionKey,row.ciphertext);
  }
  async remove(userId,id) {await this.transact('readwrite',store=>store.delete(userId+':'+id));}
  async clear(userId) {for(const row of await this.transact('readonly',store=>store.getAll()))if(row.userId===userId)await this.remove(userId,row.id);}
}
export async function prepareOfflineShell() {
  if(!('serviceWorker' in navigator)||!window.isSecureContext)throw Error('Offline reading needs HTTPS and a supported browser.');
  const registration=await navigator.serviceWorker.register('/bp-reading-sw.js',{scope:'/pages/bp-reading.html'});
  await navigator.serviceWorker.ready;
  const worker=registration.active||registration.waiting||registration.installing;
  if(!worker)throw Error('The offline reader is not ready yet.');
  await new Promise((resolve,reject)=>{
    const channel=new MessageChannel(),timer=setTimeout(()=>reject(Error('The offline reader could not finish saving. Try again online.')),45000);
    channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();event.data?.ok?resolve():reject(Error('The offline reader could not be saved. Please try again online.'));};
    worker.postMessage({type:'PREPARE_READER'},[channel.port2]);
  });
}
