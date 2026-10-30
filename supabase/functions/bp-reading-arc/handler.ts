type ArcClient={auth:{getUser(token:string):PromiseLike<{data:{user:{id:string}|null};error?:unknown}>};rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:any;error?:any}>;storage:{from(bucket:string):{download(path:string):PromiseLike<{data:Blob|null;error?:unknown}>}}};
export function createArcReadingHandler(deps:{env(name:string):string|undefined;client(url:string,key:string):ArcClient;personalise(bytes:ArrayBuffer,reference:string):Promise<ArrayBuffer>;log(message:string):void}){
 const origins=new Set(['https://blackwoodpublishing.co.uk','https://www.blackwoodpublishing.co.uk','https://aidanb1982.github.io']);
 return async(request:Request)=>{
  const origin=request.headers.get('Origin'),headers:Record<string,string>={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Vary':'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Expose-Headers':'X-BP-ARC-Reference, X-BP-Offline-Until'};
  if(origin&&origins.has(origin))headers['Access-Control-Allow-Origin']=origin;
  const json=(status:number,value:unknown)=>Response.json(value,{status,headers});
  if(origin&&!origins.has(origin))return json(403,{error:'Origin not allowed.'});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return json(405,{error:'Use POST.'});
  try{
   const token=/^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization')||'')?.[1];
   if(!token||token.length>8192)return json(401,{error:'Sign in to read your ARC.'});
   const raw=await request.text();if(new TextEncoder().encode(raw).length>4096)return json(413,{error:'Request too large.'});
   let body:any;try{body=JSON.parse(raw)}catch{return json(400,{error:'Invalid request.'});}
   if(!body||Array.isArray(body)||!Number.isSafeInteger(body.assignmentId)||body.assignmentId<=0||!['open','check','save'].includes(body.action)||body.offline===true)return json(400,{error:'Use a valid ARC assignment and an online reading action.'});
   const url=deps.env('SUPABASE_URL'),anon=deps.env('SUPABASE_ANON_KEY'),key=deps.env('SUPABASE_SERVICE_ROLE_KEY');if(!url||!anon||!key)return json(503,{error:'ARC reading is not configured.'});
   const user=await deps.client(url,anon).auth.getUser(token);if(user.error||!user.data.user)return json(401,{error:'Your sign-in could not be verified.'});
   const service=deps.client(url,key),userId=user.data.user.id;
   if(body.action==='check'){
    const result=await service.rpc('bp_arc_reading_offline_until',{p_member_id:userId,p_assignment_id:body.assignmentId});
    if(result.error)return json(503,{error:'ARC access could not be checked.'});
    return typeof result.data==='string'&&Date.parse(result.data)>Date.now()?json(200,{eligible:true,offlineUntil:result.data}):json(403,{error:'This ARC assignment is no longer available.'});
   }
   const result=await service.rpc('bp_arc_reading_open',{p_member_id:userId,p_assignment_id:body.assignmentId,p_accept_terms:body.acceptedTerms===true,p_terms_version:body.termsVersion||''});
   if(result.error)return json(result.error.code==='42501'||result.error.code==='22023'?403:503,{error:result.error.code==='42501'?'ARC access or copyright acceptance could not be verified.':'The ARC reading edition is not ready. Please contact Blackwood Publishing.'});
   const file=result.data;
   if(!file||file.assignment_id!==body.assignmentId||file.storage_bucket!=='bp-reading-editions'||typeof file.storage_path!=='string'||!file.storage_path||typeof file.reference!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(file.reference))return json(503,{error:'The ARC delivery record could not be verified.'});
   if(body.action==='save'){
    const until=Date.parse(file.offline_until);
    if(!Number.isFinite(until)||until<=Date.now()||until>Date.now()+7*86400000+60000)return json(503,{error:'Apply the ARC offline SQL update before saving this copy.'});
    headers['X-BP-Offline-Until']=new Date(until).toISOString();
   }
   const downloaded=await service.storage.from(file.storage_bucket).download(file.storage_path);
   if(downloaded.error||!downloaded.data)return json(404,{error:'The ARC reading file is unavailable.'});
   if(downloaded.data.size>100*1024*1024)return json(413,{error:'The ARC edition is too large.'});
   const bytes=await downloaded.data.arrayBuffer(),sig=new Uint8Array(bytes,0,Math.min(4,bytes.byteLength));
   if(sig.length!==4||sig[0]!==80||sig[1]!==75||sig[2]!==3||sig[3]!==4)return json(503,{error:'The ARC file is invalid.'});
   const personalised=await deps.personalise(bytes,file.reference);
   const recorded=await service.rpc(body.action==='save'?'bp_arc_reading_check':'bp_arc_reading_record_open',{p_member_id:userId,p_assignment_id:body.assignmentId});
   if(recorded.error||recorded.data!==true)return json(403,{error:'ARC access changed before delivery. Please refresh.'});
   return new Response(personalised,{status:200,headers:{...headers,'Content-Type':'application/epub+zip','Content-Disposition':'inline','X-BP-ARC-Reference':file.reference}});
  }catch{deps.log('ARC reading request failed.');return json(503,{error:'ARC reading is temporarily unavailable.'});}
 };
}
