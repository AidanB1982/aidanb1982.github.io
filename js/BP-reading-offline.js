/* Device storage is not DRM. Never store tokens or private Storage URLs here. */
export const OFFLINE_WINDOW = 7 * 24 * 60 * 60 * 1000;
export const offlineBookKey = book => Number.isSafeInteger(book.arcAssignmentId)&&book.arcAssignmentId>0 ? `arc:${book.arcAssignmentId}` : book.publicTextId ? `public:${book.publicTextId}` : `edition:${book.editionId}`;
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
    const metadata=Object.fromEntries(['id','editionId','bookId','publicTextId','title','author','cover','coverAlt','series','seriesOrder','collection','readingOrder','description','arcAssignmentId','arcReference','arcTermsAccepted','reviewDue','reviewLink'].map(k=>[k,book[k]??null]));
    if(!globalThis.crypto?.subtle)throw Error('Encrypted offline storage is unavailable in this browser.');
    const encryptionKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(userId+':'+id+':'+expiresAt)},encryptionKey,bytes);
    await this.transact('readwrite',store=>store.put({key:userId+':'+id,userId,id,book:metadata,ciphertext,encryptionKey,iv,expiresAt,cryptoVersion:2,lastSeen:now}));
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
    return crypto.subtle.decrypt({name:'AES-GCM',iv:row.iv,additionalData:new TextEncoder().encode(userId+':'+row.id+(row.cryptoVersion===2?':'+row.expiresAt:''))},row.encryptionKey,row.ciphertext);
  }
  async remove(userId,id) {await this.transact('readwrite',store=>store.delete(userId+':'+id));}
  async clear(userId) {for(const row of await this.transact('readonly',store=>store.getAll()))if(row.userId===userId)await this.remove(userId,row.id);}
}
export async function prepareOfflineShell() {
  if(!('serviceWorker' in navigator)||!window.isSecureContext)throw Error('Offline reading needs HTTPS and a supported browser.');
  const registration=await navigator.serviceWorker.register('/bp-reading-sw.js?v=20261030-arc-offline2',{scope:'/pages/bp-reading.html',type:'module',updateViaCache:'none'});
  await registration.update();
  await navigator.serviceWorker.ready;
  // An updated worker may be installed but waiting behind another reader tab.
  // Ask that worker to activate, and follow registration changes rather than
  // holding a worker that the browser may replace during the update.
  const worker=await new Promise((resolve,reject)=>{
    const watched=new Set();
    const finish=(error,value)=>{clearTimeout(timer);registration.removeEventListener?.('updatefound',changed);for(const item of watched)item.removeEventListener?.('statechange',changed);error?reject(error):resolve(value);};
    const changed=()=>{
      const candidate=registration.installing||registration.waiting||registration.active;
      if(!candidate)return;
      if(candidate.state==='activated'){finish(null,candidate);return;}
      if(!watched.has(candidate)){watched.add(candidate);candidate.addEventListener?.('statechange',changed);}
      if(candidate.state==='installed')candidate.postMessage({type:'ACTIVATE_READER'});
    };
    const timer=setTimeout(()=>finish(Error('The offline reader update is waiting. Close other BP Reading tabs, then try Save offline again online.')),45000);
    registration.addEventListener?.('updatefound',changed);changed();
  });
  await new Promise((resolve,reject)=>{
    const channel=new MessageChannel(),timer=setTimeout(()=>reject(Error('The offline reader could not finish saving. Try again online.')),45000);
    channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();event.data?.revision!==6?reject(Error('An older offline reader is still active. Refresh this page while online and try again.')):event.data?.ok?resolve():reject(Error(typeof event.data?.error==='string'?event.data.error:'Offline preparation failed without a resource detail. Refresh online and try again.'));};
    worker.postMessage({type:'PREPARE_READER'},[channel.port2]);
  });
}
