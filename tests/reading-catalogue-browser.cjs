const {chromium}=require('playwright'),assert=require('node:assert/strict');
const BASE=process.env.BASE_URL||'http://127.0.0.1:8000',count=require('../data/book-discovery.json').filter(b=>!b.hideFromReading).length;
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});try{for(const config of [{admin:false},{admin:true},{admin:false,unavailable:true},{admin:false,metadataMissing:true}]){
 const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('https://**/*',r=>{if(r.request().url().includes('esm.sh/'))return r.fulfill({contentType:'application/javascript',body:`export function createClient(){window.mockEditions=${config.metadataMissing?JSON.stringify([{edition_id:2,book_id:'gualachulain',title:'Gualachulain'}]):'[]'};window.accessQueries=[];function rows(table){if(table==='bp_reading_catalog')return window.mockEditions;if(table==='bp_reading_memberships')return [{access_until:'2099-01-01',revoked_at:null}];return [];}return{auth:{getUser:async()=>({data:{user:{id:'reader'}}}),getSession:async()=>({data:{session:{access_token:'test'}}}),onAuthStateChange:()=>{}},from(table){return{select(){return this},eq(){return this},single:async()=>({data:{is_admin:${!!config.admin}}}),maybeSingle:async()=>({data:rows(table)[0]||null}),then(resolve){resolve(${config.unavailable?"table==='bp_reading_catalog'?{error:{message:'Unavailable'}}:":''}{data:rows(table)})}}},rpc:async(name,args)=>{window.accessQueries.push(args?.p_edition_id);return{data:true}}};}`});return r.abort();});
 if(config.metadataMissing)await p.route('**/data/book-discovery.json*',r=>r.fulfill({status:503,body:'unavailable'}));
 await p.goto(BASE+'/pages/bp-reading.html');await p.waitForFunction(()=>!document.getElementById('library').hidden);
 if(config.metadataMissing){assert.equal(await p.locator('.book-card').count(),1);assert.match(await p.locator('#library-catalogue-status').textContent(),/full book list could not load/);}
 else{assert.equal(await p.locator('.book-card').count(),count);
  assert.equal(await p.getByRole('heading',{name:'Blackwood Manuscript Audit Workbook',exact:true}).count(),0);
  assert.equal(await p.locator('.reading-collection-heading').count(),7,'visible collection headings');
  await p.locator('#library-collection').selectOption('The Archive Files');assert.deepEqual(await p.locator('.book-card h4').allTextContents(),['The Third Night','The Black Bothy','The Gåtestein Log','The Drowned Fjord','The Erased Archivist','Holdfast']);await p.locator('#library-collection').selectOption('');
  for(const [title,file] of [['The Black Bothy','book3.jpg'],['The Drowned Fjord','book4.jpg'],['The Erased Archivist','book5.jpg'],['Holdfast','book6.jpg'],['The Money Reset','book17.png'],['Introduction to Accounts','book18.jpg'],['Accounting for UK Landlords','book19.jpg'],['Before the House Closed','book20.png']]){const card=p.locator('.book-card').filter({has:p.getByRole('heading',{name:title,exact:true})});assert.equal(await card.locator('img').getAttribute('src'),'/assets/'+file,'flat reading cover for '+title);}
  assert.equal(await p.locator('.book-card img[src="/assets/book13.jpg"]').count(),0,'limited physical edition is not substituted for the main reading cover');
  await p.locator('#library-collection').selectOption('The Hollowing Veil');assert.equal(await p.locator('.book-card').count(),2);assert.deepEqual(await p.locator('.book-card h4').allTextContents(),['The Orphan and the Hollow Tree','The Salt Widow']);
  await p.locator('#library-collection').selectOption('');await p.locator('#library-search').fill('Introduction to Accounts');assert.equal(await p.locator('.book-card').count(),1);assert.match(await p.locator('.book-card').textContent(),/Martin Hales/);await p.locator('#library-search').fill('Before the House Closed');assert.equal(await p.locator('.book-card').count(),1);assert.match(await p.locator('.book-card').textContent(),/Aidan Blackwood/);await p.locator('#library-search').fill('');
assert.equal(await p.locator('.open-book:not(:disabled)').count(),2);assert.equal(await p.locator('#load-synced').isDisabled(),true);assert.deepEqual(await p.evaluate(()=>window.accessQueries),[],'no placeholder entitlement calls');
  if(config.unavailable){assert.match(await p.locator('#library-catalogue-status').textContent(),/could not be fully checked/);assert.equal(await p.getByRole('button',{name:'Check back later',exact:true}).count(),count-2);}
  else{assert.equal(await p.getByRole('button',{name:'Coming soon',exact:true}).count(),count-2);
   await p.evaluate(()=>{window.mockEditions=[{edition_id:77,book_id:'real-camban-book-id',title:'Camban',author:'Aidan Blackwood',series:'The Cursed Bothies',series_order:3}];window.dispatchEvent(new Event('bp-reading-membership-confirmed'));});
   await p.waitForSelector('.book-card[data-edition-id="77"]');assert.equal(await p.locator('.book-card').count(),count,'promotion replaces the matching placeholder');assert.equal(await p.getByRole('heading',{name:'Camban',exact:true}).count(),1);assert.equal(await p.getByRole('button',{name:'Read Book',exact:true}).count(),3);assert((await p.evaluate(()=>window.accessQueries)).every(id=>id===77));}
 }
 for(const width of [320,768]){await p.setViewportSize({width,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'catalogue layout fits '+width);}
 await p.setViewportSize({width:390,height:844});
 const first=p.locator('.book-card').first();
 if(!config.metadataMissing){const a=await first.boundingBox(),b=await p.locator('.book-card').nth(1).boundingBox();assert(Math.abs(a.y-b.y)<2&&b.x>a.x,'two cards per mobile row');}
 assert((await first.locator('.open-book').boundingBox()).width<=140,'compact button width');
 assert((await first.locator('.open-book').boundingBox()).height>=44,'touch target');
 assert.equal(await first.locator('.book-synopsis').isVisible(),false);
 await p.setViewportSize({width:1280,height:900});
 if(!config.metadataMissing)assert.equal(await first.locator('.book-synopsis').isVisible(),true,'desktop retains synopsis');
 assert.deepEqual(errors,[]);await p.close();
}console.log('PASS pending catalogue: empty server/admin/member states, no invented IDs or access calls, promotion after approval, missing-server/metadata failures and mobile layouts');}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
