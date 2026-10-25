import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {createSetupCheck} from './handler.ts';
const auth={persistSession:false,autoRefreshToken:false};
function service(){
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)throw Error('Server configuration missing');
 return createClient(url,key,{auth});
}
Deno.serve(createSetupCheck({
 env:name=>Deno.env.get(name),
 async isAdmin(token){
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_ANON_KEY');
  if(!url||!key)return false;
  const {data,error}=await createClient(url,key,{auth}).auth.getUser(token);
  if(error||!data.user)return false;
  const profile=await service().from('member_profiles').select('is_admin').eq('id',data.user.id).maybeSingle();
  return !profile.error&&profile.data?.is_admin===true;
 },
 async checkDatabase(){
  const client=service();
  const tables=['bp_reading_catalog','bp_reading_memberships','bp_reading_purchases','bp_reading_state','bp_reading_releases','bp_reading_checkout_intents','bp_reading_membership_receipts'];
  const results=await Promise.all(tables.map(table=>client.from(table).select('*').limit(0)));
  return results.every(result=>!result.error);
 },
 fetch:(...args)=>fetch(...args)
}));
