import assert from 'node:assert/strict';
import {initializeReadingCheckout} from '../js/BP-reading-checkout.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
class Element extends EventTarget {disabled=false;hidden=true;textContent='';click(){this.dispatchEvent(new Event('click'));}}
function fixture(options={}) {
  const button=new Element(),status=new Element(),retry=new Element();
  const timers=[];let payment='pending',invocations=0;
  const popup={closed:false,opener:{},document:{},location:{replace(value){popup.url=value;}},close(){this.closed=true;}};
  const events=[];
  const platform={open(){return options.blocked?null:popup;},setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){},dispatchEvent(event){events.push(event);}};
  const client={functions:{async invoke(){invocations++;if(options.error)return {error:{context:options.errorBody?Response.json(options.errorBody):undefined}};return {data:{intentId:'verified-intent',checkoutUrl:'https://example.myshopify.com/checkouts/annual'}};}},rpc:async()=>({data:[{status:payment,access_until:'2099-10-25T12:00:00Z'}]})};
  const controller=initializeReadingCheckout(client,{button,status,retry},platform);
  return {button,status,retry,popup,events,timers,controller,setPayment:value=>{payment=value;},get invocations(){return invocations;}};
}
let f=fixture({blocked:true});f.button.click();await tick();assert.equal(f.invocations,0);assert.match(f.status.textContent,/blocked/);f.controller.stop();
f=fixture({error:true});f.button.click();await tick();assert.equal(f.popup.closed,true);assert.equal(f.events.length,0);assert.match(f.status.textContent,/could not be prepared/);f.controller.stop();
f=fixture();f.button.click();await tick();assert.equal(f.popup.url,'https://example.myshopify.com/checkouts/annual');assert.equal(f.popup.opener,null);assert.equal(f.events.length,0);f.popup.closed=true;await f.timers.shift()();await tick();assert.equal(f.events.length,0,'popup closure never grants access');f.setPayment('paid');f.retry.click();await tick();assert.equal(f.events.length,1);assert.equal(f.events[0].type,'bp-reading-membership-confirmed');assert.match(f.status.textContent,/2099/);assert.equal(f.button.disabled,true);f.controller.reset();f.setPayment('pending');f.button.click();await tick();assert.equal(f.invocations,2,'reset starts a fresh checkout instead of reopening the paid one');f.controller.stop();
f=fixture();f.button.click();await tick();f.setPayment('refunded');f.retry.click();await tick();assert.equal(f.events.length,0);assert.match(f.status.textContent,/refunded/);f.controller.stop();
for (const [body,pattern] of [
 [{error:'Membership checkout is not ready yet.'},/BP_READING_TEST_USER_ID/],
 [{error:'Annual subscription checkout is not configured.'},/Storefront token/],
 [{message:'Invalid JWT'},/sign-in token/],
 [{error:'untrusted arbitrary never-output-secret'},/could not be prepared/]
]) {
 f=fixture({error:true,errorBody:body});f.button.click();await tick();await tick();
 assert.equal(f.popup.closed,true);assert.match(f.status.textContent,pattern);assert(!f.status.textContent.includes('never-output-secret'));assert.equal(f.events.length,0);f.controller.stop();
}
console.log('PASS popup: popup-blocked handling, launch failure recovery, retained website, no access on close, server-only payment confirmation, refund state and logout cleanup');
