import assert from 'node:assert/strict';
import {createOrderReconciliation} from '../supabase/functions/bp-reading-reconcile-order/handler.ts';
import {verifyAndApplyReadingOrder} from '../supabase/functions/bp-reading-shopify-webhook/handler.ts';
const gid='gid://shopify/Order/123';
const paid={id:gid,test:true,financialStatus:'PAID',currency:'GBP',intentId:'10000000-0000-0000-0000-000000000001',variantId:'gid://shopify/ProductVariant/60163522265433',sellingPlanId:'gid://shopify/SellingPlan/697040896345',quantity:1,lineCount:1,lineAmount:'10.99',paidAt:'2026-10-25T12:00:00Z'};
function fixture(overrides={}) {
 const events=[];let loads=0,searches=0;
 const service={env:name=>({SHOPIFY_STORE_DOMAIN:'test.myshopify.com'})[name],loadOrder:async id=>{loads++;assert.equal(id,gid);return {...paid,...overrides};},allowTestPayment:async()=>overrides.allowTest!==false,applyPayment:async(...args)=>events.push(args),revokePayment:async()=>{},log:()=>{}};
 const handler=createOrderReconciliation({isAdmin:async()=>overrides.admin!==false,resolveOrderName:async name=>{searches++;assert.equal(name,'#1017');return overrides.notFound?null:gid;},reconcile:id=>verifyAndApplyReadingOrder(id,'orders/paid',service)});
 return {handler,events,get loads(){return loads;},get searches(){return searches;}};
}
const req=(body={orderName:'#1017'},auth=true)=>new Request('https://service.invalid',{method:'POST',headers:{Origin:'https://blackwoodpublishing.co.uk',...(auth?{Authorization:'Bearer admin-jwt'}:{})},body:JSON.stringify(body)});
let f=fixture();let response=await f.handler(req());assert.equal(response.status,200);assert.equal(f.searches,1);assert.equal(f.loads,1);assert.equal(f.events.length,1);assert.equal(f.events[0][0],paid.intentId,'only Shopify-verified checkout owns the grant');
f=fixture();response=await f.handler(req({orderId:'123',userId:'attacker',paid:true,accessUntil:'2099-01-01'}));assert.equal(response.status,200);assert.equal(f.events[0][0],paid.intentId,'browser entitlement assertions ignored');
f=fixture({admin:false});assert.equal((await f.handler(req())).status,403);assert.equal(f.loads,0);assert.equal(f.searches,0);assert.equal(f.events.length,0);
f=fixture();assert.equal((await f.handler(req({},false))).status,401);assert.equal(f.loads,0);
f=fixture({notFound:true});assert.equal((await f.handler(req())).status,404);assert.equal(f.loads,0);
for(const overrides of [{financialStatus:'AUTHORIZED'},{lineAmount:'0.00'},{sellingPlanId:null},{intentId:null}]) {
 f=fixture(overrides);response=await f.handler(req());assert.equal(response.status,503);assert.equal(f.events.length,0);assert((await response.json()).phase);
}
f=fixture({allowTest:false});assert.equal((await f.handler(req())).status,200);assert.equal(f.events.length,0,'test-account protection retained during recovery');
f=fixture();assert.equal((await f.handler(req({orderName:'#1017 OR paid:true'}))).status,400);assert.equal(f.searches,0);
console.log('PASS admin order recovery: verified role, exact order lookup, shared paid-offer checks, immutable checkout ownership, denied unpaid/free orders and no browser-supplied grants');
