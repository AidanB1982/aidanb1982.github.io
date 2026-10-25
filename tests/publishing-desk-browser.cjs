const {chromium}=require('playwright');const assert=require('node:assert/strict');
const BASE_URL=process.env.BASE_URL||'http://127.0.0.1:8000';const OUT=process.env.READING_TEST_DIR||'/tmp/blackwood-reading-test';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*',r=>r.abort());
 await page.addInitScript(()=>{
  window.mockPosts=[];window.mockAssignments=[{id:1,member_id:'00000000-0000-0000-0000-000000000002',arc_file_id:1,status:'active',download_count:0,review_due_date:'2026-09-14'},{id:2,member_id:'00000000-0000-0000-0000-000000000001',arc_file_id:2,status:'active',download_count:0}];window.mockCalls=[];window.mockAuthCallbacks=[];
  const people=[{id:'00000000-0000-0000-0000-000000000001',email:'admin@example.invalid',reader_name:'Admin',application_reference_available:true,is_arc_member:true,member_status:'active'},{id:'00000000-0000-0000-0000-000000000002',email:'reader@example.invalid',reader_name:'Reader',application_reference_available:true,is_arc_member:true,member_status:'active'},{id:'00000000-0000-0000-0000-000000000003',email:'unlinked@example.invalid',reader_name:'Unlinked reader',application_reference_available:false,is_arc_member:true,member_status:'active'}];
  const client={auth:{getUser:async()=>({data:{user:{id:people[0].id}}}),getSession:async()=>({data:{session:null}}),onAuthStateChange:fn=>{window.mockAuthCallbacks.push(fn);}},from(table){return {select(){return this},eq(){return this},order(){return this},range:async()=>({data:window.mockPosts}),maybeSingle:async()=>({data:{is_admin:!window.mockDenied}})};},functions:{async invoke(name,{body}){
   window.mockCalls.push(body);
   if(body.action==='overview')return {data:{campaigns:[{id:1,title:'The Crossing',is_active:true},{id:2,title:'Gualachulain',author_name:'Aidan Blackwood',is_active:true}],readers:people,assignments:window.mockAssignments,notices:[],mailConfigured:true,aiConfigured:true}};
   if(body.action==='assign'&&window.mockAssignFailure)return {error:{context:{json:async()=>({error:'This ARC campaign is inactive or closed.'})}}};
   if(body.action==='assign'){let created=0,retained=0,blocked=[];for(const id of body.members){
    const person=people.find(p=>p.id===id);
    if(window.mockAssignments.some(a=>a.member_id===id&&a.arc_file_id===body.fileId))retained++;
    else{window.mockAssignments.push({id:Math.max(...window.mockAssignments.map(a=>a.id))+1,member_id:id,arc_file_id:body.fileId,status:'active',download_count:0,review_due_date:body.due});person.application_reference_available=true;created++;}
   }return {data:{result:[{created_count:created,existing_count:retained,blocked_count:blocked.length,blocked_readers:blocked}]}};}
   if(body.action==='preview')return {data:{batchId:'00000000-0000-0000-0000-000000000010',recipients:people.filter(p=>window.mockAssignments.some(a=>a.member_id===p.id&&a.arc_file_id===body.fileId)).map(p=>({name:p.reader_name,email:p.email,subject:'Gualachulain is ready',text:'Open your protected ARC profile.'}))}};
   if(body.action==='send')return {data:{results:[{state:'submitted'},{state:'submitted'},{state:'submitted'}],remaining:0}};
   if(body.action==='generate')return {data:{draft:'Hook: A quiet place.\nShot list: Trees, a book, a turning page.\nCaption: Discover Gualachulain.'}};
  }},async rpc(name,args){const existing=window.mockPosts.find(p=>p.id===args.p_id);const row={...args.p_payload,id:existing?.id||crypto.randomUUID(),revision:(existing?.revision||0)+1,created_at:new Date().toISOString()};window.mockPosts=window.mockPosts.filter(p=>p.id!==row.id);window.mockPosts.push(row);return {data:row};}};
  window.supabase={createClient:()=>client};window.mockClient=client;
 });
 await page.goto(BASE_URL+'/pages/behind-files-admin.html');
 await page.waitForFunction(()=>!document.getElementById('bfa-admin-content').hidden&&!document.getElementById('ops-controls').disabled);
 assert(await page.getByRole('heading',{name:'Behind the Files',exact:true}).count()>0,'existing editorial desk preserved');
 await page.locator('#ops-select').click();assert((await page.locator('#ops-arc-status').textContent()).includes('Choose an ARC campaign'));
 await page.selectOption('#ops-campaign','2');await page.locator('#ops-select').click();
 assert.equal(await page.locator('#ops-readers input:checked').count(),3,'select team visibly checks every reader');
 assert((await page.locator('#ops-selection-state').textContent()).includes('3 of 3 reader(s) selected for Gualachulain. 2 need book access; 1 already have an assignment record'));
 assert.equal(await page.evaluate(()=>window.mockCalls.filter(c=>c.action==='assign').length),0,'selection itself does not mutate records');
 const above=await page.evaluate(()=>document.getElementById('ops-assign').compareDocumentPosition(document.querySelector('.ops-table-wrap'))&Node.DOCUMENT_POSITION_FOLLOWING);assert(above,'assign action stays above the reader table');
 await page.locator('#ops-due').fill('');await page.locator('#ops-assign').click();
 await page.waitForFunction(()=>document.getElementById('ops-arc-status').textContent.includes('Choose a review due date'));
 await page.evaluate(()=>window.mockAssignFailure=true);await page.locator('#ops-due').fill('2099-10-10');await page.locator('#ops-assign').click();
 await page.waitForFunction(()=>document.getElementById('ops-arc-status').textContent.includes('inactive or closed'));
 assert.equal(await page.evaluate(()=>window.mockAssignments.filter(a=>a.arc_file_id===2).length),1,'failed assignment never pretends records were updated');
 await page.evaluate(()=>window.mockAssignFailure=false);
 assert((await page.locator('#ops-readers').textContent()).includes('Needs book access'),'reader has not silently inherited the new book');
 await page.locator('#ops-due').fill('2099-10-10');await page.locator('#ops-assign').click();
 await page.waitForFunction(()=>document.getElementById('ops-arc-status').textContent.includes('2 new assignment'));
 assert.equal(await page.evaluate(()=>window.mockAssignments.filter(a=>a.arc_file_id===2).length),3,'approved reader without legacy application gets book access');
 assert((await page.locator('#ops-selection-state').textContent()).includes('0 need book access; 3 already have an assignment record'));
 assert.equal(await page.evaluate(()=>window.mockCalls.filter(c=>c.action==='assign').at(-1).applicationRefs),undefined,'grant does not manufacture references');
 assert.equal(await page.evaluate(()=>window.mockAssignments.filter(a=>a.arc_file_id===1).length),1,'old ARC record retained');
 await page.locator('#ops-preview').click();await page.waitForSelector('#ops-email-preview');
 assert((await page.locator('#ops-preview-text').textContent()).includes('Gualachulain'));
 assert.equal(await page.evaluate(()=>window.mockCalls.filter(c=>c.action==='send').length),0,'preview never sends email');
 await page.locator('#ops-send').click();await page.waitForFunction(()=>document.getElementById('ops-status').textContent.includes('3 notice(s) submitted'));
 await page.locator('#ops-ai-title-input').fill('Gualachulain');await page.selectOption('#ops-ai-channel','TikTok');await page.locator('#ops-ai-facts').fill('Aidan Blackwood. The Cursed Bothies, Book 2.');await page.locator('#ops-generate').click();
 await page.waitForFunction(()=>document.getElementById('ops-ai-output').value.includes('Shot list'));
 await page.locator('#ops-use-draft').click();assert.equal(await page.locator('#ops-post-channel').inputValue(),'TikTok');
 await page.locator('#ops-post-time').fill('2099-10-01T10:00');await page.selectOption('#ops-post-status','scheduled');await page.getByRole('button',{name:'Save content',exact:true}).click();
 await page.waitForSelector('.ops-post');assert((await page.locator('.ops-post').textContent()).includes('TikTok'));
 assert.equal(await page.locator('.ops-calendar-day').count(),42,'monthly calendar');
 await page.getByRole('button',{name:'Plan monthly newsletter',exact:true}).click();assert.equal(await page.locator('#ops-post-channel').inputValue(),'Email');assert.equal(await page.locator('#ops-post-cadence').inputValue(),'monthly');
 const dates=await page.evaluate(()=>{const first=window.BlackwoodOperations.helpers.monthAfter('2027-01-31T10:00:00',31),second=window.BlackwoodOperations.helpers.monthAfter(first,31);return [first.getDate(),second.getDate()];});assert.deepEqual(dates,[28,31],'monthly cadence handles short months without losing original day');
 const exported=await page.evaluate(()=>window.BlackwoodOperations.helpers.ics(window.mockPosts));assert(exported.includes('BEGIN:VEVENT'));assert(exported.includes('DTSTART:20991001T100000Z'));assert(exported.includes('manual publishing'));
 // A token refresh must preserve unsaved editorial work; sign-out must clear it.
 await page.locator('#ops-ai-facts').fill('Unsaved factual brief');
 await page.evaluate(()=>window.mockAuthCallbacks.forEach(cb=>cb('TOKEN_REFRESHED')));
 await page.waitForFunction(()=>!document.getElementById('ops-controls').disabled);
 assert.equal(await page.locator('#ops-ai-facts').inputValue(),'Unsaved factual brief');
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth+1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile desk has no page overflow');
 await page.locator('#ops-ai').screenshot({path:OUT+'/publishing-assistant-mobile.png'});
 await page.evaluate(()=>window.mockAuthCallbacks.forEach(cb=>cb('SIGNED_OUT')));
 assert(await page.locator('#bfa-admin-content').isHidden());assert.equal(await page.locator('#ops-readers tr').count(),0);assert.equal(await page.locator('#ops-ai-facts').inputValue(),'');
 await page.evaluate(()=>{window.mockDenied=true;window.mockAuthCallbacks.forEach(cb=>cb('SIGNED_IN'));});
 await page.waitForFunction(()=>document.getElementById('bfa-access-title').textContent==='Access Denied');
 assert(await page.locator('#bfa-admin-content').isHidden(),'non-admin cannot open tools');
 assert.deepEqual(errors,[]);console.log('PASS full admin gate, ARC assignment/preview/send workflow, AI-to-calendar drafting, social scheduling, monthly newsletter, calendar export, mobile layout and session changes (mock services)');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
