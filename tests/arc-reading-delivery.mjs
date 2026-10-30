import assert from 'node:assert/strict';
import {createArcReadingHandler} from '../supabase/functions/bp-reading-arc/handler.ts';
import {personaliseArc} from '../supabase/functions/bp-reading-arc/personalise.ts';
import {createRequire} from 'node:module';
const origin='https://blackwoodpublishing.co.uk';
function fixture(config={}){
 const calls=[];
 const handler=createArcReadingHandler({env:name=>({SUPABASE_URL:'https://test.invalid',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'})[name],log:()=>{},personalise:async(bytes,ref)=>{calls.push({personalise:ref});return bytes;},client:(url,key)=>({auth:{getUser:async token=>{assert.equal(key,'anon');return {data:{user:config.badToken?null:{id:'verified-reader'}}};}},rpc:async(name,args)=>{
  assert.equal(key,'service');assert.equal(args.p_member_id,'verified-reader');calls.push({name,args});
  if(name==='bp_arc_reading_offline_until')return {data:config.denied?null:new Date(Date.now()+86400000).toISOString()};
  if(name==='bp_arc_reading_check')return {data:!config.denied};
  if(name==='bp_arc_reading_record_open')return {data:!config.revokedDuringDelivery};
  if(config.denied)return {error:{code:'42501',message:'private database data'}};
  return {data:{assignment_id:9,edition_id:2,storage_bucket:config.badBucket?'public-files':'bp-reading-editions',storage_path:'PRIVATE.epub',reference:'GUA-ARC-001',offline_until:config.missingLease?null:new Date(Date.now()+86400000).toISOString()}};
 },storage:{from(bucket){assert.equal(bucket,'bp-reading-editions');return {download:async(path)=>{assert.equal(path,'PRIVATE.epub');calls.push({download:true});return {data:new Blob([new Uint8Array(config.badZip?[1,2,3]:[80,75,3,4,5])])};}};}}})});
 return {handler,calls};
}
async function request(config={},body={action:'open',assignmentId:9,acceptedTerms:true,termsVersion:'ARC Copyright Terms v1'},headers={}){const f=fixture(config);return {...f,response:await f.handler(new Request('https://edge.invalid',{method:'POST',headers:{Origin:origin,Authorization:'Bearer user-token',...headers},body:JSON.stringify(body)}))};}
let r=await request({}, {action:'open',assignmentId:9,acceptedTerms:true,termsVersion:'ARC Copyright Terms v1',userId:'spoofed'});assert.equal(r.response.status,200);assert.equal(r.response.headers.get('Cache-Control'),'private, no-store');assert.equal(r.response.headers.get('Content-Disposition'),'inline');assert.equal(r.response.headers.get('X-BP-ARC-Reference'),'GUA-ARC-001');assert(!r.response.headers.has('X-BP-Offline-Until'));assert.deepEqual([...new Uint8Array(await r.response.arrayBuffer())],[80,75,3,4,5]);assert(r.calls.some(c=>c.personalise==='GUA-ARC-001'));
for(const config of [{denied:true},{badToken:true},{badBucket:true},{badZip:true},{revokedDuringDelivery:true}]){r=await request(config);assert.notEqual(r.response.status,200);const result=await r.response.text();assert(!/PRIVATE|private database|user-token/.test(result));if(config.denied||config.badToken||config.badBucket)assert(!r.calls.some(c=>c.download));}
for(const body of [{action:'open',assignmentId:9,offline:true},{action:'open',assignmentId:'9'},{action:'download',assignmentId:9},{action:'open',assignmentId:-1}]){r=await request({},body);assert.equal(r.response.status,400);assert.equal(r.calls.length,0);}
r=await request({}, {action:'check',assignmentId:9});assert.equal(r.response.status,200);assert(!r.calls.some(c=>c.download));r=await request({denied:true},{action:'check',assignmentId:9});assert.equal(r.response.status,403);
r=await request({},undefined,{Origin:'https://untrusted.invalid'});assert.equal(r.response.status,403);assert(!r.response.headers.has('Access-Control-Allow-Origin'));
r=await request({}, {action:'save',assignmentId:9,acceptedTerms:true,termsVersion:'ARC Copyright Terms v1'});assert.equal(r.response.status,200);assert(Date.parse(r.response.headers.get('X-BP-Offline-Until'))>Date.now());assert(!r.calls.some(c=>c.name==='bp_arc_reading_record_open'),'saving is not a reading open');
r=await request({missingLease:true},{action:'save',assignmentId:9,acceptedTerms:true,termsVersion:'ARC Copyright Terms v1'});assert.equal(r.response.status,503);assert(!r.calls.some(c=>c.download));
const require=createRequire(import.meta.url),JSZip=require((process.env.READING_TEST_DIR||'/tmp/blackwood-reading-test')+'/jszip.min.js');
const zip=new JSZip();zip.file('mimetype','application/epub+zip');zip.file('chapter.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Original chapter</h1><p>Original story.</p></body></html>');
const bytes=await zip.generateAsync({type:'arraybuffer'}),personalised=await personaliseArc(JSZip,bytes,'GUA-ARC-001');const output=await JSZip.loadAsync(personalised),chapter=await output.file('chapter.xhtml').async('string');assert(chapter.includes('Original story.'));assert(chapter.includes('GUA-ARC-001'));assert(!chapter.includes('@'));await assert.rejects(()=>personaliseArc(JSZip,bytes,'<unsafe>'),/Invalid ARC reference/);
console.log('PASS ARC delivery: fresh caller identity, service-only authorisation, no membership/admin bypass, check-only requests, revocation before bytes, private inline/no-store delivery, bounded explicit offline save, no export and personalised chapter preservation');
