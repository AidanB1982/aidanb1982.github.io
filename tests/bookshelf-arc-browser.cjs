const {chromium}=require('playwright'),assert=require('node:assert/strict');
const BASE=process.env.BASE_URL||'http://127.0.0.1:8000';
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/shelf-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/css/member-bookshelf.css"><div id="blackwood-bookshelf-root"></div>'}));
 await page.goto(BASE+'/shelf-fixture');await page.addScriptTag({url:BASE+'/js/member-bookshelf.js?v=20261030-arc2'});
 await page.evaluate(()=>{
  window.shelfRows=[];window.shelfWrites=[];window.arcRpcCalls=0;
  window.shelfClient={rpc:async()=>{window.arcRpcCalls++;return {data:[{assignment_id:9,edition_id:2,book_id:'gualachulain',title:'Gualachulain',author:'Aidan Blackwood',can_read:true}]};},from(table){if(table!=='member_book_shelf')throw Error(table);let mode='select',value,options,filters={};const chain={select(){return chain},eq(k,v){filters[k]=v;return chain},order(){return chain},upsert(v,o){mode='upsert';value=v;options=o;return chain},update(v){mode='update';value=v;return chain},delete(){mode='delete';return chain},then(resolve,reject){try{
   const match=row=>Object.entries(filters).every(([k,v])=>row[k]===v);
   if(mode==='select')return Promise.resolve(resolve({data:structuredClone(window.shelfRows.filter(match))}));
   window.shelfWrites.push({mode,value,filters});
   if(mode==='upsert'){const old=window.shelfRows.find(row=>row.member_id===value.member_id&&row.book_id===value.book_id);if(!old)window.shelfRows.push({...value,id:crypto.randomUUID()});else if(!options?.ignoreDuplicates)Object.assign(old,value);}
   if(mode==='update')window.shelfRows.filter(match).forEach(row=>Object.assign(row,value));
   if(mode==='delete')window.shelfRows=window.shelfRows.filter(row=>!match(row));
   return Promise.resolve(resolve({data:null,error:null}));
  }catch(e){return Promise.reject(e).then(resolve,reject);}}};return chain;}};
  window.openShelf=async(id='reader-A',arc=true)=>window.initBlackwoodBookshelf({root:document.getElementById('blackwood-bookshelf-root'),client:window.shelfClient,session:{user:{id}},member:{is_arc_member:arc},pointsTotal:25});
  localStorage.setItem('bp-reading:reader-A:arc-assignment:9:v1',JSON.stringify({hasStarted:true,progress:2}));
 });
 await page.evaluate(()=>window.openShelf());
 let rows=await page.evaluate(()=>window.shelfRows);assert.equal(rows.length,1);assert.equal(rows[0].book_id,'gualachulain-bothy');assert.equal(rows[0].is_arc,true);assert.equal(rows[0].shelf_status,'reading');assert.equal(rows[0].owned,false);
 await page.locator('[data-bookshelf-drawer] > summary').click();
 assert.match(await page.locator('.bookshelf-spine-badges').textContent(),/ARC/);assert.match(await page.locator('.bookshelf-arc-reading-link').getAttribute('href'),/arc=1&assignment=9/);
 await page.locator('[data-bookshelf-open-book="gualachulain-bothy"]').click();assert.equal(await page.locator('[name=is_arc]').isDisabled(),true);assert.equal(await page.locator('[data-bookshelf-remove]').count(),0);await page.locator('[data-bookshelf-close]').click();
 await page.evaluate(()=>window.openShelf());assert.equal((await page.evaluate(()=>window.shelfRows)).length,1,'reload never duplicates assigned book');
 await page.evaluate(()=>{Object.assign(window.shelfRows[0],{is_arc:false,shelf_status:'reviewed',notes:'My private note',owned:true,is_signed:true,is_favourite:true});});
 await page.evaluate(()=>window.openShelf());rows=await page.evaluate(()=>window.shelfRows);assert.equal(rows[0].is_arc,true);assert.equal(rows[0].shelf_status,'reviewed');assert.equal(rows[0].notes,'My private note');assert.equal(rows[0].owned,true);assert.equal(rows[0].is_signed,true);
 const before=await page.evaluate(()=>window.arcRpcCalls);await page.evaluate(()=>window.openShelf('reader-B',false));assert.equal(await page.evaluate(()=>window.arcRpcCalls),before,'ordinary member makes no ARC RPC');assert.equal(await page.locator('.bookshelf-arc-reading-link').count(),0);assert.equal((await page.evaluate(()=>window.shelfRows)).length,1,'no other-member book created');
 assert.deepEqual(errors,[]);console.log('PASS ARC bookshelf: authoritative assigned auto-entry, local reading-stage default, ARC badge/reader link, rerun deduplication, protected provenance and retained private metadata, account isolation');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1});
