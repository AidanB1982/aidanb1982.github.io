import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {createCheckoutHandler} from "./handler.ts";
const options={auth:{persistSession:false,autoRefreshToken:false}};
function service() {
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!key)throw Error('Server configuration missing');
  return createClient(url,key,options);
}
Deno.serve(createCheckoutHandler({
  env:name=>Deno.env.get(name),
  async authenticate(token){
    const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_ANON_KEY');
    if(!url||!key)throw Error('Server configuration missing');
    const {data,error}=await createClient(url,key,options).auth.getUser(token);
    return error?null:data.user?.id||null;
  },
  async isAdmin(userId){
    const {data,error}=await service().from('member_profiles').select('is_admin').eq('id',userId).maybeSingle();
    return !error&&data?.is_admin===true;
  },
  async createIntent(userId){
    const {data,error}=await service().from('bp_reading_checkout_intents').insert({user_id:userId}).select('id').single();
    if(error||!data)throw Error('Checkout could not be created');return data.id;
  },
  async attachCart(id,cartId){const {error}=await service().from('bp_reading_checkout_intents').update({shopify_cart_id:cartId}).eq('id',id);if(error)throw Error('Checkout could not be linked');},
  async failIntent(id){await service().from('bp_reading_checkout_intents').update({status:'failed'}).eq('id',id);},
  log:stage=>console.error('BP Reading checkout failed at '+stage),
  fetch:(...args)=>fetch(...args)
}));
