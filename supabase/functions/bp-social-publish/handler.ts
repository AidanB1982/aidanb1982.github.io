import type {SocialPost,SocialResult} from './meta.ts';
export type SocialWorkerDeps={
 secret:()=>string;enabled:()=>boolean;configured:()=>boolean;
 claim:()=>Promise<SocialPost|null>;finish:(post:SocialPost,result:SocialResult)=>Promise<boolean>;
 publish:(post:SocialPost)=>Promise<SocialResult>;
};
async function equalSocialSecret(a:string,b:string){const digest=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));const [x,y]=await Promise.all([digest(a),digest(b)]);let different=0;for(let i=0;i<x.length;i++)different|=x[i]^y[i];return different===0;}
export function createSocialWorker(deps:SocialWorkerDeps){return async(request:Request)=>{
 const json=(status:number,data:unknown)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
 if(request.method!=='POST')return json(405,{error:'Use POST.'});
 const secret=deps.secret();if(secret.length<32)return json(503,{error:'The scheduler secret is not configured.'});
 const supplied=request.headers.get('x-bp-social-secret')||'';
 if(!supplied||supplied.length>512||!await equalSocialSecret(supplied,secret))return json(401,{error:'Scheduler authentication failed.'});
 if(!deps.enabled())return json(200,{state:'paused',message:'Automatic publishing is switched off.'});
 if(!deps.configured())return json(503,{error:'Meta publishing credentials are not configured.'});
 try{
  const post=await deps.claim();if(!post)return json(200,{state:'idle'});
  const result=await deps.publish(post);
  if(!await deps.finish(post,result))return json(503,{error:'The outcome could not be recorded. Check the social account; this delivery will not be retried automatically.'});
  return json(200,{state:result.state,postId:post.id,providerId:result.providerId});
 }catch{return json(503,{error:'The scheduler stopped before confirmation. Check the social account and delivery status before retrying.'});}
};}
