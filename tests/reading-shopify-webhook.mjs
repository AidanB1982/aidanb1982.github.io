import assert from 'node:assert/strict';
import {createShopifyWebhook} from '../supabase/functions/bp-reading-shopify-webhook/handler.ts';
const shop='test.myshopify.com',secret='test-signing-key';
const order={id:'gid://shopify/Order/123',financialStatus:'PAID',currency:'GBP',intentId:'10000000-0000-0000-0000-000000000001',variantId:'gid://shopify/ProductVariant/60163522265433',sellingPlanId:'gid://shopify/SellingPlan/697040896345',quantity:1,lineCount:1,lineAmount:'10.99',paidAt:'2026-10-25T12:00:00Z'};
async function request({topic='orders/paid',invalid=false,wrongShop=false}={}) {
 const body=JSON.stringify(topic==='refunds/create'?{order_id:123}:{id:123,admin_graphql_api_id:order.id});
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const mac=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body)));
 const signature=btoa(String.fromCharCode(...mac));
 return new Request('https://service.invalid',{method:'POST',body,headers:{'X-Shopify-Shop-Domain':wrongShop?'wrong.myshopify.com':shop,'X-Shopify-Topic':topic,'X-Shopify-Hmac-Sha256':invalid?'invalid':signature}});
}
function fixture(overrides={}) {const events=[];let loads=0;const handler=createShopifyWebhook({env:name=>({SHOPIFY_STORE_DOMAIN:shop,SHOPIFY_WEBHOOK_SECRET:secret})[name],loadOrder:async()=>{loads++;return {...order,...overrides};},applyPayment:async(...args)=>events.push(['paid',...args]),revokePayment:async id=>events.push(['revoke',id]),log:()=>{}});return {handler,events,get loads(){return loads;}};}
let f=fixture();assert.equal((await f.handler(await request())).status,200);assert.deepEqual(f.events[0],['paid',order.intentId,`shopify:${shop}:${order.id}`,order.paidAt]);
for(const config of [{invalid:true},{wrongShop:true}]){f=fixture();assert.equal((await f.handler(await request(config))).status,401);assert.equal(f.loads,0);assert.equal(f.events.length,0);}
for(const overrides of [{sellingPlanId:null},{financialStatus:'AUTHORIZED'},{currency:'USD'},{lineAmount:'0.00'},{intentId:null},{paidAt:null},{quantity:2},{lineCount:2}]){f=fixture(overrides);assert.equal((await f.handler(await request())).status,503,JSON.stringify(overrides));assert.equal(f.events.length,0);}
f=fixture({financialStatus:'REFUNDED'});assert.equal((await f.handler(await request({topic:'refunds/create'}))).status,200);assert.equal(f.events[0][0],'revoke');
f=fixture({financialStatus:'PARTIALLY_REFUNDED'});assert.equal((await f.handler(await request({topic:'refunds/create'}))).status,200);assert.equal(f.events.length,0);
console.log('PASS Shopify webhook: raw-body HMAC, expected shop, verified order lookup, annual offer checks, trusted paid timestamp, no grant from browser data, full refunds and partial-refund review');
