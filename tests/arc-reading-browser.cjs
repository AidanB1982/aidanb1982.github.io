const {chromium}=require('playwright'),assert=require('node:assert/strict');
const BASE=process.env.BASE_URL||'http://127.0.0.1:8000',DIR=process.env.READING_TEST_DIR||'/tmp/blackwood-reading-test';
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});try{
 const page=await context.newPage(),errors=[];let opens=0,saves=0,revoked=false,offline=false;page.on('pageerror',e=>errors.push(e.message));
 await context.route('https://**/*',route=>{
  if(offline)return route.abort();
  const publicCors={'Access-Control-Allow-Origin':'*'};
  const url=route.request().url();
  if(url.includes('esm.sh/'))return route.fulfill({contentType:'application/javascript',headers:publicCors,body:`export function createClient(){localStorage.setItem('sb-bmnlynjldlnxfvunqbqq-auth-token',JSON.stringify({user:{id:'basic-arc-pilot'}}));window.arcCalls=[];return{auth:{getUser:async()=>({data:{user:{id:'basic-arc-pilot'}}}),getSession:async()=>({data:{session:{access_token:'fixture'}}}),onAuthStateChange:fn=>{window.signOutArc=()=>fn('SIGNED_OUT')}},from(table){if(table!=='member_profiles')throw Error('No paid-account query allowed: '+table);return{select(){return this},eq(){return this},single:async()=>({data:{is_admin:false}})}},rpc:async(name,args)=>{window.arcCalls.push({name,args});if(name==='bp_arc_reading_review')return{data:true};if(name!=='bp_arc_reading_catalogue')throw Error('No paid-access RPC allowed: '+name);return{data:[{assignment_id:9,edition_id:2,book_id:'gualachulain',title:'Gualachulain',author:'Aidan Blackwood',cover_url:'/assets/book7.png',series:'The Cursed Bothies',series_order:2,terms_accepted:false,can_read:true}]}}}}`});
  if(url.includes('jszip'))return route.fulfill({path:DIR+'/jszip.min.js',contentType:'application/javascript',headers:publicCors});
  if(url.includes('epub.min.js'))return route.fulfill({path:DIR+'/epub.min.js',contentType:'application/javascript',headers:publicCors});
  if(url.includes('/functions/v1/bp-reading-arc')){
   const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Expose-Headers':'X-BP-ARC-Reference,X-BP-Offline-Until'};
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
   const body=JSON.parse(route.request().postData());assert.equal(body.assignmentId,9);assert(!body.editionId);assert(!body.userId);
   if(body.action==='check')return route.fulfill({status:revoked?403:200,contentType:'application/json',headers:cors,body:JSON.stringify(revoked?{error:'Revoked'}:{eligible:true,offlineUntil:new Date(Date.now()+86400000).toISOString()})});
   if(body.action==='save')saves++;else opens++;assert.equal(body.acceptedTerms,true);assert.equal(body.termsVersion,'ARC Copyright Terms v1');
   return route.fulfill({path:DIR+'/test.epub',contentType:'application/epub+zip',headers:{...cors,'X-BP-ARC-Reference':'GUA-ARC-001',...(body.action==='save'?{'X-BP-Offline-Until':new Date(Date.now()+86400000).toISOString()}:{})}});
  }
  if(url.includes('/functions/'))throw Error('Wrong delivery endpoint: '+url);
  return route.abort();
 });
 await page.goto(BASE+'/pages/bp-reading.html?arc=1');await page.waitForFunction(()=>!document.getElementById('library').hidden);
 assert.equal(await page.locator('.book-card').count(),1);assert.equal(await page.locator('#reading-membership-offer').count(),0);assert.equal(await page.locator('#reading-membership-summary').isHidden(),true);assert.equal(await page.getByRole('button',{name:'Save offline',exact:true}).isDisabled(),true,'terms required before offline save');assert.equal(await page.locator('#load-synced').isDisabled(),true);
 const read=page.getByRole('button',{name:'Read your ARC',exact:true});assert.equal(await read.isDisabled(),true);
 for(const checkbox of await page.locator('.arc-reading-terms input').all())await checkbox.check();assert.equal(await read.isEnabled(),true);
 await page.getByRole('button',{name:'Save offline',exact:true}).click();await page.waitForFunction(()=>document.getElementById('reading-offline-status').textContent.includes('saved on this device'),{},{timeout:60000});assert.equal(saves,1);
 await read.click();await page.waitForFunction(()=>!document.getElementById('reader-menu-toggle').hidden,{},{timeout:30000});
 assert((await page.frameLocator('#epub-viewer iframe').locator('body').textContent()).trim().length>20);assert.match(await page.locator('#reader-watermark').textContent(),/GUA-ARC-001/);assert.equal(opens,1);
 assert(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.includes(':arc-assignment:9:'))),'ARC progress has separate device namespace');
 offline=true;await context.setOffline(true);assert.equal(await page.locator('#reader').isVisible(),true,'saved ARC remains readable after disconnect');
 await page.evaluate(()=>document.getElementById('back-to-library').click());await page.reload();await page.waitForFunction(()=>!document.getElementById('library').hidden);
 assert.equal(await page.locator('.book-card').count(),1);assert.equal(await page.locator('.arc-reading-review button').isDisabled(),true,'reviews wait for a connection');
 await page.getByRole('button',{name:'Read your ARC',exact:true}).click();await page.waitForFunction(()=>!document.getElementById('reader-menu-toggle').hidden,{},{timeout:30000});assert.match(await page.locator('#reader-watermark').textContent(),/GUA-ARC-001/);assert.equal(opens,1,'offline reopening never calls delivery');
 revoked=true;offline=false;await context.setOffline(false);await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForFunction(()=>document.getElementById('reader').hidden);await page.waitForFunction(()=>document.getElementById('library-error').textContent.includes('ARC access could not be verified'));
 await page.waitForFunction(()=>!document.querySelector('.arc-reading-review button').disabled);
 await page.locator('.arc-reading-review input').fill('https://example.invalid/review');await page.locator('.arc-reading-review button').click();await page.waitForFunction(()=>document.querySelector('.arc-reading-review [role=status]').textContent.includes('filed'));
 const calls=await page.evaluate(()=>window.arcCalls);assert(calls.some(c=>c.name==='bp_arc_reading_review'&&c.args.p_assignment_id===9));assert(calls.every(c=>c.name.startsWith('bp_arc_reading_')));
 for(const width of [320,768,1280]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'ARC shelf fits '+width);}
 await page.addScriptTag({url:BASE+'/js/member-arc-reading.js?v=20261030-arc1'});
 const portal=await page.evaluate(async()=>{const root=document.createElement('section');document.body.append(root);await window.initBlackwoodArcReading({root,client:{rpc:async()=>({data:[{title:'Gualachulain',can_read:true}]})}});return {text:root.textContent,link:root.querySelector('a').getAttribute('href')};});assert.match(portal.text,/Gualachulain/);assert.equal(portal.link,'/pages/bp-reading.html?arc=1');
 assert.deepEqual(errors,[]);console.log('PASS ARC browser: assigned-only shelf, non-admin/no membership path, server-bound terms, ARC endpoint, real EPUB rendering/reference, encrypted offline reload and reference, separate device state, revocation closure, review filing, member entry and mobile fit');
}finally{await context.close();await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
