import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {createOrderReconciliation} from './handler.ts';
import {verifyAndApplyReadingOrder} from '../bp-reading-shopify-webhook/handler.ts';
import {createReadingPaymentService} from '../bp-reading-shopify-webhook/shopify-service.ts';
const paymentService=createReadingPaymentService(name=>Deno.env.get(name));
Deno.serve(createOrderReconciliation({
  async isAdmin(token){
    const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!url||!anon||!key)return false;
    const auth={persistSession:false,autoRefreshToken:false};
    const {data,error}=await createClient(url,anon,{auth}).auth.getUser(token);
    if(error||!data.user)return false;
    const profile=await createClient(url,key,{auth}).from('member_profiles').select('is_admin').eq('id',data.user.id).maybeSingle();
    return !profile.error&&profile.data?.is_admin===true;
  },
  resolveOrderName:name=>paymentService.resolveOrderName(name),
  reconcile:orderId=>verifyAndApplyReadingOrder(orderId,'orders/paid',paymentService)
}));
