import assert from 'node:assert/strict';
import {createShopifyWebhook} from '../supabase/functions/bp-reading-shopify-webhook/handler.ts';
const shop='test.myshopify.com',secret='test-signing-key';
const order={test:false,id:'gid://shopify/Order/123',financialStatus:'PAID',currency:'GBP',intentId:'10000000-0000-0000-0000-000000000001',variantId:'gid://shopify/ProductVariant/60163522265433',sellingPlanId:'gid://shopify/SellingPlan/697040896345',quantity:1,lineCount:1,lineAmount:'10.99',paidAt:'2026-10-25T12:00:00Z'};
async function request({topic='orders/paid',invalid=false,wrongShop=false}={}) {
 const body=JSON.stringify(topic==='refunds/create'?{order_id:123}:{id:123,admin_graphql_api_id:order.id});
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const mac=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body)));
 const signature=btoa(String.fromCharCode(...mac));
 return new Request('https://service.invalid',{method:'POST',body,headers:{'X-Shopify-Shop-Domain':wrongShop?'wrong.myshopify.com':shop,'X-Shopify-Topic':topic,'X-Shopify-Hmac-Sha256':invalid?'invalid':signature}});
}
function fixture(overrides={}) {const events=[],logs=[];let loads=0;const handler=createShopifyWebhook({env:name=>({SHOPIFY_STORE_DOMAIN:shop,SHOPIFY_WEBHOOK_SECRET:secret})[name],loadOrder:async()=>{loads++;if(overrides.orderError)throw Error(overrides.orderError);return {...order,...overrides};},allowTestPayment:async()=>overrides.allowTest===true,applyPayment:async(...args)=>events.push(['paid',...args]),revokePayment:async id=>events.push(['revoke',id]),log:message=>logs.push(message)});return {handler,events,logs,get loads(){return loads;}};}
let f=fixture();assert.equal((await f.handler(await request())).status,200);assert.deepEqual(f.events[0],['paid',order.intentId,`shopify:${shop}:${order.id}`,order.paidAt]);
for(const config of [{invalid:true},{wrongShop:true}]){f=fixture();assert.equal((await f.handler(await request(config))).status,401);assert.equal(f.loads,0);assert.equal(f.events.length,0);}
for(const overrides of [{sellingPlanId:null},{financialStatus:'AUTHORIZED'},{currency:'USD'},{lineAmount:'0.00'},{intentId:null},{paidAt:null},{quantity:2},{lineCount:2}]){f=fixture(overrides);assert.equal((await f.handler(await request())).status,503,JSON.stringify(overrides));assert.equal(f.events.length,0);}
f=fixture({financialStatus:'REFUNDED'});assert.equal((await f.handler(await request({topic:'refunds/create'}))).status,200);assert.equal(f.events[0][0],'revoke');
f=fixture({financialStatus:'PARTIALLY_REFUNDED'});assert.equal((await f.handler(await request({topic:'refunds/create'}))).status,200);assert.equal(f.events.length,0);
f=fixture({test:true});assert.equal((await f.handler(await request())).status,200);assert.equal(f.events.length,0,'simulated payment is ignored without test-account approval');
f=fixture({test:true,allowTest:true});assert.equal((await f.handler(await request())).status,200);assert.equal(f.events[0][0],'paid');assert.match(f.events[0][2],/^shopify-test:/,'test receipt provenance retained');
f=fixture({orderError:'SHOPIFY_ORDER_GRAPHQL_ACCESS_DENIED_ORDER'});await f.handler(await request());assert(f.logs.some(line=>line.includes('phase=ORDER_LOOKUP code=SHOPIFY_ORDER_GRAPHQL_ACCESS_DENIED_ORDER')));
f=fixture({sellingPlanId:null});await f.handler(await request());assert(f.logs.some(line=>line.includes('phase=SELLING_PLAN')));
f=fixture();await f.handler(await request({wrongShop:true}));assert(f.logs.some(line=>line.includes('BP_READING_WEBHOOK_SHOP_MISMATCH')));
f=fixture();await f.handler(await request({invalid:true}));assert(f.logs.some(line=>line.includes('INVALID_SIGNATURE')));
console.log('PASS Shopify webhook: raw-body HMAC, expected shop, verified order lookup, annual offer checks, trusted paid timestamp, no grant from browser data, full refunds and partial-refund review');
