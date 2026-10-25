import assert from 'node:assert/strict';
import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {createPublishingDesk,assignmentFailure} from '../supabase/functions/bp-publishing-desk/handler.ts';
import {createOutlookMailer} from '../supabase/functions/bp-publishing-desk/outlook.ts';
const admin='00000000-0000-0000-0000-000000000001',reader='00000000-0000-0000-0000-000000000002';
const campaign={id:2,title:'Gualachulain',author_name:'Aidan Blackwood',is_active:true};
function fixture(overrides={}){
 const events=[],notices=[],batches=new Map();let next=10;
 const data={campaigns:[campaign],readers:[{id:reader,email:'reader@example.invalid',reader_name:'Test reader',is_arc_member:true,member_status:'active'}],assignments:[{id:3,member_id:reader,arc_file_id:2,status:'active',review_due_date:'2099-10-10',download_count:0}],notices,mailConfigured:true,aiConfigured:true,...overrides.data};
 const deps={now:()=>Date.parse('2026-10-25T10:00:00Z'),authenticate:async()=>({id:admin,admin:true}),overview:async()=>{events.push('overview');return data;},assign:async(...args)=>{events.push({assign:args});return [{created_count:1,existing_count:0}];},createBatch:async(user,fileId,kind,recipients)=>{const batch={id:`00000000-0000-0000-0000-${String(next++).padStart(12,'0')}`,created_by:user,arc_file_id:fileId,kind,recipients,created_at:'2026-10-25T10:00:00Z'};batches.set(batch.id,batch);return batch;},batch:async id=>batches.get(id),mailReady:async()=>{},claim:async(assignment,kind,batch)=>{if(notices.some(n=>n.assignment_id===assignment&&n.kind===kind))return null;notices.push({assignment_id:assignment,kind,state:'sending'});return 'notice-'+assignment;},record:async(id,state)=>{notices.find(n=>'notice-'+n.assignment_id===id).state=state;},send:async r=>{events.push({send:r});return 'submitted';},generate:async(user,brief)=>{events.push({generate:brief});return 'A factual draft.';},...overrides.deps};
 const handler=createPublishingDesk(deps);
 async function request(body,headers={Authorization:'Bearer fixture'}){const response=await handler(new Request('https://service.invalid',{method:'POST',headers:{Origin:'https://blackwoodpublishing.co.uk',...headers},body:JSON.stringify(body)}));return {status:response.status,body:await response.json()};}
 return {request,events,data,batches,notices};
}
let f=fixture();assert.equal((await f.request({action:'overview'},{})).status,401);assert.equal(f.events.length,0);
f=fixture({deps:{authenticate:async()=>({id:reader,admin:false})}});assert.equal((await f.request({action:'overview'})).status,403);assert.equal(f.events.length,0,'non-admin sees no campaign records');
f=fixture();assert.equal((await f.request({action:'overview'},{Authorization:'Bearer fixture',Origin:'https://wrong.invalid'})).status,403);
assert.equal((await f.request({action:'assign',fileId:2,members:[reader],due:'2026-02-30'})).status,400);
assert.equal((await f.request({action:'assign',fileId:2,members:[reader,reader],due:'2099-10-10'})).status,400);
assert.equal((await f.request({action:'assign',fileId:2,members:[reader],due:'2099-10-10'})).status,200);assert.deepEqual(f.events.find(e=>e.assign).assign,[2,[reader],'2099-10-10']);
let preview=await f.request({action:'preview',fileId:2,members:[reader],kind:'available'});assert.equal(preview.status,200);assert.equal(preview.body.recipients.length,1);assert(preview.body.recipients[0].text.includes('/pages/members.html'));assert(!preview.body.recipients[0].text.includes('storage/'));
let sent=await f.request({action:'send',batchId:preview.body.batchId});assert.equal(sent.body.results[0].state,'submitted');assert.equal(f.events.filter(e=>e.send).length,1);
await f.request({action:'send',batchId:preview.body.batchId});assert.equal(f.events.filter(e=>e.send).length,1,'replay cannot duplicate mail');
assert.equal((await f.request({action:'preview',fileId:2,members:[reader],kind:'available'})).status,409,'notified readers excluded');
assert.equal((await f.request({action:'preview',fileId:2,members:[reader],kind:'reminder'})).status,200,'separate explicit follow-up allowed');
for(const change of [{download_count:1},{review_link:'https://review.invalid'},{status:'revoked'},{arc_file_id:1}]){f=fixture();Object.assign(f.data.assignments[0],change);assert.equal((await f.request({action:'preview',fileId:2,members:[reader]})).status,409);}
f=fixture({data:{campaigns:[{...campaign,downloads_open_at:'2099-01-01'}]}});assert.equal((await f.request({action:'preview',fileId:2,members:[reader]})).status,409);
f=fixture();preview=await f.request({action:'preview',fileId:2,members:[reader]});f.data.readers[0].email='changed@example.invalid';sent=await f.request({action:'send',batchId:preview.body.batchId});assert.equal(sent.body.results[0].state,'skipped');assert.equal(f.events.filter(e=>e.send).length,0,'changed email requires a fresh preview');
f=fixture({deps:{send:async()=>{throw Error('timeout');}}});preview=await f.request({action:'preview',fileId:2,members:[reader]});sent=await f.request({action:'send',batchId:preview.body.batchId});assert.equal(sent.body.results[0].state,'unknown');assert.equal((await f.request({action:'preview',fileId:2,members:[reader]})).status,409,'ambiguous send is quarantined');
f=fixture();preview=await f.request({action:'preview',fileId:2,members:[reader]});f.batches.get(preview.body.batchId).created_by=reader;assert.equal((await f.request({action:'send',batchId:preview.body.batchId})).status,404,'another administrator cannot use this preview');
f=fixture();preview=await f.request({action:'preview',fileId:2,members:[reader]});f.batches.get(preview.body.batchId).created_at='2026-10-20T10:00:00Z';assert.equal((await f.request({action:'send',batchId:preview.body.batchId})).status,409,'expired previews cannot send');
f=fixture();assert.equal((await f.request({action:'generate',title:'Book',channel:'TikTok',facts:'Approved facts',task:'Draft a video hook'})).body.draft,'A factual draft.');
f=fixture({deps:{assign:async()=>{throw assignmentFailure({code:'23502',message:'null value in column "application_id" violates not-null constraint'});}}});let rejected=await f.request({action:'assign',fileId:2,members:[reader],due:'2099-10-10'});assert.equal(rejected.status,409);assert.equal(rejected.body.code,'ARC_APPLICATION_MISSING');
assert.equal(assignmentFailure({code:'23505',message:'private database detail'}).code,'ARC_ASSIGNMENT_CONFLICT');
assert(!assignmentFailure({code:'23503',message:'private database detail'}).message.includes('private database detail'),'raw database records are never echoed');
let calls=[],mailStatus=202;const env={MICROSOFT_TENANT_ID:admin,MICROSOFT_CLIENT_ID:'client-fixture',MICROSOFT_CLIENT_SECRET:'secret-fixture'};
const mailer=createOutlookMailer(name=>env[name]||'',async(url,options)=>{calls.push({url,options});return url.includes('/token')?Response.json({access_token:'server-token-fixture',expires_in:3600}):new Response(null,{status:mailStatus});});
await Promise.all([mailer.ready(),mailer.ready()]);assert.equal(calls.length,1,'concurrent token refresh coalesces');
assert.equal(await mailer.send({email:'reader@example.invalid',subject:'Book ready',text:'Private profile link'},admin),'submitted');
const mail=JSON.parse(calls[1].options.body);assert.equal(mail.message.toRecipients.length,1);assert.equal(mail.saveToSentItems,true);assert(calls[1].url.includes('aidan%40blackwoodpublishing.co.uk'));assert.equal(mail.message.body.contentType,'Text');
mailStatus=503;assert.equal(await mailer.send({email:'reader@example.invalid',subject:'Book',text:'Text'},admin),'unknown');mailStatus=403;assert.equal(await mailer.send({email:'reader@example.invalid',subject:'Book',text:'Text'},admin),'failed');
const context={window:{}};vm.runInNewContext(readFileSync('js/arc-campaign-summary.js','utf8'),context);
const summary=context.window.BlackwoodArcCampaignSummary.summarize([{id:1,status:'active',created_at:'2026-09-01',review_due_date:'2026-09-14',arc_files:{title:'The Crossing'}},{id:2,status:'active',created_at:'2026-10-25',review_due_date:'2026-11-10',arc_files:[{title:'Gualachulain'}]}]);assert.equal(summary.title,'Gualachulain');assert.equal(summary.due,'2026-11-10');assert.equal(summary.pending.length,2,'older outstanding review retained');
console.log('PASS administrator gates, exact assignment targeting, preview/send lifecycle, replay safety, release windows, changed recipients, ambiguous delivery, Outlook transport and current ARC selection');
