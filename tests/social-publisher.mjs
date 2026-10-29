import assert from 'node:assert/strict';
import {createMetaPublisher} from '../supabase/functions/bp-social-publish/meta.ts';
import {createSocialWorker} from '../supabase/functions/bp-social-publish/handler.ts';
const settings={META_PAGE_ACCESS_TOKEN:'private-fixture-token',META_PAGE_ID:'123',BP_SOCIAL_PUBLISHING_ENABLED:'true'};
const post={id:'post-fixture',channel:'Facebook',content:'Approved book news',media_url:'',delivery_claim:'claim-fixture'};
let calls=[];
const mock=async(url,options)=>{calls.push({url,options});if(url.includes('?fields=id,name'))return Response.json({id:'123',name:'Blackwood',instagram_business_account:{id:'456',username:'blackwood'}});if(url.includes('?fields=status_code'))return Response.json({status_code:'FINISHED'});if(url.endsWith('/media_publish'))return Response.json({id:'888'});if(url.endsWith('/media'))return Response.json({id:'777'});return Response.json({id:'123_999'});};
const provider=createMetaPublisher(k=>settings[k],mock,async()=>{});
assert.equal(provider.configured(),true);let account=await provider.check();assert.equal(account.pageName,'Blackwood');assert.equal(account.instagramConnected,true);assert(calls.every(c=>c.options.method==='GET'),'connection check never publishes');assert(!JSON.stringify(account).includes('private-fixture-token'));
calls=[];let result=await provider.publish(post);assert.equal(result.state,'published');assert.equal(result.providerId,'123_999');assert.equal(calls.length,1);assert(calls[0].url.endsWith('/123/feed'));assert.equal(calls[0].options.headers.Authorization,'Bearer private-fixture-token');assert(!calls[0].url.includes('private-fixture-token'));
calls=[];result=await provider.publish({...post,media_url:'https://example.invalid/cover.jpg'});assert.equal(result.state,'published');assert(calls[0].url.endsWith('/123/photos'));assert.equal(calls[0].options.body.get('published'),'true');
calls=[];result=await provider.publish({...post,channel:'Instagram',media_url:'https://example.invalid/cover.jpg'});assert.equal(result.state,'published');assert.equal(result.providerId,'888');assert.equal(calls.filter(c=>c.url.endsWith('/media_publish')).length,1);
calls=[];assert.equal((await provider.publish({...post,channel:'Instagram'})).state,'failed');assert.equal(calls.length,0,'invalid Instagram media never invokes Meta');assert.equal((await provider.publish({...post,channel:'TikTok'})).state,'failed');assert.equal((await provider.publish({...post,media_url:'http://example.invalid/cover.jpg'})).state,'failed');
for(const [status,code,outcome] of [[401,190,'failed'],[403,200,'failed'],[429,4,'failed'],[500,2,'unknown']]){const p=createMetaPublisher(k=>settings[k],async()=>Response.json({error:{code,message:'private provider data'}},{status}));result=await p.publish(post);assert.equal(result.state,outcome);assert(!result.message.includes('private provider data'));}
const timeout=createMetaPublisher(k=>settings[k],async()=>{throw Error('private network data');});assert.equal((await timeout.publish(post)).state,'unknown');
const missingId=createMetaPublisher(k=>settings[k],async()=>Response.json({}));assert.equal((await missingId.publish(post)).state,'unknown','missing publication ID cannot silently retry');
let pendingCalls=[];const pending=createMetaPublisher(k=>settings[k],async(url,options)=>{pendingCalls.push(url);if(url.includes('?fields=status_code'))return Response.json({status_code:'IN_PROGRESS'});return mock(url,options);},async()=>{});assert.equal((await pending.publish({...post,channel:'Instagram',media_url:'https://example.invalid/cover.jpg'})).state,'failed');assert(!pendingCalls.some(u=>u.endsWith('/media_publish')),'unready Instagram container never publishes');
let claims=0,finishes=0,publishes=0,enabled=true;const secret='long-private-scheduler-fixture-secret';
const worker=createSocialWorker({secret:()=>secret,enabled:()=>enabled,configured:()=>true,claim:async()=>{claims++;return claims===1?post:null;},finish:async(p,r)=>{finishes++;assert.equal(p.delivery_claim,'claim-fixture');assert.equal(r.state,'published');return true;},publish:async()=>{publishes++;return {state:'published',providerId:'123_999',message:null};}});
const invoke=(key=secret,method='POST')=>worker(new Request('https://edge.invalid/worker',{method,headers:{'x-bp-social-secret':key}}));
assert.equal((await invoke('bad')).status,401);assert.equal((await invoke(secret,'GET')).status,405);assert.equal(claims,0);
enabled=false;assert.equal((await (await invoke()).json()).state,'paused');assert.equal(claims,0);enabled=true;
assert.equal((await (await invoke()).json()).state,'published');assert.equal(finishes,1);assert.equal(publishes,1);assert.equal((await (await invoke()).json()).state,'idle');assert.equal(publishes,1);
console.log('PASS Meta read-only connection, Facebook text/image, Instagram readiness, safe errors, ambiguous outcomes and authenticated paused/idempotent worker (mock APIs)');
let captured;
const uncertainWorker=createSocialWorker({secret:()=>secret,enabled:()=>true,configured:()=>true,claim:async()=>post,publish:async()=>({state:'unknown',providerId:null,message:'Check account before retrying.'}),finish:async(p,r)=>{captured=r;return true;}});
assert.equal((await (await uncertainWorker(new Request('https://edge.invalid/worker',{method:'POST',headers:{'x-bp-social-secret':secret}}))).json()).state,'unknown');assert.equal(captured.state,'unknown','ambiguous result is persisted for reconciliation');

