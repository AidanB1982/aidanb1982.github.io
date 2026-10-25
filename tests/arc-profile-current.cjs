const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const assignments=[{id:1,member_id:'00000000-0000-0000-0000-000000000001',arc_file_id:1,status:'active',created_at:'2026-09-01',review_due_date:'2026-09-14',download_count:1,review_link:'https://review.invalid',arc_files:{title:'The Crossing',slug:'the-crossing',author_name:'Miren Vale',is_active:true}},{id:2,member_id:'00000000-0000-0000-0000-000000000001',arc_file_id:2,status:'active',created_at:'2026-10-25',review_due_date:'2099-11-10',download_count:0,arc_files:{title:'Gualachulain',slug:'gualachulain',author_name:'Aidan Blackwood',is_active:true}}];
 await page.route('https://**/*',route=>{
  const url=route.request().url();
  if(url.includes('script.google.com'))return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,profile:{editable:{Name:'Fixture reader'},readOnly:{'Application Status':'Accepted','ARC Sent':'The Crossing','Review Due Date':'14 Sept 2026'}}})});
  if(url.includes('/rest/v1/arc_file_assignments'))return route.fulfill({contentType:'application/json',body:JSON.stringify(assignments)});
  if(url.includes('get_arc_admin_dashboard'))return route.fulfill({contentType:'application/json',body:JSON.stringify(assignments.map(a=>({...a,title:a.arc_files.title,author_name:a.arc_files.author_name,reader_name:'Fixture reader',reader_email:'reader@example.invalid',review_status:a.review_link?'Review Filed':'Active'})))});
  return route.abort();
 });
 for(const name of ['members.js','header.js','member-bookshelf.js','member-arc-shield-watch.js'])await page.route('**/js/'+name+'*',r=>r.abort());
 await page.goto((process.env.BASE_URL||'http://127.0.0.1:8000')+'/pages/members.html');
 await page.waitForFunction(()=>typeof window.initBlackwoodArcProfile==='function');
 await page.evaluate(async()=>{const root=document.createElement('section');root.id='arc-test-root';document.body.append(root);await window.initBlackwoodArcProfile({root,session:{access_token:'test',user:{id:'00000000-0000-0000-0000-000000000001'}}});});
 await page.waitForFunction(()=>document.querySelector('[data-arc-live-summary]').textContent.includes('Gualachulain'));
 assert((await page.locator('[data-arc-live-summary]').textContent()).includes('2099-11-10'));
 assert(await page.locator('[aria-label="Historical ARC application details"]').isHidden(),'old application due date is clearly historical and collapsed');
 assert.equal(await page.locator('[data-arc-assignment-card]').count(),2,'old ARC review record remains in the vault');
 await page.locator('.arc-admin-summary').click();await page.locator('[data-arc-admin-book-search]').fill('Gualachulain');
 assert.equal(await page.locator('[data-arc-admin-row]:visible').count(),1,'admin monitor can focus on the current campaign');
 assert((await page.locator('[data-arc-admin-row]:visible').textContent()).includes('Gualachulain'));
 assert.equal(await page.locator('a[href="/pages/behind-files-admin.html#ops-arc"]').count(),1);
 assert.deepEqual(errors,[]);console.log('PASS real ARC profile uses current Supabase assignment, retains collapsed legacy details and review history, and filters the admin monitor by book');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
