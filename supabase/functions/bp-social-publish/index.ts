import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {createMetaPublisher} from './meta.ts';
import {createSocialWorker} from './handler.ts';
const env=(name:string)=>Deno.env.get(name)||'';
const publisher=createMetaPublisher(env);
function database(){const url=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY');if(!url||!key)throw Error('CONFIG');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
Deno.serve(createSocialWorker({
 secret:()=>env('BP_SOCIAL_CRON_SECRET'),enabled:()=>env('BP_SOCIAL_PUBLISHING_ENABLED')==='true',configured:()=>publisher.configured(),
 async claim(){const {data,error}=await database().rpc('bp_social_claim');if(error)throw Error('DATABASE');return data?.[0]||null;},
 async finish(post,result){const {data,error}=await database().rpc('bp_social_finish',{p_id:post.id,p_claim:post.delivery_claim,p_state:result.state,p_provider_id:result.providerId,p_error:result.message});if(error)throw Error('DATABASE');return data===true;},
 publish:post=>publisher.publish(post)
}));
