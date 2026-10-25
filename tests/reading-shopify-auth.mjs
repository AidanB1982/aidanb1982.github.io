import assert from 'node:assert/strict';
import {createAdminTokenProvider} from '../supabase/functions/bp-reading-shopify-webhook/shopify-auth.ts';
let clock=100000,calls=0;
const values={SHOPIFY_STORE_DOMAIN:'example.myshopify.com',SHOPIFY_CLIENT_ID:'test-client',SHOPIFY_CLIENT_SECRET:'test-secret'};
const env=name=>values[name];
const provider=createAdminTokenProvider(env,async(url,options)=>{
  calls++;assert.equal(url,'https://example.myshopify.com/admin/oauth/access_token');
  const form=new URLSearchParams(options.body);assert.equal(form.get('grant_type'),'client_credentials');assert.equal(form.get('client_id'),'test-client');assert.equal(form.get('client_secret'),values.SHOPIFY_CLIENT_SECRET);
  return Response.json({access_token:'token-'+calls,expires_in:86400});
},()=>clock);
assert.deepEqual(await Promise.all([provider(),provider()]),['token-1','token-1']);assert.equal(calls,1);
assert.equal(await provider(),'token-1');clock+=86400*1000;assert.equal(await provider(),'token-2');
assert.equal(await provider(true),'token-3');values.SHOPIFY_CLIENT_SECRET='rotated-secret';assert.equal(await provider(),'token-4');
const failed=createAdminTokenProvider(env,async()=>new Response('',{status:401}));await assert.rejects(()=>failed(),/authentication failed/);
const malformed=createAdminTokenProvider(env,async()=>Response.json({access_token:'token'}));await assert.rejects(()=>malformed(),/invalid app token/);
const legacy=createAdminTokenProvider(name=>({SHOPIFY_STORE_DOMAIN:'example.myshopify.com',SHOPIFY_ADMIN_ACCESS_TOKEN:'legacy'})[name]);assert.equal(await legacy(),'legacy');
console.log('PASS Shopify app authentication: client-credentials form, concurrent cache, expiry renewal, forced retry, secret rotation and rejection of invalid tokens');
