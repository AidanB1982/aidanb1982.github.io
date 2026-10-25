import assert from 'node:assert/strict';
import {ReadingAccount} from '../js/BP-reading-account.js';
const storage = () => {const values = new Map(); return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
function backend() {
  let row = null;
  return {
    get row() {return row;},
    client: {
      from() {return {select() {return this;},eq() {return this;},maybeSingle:async()=>({data:row})};},
      async rpc(name,args) {
        if ((row?.revision||0)!==args.p_expected_revision) return {error:{code:'40001'}};
        row = {payload:args.p_payload,revision:(row?.revision||0)+1}; return {data:row.revision};
      }
    }
  };
}
const remote = backend();
const device1 = storage(), device2 = storage();
const messages = [];
const first = new ReadingAccount(remote.client,'reader',2,m=>messages.push(m),device1);
assert.equal(await first.load(),null);
first.schedule({progress:10,annotations:[{note:'A private thought'}]}); await first.flush();
assert.equal(remote.row.revision,1);
assert.equal(device1.getItem(first.outboxKey),null);
const second = new ReadingAccount(remote.client,'reader',2,m=>messages.push(m),device2);
assert.equal((await second.load()).progress,10);
first.schedule({progress:20}); await first.flush();
second.schedule({progress:30}); await second.flush();
assert.equal(second.conflict,true);
assert.equal(remote.row.payload.progress,20,'stale device does not overwrite');
assert.equal(JSON.parse(device2.getItem(second.outboxKey)).payload.progress,30,'conflicting local work preserved');
assert.equal((await second.useServerCopy()).progress,20);
assert.equal(second.conflict,false);
second.schedule({progress:40}); await second.flush(); assert.equal(remote.row.payload.progress,40);
const reloaded = new ReadingAccount(remote.client,'reader',2,m=>messages.push(m),device1);
await reloaded.load();
reloaded.schedule({progress:50}); reloaded.stop();
const reopened = new ReadingAccount(remote.client,'reader',2,m=>messages.push(m),device1);
assert.equal((await reopened.load()).progress,50,'outbox survives refresh'); await reopened.flush(); assert.equal(remote.row.payload.progress,50);
const offline = new ReadingAccount({from(){throw Error('not deployed');}},'reader',2,m=>messages.push(m),storage());
await offline.load();offline.schedule({progress:60});await offline.flush();assert.equal(offline.ready,false);assert.equal(JSON.parse(offline.storage.getItem(offline.outboxKey)).payload.progress,60);
let release;
const delayed = backend();
const rpc = delayed.client.rpc;
delayed.client.rpc = async (...args)=> {await new Promise(resolve=>{release=resolve;}); return rpc(...args);};
const concurrent = new ReadingAccount(delayed.client,'reader',2,()=>{},storage()); await concurrent.load();
concurrent.schedule({progress:1}); const inFlight = concurrent.flush();
concurrent.schedule({progress:2});release(); await inFlight;
assert.equal(JSON.parse(concurrent.storage.getItem(concurrent.outboxKey)).revision,1,'outbox base revision advances after in-flight save');
assert.equal(concurrent.pending.progress,2,'edits during save retained');
for (const account of [first,second,reloaded,reopened,offline,concurrent]) account.stop();
console.log('PASS reader sync: cross-device load, private notebook payloads, CAS conflicts, explicit server reload, persistent outbox, missing backend fallback, edits during in-flight save');
