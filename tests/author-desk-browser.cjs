const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base=process.env.BASE_URL||'http://127.0.0.1:8000',out=process.env.READING_TEST_DIR||'/tmp';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.route('https://**/*',route=>route.abort());
 await page.addInitScript(()=>{
  const author='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002';window.deskCalls=[];
  const fixtures={
   author_records:[{id:author,publishing_name:'Test Author',relationship_status:'active',desk_access_enabled:true}],publishing_staff:[],
   book_contributors:[{author_id:author,book_id:1,desk_visible:true},{author_id:author,book_id:2,desk_visible:true},{author_id:other,book_id:3,desk_visible:true}],
   book_records:[{id:1,title:'Gualachulain',internal_reference:'BW-001',production_stage:'copy_editing',work_status:'in_production'},{id:2,title:'Another Book',internal_reference:'BW-002',production_stage:'proofreading',work_status:'in_production'},{id:3,title:'Private unrelated book'}],
   author_actions:[{id:1,book_id:1,title:'Approve the cover',description:'Check the artwork.',due_at:'2020-01-01',status:'open',author_visible:true},{id:2,book_id:1,title:'Check the proofs',due_at:'2099-11-01',status:'open',author_visible:true},{id:3,book_id:2,title:'Completed manuscript check',status:'completed',completed_at:'2026-10-01',author_visible:true},{id:4,book_id:1,title:'Hidden editorial note',status:'open',author_visible:false}],
   production_events:[{id:1,book_id:1,to_stage:'copy_editing',event_type:'production_stage_changed',event_date:'2026-10-01',author_visible:true},{id:2,book_id:1,event_type:'hidden_private_event',event_date:'2026-10-20',author_visible:false}],
   book_editions:[{id:1,book_id:1,edition_name:'Paperback',format:'paperback',status:'planned',publication_date:'2099-11-01',author_visible:true}],
   documents:[{id:1,author_id:author,book_id:1,title:'Publishing agreement',requires_signature:true,author_visible:true},{id:2,author_id:author,book_id:null,title:'General author agreement',requires_signature:true,signed_at:'2026-10-01',author_visible:true},{id:3,author_id:author,book_id:2,title:'Retired unsigned draft',requires_signature:true,author_visible:true},{id:4,author_id:author,book_id:2,title:'Signed replacement',supersedes_document_id:3,requires_signature:true,signed_at:'2026-10-02',author_visible:true},{id:5,author_id:other,title:'Private other author contract',requires_signature:true,author_visible:true}],
   agreements:[],rights:[],rights_events:[],payments:[],payment_requests:[],advances:[],royalty_statements:[],royalty_statement_lines:[],payment_allocations:[]
  };
  const client={auth:{getUser:async()=>({data:{user:window.deskSignedOut?null:{id:author}}}),signOut:async()=>{window.deskSignedOut=true;return {error:null};}},from(table){const filters=[];const resolve=()=>({data:(sessionStorage.getItem('desk-empty')==='true'&&table!=='author_records'?[]:fixtures[table]||[]).filter(row=>filters.every(fn=>fn(row))),error:null});const query={select(){return this;},eq(key,value){filters.push(row=>row[key]===value);return this;},in(key,values){filters.push(row=>values.includes(row[key]));return this;},order(){return this;},maybeSingle:async()=>({data:sessionStorage.getItem('desk-denied')==='true'&&table==='author_records'?null:resolve().data[0]||null,error:null}),then(yes,no){window.deskCalls.push({table});return Promise.resolve(resolve()).then(yes,no);}};return query;},rpc:async(name)=>{window.deskCalls.push({rpc:name});return {data:[],error:null};}};
  window.supabase={createClient:()=>client};
 });
 await page.goto(base+'/pages/authordesk.html');await page.waitForSelector('#desk:not([hidden])');
 assert.equal(await page.locator('#book-count').textContent(),'2');assert.equal(await page.locator('#open-action-count').textContent(),'2');
 assert((await page.locator('#author-attention-summary').textContent()).includes('1 document awaiting signature'));
 assert((await page.locator('#author-attention-list').textContent()).includes('overdue'));
 assert(!(await page.locator('#author-attention-list').textContent()).includes('Retired unsigned draft'));
 assert(!(await page.locator('#desk').textContent()).includes('Private unrelated book'));assert(!(await page.locator('#desk').textContent()).includes('Private other author contract'));assert(!(await page.locator('#desk').textContent()).includes('Hidden editorial note'));
 assert((await page.locator('#author-upcoming-list').textContent()).includes('2099'));assert((await page.locator('#author-recent-list').textContent()).includes('Copy Editing'));
 await page.screenshot({path:out+'/author-desk-overview-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'View all books →',exact:true}).click();assert.equal(await page.locator('.nav-button[aria-current=page]').getAttribute('data-section'),'books');
 await page.locator('#author-book-search').fill('BW-001');assert.equal(await page.locator('#books-book-list .book-card').count(),1);
 await page.locator('#author-book-search').fill('no matches');assert((await page.locator('#books-book-list').textContent()).includes('No books match'));
 await page.locator('#author-book-clear').click();await page.selectOption('#author-book-stage','proofreading');assert.equal(await page.locator('#books-book-list .book-card').count(),1);
 await page.locator('#author-book-clear').click();await page.locator('#books-book-list .book-card').first().getByRole('button',{name:'View production →'}).click();assert.equal(await page.locator('#author-production-book').inputValue(),'1');assert.equal(await page.locator('#production-content .production-book').count(),1);
 await page.selectOption('#author-action-filter','overdue');assert.equal(await page.locator('#production-content .action-card').count(),1);assert((await page.locator('#production-content .action-card').textContent()).includes('Approve the cover'));
 await page.selectOption('#author-production-book','2');await page.selectOption('#author-action-filter','completed');assert.equal(await page.locator('#production-content .action-card').count(),1);
 await page.locator('.nav-button[data-section=overview]').click();await page.getByRole('button',{name:'View document record →',exact:true}).click();assert.equal(await page.locator('#author-documents-book').inputValue(),'1');assert((await page.locator('#documents-rights-content').textContent()).includes('Publishing agreement'));assert(!(await page.locator('#documents-rights-content').textContent()).includes('General author agreement'));
 await page.selectOption('#author-documents-book','general');assert((await page.locator('#documents-rights-content').textContent()).includes('General author agreement'));
 await page.locator('.nav-button[data-section=finance]').click();assert(await page.locator('#statement-list').isVisible());assert.equal(await page.locator('#publishing-desk-nav').isVisible(),false);
 assert.equal(await page.evaluate(()=>window.deskCalls.filter(call=>call.table==='book_contributors').length),1,'one contributor lookup reused');
 assert(await page.evaluate(()=>window.deskCalls.filter(call=>call.rpc).every(call=>call.rpc==='author_desk_monthly_royalties')),'read-only improvements create no transactions or new RPC dependencies');
 await page.locator('.nav-button[data-section=overview]').click();
 for(const width of [1024,768,390,320]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no page overflow at '+width);}
 await page.selectOption('#author-section-select','finance');assert(await page.locator('#section-finance').isVisible(),'mobile section selector works');
 await page.selectOption('#author-section-select','overview');
 await page.screenshot({path:out+'/author-desk-overview-mobile.png',fullPage:true});
 await page.reload();await page.waitForSelector('#desk:not([hidden])');assert.equal(await page.locator('.nav-button[aria-current=page]').getAttribute('data-section'),'overview');
 await page.locator('#sign-out-button').click();await page.waitForSelector('#access-panel:not([hidden])');assert(await page.locator('#desk').isHidden());
 await page.evaluate(()=>sessionStorage.setItem('desk-empty','true'));await page.goto(base+'/pages/authordesk.html?empty=1#publishing');await page.waitForSelector('#desk:not([hidden])');
 assert.equal(await page.locator('#book-count').textContent(),'0');assert.equal(await page.locator('#open-action-count').textContent(),'0');assert((await page.locator('#author-attention-list').textContent()).includes('No outstanding actions'));
 assert.equal(await page.locator('.nav-button[aria-current=page]').getAttribute('data-section'),'overview','staff-only bookmark cannot expose publishing view');
 assert.equal(await page.locator('#author-section-select option[value=publishing]').count(),0,'staff option not exposed to author');
 await page.evaluate(()=>{window.deskSignedOut=false;sessionStorage.setItem('desk-denied','true');});await page.reload();await page.waitForSelector('#access-panel:not([hidden])');assert(await page.locator('#desk').isHidden(),'author without enabled access cannot see desk');
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS Author Desk overview, scoped records, deadlines, document/book/production filters, navigation, finance access, mobile and denied/sign-out flows (mock Supabase)');
})().catch(error=>{console.error(error);process.exit(1)});
