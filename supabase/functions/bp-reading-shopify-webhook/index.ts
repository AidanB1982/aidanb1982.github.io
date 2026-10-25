import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {createShopifyWebhook,type PaidOrder} from './handler.ts';
function service(){
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!key)throw Error('Missing server configuration');
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
Deno.serve(createShopifyWebhook({
  env:name=>Deno.env.get(name),log:message=>console.error(message),
  async loadOrder(id):Promise<PaidOrder>{
    const shop=Deno.env.get('SHOPIFY_STORE_DOMAIN')||'',token=Deno.env.get('SHOPIFY_ADMIN_ACCESS_TOKEN');
    if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)||!token)throw Error('Missing Shopify configuration');
    const query=`query ReadingPaidOrder($id:ID!){order(id:$id){id displayFinancialStatus currencyCode customAttributes{key value} lineItems(first:2){nodes{quantity variant{id} sellingPlan{sellingPlanId} discountedTotalSet{shopMoney{amount currencyCode}} customAttributes{key value}}} transactions(first:100){kind status processedAt}}}`;
    const response=await fetch(`https://${shop}/admin/api/2026-10/graphql.json`,{method:'POST',headers:{'Content-Type':'application/json','X-Shopify-Access-Token':token},body:JSON.stringify({query,variables:{id}}),signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error('Shopify could not verify the order');
    const result=await response.json(),order=result.data?.order;
    if(result.errors?.length||!order)throw Error('Order verification failed');
    const lines=order.lineItems?.nodes||[],line=lines[0];
    const attributes=[...(order.customAttributes||[]),...(line?.customAttributes||[])];
    const intent=attributes.find((a:{key:string})=>a.key==='bp_reading_intent'||a.key==='_bp_reading_intent')?.value;
    const paid=(order.transactions||[]).filter((t:{kind:string;status:string;processedAt:string})=>['SALE','CAPTURE'].includes(t.kind)&&t.status==='SUCCESS'&&Number.isFinite(Date.parse(t.processedAt))).map((t:{processedAt:string})=>t.processedAt).sort((a:string,b:string)=>Date.parse(b)-Date.parse(a));
    return {id:order.id,financialStatus:order.displayFinancialStatus,currency:order.currencyCode,intentId:intent||null,variantId:line?.variant?.id||null,sellingPlanId:line?.sellingPlan?.sellingPlanId||null,quantity:line?.quantity||0,lineCount:lines.length,lineAmount:line?.discountedTotalSet?.shopMoney?.amount||'',paidAt:paid[0]||null};
  },
  async applyPayment(intent,payment,date){const {error}=await service().rpc('bp_reading_apply_membership_payment',{p_intent_id:intent,p_payment_id:payment,p_paid_at:date});if(error)throw Error('Membership update failed');},
  async revokePayment(payment){const {error}=await service().rpc('bp_reading_revoke_membership_payment',{p_payment_id:payment});if(error)throw Error('Refund update failed');}
}));
