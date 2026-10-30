export type SocialPost={id:string;channel:string;content:string;media_url:string;delivery_claim:string};
export type SocialResult={state:'published'|'failed'|'unknown';providerId:string|null;message:string|null};
export class MetaError extends Error {ambiguous:boolean;constructor(message:string,ambiguous=false){super(message);this.ambiguous=ambiguous;}}
export function createMetaPublisher(env:(name:string)=>string|undefined,transport:typeof fetch=fetch,pause:(ms:number)=>Promise<void>=ms=>new Promise(resolve=>setTimeout(resolve,ms))){
 const config=()=>{const token=env('META_PAGE_ACCESS_TOKEN')||'',page=env('META_PAGE_ID')||'',version=env('META_GRAPH_VERSION')||'v24.0';if(!token||!/^\d+$/.test(page)||!/^v\d+\.\d+$/.test(version))throw new MetaError('Meta is not configured. Add META_PAGE_ACCESS_TOKEN and META_PAGE_ID in Supabase.');return {token,page,version};};
 function diagnostic(error:any){
  const parts:string[]=[];
  if(Number.isSafeInteger(error?.code))parts.push('code '+error.code);
  if(Number.isSafeInteger(error?.error_subcode))parts.push('subcode '+error.error_subcode);
  if(typeof error?.fbtrace_id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(error.fbtrace_id))parts.push('trace '+error.fbtrace_id);
  return parts.length?' [Meta '+parts.join(', ')+']':'';
 }
 async function graph(path:string,method='GET',fields?:Record<string,string>,tokenOverride?:string){
  const current=config(),token=tokenOverride??current.token,version=current.version;let response:Response;
  try{response=await transport(`https://graph.facebook.com/${version}/${path}`,{method,headers:{Authorization:'Bearer '+token,...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body:method==='POST'?new URLSearchParams(fields):undefined,redirect:'error',signal:AbortSignal.timeout(method==='GET'?10000:20000)});}catch{throw new MetaError('Meta did not confirm the request. Check the social account before retrying.',method==='POST');}
  let data:any;try{data=await response.json();}catch{throw new MetaError('Meta returned an unreadable response. Check the social account before retrying.',method==='POST');}
  if(!response.ok||data.error){const code=data.error?.code,detail=diagnostic(data.error);if(method==='POST'&&(response.status>=500||code===1||code===2))throw new MetaError('Meta did not confirm publication. Check the social account before retrying.'+detail,true);throw new MetaError((code===190?'The Meta access token expired or is invalid. Update it in Supabase.':code===10||code===200?'Meta denied publishing permission. Check app permissions and Page access.':response.status===429?'Meta is rate limiting requests. Try scheduling again later.':'Meta rejected the request. Check image format, account permissions and platform restrictions.')+detail,method==='POST'&&(response.status>=500||code===1||code===2));}
  return data;
 }
 async function verifyPageToken(){
  const {page}=config(),identity=await graph('me?fields=id,name');
  if(String(identity.id)!==page)throw new MetaError('META_PAGE_ACCESS_TOKEN does not identify the configured Facebook Page. Save the Page access token returned in the Page query, rather than the Explorer User token.');
 }
 async function account(){const {page}=config();const data=await graph(page+'?fields=id,name,instagram_business_account{id,username}');if(String(data.id)!==page)throw new MetaError('The configured Facebook Page could not be verified.');return data;}
 async function instagram(pageAccount?:any){
  const token=(env('META_INSTAGRAM_ACCESS_TOKEN')||'').trim(),id=(env('META_INSTAGRAM_ACCOUNT_ID')||'').trim();
  if(token||id){
   if(!token||!/^\d+$/.test(id))throw new MetaError('Add both META_INSTAGRAM_ACCESS_TOKEN and numeric META_INSTAGRAM_ACCOUNT_ID in Supabase for Unified Login.');
   const verified=await graph(id+'?fields=id,username','GET',undefined,token);
   if(String(verified.id)!==id)throw new MetaError('The configured Instagram account ID could not be verified.');
   return {id,username:typeof verified.username==='string'?verified.username:null,token};
  }
  const a=pageAccount||await account(),ig=a.instagram_business_account;
  if(!/^\d+$/.test(String(ig?.id||'')))throw new MetaError('No Instagram account was returned by the Page token. Check Instagram permissions or configure separate Unified Login credentials.');
  return {id:String(ig.id),username:typeof ig.username==='string'?ig.username:null,token:config().token};
 }
 return {
  configured(){try{config();return true;}catch{return false;}},
  async check(){
   const [,a]=await Promise.all([verifyPageToken(),account()]),result={pageName:typeof a.name==='string'?a.name:'Facebook Page',instagramUsername:null as string|null,instagramConnected:false,instagramError:null as string|null,enabled:env('BP_SOCIAL_PUBLISHING_ENABLED')==='true'};
   try{const ig=await instagram(a);result.instagramUsername=ig.username;result.instagramConnected=true;}
   catch(error){result.instagramError=error instanceof MetaError?error.message:'Instagram verification is unavailable. Facebook remains connected.';}
   return result;
  },
  async publish(post:SocialPost):Promise<SocialResult>{
   try{
    config();if(!['Facebook','Instagram'].includes(post.channel)||!post.content?.trim())throw new MetaError('Only Facebook and Instagram posts with a caption are supported.');
    if(post.media_url){let url:URL;try{url=new URL(post.media_url);}catch{throw new MetaError('Use a public HTTPS image URL.');}if(url.protocol!=='https:'||url.username||url.password)throw new MetaError('Use a public HTTPS image URL.');}
    let data:any;
    if(post.channel==='Facebook'){
     const {page}=config();data=post.media_url?await graph(page+'/photos','POST',{url:post.media_url,caption:post.content,published:'true'}):await graph(page+'/feed','POST',{message:post.content});
     const id=data.post_id||data.id;if(typeof id!=='string'||!id)throw new MetaError('Meta accepted the request without returning a post ID. Check the Page.',true);
     return {state:'published',providerId:id,message:null};
    }
    if(!post.media_url||post.content.length>2200)throw new MetaError('Instagram needs a public JPEG image URL and a caption of at most 2200 characters.');
    const target=await instagram(),ig=target.id,igToken=target.token;
    const container=await graph(ig+'/media','POST',{image_url:post.media_url,caption:post.content},igToken);
    if(!/^\d+$/.test(String(container.id||'')))throw new MetaError('Instagram did not return a media container. No publish request was made.');
    let ready=false;
    for(let attempt=0;attempt<4;attempt++){const state=await graph(container.id+'?fields=status_code','GET',undefined,igToken);if(state.status_code==='FINISHED'){ready=true;break;}if(['ERROR','EXPIRED'].includes(state.status_code))throw new MetaError('Instagram could not process this image. Check its JPEG format and public URL.');await pause(1000);}
    if(!ready)throw new MetaError('Instagram did not finish preparing this image. No publish request was made. Try scheduling it again later.');
    data=await graph(ig+'/media_publish','POST',{creation_id:container.id},igToken);
    if(typeof data.id!=='string'||!data.id)throw new MetaError('Instagram did not return a published post ID. Check the account before retrying.',true);
    return {state:'published',providerId:data.id,message:null};
   }catch(error){return {state:error instanceof MetaError?(error.ambiguous?'unknown':'failed'):'unknown',providerId:null,message:error instanceof MetaError?error.message:'Social publication failed before confirmation. Check the account before retrying.'};}
  }
 };
}
