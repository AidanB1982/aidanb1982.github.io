import assert from 'node:assert/strict';
import { createReadingHandler } from '../supabase/functions/bp-reading-deliver-epub/handler.ts';
const origin = 'https://blackwoodpublishing.co.uk';
function fixture(overrides={}) {
  const config = {isAdmin:true,enabled:false,entitled:false,release:true,file:true,edition:true,format:'ebook',status:'admin_testing',...overrides};
  const operations=[];
  const env={SUPABASE_URL:'https://test.invalid',SUPABASE_ANON_KEY:'anon-fixture',SUPABASE_SERVICE_ROLE_KEY:'server-fixture',BP_READING_CUSTOMER_ACCESS:config.enabled?'true':'false',BP_READING_TEST_USER_ID:config.tester};
  const handler = createReadingHandler({env:name=>env[name],log:()=>{},createClient:(url,key,options)=>({
    auth:{getUser:async token=>config.badToken?{data:{user:null},error:{}}:{data:{user:{id:'verified-user'}}}},
    from(table) { const filters={}; return {select(){return this;},eq(k,v){filters[k]=v;return this;},async maybeSingle(){operations.push({table,filters});
      if(table==='member_profiles')return {data:{is_admin:config.isAdmin}};
      if(table==='bp_reading_files')return {data:config.file?{edition_id:2,storage_bucket:'bp-reading-editions',storage_path:'private-fixture.epub',file_format:'epub',access_status:config.status}:null};
      if(table==='bp_reading_releases')return {data:config.release?{enabled:true,storage_bucket:'bp-reading-editions',storage_path:config.changedPath?'different.epub':'private-fixture.epub'}:null};
      if(table==='book_editions')return {data:config.edition?{id:2,format:config.format}:null};
      throw Error('Unexpected query');
    }};},
    async rpc(name,args) {assert.equal(key,'anon-fixture','entitlements use caller client');assert.equal(options.global.headers.Authorization,'Bearer verified-token');operations.push({rpc:name,args});return config.rpcError?{data:null,error:{}}:{data:config.entitled};},
    storage:{from(bucket){assert.equal(key,'server-fixture');assert.equal(bucket,'bp-reading-editions');return {async download(path){assert.equal(path,'private-fixture.epub');operations.push({download:path});return {data:new Blob([new Uint8Array(config.invalidZip?[1,2,3]:[0x50,0x4b,0x03,0x04,1])])};}};}}
  })});
  return {handler,operations};
}
async function request(overrides={},body={editionId:2},headers={}) {
  const f=fixture(overrides);const response=await f.handler(new Request('https://service.invalid',{method:'POST',headers:{Origin:origin,Authorization:'Bearer verified-token',...headers},body:typeof body==='string'?body:JSON.stringify(body)}));return {...f,response};
}
let result=await request();assert.equal(result.response.status,200,'legacy admin test path preserved');assert.equal(result.response.headers.get('Cache-Control'),'private, no-store');assert.equal(result.response.headers.get('Access-Control-Allow-Origin'),origin);assert.equal(result.response.headers.get('X-Content-Type-Options'),'nosniff');
for(const config of [{isAdmin:false},{badToken:true},{isAdmin:false,enabled:true},{isAdmin:false,enabled:true,entitled:true,release:false},{isAdmin:false,enabled:true,entitled:true,changedPath:true},{status:'disabled'},{format:'paperback'},{file:false},{edition:false},{invalidZip:true},{isAdmin:false,enabled:true,rpcError:true}]) {
  result=await request(config);assert.notEqual(result.response.status,200,JSON.stringify(config));
  if(!config.invalidZip)assert.equal(result.operations.some(op=>op.download),false,'denied request never fetches file');
}
result=await request({isAdmin:false,enabled:true,entitled:true});assert.equal(result.response.status,200,'paid reader with explicit file release');assert.equal(result.operations.some(op=>op.download),true);
result=await request({isAdmin:false,enabled:false,tester:'verified-user',entitled:false});assert.equal(result.response.status,403,'tester still needs a paid entitlement');
result=await request({isAdmin:false,enabled:false,tester:'verified-user',entitled:true,release:false});assert.equal(result.response.status,403,'tester still needs an approved file release');
result=await request({isAdmin:false,enabled:false,tester:'verified-user',entitled:true});assert.equal(result.response.status,200,'paid tester can read with public launch closed');
result=await request({isAdmin:false,enabled:false,tester:'another-user',entitled:true});assert.equal(result.response.status,403,'other paid users remain launch-gated');
for(const body of [{editionId:'2'},{editionId:-1},{editionId:2.5},{editionId:Number.MAX_SAFE_INTEGER+1},[],null,'{bad']){result=await request({},body);assert.equal(result.response.status,400);assert.equal(result.operations.length,0);}
result=await request({},'x'.repeat(4097));assert.equal(result.response.status,413);
result=await request({},undefined,{Origin:'https://untrusted.invalid'});assert.equal(result.response.status,403);assert.equal(result.response.headers.has('Access-Control-Allow-Origin'),false);
result=await request({},undefined,{Authorization:''});assert.equal(result.response.status,401);
const f=fixture();assert.equal((await f.handler(new Request('https://service.invalid',{method:'OPTIONS',headers:{Origin:origin}}))).status,204);assert.equal((await f.handler(new Request('https://service.invalid',{headers:{Origin:origin}}))).status,405);
console.log('PASS delivery handler: verified admin path, closed customer gate, caller-scoped entitlements, per-file releases, mismatched paths, denied access before storage, invalid IDs/EPUBs, CORS and no-store headers');
