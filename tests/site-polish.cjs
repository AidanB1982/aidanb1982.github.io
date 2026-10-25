const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const BASE_URL=process.env.BASE_URL||'http://127.0.0.1:8000';
const OUT=process.env.READING_TEST_DIR||'/tmp/blackwood-reading-test';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  await page.route('https://**/*',route=>{
   if(route.request().url().includes('supabase-js'))return route.fulfill({contentType:'text/javascript',body:'window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>{}}})}'});
   return route.abort();
  });
  for(const path of ['/index.html','/pages/publications.html','/pages/store.html','/pages/about.html','/pages/contact.html','/pages/start-here.html','/pages/reading-lists.html','/pages/members.html','/pages/behind-files-admin.html']){
   await page.goto(BASE_URL+path);
   await page.waitForSelector('.blackwood-account-link',{state:'attached'});
   await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.locator('link[href*="site-polish.css"]').count(),1,'shared finishing layer loaded');
   const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   if(overflow.scroll>overflow.width+1)console.log(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left< -1)&&getComputedStyle(el).position!=='fixed'}).slice(0,12).map(el=>({tag:el.tagName,class:el.className,width:el.getBoundingClientRect().width,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right}))));
   assert(overflow.scroll<=overflow.width+1,`${path} at ${width}px overflows: ${JSON.stringify(overflow)}`);
   if(path==='/index.html'&&width===390){
    await page.getByRole('button',{name:'Reading',exact:true}).click();
    const readingLink=page.getByRole('menuitem',{name:'BP Reading',exact:true});
    await readingLink.click({trial:true});
    const bounds=await readingLink.boundingBox();
    assert(bounds.x>=0&&bounds.x+bounds.width<=width,'home dropdown stays within mobile viewport');
    await page.keyboard.press('Escape');
   }
   if(path!=='/index.html'&&width===390){
    const toggle=page.locator('.blackwood-mobile-toggle');
    if(await toggle.isVisible()){
     await toggle.click();
     await page.locator('.blackwood-account-link').click({trial:true});
     assert.equal(await toggle.getAttribute('aria-expanded'),'true','mobile menu opens');
     await toggle.click();
    }
   }
   if(path==='/pages/publications.html'||path==='/pages/contact.html'||path==='/index.html')await page.screenshot({path:OUT+'/polish-'+path.split('/').pop().replace('.html','')+'-'+width+'.png',fullPage:true});
   console.log('PASS layout/navigation',width,path);
  }
  await page.close();
 }
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