// New-app Unified Login credentials are distinct from the working Facebook Page token.
const unifiedSettings={...settings,META_GRAPH_VERSION:'v26.0',META_INSTAGRAM_ACCOUNT_ID:'456',META_INSTAGRAM_ACCESS_TOKEN:'private-instagram-fixture'};
let unifiedCalls=[];
const unifiedTransport=async(url,options)=>{unifiedCalls.push({url,options});
 if(url.includes('/123?fields=id,name'))return Response.json({id:'123',name:'Blackwood'});
 if(url.includes('/456?fields=id,username'))return Response.json({id:'456',username:'aidan.blackwood'});
 if(url.includes('?fields=status_code'))return Response.json({status_code:'FINISHED'});
 if(url.endsWith('/media_publish'))return Response.json({id:'888'});
 if(url.endsWith('/media'))return Response.json({id:'777'});
 return Response.json({id:'123_999'});
};
const unified=createMetaPublisher(k=>unifiedSettings[k],unifiedTransport,async()=>{});
account=await unified.check();assert.equal(account.pageName,'Blackwood');assert.equal(account.instagramConnected,true);assert.equal(account.instagramUsername,'aidan.blackwood');assert.equal(account.instagramError,null);assert(unifiedCalls.every(c=>c.options.method==='GET'));assert(!JSON.stringify(account).includes('private-instagram-fixture'));
assert.equal(unifiedCalls[0].options.headers.Authorization,'Bearer private-fixture-token');assert.equal(unifiedCalls[1].options.headers.Authorization,'Bearer private-instagram-fixture');
unifiedCalls=[];result=await unified.publish({...post,channel:'Instagram',media_url:'https://example.invalid/cover.jpg'});assert.equal(result.state,'published');assert(unifiedCalls.every(c=>c.options.headers.Authorization==='Bearer private-instagram-fixture'));assert(unifiedCalls.every(c=>c.url.startsWith('https://graph.facebook.com/v26.0/')));assert.equal(unifiedCalls.filter(c=>c.url.endsWith('/media_publish')).length,1);
unifiedCalls=[];assert.equal((await unified.publish(post)).state,'published');assert.equal(unifiedCalls.length,1);assert.equal(unifiedCalls[0].options.headers.Authorization,'Bearer private-fixture-token');
for(const partial of [{META_INSTAGRAM_ACCOUNT_ID:''},{META_INSTAGRAM_ACCESS_TOKEN:''},{META_INSTAGRAM_ACCOUNT_ID:'wrong'}]){
 unifiedCalls=[];const partialConfig={...unifiedSettings,...partial};const p=createMetaPublisher(k=>partialConfig[k],unifiedTransport,async()=>{});
 account=await p.check();assert.equal(account.pageName,'Blackwood');assert.equal(account.instagramConnected,false);assert.match(account.instagramError,/Add both/);
 unifiedCalls=[];assert.equal((await p.publish({...post,channel:'Instagram',media_url:'https://example.invalid/cover.jpg'})).state,'failed');assert.equal(unifiedCalls.length,0,'partial credentials never fall back to another Instagram account');assert.equal((await p.publish(post)).state,'published');
}
const mismatched=createMetaPublisher(k=>unifiedSettings[k],async(url,options)=>{if(url.includes('/456?fields=id,username'))return Response.json({id:'999',username:'other'});return unifiedTransport(url,options);},async()=>{});
unifiedCalls=[];account=await mismatched.check();assert.equal(account.instagramConnected,false);assert.match(account.instagramError,/could not be verified/);
assert.equal((await mismatched.publish({...post,channel:'Instagram',media_url:'https://example.invalid/cover.jpg'})).state,'failed');assert(!unifiedCalls.some(c=>c.options.method==='POST'));
console.log('PASS Unified Login: direct IG identity verification, separate tokens for all IG requests, Facebook preservation, partial-config refusal and no fallback on wrong account');
