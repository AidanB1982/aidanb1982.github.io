import assert from 'node:assert/strict';
import {createSetupCheck} from '../supabase/functions/bp-reading-setup-check/handler.ts';
function fixture(overrides={}) {
 const vars={SHOPIFY_STORE_DOMAIN:'example.myshopify.com',SHOPIFY_CLIENT_ID:'test-client',SHOPIFY_CLIENT_SECRET:'never-output-secret',SHOPIFY_STOREFRONT_TOKEN:'never-output-storefront',SHOPIFY_WEBHOOK_SECRET:'never-output-signing',...overrides.env};
 const calls=[];
 const handler=createSetupCheck({env:name=>vars[name],isAdmin:async()=>!overrides.nonAdmin,checkDatabase:async()=>!overrides.missingTables,
 fetch:async(url,options)=>{
  calls.push(url);const body=String(options.body);
  assert(!body.includes('mutation'),'readiness must not mutate Shopify');
  if(url.includes('oauth'))return overrides.badAuth?new Response('',{status:401}):Response.json({access_token:'never-output-admin',expires_in:86400});
  if(url.includes('/admin/api/'))return Response.json({data:{currentAppInstallation:{accessScopes:[{handle:'read_orders'},{handle:'read_products'}]},plan:{fields:[{name:'sellingPlanId'}]},transaction:{fields:[{name:'processedAt'}]}}});
  const product={
    variants:{nodes:[{id:'gid://shopify/ProductVariant/60163522265433'}]},
    sellingPlanGroups:{nodes:[{sellingPlans:{nodes:[{id:'gid://shopify/SellingPlan/697040896345'}]}}]}
  };
  return Response.json({data:{productByHandle:overrides.hiddenProduct?null:product}});
 }});return {handler,calls};
}
const req=()=>new Request('https://service.invalid',{method:'POST',headers:{Origin:'https://blackwoodpublishing.co.uk',Authorization:'Bearer admin-jwt'},body:'{}'});
let f=fixture();let response=await f.handler(req());assert.equal(response.status,200);let data=await response.json();assert(data.checks.every(check=>check.ok));assert.equal(data.billingTested,false);assert(!JSON.stringify(data).includes('never-output'));assert.equal(f.calls.length,3);
f=fixture({nonAdmin:true});response=await f.handler(req());assert.equal(response.status,403);assert.equal(f.calls.length,0);
for(const config of [{badAuth:true},{hiddenProduct:true},{missingTables:true},{env:{SHOPIFY_STOREFRONT_TOKEN:''}},{env:{SHOPIFY_STORE_DOMAIN:''}}]) {
 f=fixture(config);response=await f.handler(req());data=await response.json();assert(data.checks.some(check=>!check.ok),JSON.stringify(config));assert.equal(typeof data.note,'string');assert.equal(data.billingTested,false);assert(!JSON.stringify(data).includes('never-output'));
}
console.log('PASS admin-only setup check: no Shopify mutations, app authentication, permission/schema checks, annual plan visibility, missing configuration and secret-free reports');
