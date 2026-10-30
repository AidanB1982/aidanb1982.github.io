const {chromium}=require('playwright'),assert=require('node:assert/strict');
const BASE=process.env.BASE_URL||'http://127.0.0.1:8000',DIR=process.env.READING_TEST_DIR||'/tmp/blackwood-reading-test';
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});const context=await browser.newContext({viewport:{width:390,height:844}});try{
 let offline=false,deliveries=0,tracingRequests=0;
 const mock=`const warning="Add import '@supabase/supabase-js/tracing' at your application entry point";/* import '@supabase/supabase-js/tracing' */export const optionalTracing=()=>import("@supabase/supabase-js/tracing");import {fixture} from "/offline-fixture.mjs";export function createClient(){localStorage.setItem('sb-bmnlynjldlnxfvunqbqq-auth-token',JSON.stringify({user:{id:'offline-reader'}}));return{auth:{getUser:async()=>({data:{user:{id:'offline-reader'}}}),getSession:async()=>({data:{session:{access_token:'test'}}}),onAuthStateChange:fn=>{window.testSignOut=()=>fn('SIGNED_OUT')}},from(table){function rows(){if(table==='bp_reading_catalog')return [{edition_id:10,book_id:'4',title:'The Black Bothy',author:'Aidan Blackwood'}];if(table==='bp_reading_memberships')return [{access_until:'2099-01-01',revoked_at:null}];return [];}return{select(){return this},eq(){return this},single:async()=>({data:{is_admin:false}}),maybeSingle:async()=>({data:rows()[0]||null}),then(resolve){resolve({data:rows()})}}},rpc:async()=>({data:true})}}`;
 await context.route('https://**/*',async route=>{
  if(offline)return route.abort();
  const url=route.request().url(),cors={'access-control-allow-origin':'*','access-control-expose-headers':'X-BP-Offline-Until'};
  if(url.includes('/tracing')){tracingRequests++;return route.fulfill({status:404,body:'not found',headers:cors});}
  if(url.includes('esm.sh/'))return route.fulfill({contentType:'application/javascript',body:url.endsWith('/offline-fixture.mjs')?'export const fixture=true;':mock,headers:cors});
  if(url.includes('jszip'))return route.fulfill({path:DIR+'/jszip.min.js',contentType:'application/javascript',headers:cors});
  if(url.includes('epub.min.js'))return route.fulfill({path:DIR+'/epub.min.js',contentType:'application/javascript',headers:cors});
  if(url.includes('bp-reading-deliver-epub')){deliveries++;return route.fulfill({path:DIR+'/test.epub',contentType:'application/epub+zip',headers:{...cors,'X-BP-Offline-Until':new Date(Date.now()+86400000).toISOString()}});}
  return route.abort();
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE',e.message)});page.on('console',message=>{if(message.type()==='error')console.error('BROWSER',message.text())});
 await page.goto(BASE+'/pages/bp-reading.html');await page.waitForFunction(()=>!document.getElementById('library').hidden);
 // Encryption, account isolation, expiry, future-date rejection and clock rollback.
 const checks=await page.evaluate(async()=>{
  const {OfflineLibrary,OFFLINE_WINDOW}=await import('/js/BP-reading-offline.js?v=20261030-arc-offline1');let now=Date.now();const store=new OfflineLibrary(indexedDB,()=>now);
  const book={editionId:999,title:'Test',token:'must not persist'},bytes=new Uint8Array([80,75,3,4,42]).buffer;
  await store.save('unit-reader',book,bytes,now+10000);
  await store.save('unit-reader',{...book,arcAssignmentId:9,arcReference:'GUA-ARC-TEST'},bytes,now+10000);
  const isolatedKinds=(await store.list('unit-reader')).length===2;
  const legacyKey=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']),legacyIv=crypto.getRandomValues(new Uint8Array(12));
  const legacyCipher=await crypto.subtle.encrypt({name:'AES-GCM',iv:legacyIv,additionalData:new TextEncoder().encode('legacy-reader:edition:999')},legacyKey,bytes);
  await store.transact('readwrite',db=>db.put({key:'legacy-reader:edition:999',id:'edition:999',userId:'legacy-reader',book:{editionId:999},ciphertext:legacyCipher,encryptionKey:legacyKey,iv:legacyIv,expiresAt:now+10000,lastSeen:now}));
  const legacyWorks=new Uint8Array(await store.read('legacy-reader',book))[4]===42;
  const row=(await store.list('unit-reader')).find(row=>row.id==='edition:999'),isolated=(await store.list('other-reader')).length===0;
  const decrypted=Array.from(new Uint8Array(await store.read('unit-reader',book)));
  let notExportable=false;try{await crypto.subtle.exportKey('raw',row.encryptionKey)}catch{notExportable=true;}
  let longRejected=false;try{await store.save('unit-reader',book,bytes,now+OFFLINE_WINDOW+120000)}catch{longRejected=true;}
  now+=11000;const expired=(await store.list('unit-reader')).length===0;
  await store.save('unit-reader',book,bytes,now+10000);now-=600000;const rollback=(await store.list('unit-reader')).length===0;
  return {isolatedKinds,legacyWorks,isolated,decrypted,notExportable,longRejected,expired,rollback,noPlainBytes:!row.bytes,noToken:!row.book.token};
 });
 assert.deepEqual(checks,{isolatedKinds:true,legacyWorks:true,isolated:true,decrypted:[80,75,3,4,42],notExportable:true,longRejected:true,expired:true,rollback:true,noPlainBytes:true,noToken:true});
 await context.setOffline(true);
 await page.getByRole('button',{name:'Save online first',exact:true}).first().waitFor();
 assert.equal(await page.getByRole('button',{name:'Subscribe to read',exact:true}).count(),0,'offline is not a subscription failure');
 const reloaded=page.waitForEvent('load');await context.setOffline(false);await reloaded;
 await page.waitForFunction(()=>!document.getElementById('library').hidden);
 await page.locator('#library-search').fill('The Black Bothy');
 const failedResource=route=>route.fulfill({status:503,body:'unavailable'});
 await context.route('**/css/BP-Reading.css*',failedResource);
 await page.getByRole('button',{name:'Save offline',exact:true}).click();
 await page.waitForSelector('.offline-save-error');assert.match(await page.locator('.offline-save-error').textContent(),/BP-Reading.css.*HTTP 503/);
 assert.equal(await page.getByRole('button',{name:'Save offline',exact:true}).isEnabled(),true);
 await context.unroute('**/css/BP-Reading.css*',failedResource);
 await page.getByRole('button',{name:'Save offline',exact:true}).click();
 await page.waitForFunction(()=>!document.getElementById('reading-offline-status').textContent.startsWith('Saving '),{},{timeout:60000});assert.match(await page.locator('#reading-offline-status').textContent(),/saved on this device/);
 assert.equal(deliveries,1);assert.equal(tracingRequests,0,'optional tracing dependency not requested');
 const cacheURLs=await page.evaluate(async()=>{const c=await caches.open('bp-reader-shell-v1');return(await c.keys()).map(r=>r.url)});
 assert(cacheURLs.some(url=>url.endsWith('/offline-fixture.mjs')),'transitive SDK dependency cached');
 assert(!cacheURLs.some(url=>url.includes('/functions/')||url.includes('/auth/')||url.endsWith('.epub')),'private data never enters public shell cache');
 await page.evaluate(async()=>{const {OfflineLibrary}=await import('/js/BP-reading-offline.js?v=20261030-arc-offline1');await new OfflineLibrary().save('offline-reader',{editionId:10,arcAssignmentId:99,title:'Separate ARC record',arcReference:'GUA-ARC-TEST'},new Uint8Array([80,75,3,4,1]).buffer,Date.now()+60000);});
 // Offline main page reload, then real EPUB rendering using only encrypted saved content.
 offline=true;await context.setOffline(true);await page.reload();
 await page.waitForFunction(()=>!document.getElementById('library').hidden);
 assert.equal(await page.locator('.book-card').count(),1);
 await page.getByRole('button',{name:'Read Book',exact:true}).click();
 await page.waitForFunction(()=>!document.getElementById('reader-menu-toggle').hidden,{},{timeout:30000});
 assert((await page.frameLocator('#epub-viewer iframe').locator('body').textContent()).trim().length>20);
 assert.equal(deliveries,1,'offline read never calls delivery');
 await page.locator('#reader-menu-toggle').click();await page.locator('#back-to-library').click();
 await page.getByRole('button',{name:'Remove offline',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.book-card').length===0);
 await page.evaluate(async()=>{const {OfflineLibrary}=await import('/js/BP-reading-offline.js?v=20261030-arc-offline1');const library=new OfflineLibrary();await library.save('offline-reader',{editionId:88,title:'Signout test'},new Uint8Array([80,75,3,4,1]).buffer,Date.now()+60000);window.testSignOut();});
 await page.waitForFunction(async()=>{const {OfflineLibrary}=await import('/js/BP-reading-offline.js?v=20261030-arc-offline1');return(await new OfflineLibrary().list('offline-reader')).length===0});
 assert.equal(await page.evaluate(()=>localStorage.getItem('bp-reading-offline-account-v1')),null,'signout clears offline identity');
 assert.deepEqual(errors,[]);
 console.log('PASS encrypted offline storage, non-exportable key, account isolation, expiry/clock bounds, explicit save, shell-only cache, full offline reload and EPUB rendering, removal');
 }finally{await context.close();await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
