const {chromium}=require('playwright');
const TEST_DIR = process.env.READING_TEST_DIR || '/tmp/blackwood-reading-test';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000';
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}),headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:process.env.READING_MOBILE_TEST==='1'?{width:390,height:844}:{width:1280,height:900}}); const errors=[];page.on('pageerror',e=>errors.push(e.message));
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

 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bp-reading:reader-test:edition:2:v2')));
 const original=await saved();
 // Hold the curl open: the destination must render before that animation finishes.
 const layout=await page.locator('#epub-viewer').evaluate(viewer=>{
   const frame=viewer.querySelector('iframe'),p=frame.contentDocument.querySelector('p');
   return {font:frame.contentWindow.getComputedStyle(p).fontSize,width:frame.getBoundingClientRect().width};
 });
 await page.evaluate(()=>{
   document.getElementById('page-arrow-right').click();
   window.heldTurn=document.getElementById('page-turn-sheet').getAnimations()[0];
   window.heldTurn.pause();window.heldTurn.currentTime=0;
 });
 await page.waitForFunction(cfi=>JSON.parse(localStorage.getItem('bp-reading:reader-test:edition:2:v2')).position!==cfi,original.position);
 const snapshot=await page.locator('.turn-page-snapshot').evaluate(host=>{
   const p=host.shadowRoot.querySelector('p');
   return {text:p.textContent,font:getComputedStyle(p).fontSize,rect:p.getBoundingClientRect().toJSON()};
 });
 assert(snapshot.text.length>20&&snapshot.rect.width>0,'outgoing sheet contains actual book prose');
 assert(snapshot.font===layout.font,'snapshot preserves the reader type size');
 const viewport=await page.locator('#epub-viewer').boundingBox();assert(snapshot.rect.left>=viewport.x-1&&snapshot.rect.right<=viewport.x+viewport.width+1,'snapshot prose aligns with the outgoing visible page');
 await page.evaluate(()=>window.heldTurn.currentTime=100);
 await page.screenshot({path:TEST_DIR+'/page-curl.png'});
 // A quick second press queues one turn without tearing away the first sheet.
 await page.locator('#page-arrow-right').click();
 assert(await page.locator('#page-turn-overlay').isVisible(),'queued turn keeps the outgoing sheet');
 await page.evaluate(()=>window.heldTurn.play());
 await page.waitForFunction(()=>document.getElementById('page-turn-overlay').hidden);
 const advanced=await saved();assert(advanced.progress>original.progress,'queued turns update completion');
 assert(await page.locator('#epub-viewer iframe').evaluate(frame=>frame.getBoundingClientRect().width)===layout.width,'snapshot never changes pagination width');
 // Swipe from a page that is already offset inside a long chapter.
 async function drag(direction,cancel=false){
   const frame=await (await page.locator('#epub-viewer iframe').elementHandle()).contentFrame();
   await frame.evaluate(({direction,cancel})=>{
     const viewer=parent.document.getElementById('epub-viewer').getBoundingClientRect();
     const offset=window.frameElement.getBoundingClientRect().left-viewer.left;
     const start=(direction>0?viewer.width*.95:viewer.width*.05)-offset;
     const end=start+(direction>0?-1:1)*viewer.width*.65;
     for(const [type,x] of [['pointerdown',start],['pointermove',end],[cancel?'pointercancel':'pointerup',end]])document.body.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'touch',pointerId:7,isPrimary:true,clientX:x,clientY:200}));
   },{direction,cancel});
   await page.waitForFunction(()=>document.getElementById('page-turn-overlay').hidden);
 }
 await drag(1,true);assert((await saved()).position===advanced.position,'cancelled swipe keeps reading place');
 await drag(1);assert((await saved()).position!==advanced.position,'forward swipe uses visible-page coordinates');
 await drag(-1);assert((await saved()).position===advanced.position,'backward swipe restores the same place');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.keyboard.press('ArrowLeft');
 await page.waitForFunction(cfi=>JSON.parse(localStorage.getItem('bp-reading:reader-test:edition:2:v2')).position!==cfi,advanced.position);
 assert(await page.locator('#page-turn-overlay').isHidden(),'reduced motion skips the curl');
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.locator('#reader-menu-toggle').click();await page.locator('#open-appearance').click();
 await page.selectOption('#reader-motion','instant');await page.locator('#close-panel').click();
 const beforeInstant=await saved();await page.keyboard.press('ArrowRight');
 await page.waitForFunction(cfi=>JSON.parse(localStorage.getItem('bp-reading:reader-test:edition:2:v2')).position!==cfi,beforeInstant.position);
 assert(await page.locator('#page-turn-overlay').isHidden(),'instant preference skips the curl');
 await page.evaluate(()=>{
   document.getElementById('reader-motion').value='gentle';
   document.getElementById('reader-motion').dispatchEvent(new Event('change'));
   document.getElementById('page-arrow-right').click();window.testSignOut();
 });
 await page.waitForFunction(()=>!document.getElementById('reader-access').hidden);
 assert(await page.locator('.turn-page-snapshot').count()===0,'closing removes the outgoing page copy');
 assert(await page.locator('#page-turn-sheet').evaluate(sheet=>sheet.getAnimations().length)===0,'closing cancels the curl immediately');
 assert(errors.length===0,JSON.stringify(errors));
 console.log('PASS concurrent EPUB rendering and page curl, queued turns, stable pagination, forward/backward/cancelled swipes, reduced motion and instant turns');
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
