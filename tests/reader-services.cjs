const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const BASE=process.env.BASE_URL||'http://127.0.0.1:8000';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const remote=[];
  await page.route('https://**/*',route=>{remote.push(route.request().url());if(route.request().url().includes('googletagmanager'))return route.fulfill({contentType:'text/javascript',body:''});return route.abort();});
  await page.goto(BASE+'/pages/discover.html');await page.waitForSelector('.rs-book');
  assert.equal(remote.filter(url=>url.includes('googletagmanager')).length,0,'no analytics request before consent');
  const all=await page.locator('.rs-book').count();assert(all>=14);
  await page.locator('#discover-series').selectOption('The Archive Files');
  assert.deepEqual(await page.locator('.rs-book h3').allTextContents(),['The Black Bothy','The Drowned Fjord','The Erased Archivist','Holdfast']);
  const first=page.locator('.rs-book').first();await first.locator('[data-save]').click();await first.locator('[data-follow]').click();
  assert.match(await page.locator('#followed-authors').textContent(),/Aidan Blackwood/);
  await page.reload();await page.waitForSelector('.rs-book');assert.equal(await page.locator('.rs-book [data-save][aria-pressed=true]').count(),1);
  await page.locator('#discover-view').selectOption('saved');assert.equal(await page.locator('.rs-book').count(),1);
  await page.locator('.rs-book [data-save]').click();assert.match(await page.locator('#discovery-status').textContent(),/No books match/);
  await page.getByRole('button',{name:'Reset filters',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.rs-book').length>=14);
  await page.locator('#discover-view').selectOption('sample');assert.equal(await page.locator('.rs-book').count(),1);assert.equal(await page.locator('.rs-book h3').textContent(),'Holdfast');
  await page.getByRole('link',{name:'Read the public prologue'}).click();await page.waitForFunction(()=>document.querySelectorAll('#sample-text p').length>5);
  assert(remote.every(url=>!url.includes('deliver-epub')),'sample never calls protected delivery');
  for(const [theme,bg] of [['day','rgb(255, 255, 255)'],['parchment','rgb(245, 240, 230)'],['night','rgb(32, 28, 26)']]){await page.locator('#sample-theme').selectOption(theme);await page.waitForFunction(bg=>getComputedStyle(document.getElementById('public-sample')).backgroundColor===bg,bg);}
  await page.locator('#sample-larger').click();assert.equal(await page.locator('#sample-text p').first().evaluate(el=>getComputedStyle(el).fontSize),'21px');
  const before=remote.length;await page.locator('.rs-privacy-notice').getByRole('button',{name:'Allow analytics',exact:true}).click();await page.waitForFunction(()=>document.querySelector('script[src*="googletagmanager"]'));
  assert(remote.slice(before).some(url=>url.includes('googletagmanager')));
  const layer=await page.evaluate(()=>window.dataLayer);assert(layer.some(args=>args[0]==='event'&&args[1]==='public_sample_open'));assert(!JSON.stringify(layer).includes('?book='),'analytics omits query and fragment');
  await page.locator('[data-privacy-settings]').click();await page.locator('.rs-privacy-dialog').getByRole('button',{name:'Essential only',exact:true}).click();assert.equal(await page.evaluate(()=>window['ga-disable-G-1WN8PBHBW4']),true);
  await page.locator('.rs-privacy-dialog').getByRole('button',{name:'Allow analytics',exact:true}).click();assert.equal(await page.evaluate(()=>window['ga-disable-G-1WN8PBHBW4']),false,'consent can be re-enabled in same page');
  await page.locator('.rs-privacy-dialog').getByRole('button',{name:'Essential only',exact:true}).click();await page.locator('.rs-privacy-dialog').getByRole('button',{name:'Close',exact:true}).click();
  // Native provider form stays separate from membership and never claims provider success.
  let submissions=0;await page.route('https://assets.mailerlite.com/**',route=>{submissions++;return route.fulfill({contentType:'text/html',body:'Provider fixture'});});
  await page.goto(BASE+'/pages/newsletter.html');await page.locator('#newsletter-email').fill('reader@example.test');await page.locator('#newsletter-form button').click();assert.equal(submissions,0,'consent required before submitting');await page.locator('#newsletter-consent').check();await page.locator('#newsletter-form button').click();await page.waitForFunction(()=>document.querySelector('#newsletter-status').textContent.includes('request'));
  await page.waitForTimeout(250);assert.equal(submissions,1);assert(!/subscribed|success|confirmed/i.test(await page.locator('#newsletter-status').textContent()),'no timed fake confirmation');
  assert(!(await page.evaluate(()=>JSON.stringify(localStorage))).includes('reader@example.test'),'email not stored in device wishlist or analytics');
  // Mobile/tablet layouts and primary targets on every new journey.
  for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:900});for(const path of ['discover','newsletter','gifts','reading-preview']){await page.goto(BASE+'/pages/'+path+'.html');if(path==='discover')await page.waitForSelector('.rs-book');if(path==='reading-preview')await page.waitForSelector('#sample-text p');await page.waitForSelector('#footer-placeholder .footer');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),path+' overflow '+width);const small=await page.locator('.rs-button').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().height<43&&n.getBoundingClientRect().width>0).length);assert.equal(small,0,path+' touch targets');assert.equal(await page.locator('#footer-placeholder a[href="/pages/bp-reading.html"]').count(),0,'protected reading stays out of public navigation');}}
  await page.close();
  // A member's records are queried with their authenticated ID; failures remain explicit.
  const account=await browser.newPage();await account.route('https://**/*',route=>route.abort());await account.goto(BASE+'/pages/newsletter.html');await account.addScriptTag({path:require('node:path').resolve('js/member-reading-centre.js')});
  const result=await account.evaluate(async()=>{const root=document.createElement('section');root.className='rs-account';document.querySelector('main').append(root);const queries=[];const data={bp_reading_memberships:{access_until:'2099-12-31T12:00:00Z',revoked_at:null},bp_reading_purchases:[{book_id:'owned',purchased_at:'2026-10-25T10:00:00Z',revoked_at:null},{book_id:'refunded',revoked_at:'2026-10-26'}],bp_reading_catalog:[{edition_id:2,book_id:'owned',title:'Owned title'}],bp_reading_state:[{edition_id:2,payload:{hasStarted:true,progress:42},updated_at:'2026-10-26'}]};const client={auth:{getUser:async()=>({data:{user:{id:'member-one'}}})},from(table){const query={table,filters:[]};queries.push(query);return{select(){return this},eq(k,v){query.filters.push([k,v]);return this},order(){return this},maybeSingle:async()=>({data:data[table]}),then(resolve){resolve({data:data[table]})}}}};await window.initBlackwoodReadingCentre({root,client,userId:'member-one'});return{text:root.textContent,queries,html:root.innerHTML};});
  assert.match(result.text,/reading access through/);assert.match(result.text,/Owned title · permanent/);assert.match(result.text,/42%/);assert(!result.text.includes('refunded'));assert(result.queries.filter(q=>q.table!=='bp_reading_catalog').every(q=>q.filters.some(([k,v])=>k==='user_id'&&v==='member-one')),'private lookups scoped to signed-in user');
  const mismatch=await account.evaluate(async()=>{const root=document.createElement('section');document.body.append(root);let queried=false;await initBlackwoodReadingCentre({root,userId:'another-member',client:{auth:{getUser:async()=>({data:{user:{id:'actual-member'}}})},from(){queried=true;throw Error();}}});return{text:root.textContent,queried};});assert.equal(mismatch.queried,false);assert.match(mismatch.text,/could not be verified/);
  const missing=await account.evaluate(async()=>{const root=document.createElement('section');document.body.append(root);await initBlackwoodReadingCentre({root,userId:'reader',client:{auth:{getUser:async()=>({data:{user:{id:'reader'}}})},from(){return{select(){return this},eq(){return this},order(){return this},maybeSingle:async()=>({error:{message:'not deployed'}}),then(resolve){resolve({error:{message:'not deployed'}})}}}}});return root.textContent;});assert.match(missing,/Membership status could not be checked/);assert.match(missing,/purchase records could not be loaded/);
  await account.close();
  const privatePage=await browser.newPage();let privateTags=0;
  await privatePage.addInitScript(()=>localStorage.setItem('blackwood-analytics-consent-v1',JSON.stringify({version:1,choice:'granted',at:Date.now()})));
  await privatePage.route('https://**/*',r=>{if(r.request().url().includes('googletagmanager'))privateTags++;return r.abort();});
  for(const path of ['/pages/members.html','/pages/behind-files-admin.html','/pages/bp-reading.html']){await privatePage.goto(BASE+path);await privatePage.waitForFunction(()=>Boolean(window.BlackwoodAnalytics));}
  assert.equal(privateTags,0,'existing analytics consent never loads the tag on account, admin or protected reader pages');await privatePage.close();
  const denied=await browser.newPage();await denied.route('https://**/*',r=>r.abort());await denied.addInitScript(()=>{Object.defineProperty(Storage.prototype,'setItem',{value:()=>{throw Error('blocked')}});Object.defineProperty(Storage.prototype,'getItem',{value:()=>{throw Error('blocked')}});});await denied.goto(BASE+'/pages/discover.html');await denied.waitForSelector('.rs-book');await denied.locator('.rs-book [data-save]').first().click();assert.match(await denied.locator('#discovery-save-status').textContent(),/storage is unavailable/);await denied.close();
  console.log('PASS reader journeys: catalogue order/filter/device saves, public-only samples and themes, newsletter consent and honest feedback, analytics opt-in/withdrawal/query redaction, 20 responsive layouts, caller-scoped account data and failure states');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
