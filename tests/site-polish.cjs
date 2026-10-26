const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const BASE_URL=process.env.BASE_URL||'http://127.0.0.1:8000';
const OUT=process.env.READING_TEST_DIR||'/tmp/blackwood-reading-test';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 for(const width of [1440,1024,768,390,320]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  await page.route('https://**/*',route=>{
   if(route.request().url().includes('supabase-js'))return route.fulfill({contentType:'text/javascript',body:'window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>{}}})}'});
   return route.abort();
  });
  for(const path of ['/index.html','/pages/publications.html','/pages/store.html','/pages/about.html','/pages/contact.html','/pages/start-here.html','/pages/reading-lists.html','/pages/members.html','/pages/behind-files-admin.html','/pages/recovered-files.html','/pages/standalone.html','/pages/appearances.html','/pages/submissions.html','/pages/cursed-bothies.html','/pages/archive-files.html','/pages/author.html','/pages/CommunitySpotlight.html']){
   await page.goto(BASE_URL+path);
   await page.waitForSelector('.blackwood-account-link',{state:'attached'});
   await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.locator('link[href*="site-polish.css"]').count(),1,'shared finishing layer loaded');
   assert.equal(await page.locator('#header-placeholder a[href="/pages/bp-reading.html"]').count(),0,'BP Reading withheld from public navigation');
   await page.waitForSelector('#footer-placeholder .footer');
   assert.equal(await page.locator('#footer-placeholder a[href="/pages/bp-reading.html"]').count(),0,'BP Reading withheld from public footer');
   const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   if(overflow.scroll>overflow.width+1)console.log(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left< -1)&&getComputedStyle(el).position!=='fixed'}).slice(0,12).map(el=>({tag:el.tagName,class:el.className,width:el.getBoundingClientRect().width,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right}))));
   assert(overflow.scroll<=overflow.width+1,`${path} at ${width}px overflows: ${JSON.stringify(overflow)}`);
   if(path==='/index.html'&&width<=390){
    await page.getByRole('button',{name:'Reading',exact:true}).click();
    const readingLink=page.getByRole('menuitem',{name:'Recommended Reads',exact:true});
    await readingLink.click({trial:true});
    const bounds=await readingLink.boundingBox();
    assert(bounds.x>=0&&bounds.x+bounds.width<=width,'home dropdown stays within mobile viewport');
    await page.keyboard.press('Escape');
   }
   if(path!=='/index.html'&&width<=1024){
    const toggle=page.locator('.blackwood-mobile-toggle');
    if(await toggle.isVisible()){
     await toggle.click();
     await page.locator('.blackwood-account-link').click({trial:true});
     assert.equal(await toggle.getAttribute('aria-expanded'),'true','mobile menu opens');
     await toggle.click();
    }
   }
   if(path==='/pages/CommunitySpotlight.html'&&width===390){
    assert.equal(await page.locator('#header-placeholder').count(),1,'one Community header');assert.equal(await page.locator('.taggbox').count(),1,'one Community embed');
    await page.evaluate(()=>{window.testCopied='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.testCopied=text;}}});});
    await page.locator('#hashtag').click();assert.equal(await page.evaluate(()=>window.testCopied),'#aidanblackwood');assert((await page.locator('#hashtag').textContent()).includes('Copied'));
   }
   if(width<=1024){
    if(path==='/pages/publications.html'&&width<=600){const heights=await page.locator('#start-here .work-actions .button').evaluateAll(buttons=>buttons.map(button=>button.getBoundingClientRect().height));assert(heights.every(height=>height<80),'stacked book actions do not inherit a vertical flex basis');}
    const hiddenCopy=await page.evaluate(()=>[...document.querySelectorAll('.fade-in,.work')].filter(el=>el.getBoundingClientRect().height>0&&getComputedStyle(el).opacity==='0').length);assert.equal(hiddenCopy,0,'mobile content never waits for reveal animations');
    const tiny=await page.evaluate(()=>[...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]),select,textarea')].filter(el=>{const r=el.getBoundingClientRect();return r.width>2&&r.height>2&&r.left>=0&&getComputedStyle(el).visibility!=='hidden';}).filter(el=>parseFloat(getComputedStyle(el).fontSize)<16).map(el=>el.id||el.className));
    assert.deepEqual(tiny,[],path+' has zoom-prone mobile form text');
   }
   const shortActions=await page.evaluate(()=>[...document.querySelectorAll('button,.button')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden';}).filter(el=>el.getBoundingClientRect().height<43).map(el=>el.id||el.className));
   assert.deepEqual(shortActions,[],path+' has undersized primary controls');
   if(path==='/pages/publications.html'||path==='/pages/contact.html'||path==='/index.html')await page.screenshot({path:OUT+'/polish-'+path.split('/').pop().replace('.html','')+'-'+width+'.png',fullPage:true});
   console.log('PASS layout/navigation',width,path);
  }
  await page.close();
 }
 const touch=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 await touch.route('https://**/*',route=>route.abort());
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  await touch.setViewportSize(viewport);await touch.goto(BASE_URL+'/index.html');await touch.waitForSelector('.blackwood-account-link');
  await touch.getByRole('button',{name:'Reading',exact:true}).click();
  const link=touch.getByRole('menuitem',{name:'Recommended Reads',exact:true});await link.click({trial:true});
  const bounds=await link.boundingBox(),hero=await touch.locator('.hero').boundingBox();assert(bounds.y+bounds.height<=hero.y+hero.height+1,'touch navigation is not clipped by the hero');
  await touch.goto(BASE_URL+'/pages/contact.html');await touch.waitForSelector('.blackwood-mobile-toggle');
  await touch.locator('.blackwood-mobile-toggle').click();assert(await touch.locator('.blackwood-account-link').isVisible());await touch.keyboard.press('Escape');
  assert.equal(await touch.locator('.blackwood-mobile-toggle').getAttribute('aria-expanded'),'false');
  const field=touch.locator('#name');await field.fill('Reader');assert.equal(await field.evaluate(el=>getComputedStyle(el).fontSize),'16px');
  console.log('PASS touch portrait/landscape navigation and form',viewport.width,viewport.height);
 }
 await touch.route('**/js/header.js*',route=>route.abort());await touch.goto(BASE_URL+'/pages/contact.html');
 assert.equal(await touch.locator('.contact-form-section').evaluate(el=>getComputedStyle(el).opacity),'1','content remains visible if the shared script cannot load');
 await touch.close();
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
