export type Campaign={id:number;title:string;author_name?:string;is_active:boolean;downloads_open_at?:string;downloads_close_at?:string};
export type Reader={id:string;email:string;display_name?:string;reader_name?:string;is_arc_member:boolean;member_status:string};
export type Assignment={id:number;member_id:string;arc_file_id:number;status:string;review_due_date?:string;download_count:number;review_link?:string;created_at?:string};
export type Notice={assignment_id:number;kind:string;state:string};
export type Overview={campaigns:Campaign[];readers:Reader[];assignments:Assignment[];notices:Notice[];mailConfigured:boolean;aiConfigured:boolean};
export type Recipient={assignmentId:number;memberId:string;email:string;name:string;subject:string;text:string};
export type Batch={id:string;created_by:string;arc_file_id:number;kind:string;recipients:Recipient[];created_at:string};
export type DeskDeps={
 authenticate(token:string):Promise<{id:string;admin:boolean}|null>;
 overview():Promise<Overview>;
 assign(fileId:number,members:string[],due:string):Promise<unknown>;
 createBatch(admin:string,fileId:number,kind:string,recipients:Recipient[]):Promise<Batch>;
 batch(id:string):Promise<Batch|null>;
 mailReady():Promise<void>;
 claim(assignmentId:number,kind:string,batchId:string):Promise<string|null>;
 record(id:string,state:string):Promise<void>;
 send(recipient:Recipient,noticeId:string):Promise<'submitted'|'failed'|'unknown'>;
 generate(admin:string,brief:{title:string;author:string;channel:string;facts:string;task:string}):Promise<string>;
 now?:()=>number;
};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const channels=['Facebook','Instagram','TikTok','Email','Behind the Files','Other'];
export function available(c:Campaign,now:number){return c.is_active===true&&(!c.downloads_open_at||Date.parse(c.downloads_open_at)<=now)&&(!c.downloads_close_at||Date.parse(c.downloads_close_at)>now);}
function validDate(s:unknown){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;}
export function createPublishingDesk(deps:DeskDeps){return async(request:Request)=>{
 const origin=request.headers.get('Origin'),allowed=['https://blackwoodpublishing.co.uk','https://www.blackwoodpublishing.co.uk','http://127.0.0.1:8000'];
 const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'private, no-store','Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin','X-Content-Type-Options':'nosniff'};
 if(origin&&allowed.includes(origin))headers['Access-Control-Allow-Origin']=origin;
 const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!allowed.includes(origin))return json(403,{error:'Origin not allowed.'});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return json(405,{error:'Use POST.'});
 const token=/^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization')||'')?.[1];
 if(!token)return json(401,{error:'Sign in first.'});
 try{
  const user=await deps.authenticate(token);
  if(!user)return json(401,{error:'Your session could not be verified.'});
  if(!user.admin)return json(403,{error:'Administrator access is required.'});
  const raw=await request.text();if(new TextEncoder().encode(raw).length>50000)return json(413,{error:'Request too large.'});
  let body;try{body=JSON.parse(raw);}catch{return json(400,{error:'Invalid JSON.'});}
  if(!body||typeof body!=='object'||Array.isArray(body))return json(400,{error:'Invalid request.'});
  const now=deps.now?.()??Date.now();
  if(body.action==='overview')return json(200,await deps.overview());
  if(body.action==='generate'){
   const brief={title:body.title,author:body.author||'',channel:body.channel,facts:body.facts,task:body.task};
   if(!channels.includes(brief.channel)||typeof brief.title!=='string'||!brief.title.trim()||brief.title.length>300||typeof brief.author!=='string'||brief.author.length>300||typeof brief.facts!=='string'||!brief.facts.trim()||brief.facts.length>8000||typeof brief.task!=='string'||brief.task.length>1000)return json(400,{error:'Add a book title, channel, factual brief and drafting instruction.'});
   return json(200,{draft:await deps.generate(user.id,brief)});
  }
  if(body.action==='send'){
   if(!uuid.test(body.batchId||''))return json(400,{error:'Preview the recipients first.'});
   const batch=await deps.batch(body.batchId);
   if(!batch||batch.created_by!==user.id)return json(404,{error:'Preview not found.'});
   if(!Number.isFinite(Date.parse(batch.created_at))||now-Date.parse(batch.created_at)>86400000)return json(409,{error:'This preview expired. Create a fresh preview.'});
   const data=await deps.overview(),campaign=data.campaigns.find(c=>c.id===batch.arc_file_id);
   if(!campaign||!available(campaign,now))return json(409,{error:'The ARC download window is not open.'});
   await deps.mailReady();
   const results=[];let claimed=0,index=0;
   for(const r of batch.recipients){
    if(claimed>=10)break;index++;
    const reader=data.readers.find(p=>p.id===r.memberId),assignment=data.assignments.find(a=>a.id===r.assignmentId);
    if(!reader||!reader.is_arc_member||reader.member_status!=='active'||reader.email!==r.email||!assignment||assignment.arc_file_id!==campaign.id||assignment.member_id!==r.memberId||assignment.status!=='active'||Number(assignment.download_count)>0||assignment.review_link){results.push({assignmentId:r.assignmentId,state:'skipped'});continue;}
    const notice=await deps.claim(r.assignmentId,batch.kind,batch.id);
    if(!notice){results.push({assignmentId:r.assignmentId,state:'already recorded'});continue;}
    claimed++;
    let state:'submitted'|'failed'|'unknown'='unknown';
    try{state=await deps.send(r,notice);}catch{/* Transport failures are ambiguous and must never auto-retry. */}
    try{await deps.record(notice,state);}catch{state='unknown';}
    results.push({assignmentId:r.assignmentId,state});
   }
   return json(200,{results,remaining:batch.recipients.length-index});
  }
  if(!['assign','preview'].includes(body.action)||!Number.isSafeInteger(body.fileId)||body.fileId<=0||!Array.isArray(body.members)||body.members.length<1||body.members.length>200||body.members.some((id:unknown)=>typeof id!=='string'||!uuid.test(id))||new Set(body.members).size!==body.members.length)return json(400,{error:'Choose a campaign and 1–200 distinct readers.'});
  const data=await deps.overview(),campaign=data.campaigns.find(c=>c.id===body.fileId);
  if(!campaign)return json(404,{error:'ARC campaign not found.'});
  const readers=data.readers.filter(p=>body.members.includes(p.id)&&p.is_arc_member&&p.member_status==='active');
  if(readers.length!==body.members.length)return json(409,{error:'Some selected readers are no longer active ARC team members.'});
  if(body.action==='assign'){
   if(!validDate(body.due)||body.due<new Date(now).toISOString().slice(0,10))return json(400,{error:'Choose a current or future review due date.'});
   if(campaign.is_active!==true||(campaign.downloads_close_at&&Date.parse(campaign.downloads_close_at)<=now))return json(409,{error:'This campaign is inactive or closed.'});
   return json(200,{result:await deps.assign(campaign.id,body.members,body.due)});
  }
  if(!available(campaign,now))return json(409,{error:'The ARC download window is not open. Assignments may be prepared before release, but notices wait until it opens.'});
  if(body.kind&&!['available','reminder'].includes(body.kind))return json(400,{error:'Choose an available notice or reminder.'});
  const kind=body.kind==='reminder'?'reminder':'available';const recipients:Recipient[]=[];
  for(const reader of readers){
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reader.email))continue;
   const assignments=data.assignments.filter(a=>a.arc_file_id===campaign.id&&a.member_id===reader.id&&a.status==='active'&&!a.review_link&&Number(a.download_count||0)===0);
   const a=assignments.sort((a,b)=>b.id-a.id)[0];if(!a)continue;
   const old=data.notices.find(n=>n.assignment_id===a.id&&n.kind===kind);
   if(old&&old.state!=='failed')continue;
   const name=reader.reader_name||reader.display_name||'reader';
   const due=a.review_due_date?'Your review is due '+a.review_due_date+'.\n':'';
   recipients.push({assignmentId:a.id,memberId:reader.id,email:reader.email,name,subject:kind==='reminder'?'Your ARC is waiting: '+campaign.title:'Your ARC of '+campaign.title+' is ready',text:`Hello ${name},\n\n${kind==='reminder'?'A reminder that your ARC of':'Your ARC of'} ${campaign.title}${campaign.author_name?' by '+campaign.author_name:''} is ready in your Blackwood ARC Vault.\n\n${due}Sign in to your Archivist account, open your ARC profile and accept the copyright terms to download your personal review copy:\nhttps://blackwoodpublishing.co.uk/pages/members.html\n\nPlease keep your advance copy private. You can file your review link from the same ARC profile. Questions or need to step back? Reply to this email.\n\nAidan\nBlackwood Publishing`});
  }
  if(!recipients.length)return json(409,{error:'No new notices to send. Check assignments, downloads, filed reviews and previous notification states. Use the reminder option for a separate follow-up.'});
  const batch=await deps.createBatch(user.id,campaign.id,kind,recipients);
  return json(200,{batchId:batch.id,recipients});
 }catch(error){const code=error instanceof Error?error.message:'';const messages:Record<string,string>={OUTLOOK_NOT_CONFIGURED:'Outlook is not connected. Configure the Microsoft tenant, app credentials and mailbox permissions in Supabase.',AI_NOT_CONFIGURED:'The AI assistant is not connected. Configure OPENAI_API_KEY in Supabase.',AI_LIMIT:'The hourly AI drafting limit has been reached. Try again later.',OUTLOOK_AUTH:'Outlook authentication failed. Check app consent and mailbox permissions.'};return json(503,{error:messages[code]||'Publishing desk request could not be completed. Check the migration, deployed function and server configuration.'});}
};}
