import assert from 'node:assert/strict';
import {createSetupCheck} from '../supabase/functions/bp-reading-setup-check/handler.ts';
function fixture(overrides={}) {
 const vars={SUPABASE_URL:'https://supabase.invalid',SUPABASE_ANON_KEY:'never-output-anon',SHOPIFY_STORE_DOMAIN:'example.myshopify.com',SHOPIFY_CLIENT_ID:'test-client',SHOPIFY_CLIENT_SECRET:'never-output-secret',SHOPIFY_STOREFRONT_TOKEN:'never-output-storefront',SHOPIFY_WEBHOOK_SECRET:'never-output-signing',...overrides.env};
 const calls=[];
 const handler=createSetupCheck({env:name=>vars[name],isAdmin:async()=>!overrides.nonAdmin,checkDatabase:async()=>!overrides.missingTables,
 fetch:async(url,options)=>{
  calls.push(url);const body=String(options.body);
  assert(!body.includes('mutation'),'readiness must not mutate Shopify');
  if(url.includes('/functions/v1/')){assert.equal(options.method,'GET');return new Response('',{status:overrides.checkoutStatus||405,headers:{'X-BP-Reading-Checkout':overrides.oldCheckout?'old':'controlled-test-v2','Access-Control-Allow-Origin':'https://blackwoodpublishing.co.uk'}});}
  if(url.includes('oauth'))return overrides.badAuth?new Response('',{status:401}):Response.json({access_token:'never-output-admin',expires_in:86400});
  if(url.includes('/admin/api/'))return Response.json({data:{currentAppInstallation:{accessScopes:[{handle:'read_orders'},{handle:'read_products'}]},plan:{fields:[{name:'sellingPlanId'}]},transaction:{fields:[{name:'processedAt'}]}}});
  if(overrides.storefrontStatus)return new Response('',{status:overrides.storefrontStatus});
  if(overrides.graphqlDenied)return Response.json({errors:[{message:'never-output-storefront',extensions:{code:'ACCESS_DENIED'},path:['productByHandle','sellingPlanGroups']}]});
  const product={
    variants:{nodes:[{id:overrides.wrongVariant?'gid://shopify/ProductVariant/1':'gid://shopify/ProductVariant/60163522265433'}]},
    sellingPlanGroups:{nodes:overrides.noPlan?[]:[{sellingPlans:{nodes:[{id:overrides.changedPlan?'gid://shopify/SellingPlan/1':'gid://shopify/SellingPlan/697040896345'}]}}]}
  };
  return Response.json({data:{productByHandle:overrides.hiddenProduct?null:product}});
 }});return {handler,calls};
}
const req=()=>new Request('https://service.invalid',{method:'POST',headers:{Origin:'https://blackwoodpublishing.co.uk',Authorization:'Bearer admin-jwt'},body:'{}'});
let f=fixture();let response=await f.handler(req());assert.equal(response.status,200);let data=await response.json();assert(data.checks.every(check=>check.ok));assert.equal(data.billingTested,false);assert(!JSON.stringify(data).includes('never-output'));assert.equal(f.calls.length,4);
f=fixture({nonAdmin:true});response=await f.handler(req());assert.equal(response.status,403);assert.equal(f.calls.length,0);
for(const config of [{oldCheckout:true},{checkoutStatus:503},{checkoutStatus:401},{storefrontStatus:401},{storefrontStatus:403},{graphqlDenied:true},{wrongVariant:true},{noPlan:true},{changedPlan:true},{env:{SHOPIFY_READING_SELLING_PLAN_ID:'697040896345'}},{badAuth:true},{hiddenProduct:true},{missingTables:true},{env:{SHOPIFY_STOREFRONT_TOKEN:''}},{env:{SHOPIFY_STORE_DOMAIN:''}}]) {
 f=fixture(config);response=await f.handler(req());data=await response.json();assert(data.checks.some(check=>!check.ok),JSON.stringify(config));assert.equal(typeof data.note,'string');assert.equal(data.billingTested,false);assert(!JSON.stringify(data).includes('never-output'));
}
const cases=[
 [{storefrontStatus:401},/HTTP 401/],
 [{graphqlDenied:true},/ACCESS_DENIED.*sellingPlanGroups/],
 [{hiddenProduct:true},/product is not visible/],
 [{wrongVariant:true},/variant 60163522265433 was not returned/],
 [{noPlan:true},/no selling plans/],
 [{changedPlan:true},/Visible public plan IDs/]
];
for(const [config,pattern] of cases){const result=await (await fixture(config).handler(req())).json();assert.match(result.checks.find(c=>c.name==='Storefront subscription access').detail,pattern);}
console.log('PASS admin-only setup check: no Shopify mutations, app authentication, permission/schema checks, annual plan visibility, missing configuration and secret-free reports');
