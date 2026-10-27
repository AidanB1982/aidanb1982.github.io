const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const plannedCount=require('../data/book-discovery.json').filter(book=>!book.hideFromReading).length;
const TEST_DIR = process.env.READING_TEST_DIR || '/tmp/blackwood-reading-test';
const CUSTOMER_TEST = process.env.READING_CUSTOMER_TEST === '1';
const EXPIRED_TEST=process.env.READING_EXPIRED_TEST==='1';
const REVOKED_TEST=process.env.READING_REVOKED_TEST==='1';
const PURCHASE_TEST=process.env.READING_PURCHASE_TEST==='1';
const LOCKED_TEST = process.env.READING_LOCKED_TEST === '1'||EXPIRED_TEST||REVOKED_TEST;
const MEMBERSHIP_ROWS=CUSTOMER_TEST||EXPIRED_TEST||REVOKED_TEST?[{access_until:new Date(Date.now()+(EXPIRED_TEST?-1:1)*365*86400000).toISOString(),revoked_at:REVOKED_TEST?new Date().toISOString():null}]:[];
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000';
(async()=> {
  const browser = await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
  const page = await browser.newPage();
  const errors = [];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',async route=> {
    const url = route.request().url();
    if (url.includes('esm.sh/')) return route.fulfill({contentType:'application/javascript',body:`
      export function createClient(){
        function rows(table,filters){
          if(table==='bp_reading_catalog') return [{edition_id:2,book_id:'gualachulain',title:'Gualachulain',author:'Aidan Blackwood',series:'The Cursed Bothies',series_order:2,cover_url:'/assets/book7.png'}, {edition_id:3,book_id:'fixture',title:'Fixture Title',author:'Test Author',series:'Test Series',series_order:1,cover_url:'/assets/book7.png'}];
          if(table==='bp_reading_purchases')return ${PURCHASE_TEST?JSON.stringify([{book_id:'gualachulain',revoked_at:null}]):'[]'};
          if(table==='bp_reading_memberships'){const rows=${JSON.stringify(MEMBERSHIP_ROWS)};if(localStorage.getItem('mock-membership-revoked')==='yes')rows.forEach(row=>row.revoked_at=new Date().toISOString());return rows;}
          if(table==='bp_reading_state') {let rows=JSON.parse(localStorage.getItem('mock-cloud')||'{}');return Object.entries(rows).filter(([id])=>!filters.edition_id||id==filters.edition_id).map(([id,row])=>({edition_id:Number(id),...row}));}
          return [];
        }
        return {auth:{getUser:async()=>({data:{user:{id:'library-test'}}}),getSession:async()=>({data:{session:{access_token:'test'}}}),onAuthStateChange:()=>{}},
          from(table){const filters={};return {select(){return this},eq(key,value){filters[key]=value;return this},single:async()=>({data:{is_admin:${CUSTOMER_TEST || LOCKED_TEST || PURCHASE_TEST ? 'false' : 'true'}}}),maybeSingle:async()=>({data:rows(table,filters)[0]||null}),then(resolve,reject){return Promise.resolve({data:rows(table,filters)}).then(resolve,reject)}}},
          async rpc(name,args){if(name==='bp_reading_can_read'){(window.testEntitlementIds ||= []).push(args.p_edition_id);return {data:${LOCKED_TEST ? 'false' : 'true'}};}const cloud=JSON.parse(localStorage.getItem('mock-cloud')||'{}');const row=cloud[args.p_edition_id];if((row?.revision||0)!==args.p_expected_revision)return {error:{code:'40001'}};cloud[args.p_edition_id]={payload:args.p_payload,revision:(row?.revision||0)+1};localStorage.setItem('mock-cloud',JSON.stringify(cloud));return {data:cloud[args.p_edition_id].revision};}
        };
      }`});
    if (url.includes('jszip')) return route.fulfill({path:`${TEST_DIR}/jszip.min.js`,contentType:'application/javascript'});
    if (url.includes('epub.min.js')) return route.fulfill({path:`${TEST_DIR}/epub.min.js`,contentType:'application/javascript'});
    if (url.includes('bp-reading-deliver-epub')) return route.fulfill({path:`${TEST_DIR}/test.epub`,contentType:'application/epub+zip',headers:{'access-control-allow-origin':'*'}});
    return route.abort();
  });
  await page.goto(`${BASE_URL}/pages/bp-reading.html`);
  await page.waitForFunction(()=>!document.getElementById('library').hidden);
  assert.equal(await page.locator('.book-card').count(),plannedCount+1);
  assert.equal(await page.locator('.book-card[data-availability=ready]').count(),4);
  assert.equal(await page.locator('.book-card[data-availability=coming-soon]').count(),plannedCount-3);
  await page.locator('#library-availability').selectOption('coming');
  assert.equal(await page.locator('.open-book:not(:disabled)').count(),0,'pending titles cannot open, even for administrators');
  assert.equal(await page.locator('.progress-track:visible').count(),0,'pending titles do not pretend to have reading progress');
  assert((await page.evaluate(()=>window.testEntitlementIds||[])).every(id=>id===2||id===3),'only approved editions receive entitlement queries');
  await page.locator('#library-availability').selectOption('ready');assert.equal(await page.locator('.book-card').count(),4);
  await page.locator('#library-availability').selectOption('all');
  assert.equal(await page.locator('#reading-membership-offer').count(),!CUSTOMER_TEST&&(LOCKED_TEST||PURCHASE_TEST)?1:0,'whole offer removed for active members and admins');
  if(CUSTOMER_TEST)assert.match(await page.locator('#reading-membership-text').textContent(),/Annual membership active.*Reading access through/);
  if(CUSTOMER_TEST) {
    await page.evaluate(()=>{localStorage.setItem('mock-membership-revoked','yes');window.dispatchEvent(new Event('focus'));});
    await page.waitForFunction(()=>document.getElementById('reading-membership-offer')?.isConnected===true);
    assert.equal(await page.locator('#reading-membership-offer').isVisible(),true,'offer restored after revoked membership');
    await page.evaluate(()=>{localStorage.removeItem('mock-membership-revoked');window.dispatchEvent(new Event('focus'));});
    await page.waitForFunction(()=>!document.getElementById('reading-membership-offer'));
  }
  if(!CUSTOMER_TEST&&!LOCKED_TEST&&!PURCHASE_TEST)assert.match(await page.locator('#reading-membership-text').textContent(),/Administrator access/);
  if(CUSTOMER_TEST||PURCHASE_TEST)assert.equal(await page.getByRole('button',{name:'Read Book',exact:true}).count(),4);
  if(PURCHASE_TEST)assert.equal(await page.locator('.book-card').filter({has:page.getByRole('heading',{name:'Gualachulain',exact:true})}).locator('.book-badge').first().textContent(),'Owned','verified permanent purchase label');
  if(CUSTOMER_TEST)assert.equal(await page.locator('.book-card[data-edition-id] .book-badge').first().textContent(),'Included','membership inclusion label');
  const titleSize=await page.locator('.library h1').evaluate(node=>parseFloat(getComputedStyle(node).fontSize));assert(titleSize<=28,'compact library title');
  if (LOCKED_TEST) {
    assert.equal(await page.getByRole('button',{name:'Subscribe to read',exact:true}).count(),2);
    await page.locator('#book-grid .book-card[data-edition-id] .open-book').first().click();
    assert.equal(await page.locator('#reader').isVisible(),false);
    assert.match(await page.locator('#library-error').textContent(),/membership or purchase/);
    console.log('PASS signed-in nonmember sees subscription route and cannot open protected books');await browser.close();return;
  }
  await page.locator('#library-search').fill('Camban');assert.equal(await page.locator('.book-card').count(),1);assert.equal(await page.getByRole('button',{name:'Coming soon',exact:true}).isDisabled(),true);
  await page.locator('#library-search').fill('Test Author');assert.equal(await page.locator('.book-card').count(),1);
  await page.locator('#book-grid .open-book').click();await page.waitForFunction(()=>!document.getElementById('reader-menu-toggle').hidden);
  assert.equal(await page.locator('#reader-book-title').textContent(),'Fixture Title','selected edition title');
  await page.frameLocator('#epub-viewer iframe').locator('p').first().waitFor({state:'visible'});
  const frame=await (await page.locator('#epub-viewer iframe').elementHandle()).contentFrame();
  const visibleProse=await frame.evaluate(()=>{const p=document.querySelector('p');const style=getComputedStyle(p);return {text:p.textContent.length,color:style.color,font:style.fontFamily,height:p.getBoundingClientRect().height};});
  assert(visibleProse.text>20&&visibleProse.height>0,'actual prose is laid out');
  assert.equal(visibleProse.color,'rgb(48, 39, 31)','publisher colours cannot hide prose');
  assert.match(visibleProse.font,/Georgia/,'reader font overrides incompatible publisher font');

  await page.locator('#reader-menu-toggle').click();await page.locator('#open-notebook').click();await page.locator('#add-page-note').click();
  await page.locator('#notebook-list textarea').fill('Synced private note');await page.getByRole('button',{name:'Save note',exact:true}).click();await page.locator('#close-panel').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('mock-cloud')||'{}')[3]?.payload.annotations?.[0]?.note==='Synced private note');
  await page.locator('#back-to-library').click();
  await page.waitForTimeout(1400);
  await page.evaluate(()=>{for(const key of Object.keys(localStorage)) if(key.startsWith('bp-reading:')||key.startsWith('bp-reading-outbox:')) localStorage.removeItem(key);});
  await page.reload();await page.waitForFunction(()=>!document.getElementById('library').hidden);
  await page.locator('#library-search').fill('Fixture Title');await page.locator('#book-grid .open-book').click();await page.waitForFunction(()=>!document.getElementById('reader-menu-toggle').hidden);
  await page.locator('#reader-menu-toggle').click();await page.locator('#open-notebook').click();
  assert.equal(await page.locator('#notebook-list textarea').inputValue(),'Synced private note','server restore without device cache');
  await page.locator('#close-panel').click();await page.locator('#back-to-library').click();
  await page.locator('#library-search').fill('Gualachulain');await page.locator('#book-grid .open-book').click();await page.waitForFunction(()=>!document.getElementById('reader-menu-toggle').hidden);
  await page.locator('#reader-menu-toggle').click();await page.locator('#open-notebook').click();assert.equal(await page.locator('#notebook-list textarea').count(),0,'notebook isolated per edition');
  await page.locator('#close-panel').click();await page.locator('#back-to-library').click();
  await page.evaluate(()=>{
    const key='bp-reading:library-test:edition:2:v2',saved=JSON.parse(localStorage.getItem(key));
    saved.progress=100;saved.hasStarted=true;localStorage.setItem(key,JSON.stringify(saved));
    document.getElementById('library-search').value='';document.getElementById('library-search').dispatchEvent(new Event('input'));
  });
  assert.equal(await page.locator('.book-badge.finished').count(),1,'finished title has a status badge');
  assert.equal(await page.locator('#continue-reading h2').textContent(),'Fixture Title','resume excludes completed books');
  assert.deepEqual(errors,[]);console.log('PASS multi-book catalogue, author filtering, edition selection, Supabase snapshot sync, server restoration and per-edition notebook isolation (mock server, real EPUB)');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
