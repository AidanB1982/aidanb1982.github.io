import assert from 'node:assert/strict';
import {prepareOfflineShell} from '../js/BP-reading-offline.js';
const messages=[];
const worker=reply=>({state:'activated',postMessage(message,ports){messages.push(message);ports[0].postMessage(reply);ports[0].close();}});
const oldWorker=worker({ok:false});
let reply={ok:true,revision:6},updates=0;
const registration={active:oldWorker,async update(){updates++;this.active=worker(reply);}};
Object.defineProperty(globalThis,'window',{value:{isSecureContext:true},configurable:true});
Object.defineProperty(globalThis,'navigator',{value:{serviceWorker:{ready:Promise.resolve(registration),async register(url,options){assert.match(url,/bp-reading-sw\.js\?v=/);assert.equal(options.updateViaCache,'none');assert.equal(options.type,'module');assert.equal(options.scope,'/pages/bp-reading.html');registration.active=oldWorker;return registration;}}},configurable:true});
await prepareOfflineShell();assert.equal(updates,1);assert.equal(messages.length,1,'only the updated worker handles preparation');
reply={ok:false,revision:6,error:'Offline reader could not cache /css/example.css (HTTP 503).'};
await assert.rejects(()=>prepareOfflineShell(),/example.css.*503/);
reply={ok:false};await assert.rejects(()=>prepareOfflineShell(),/older offline reader/);
// Reproduce a waiting update while another tab still owns the previous worker.
const listeners=new Set();let activationRequests=0;
registration.update=async function(){updates++;this.active=oldWorker;this.waiting={state:'installed',addEventListener(type,fn){listeners.add(fn);},removeEventListener(type,fn){listeners.delete(fn);},postMessage(message){assert.equal(message.type,'ACTIVATE_READER');activationRequests++;this.state='activated';for(const fn of [...listeners])fn();this.postMessage=worker({ok:true,revision:6}).postMessage;}};};
// Switch the message handler before the resolved activation promise continues.
await prepareOfflineShell();assert.equal(activationRequests,1);assert.equal(listeners.size,0);
console.log('PASS stale-worker recovery: versioned registration, cache bypass, explicit update before preparation, protocol check and resource error propagation');
