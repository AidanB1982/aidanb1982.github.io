const {chromium}=require('playwright'),assert=require('node:assert/strict');
const BASE=process.env.BASE_URL||'http://127.0.0.1:8000',DIR=process.env.READING_TEST_DIR||'/tmp/blackwood-reading-test';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});try{
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('https://**/*',route=>{
  const url=route.request().url(),headers={'Access-Control-Allow-Origin':'*'};
  if(url.includes('esm.sh/'))return route.fulfill({contentType:'application/javascript',headers,body:`export function createClient(){return{auth:{getUser:async()=>({data:{user:{id:'swipe-reader'}}}),getSession:async()=>({data:{session:{access_token:'fixture'}}}),onAuthStateChange:()=>{}},from(table){if(table!=='member_profiles')throw Error('Unexpected table: '+table);return{select(){return this},eq(){return this},single:async()=>({data:{is_admin:false}})}},rpc:async(name)=>{if(name!=='bp_arc_reading_catalogue')throw Error('Unexpected RPC: '+name);return{data:[{assignment_id:9,edition_id:2,book_id:'gualachulain',title:'Gualachulain',author:'Aidan Blackwood',cover_url:'/assets/book7.png',terms_accepted:true,can_read:true}]}}}}`});
  if(url.includes('jszip'))return route.fulfill({path:DIR+'/jszip.min.js',contentType:'application/javascript',headers});
  if(url.includes('epub.min.js'))return route.fulfill({path:DIR+'/epub.min.js',contentType:'application/javascript',headers});
  if(url.includes('/functions/v1/bp-reading-arc')){const cors={...headers,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Expose-Headers':'X-BP-ARC-Reference'};if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:cors});return route.fulfill({path:DIR+'/test.epub',contentType:'application/epub+zip',headers:{...cors,'X-BP-ARC-Reference':'TEST-ARC'}});}
  return route.abort();
 });
 await page.goto(BASE+'/pages/bp-reading.html?arc=1');await page.waitForFunction(()=>!document.getElementById('library').hidden);
 for(const group of await page.locator('details:has(.book-card)').all())if(await group.getAttribute('open')===null)await group.locator('summary').click();
 for(const checkbox of await page.locator('.arc-reading-terms input').all())await checkbox.check();
 await page.locator('.book-card[data-edition-id="2"] .open-book').click();await page.waitForFunction(()=>!document.getElementById('reader-menu-toggle').hidden&&!document.getElementById('reader-seek').disabled);
 const saved=()=>page.evaluate(()=>{const key=Object.keys(localStorage).find(key=>key.includes(':arc-assignment:9:'));return JSON.parse(localStorage.getItem(key));});
 const frame=()=>page.frameLocator('#epub-viewer iframe');
 const cdp=await context.newCDPSession(page);
 async function touch(dx,dy=0,{cancel=false,hold=0,ratio=.5,pinch=false,point=null}={}){
  const box=await page.locator('#epub-viewer').boundingBox(),x=point?.x??(box.x+box.width*ratio),y=point?.y??(box.y+box.height*.55);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  if(hold)await page.waitForTimeout(hold);
  for(let step=1;step<=6;step++){
   const primary={x:x+dx*step/6,y:y+dy*step/6,id:1};
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:pinch&&step>=3?[primary,{x:x+40,y:y+40,id:2}]:[primary]});
  }
  await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
 }
 async function changed(position){await page.waitForFunction(position=>{const key=Object.keys(localStorage).find(key=>key.includes(':arc-assignment:9:'));return JSON.parse(localStorage.getItem(key))?.position!==position;},position);await page.waitForFunction(()=>document.getElementById('page-turn-overlay').hidden);}
 async function unchanged(position,label){await page.waitForTimeout(150);assert.equal((await saved()).position,position,label);}
 const original=await saved();await touch(-160);await changed(original.position);const next=await saved();assert(next.progress>original.progress,'a real center-origin left swipe advances');
 await touch(160);await changed(next.position);assert.equal((await saved()).position,original.position,'a real center-origin right swipe returns');
 // The starting side does not choose the turn direction: a left-half left swipe also advances.
 await touch(-110,0,{ratio:.4});await changed(original.position);const advanced=await saved();
 await touch(160,0,{ratio:.45});await changed(advanced.position);assert.equal((await saved()).position,original.position);
 await touch(-160,0,{cancel:true});await unchanged(original.position,'cancelled real touch swipe preserves place');
 await touch(0,-130);await unchanged(original.position,'vertical gestures do not turn pages');
 const box=await page.locator('#epub-viewer').boundingBox();
 const linkPoint=await frame().locator('body').evaluate((body,{x,y,viewport})=>{
   const offset=window.frameElement.getBoundingClientRect(),target=document.elementFromPoint(x-offset.left,y-offset.top);
   const a=document.createElement('a');a.id='swipe-test-link';a.href='#kept-link';
   while(target.firstChild)a.append(target.firstChild);target.append(a);
   const rect=[...a.getClientRects()].find(r=>r.width>20&&r.height>0&&r.left+offset.left>=viewport.x&&r.right+offset.left<=viewport.x+viewport.width&&r.top+offset.top>viewport.y&&r.bottom+offset.top<viewport.y+viewport.height);
   if(!rect)throw Error('No visible link text rectangle');
   return{x:rect.left+offset.left+rect.width/2,y:rect.top+offset.top+rect.height/2};
 },{x:box.x+box.width*.5,y:box.y+box.height*.55,viewport:box});
 // The EPUB iframe deliberately disallows its own scripts. Register the witness
 // from the parent realm, just as the production gesture listener is registered.
 await page.evaluate(()=>document.querySelector('#epub-viewer iframe').contentDocument.querySelector('#swipe-test-link').addEventListener('pointerdown',()=>window.linkTouchSeen=true));
 await touch(-120,0,{point:linkPoint});await unchanged(original.position,'swiping from a link does not turn a page');assert.equal(await page.evaluate(()=>window.linkTouchSeen),true,'real touch targeted the EPUB link');
 await frame().locator('#swipe-test-link').evaluate(a=>a.replaceWith(...a.childNodes));
 await touch(-150,0,{hold:600});await unchanged(original.position,'held selection press does not become a page turn');
 await frame().locator('body').evaluate(body=>{const p=body.querySelector('p'),r=document.createRange();r.setStart(p.firstChild,0);r.setEnd(p.firstChild,25);getSelection().removeAllRanges();getSelection().addRange(r);});
 await touch(-150);await unchanged(original.position,'an existing text selection is preserved');
 await frame().locator('body').evaluate(()=>getSelection().removeAllRanges());
 await touch(-150,0,{pinch:true});await unchanged(original.position,'a second touch cancels the pending turn');
 assert.deepEqual(errors,[]);console.log('PASS real EPUB touch: Chromium touch input advances/reverses from center and opposite-side starts; cancellation, vertical movement, long-press/selection, links and a second finger preserve reading place. Real-phone acceptance still required.');
}finally{await context.close();await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
