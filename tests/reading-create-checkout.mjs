import assert from 'node:assert/strict';
import {createCheckoutHandler} from '../supabase/functions/bp-reading-create-checkout/handler.ts';
const plan='gid://shopify/SellingPlan/123';
const variant='gid://shopify/ProductVariant/60163522265433';
function fixture(config={}) {
  const calls=[];
  const env={BP_READING_CHECKOUT_ENABLED:'true',BP_READING_CUSTOMER_ACCESS:'true',SHOPIFY_STORE_DOMAIN:'example.myshopify.com',SHOPIFY_STOREFRONT_TOKEN:'public-test-token',SHOPIFY_READING_SELLING_PLAN_ID:plan,...config.env};
  const handler=createCheckoutHandler({env:key=>env[key],authenticate:async()=>config.denied?null:'verified-user',isAdmin:async()=>config.admin===true,
    createIntent:async user=>{calls.push(['intent',user]);return 'intent-uuid';},attachCart:async(...args)=>{calls.push(['attach',...args]);},failIntent:async id=>calls.push(['failed',id]),
    fetch:async(url,options)=>{assert.equal(url,'https://example.myshopify.com/api/2026-10/graphql.json');const body=JSON.parse(options.body);assert.equal(body.variables.input.lines[0].sellingPlanId,plan);assert.equal(body.variables.input.lines[0].merchandiseId,variant);assert.equal(body.variables.input.attributes[0].value,'intent-uuid');return Response.json({data:{cartCreate:{cart:{id:'cart',checkoutUrl:'https://example.myshopify.com/checkouts/test',cost:{subtotalAmount:{amount:config.wrongPrice?'0.00':'10.99',currencyCode:'GBP'}},lines:{nodes:[{quantity:1,merchandise:{id:variant},sellingPlanAllocation:config.noPlan?null:{sellingPlan:{id:plan}}}]}},userErrors:[]}}});}
  });return {handler,calls};
}
const req=(action)=>new Request('https://service.invalid',{method:'POST',headers:{Origin:'https://blackwoodpublishing.co.uk',Authorization:'Bearer valid-token'},body:JSON.stringify(action?{action}:{})});
let f=fixture();let response=await f.handler(req());assert.equal(response.status,200);assert.equal((await response.json()).intentId,'intent-uuid');assert.deepEqual(f.calls,[['intent','verified-user'],['attach','intent-uuid','cart']]);
for(const config of [{denied:true},{wrongPrice:true},{noPlan:true},{env:{SHOPIFY_READING_SELLING_PLAN_ID:''}},{env:{BP_READING_CHECKOUT_ENABLED:'false'}},{env:{BP_READING_CUSTOMER_ACCESS:'false'}}]){f=fixture(config);response=await f.handler(req());assert.notEqual(response.status,200,JSON.stringify(config));assert.equal(f.calls.some(c=>c[0]==='attach'),false);}
f=fixture({admin:true,env:{BP_READING_CHECKOUT_ENABLED:'false',BP_READING_CUSTOMER_ACCESS:'false'}});response=await f.handler(req('admin_preview'));assert.equal(response.status,200);assert.equal((await response.json()).preview,true);
f=fixture({admin:false,env:{BP_READING_CHECKOUT_ENABLED:'false',BP_READING_CUSTOMER_ACCESS:'false'}});response=await f.handler(req('admin_preview'));assert.equal(response.status,403);assert.equal(f.calls.length,0,'non-admin cannot create preview intent');
f=fixture({admin:true,env:{BP_READING_CHECKOUT_ENABLED:'false',BP_READING_CUSTOMER_ACCESS:'false'}});response=await f.handler(req());assert.equal(response.status,503,'admin ordinary subscription route remains launch-gated');
console.log('PASS checkout creation: authenticated account binding, configured annual plan, fixed variant, GBP price verification, no one-time fallback, disabled launch gate and failed-cart handling');
