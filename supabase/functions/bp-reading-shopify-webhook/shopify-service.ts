import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {createAdminTokenProvider} from './shopify-auth.ts';
import type {PaidOrder,ReadingPaymentDependencies} from './handler.ts';

export function createReadingPaymentService(env:(name:string)=>string|undefined,fetcher:typeof fetch=fetch):ReadingPaymentDependencies & {resolveOrderName(name:string):Promise<string|null>} {
  const getAdminToken=createAdminTokenProvider(env,fetcher);
  function service(){
    const url=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY');
    if(!url||!key)throw Error('Missing server configuration');
    return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  }
  async function adminQuery(query:string,variables:Record<string,unknown>){
    const shop=env('SHOPIFY_STORE_DOMAIN')||'',token=await getAdminToken();
    if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)||!token)throw Error('SHOPIFY_CONFIG_MISSING');
    const lookup=(accessToken:string)=>fetcher(`https://${shop}/admin/api/2026-10/graphql.json`,{method:'POST',headers:{'Content-Type':'application/json','X-Shopify-Access-Token':accessToken},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(20000)});
    let response=await lookup(token);
    if(response.status===401)response=await lookup(await getAdminToken(true));
    if(!response.ok)throw Error('SHOPIFY_ORDER_HTTP_'+response.status);
    const result=await response.json();
    if(result.errors?.length) {
      // Report only schema/scope codes and field names, never response bodies.
      const codes=[...new Set(result.errors.map((e:{extensions?:{code?:unknown}})=>e.extensions?.code).filter((c:unknown)=>typeof c==='string'&&/^[A-Za-z_]{1,60}$/.test(c as string)))];
      const paths=[...new Set(result.errors.flatMap((e:{path?:unknown})=>Array.isArray(e.path)?e.path.filter(p=>typeof p==='string'&&/^[A-Za-z_]{1,60}$/.test(p)):[]))];
      throw Error(('SHOPIFY_ORDER_GRAPHQL_'+(codes.join('_')||'ERROR')+'_'+paths.slice(0,8).join('_')).toUpperCase().slice(0,300));
    }
    return result.data;
  }
  return {
    env,log:(message,level='error')=>{if(level==='info')console.info(message);else console.error(message);},
    async resolveOrderName(name){
      if(!/^#[0-9]{1,20}$/.test(name))throw Error('INVALID_ORDER_NAME');
      const data=await adminQuery('query ReadingOrderByName($search:String!){orders(first:2,query:$search){nodes{id name}}}',{search:'status:any name:'+JSON.stringify(name)});
      const matches=(data?.orders?.nodes||[]).filter((row:{name:string})=>row.name===name);
      return matches.length===1?matches[0].id:null;
    },
    async loadOrder(id):Promise<PaidOrder>{
    const query=`query ReadingPaidOrder($id:ID!){order(id:$id){id test displayFinancialStatus currencyCode customAttributes{key value} lineItems(first:2){nodes{quantity variant{id} sellingPlan{sellingPlanId} discountedTotalSet{shopMoney{amount currencyCode}} customAttributes{key value}}} transactions(first:100){kind status processedAt}}}`;
    const data=await adminQuery(query,{id}),order=data?.order;
    if(!order)throw Error('SHOPIFY_ORDER_NOT_FOUND');
    const lines=order.lineItems?.nodes||[],line=lines[0];
    const attributes=[...(order.customAttributes||[]),...(line?.customAttributes||[])];
    const intent=attributes.find((a:{key:string})=>a.key==='bp_reading_intent'||a.key==='_bp_reading_intent')?.value;
    const paid=(order.transactions||[]).filter((t:{kind:string;status:string;processedAt:string})=>['SALE','CAPTURE'].includes(t.kind)&&t.status==='SUCCESS'&&Number.isFinite(Date.parse(t.processedAt))).map((t:{processedAt:string})=>t.processedAt).sort((a:string,b:string)=>Date.parse(b)-Date.parse(a));
    return {id:order.id,test:order.test,financialStatus:order.displayFinancialStatus,currency:order.currencyCode,intentId:intent||null,variantId:line?.variant?.id||null,sellingPlanId:line?.sellingPlan?.sellingPlanId||null,quantity:line?.quantity||0,lineCount:lines.length,lineAmount:line?.discountedTotalSet?.shopMoney?.amount||'',paidAt:paid[0]||null};
  },
  async allowTestPayment(intent){
    const tester=(env('BP_READING_TEST_USER_ID')||'').trim().toLowerCase();
    if(env('BP_READING_TEST_PAYMENTS')!=='true'||!tester)return false;
    const {data,error}=await service().from('bp_reading_checkout_intents').select('user_id').eq('id',intent).maybeSingle();
    return !error&&data?.user_id===tester;
  },
  async applyPayment(intent,payment,date){const {error}=await service().rpc('bp_reading_apply_membership_payment',{p_intent_id:intent,p_payment_id:payment,p_paid_at:date});if(error)throw Error('MEMBERSHIP_SAVE_'+(/^[A-Za-z0-9_]{1,40}$/.test(error.code||'')?error.code:'FAILED'));},
  async revokePayment(payment){const {error}=await service().rpc('bp_reading_revoke_membership_payment',{p_payment_id:payment});if(error)throw Error('Refund update failed');}
  };
}
