const {chromium}=require('playwright');
const TEST_DIR = process.env.READING_TEST_DIR || '/tmp/blackwood-reading-test';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000';
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}),headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:900}}); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*', async r=>{
 const url=r.request().url();
 if(url.includes('esm.sh/')) return r.fulfill({contentType:'application/javascript',body:`export function createClient(){return {auth:{getUser:async()=>({data:{user:{id:'reader-test'}}}),getSession:async()=>({data:{session:{access_token:'test'}}}),onAuthStateChange:(cb)=>{window.testSignOut=()=>cb('SIGNED_OUT')}},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{is_admin:true}})})})})}}`});
 if(url.includes('jszip'))return r.fulfill({path:`${TEST_DIR}/jszip.min.js`,contentType:'application/javascript'});
 if(url.includes('epub.min.js'))return r.fulfill({path:`${TEST_DIR}/epub.min.js`,contentType:'application/javascript'});
 if(url.includes('bp-reading-deliver-epub'))return r.fulfill({path:`${TEST_DIR}/test.epub`,contentType:'application/epub+zip',headers:{'access-control-allow-origin':'*'}});
 return r.abort();
 });
 const assert=(c,m)=>{if(!c)throw Error(m)};
 await page.goto(`${BASE_URL}/pages/bp-reading.html`);
 await page.screenshot({path:`${TEST_DIR}/library.png`});
 await page.getByRole('button',{name:'Read Book',exact:true}).click();
 await page.waitForFunction(()=>!document.getElementById('reader-menu-toggle').hidden);
 await page.waitForFunction(()=>!document.getElementById('reader-seek').disabled);
 await page.screenshot({path:`${TEST_DIR}/reading.png`});
 assert(await page.locator('#epub-viewer iframe').count()>0,'real EPUB iframe rendered');
 const bookFrame = page.frames().find(frame => frame.parentFrame());
 assert(await bookFrame.evaluate(() => ['copy','cut','paste','contextmenu'].every(type => {
   const event = new Event(type, {bubbles:true,cancelable:true});
   document.dispatchEvent(event); return event.defaultPrevented;
 })), 'book clipboard deterrents');


 await bookFrame.evaluate(() => {
   const paragraph = document.querySelector('p'); const range = document.createRange();
   range.setStart(paragraph.firstChild,0); range.setEnd(paragraph.firstChild,40);
   const selection = window.getSelection();selection.removeAllRanges();selection.addRange(range);
   document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
 });
 await page.waitForFunction(()=>!document.getElementById('selection-tools').hidden);
 await page.locator('#save-highlight').click();assert(await page.locator('#notebook-list blockquote').count()===1,'selected text highlight');
 await page.locator('#notebook-list textarea').fill('Highlight note');await page.getByRole('button',{name:'Save note',exact:true}).click();await page.locator('#close-panel').click();
 await bookFrame.evaluate(()=>window.getSelection().removeAllRanges());
 await page.locator('#reader-menu-toggle').click();
 await page.locator('#open-contents').click();assert(await page.locator('#chapter-list button').count()===2,'contents');
 await page.getByRole('button',{name:'The Second Chapter',exact:true}).click();
 await page.waitForFunction(()=>document.getElementById('quiet-chapter').textContent==='The Second Chapter');
 assert(await page.locator('#return-position').isVisible(),'return offered');
 await page.locator('#return-position').click();
 await page.waitForFunction(()=>document.getElementById('quiet-chapter').textContent==='The First Chapter');
 await page.locator('#open-appearance').click();
 await page.selectOption('#reader-font','clean');await page.selectOption('#reader-spacing','1.9');await page.selectOption('#reader-width','620');await page.selectOption('#reader-motion','instant');await page.selectOption('#reading-theme','night');
 await page.keyboard.press('Escape');
 assert(!(await page.locator('#reader-panel').isVisible()),'Escape closes panel');
 assert(await page.locator('#reader').getAttribute('data-theme')==='night','theme');
 await page.locator('#bookmark').click(); await page.locator('#open-bookmarks').click();assert(await page.locator('.saved-place').count()===1,'bookmark drawer');await page.locator('#close-panel').click();
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('bp-reading:reader-test:edition:2:v2')).position);
 await page.keyboard.press('ArrowRight');await page.waitForTimeout(400);
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('bp-reading:reader-test:edition:2:v2')).position);assert(before!==after,'keyboard page turn');
 await page.locator('#open-search').click();await page.locator('#book-search').fill('water');await page.locator('#book-search-form button').click();await page.waitForFunction(()=>!document.getElementById('search-status').textContent.includes('Searching'));assert((await page.locator('#search-results button').count())>0,'search results');await page.locator('#search-results button').first().click();await page.waitForTimeout(300);

 await page.locator('#open-notebook').click();await page.locator('#add-page-note').click();await page.locator('#notebook-list textarea').first().fill('A private reading note');await page.getByRole('button',{name:'Save note',exact:true}).first().click();await page.locator('#close-panel').click();
 assert((await page.locator('#reader-watermark').textContent()).includes('Reader'),'personal watermark');
 assert((await page.locator('#reading-sync-status').textContent()).includes('Device-only'),'honest missing-backend status');
 await page.locator('#back-to-library').click();await page.reload();await page.getByRole('button',{name:'Continue Reading',exact:true}).click();await page.waitForFunction(()=>!document.getElementById('reader-menu-toggle').hidden);
 assert(await page.locator('#reader').getAttribute('data-theme')==='night','settings restored');
 await page.locator('#reader-menu-toggle').click();await page.locator('#open-notebook').click();assert((await page.locator('#notebook-list textarea').evaluateAll(nodes=>nodes.map(n=>n.value))).includes('A private reading note'),'notebook restored');await page.locator('#close-panel').click();await page.locator('#reader-menu-toggle').click();

 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await page.locator('#reader-menu-toggle').click();await page.locator('#open-appearance').click();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile viewport');
 await page.screenshot({path:`${TEST_DIR}/mobile.png`});await page.locator('#close-panel').click();
 await page.evaluate(()=>window.testSignOut());assert(await page.locator('#reader-access').isVisible(),'signout access screen');assert(!(await page.locator('#reader').isVisible()),'signout closes book');
 await page.route('https://esm.sh/**', r=>r.fulfill({contentType:'application/javascript',body:`export function createClient(){return {auth:{getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>{}}}}`}));
 await page.reload();await page.waitForFunction(()=>document.getElementById('access-message').textContent.includes('could not be opened'));
 assert(await page.locator('#reader-access').isVisible(),'failed auth has visible recovery');assert(!(await page.locator('#library').isVisible()),'failed auth hides library');
 await page.unroute('https://esm.sh/**');
 await page.route('**/functions/v1/bp-reading-deliver-epub',r=>r.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:'Test access denied'}),headers:{'access-control-allow-origin':'*'}}));
 await page.reload();await page.locator('.open-book').click();await page.waitForFunction(()=>document.getElementById('library-error').textContent.includes('Test access denied'));
 assert(await page.locator('#library').isVisible(),'delivery failure returns to library');
 assert(errors.length===0,JSON.stringify(errors));
 console.log('PASS real EPUB rendering, chapter jump/return, appearance, bookmarks, keyboard, search, resume, mobile, signout, denied auth/delivery recovery; no page errors');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
