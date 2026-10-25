(function(){
 'use strict';
 const $=id=>document.getElementById(id),desk=$('publishing-operations');if(!desk)return;
 let client=null,owner=null,epoch=0,data=null,posts=[],editing=null,preview=null,selected=new Set(),applicationRefs=new Map(),blockedReaders=[],busy=false;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const status=text=>{$('ops-status').textContent=text;};
 const arcStatus=text=>{status(text);$('ops-arc-status').textContent=text;};
 const moveTo=el=>el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
 const local=d=>{const n=new Date(d);return new Date(n.getTime()-n.getTimezoneOffset()*60000).toISOString().slice(0,16);};
 function monthAfter(value,anchor){const d=new Date(value);const day=anchor||d.getDate();d.setDate(1);d.setMonth(d.getMonth()+1);const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last));return d;}
 function ics(records){
  const escape=value=>String(value||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  const stamp=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Blackwood Publishing//Content Desk//EN','CALSCALE:GREGORIAN'];
  for(const p of records.filter(p=>p.status==='scheduled'&&Number.isFinite(Date.parse(p.scheduled_at))))lines.push('BEGIN:VEVENT','UID:'+p.id+'@blackwoodpublishing.co.uk','DTSTAMP:'+stamp(Date.now()),'DTSTART:'+stamp(p.scheduled_at),'DTEND:'+stamp(Date.parse(p.scheduled_at)+900000),'SUMMARY:'+escape(p.title),'DESCRIPTION:'+escape(p.channel+' — manual publishing\n'+p.content),'END:VEVENT');
  lines.push('END:VCALENDAR');
  return lines.map(line=>{let result='',part='',size=0;for(const c of line){const n=new TextEncoder().encode(c).length;if(size+n>73){result+=part+'\r\n ';part='';size=1;}part+=c;size+=n;}return result+part;}).join('\r\n')+'\r\n';
 }
 function invalidatePreview(){preview=null;$('ops-email-preview').hidden=true;$('ops-preview-person').replaceChildren();$('ops-preview-text').textContent='';}
 function lock(){epoch++;$('ops-controls').disabled=true;client=null;owner=null;data=null;posts=[];editing=null;selected.clear();applicationRefs.clear();blockedReaders=[];renderBlocked();invalidatePreview();$('ops-readers').replaceChildren();$('ops-posts').replaceChildren();$('ops-calendar-grid').replaceChildren();$('ops-ai-output').value='';$('ops-ai-form').reset();$('ops-post-form').reset();$('ops-campaign').innerHTML='<option value="">Choose an ARC book</option>';$('ops-send-status').textContent='';$('ops-selection-state').textContent='Choose an ARC campaign to select readers.';$('ops-arc-status').textContent='';status('Sign in as an administrator to use this desk.');}
 async function invoke(body){
  if(!client)throw Error('Administrator sign-in is required.');const version=epoch;
  const {data:result,error}=await client.functions.invoke('bp-publishing-desk',{body});
  if(version!==epoch)throw Error('Your session changed.');
  if(error){let message='The publishing function is not available. Check its deployment and configuration.';try{message=(await error.context.json()).error||message;}catch{}throw Error(message);}
  if(result?.error)throw Error(result.error);return result;
 }
 async function operation(fn,report=status){if(busy)return;busy=true;$('ops-controls').disabled=true;desk.setAttribute('aria-busy','true');try{await fn();}catch(e){if(owner)report(e.message);}finally{busy=false;$('ops-controls').disabled=!owner;desk.removeAttribute('aria-busy');}}
 async function loadOverview(){
  invalidatePreview();data=await invoke({action:'overview'});
  const currentIds=new Set(data.readers.map(r=>r.id));selected=new Set([...selected].filter(id=>currentIds.has(id)));
  for(const id of applicationRefs.keys())if(!currentIds.has(id)||data.readers.some(r=>r.id===id&&(hasApplication(r)||assignment(r))))applicationRefs.delete(id);
  const old=$('ops-campaign').value;
  $('ops-campaign').innerHTML='<option value="">Choose an ARC book</option>'+data.campaigns.map(c=>`<option value="${Number(c.id)}">${esc(c.title)}${c.author_name?' · '+esc(c.author_name):''}</option>`).join('');
  $('ops-campaign').value=old;
  $('ops-mail-state').textContent=data.mailConfigured?'Outlook credentials configured · aidan@blackwoodpublishing.co.uk. A test send is still needed to verify mailbox permissions.':'Outlook is not connected. Assignment and preview tools work once the function is deployed; sending needs Microsoft app credentials and mailbox consent.';
  $('ops-ai-state').textContent=data.aiConfigured?'AI drafting is connected. Review all facts and copy before publishing.':'AI drafting needs OPENAI_API_KEY in Supabase. You can still write and schedule content manually.';
  $('ops-generate').disabled=!data.aiConfigured;renderReaders();
 }
 function campaign(){return data?.campaigns.find(c=>c.id===Number($('ops-campaign').value));}
 function assignment(reader){return data?.assignments.filter(a=>a.member_id===reader.id&&a.arc_file_id===Number($('ops-campaign').value)).sort((a,b)=>b.id-a.id)[0];}
 function hasApplication(reader){return typeof reader.application_reference_available==='boolean'?reader.application_reference_available:Boolean(data?.assignments.some(a=>a.member_id===reader.id));}
 function canAssign(reader){return Boolean(assignment(reader)||hasApplication(reader)||applicationRefs.get(reader.id)?.trim());}
 function renderReaders(){
  const c=campaign();$('ops-campaign-state').textContent=c?`${c.title}: ${c.is_active?'active campaign':'inactive campaign'}. Downloads open ${c.downloads_open_at?new Date(c.downloads_open_at).toLocaleString():'without a scheduled start'}${c.downloads_close_at?', closing '+new Date(c.downloads_close_at).toLocaleString():''}.`:'Choose a campaign to see its assignments.';
  $('ops-readers').innerHTML=!(data&&c)?'<tr><td colspan="4">Choose an ARC campaign.</td></tr>':!data.readers.length?'<tr><td colspan="4">No active ARC team members were returned. Check their ARC membership and active status.</td></tr>':data.readers.map(r=>{
   const a=assignment(r),notice=a&&data.notices.find(n=>n.assignment_id===a.id&&n.kind===$('ops-kind').value);
   const note=notice?({submitted:'Submitted to Outlook',sending:'Sending / check before retrying',unknown:'Unconfirmed — check Sent Items',failed:'Failed — create a fresh preview to retry'}[notice.state]||notice.state):'Not notified';
   const reference=!a&&!hasApplication(r)?`<label class="ops-application-link">Approved ARC application ID<input data-application-reference="${esc(r.id)}" maxlength="200" aria-label="ARC application reference for ${esc(r.reader_name||r.display_name||r.email)}" value="${esc(applicationRefs.get(r.id)||'')}" placeholder="Paste the real Application ID"></label><small>Copy the reference from this reader’s original approved ARC application.</small>`:'';
   return `<tr id="ops-reader-${esc(r.id)}"><td><input type="checkbox" data-reader="${esc(r.id)}" aria-label="Select ${esc(r.reader_name||r.display_name||r.email)}" ${selected.has(r.id)?'checked':''}></td><td>${esc(r.reader_name||r.display_name||'ARC reader')}<small>${esc(r.email)}</small></td><td>${a?esc(a.status)+' · '+Number(a.download_count||0)+' download(s)'+(a.review_link?' · review filed':''):'Needs assignment'}<small>${a?.review_due_date?'Review due '+esc(a.review_due_date):'No due date recorded'}</small>${reference}</td><td>${esc(note)}</td></tr>`;
  }).join('');
  updateSelection();
 }
 function updateSelection(){
  const c=campaign(),readers=data?.readers||[],chosen=readers.filter(r=>selected.has(r.id));
  if(!c){$('ops-selection-state').textContent='Choose an ARC campaign to select readers.';return;}
  const missing=chosen.filter(r=>!assignment(r)).length,ready=chosen.filter(r=>!assignment(r)&&canAssign(r)).length,unlinked=missing-ready;
  $('ops-selection-state').textContent=`${chosen.length} of ${readers.length} reader(s) selected for ${c.title}. ${ready} ready for a new assignment; ${unlinked} need an application reference; ${chosen.length-missing} already have an assignment record. Next: ${missing?'Assign selected readers':'Preview email recipients'}.`;
 }
 function renderBlocked(){
  const host=$('ops-blocked-readers');host.replaceChildren();host.hidden=!blockedReaders.length;
  if(!blockedReaders.length)return;
  const title=document.createElement('h4');title.textContent='Readers needing an application link';const list=document.createElement('ul');
  for(const blocked of blockedReaders){const reader=data?.readers.find(r=>r.id===blocked.member_id),item=document.createElement('li'),link=document.createElement('a');link.href='#ops-reader-'+blocked.member_id;link.textContent=(reader?.reader_name||reader?.display_name||'ARC reader')+(blocked.reason==='application_reference_conflict'?' — reference belongs to another reader or was entered twice':' — application reference needed');item.append(link);list.append(item);}
  host.append(title,list);
 }
 $('ops-readers').addEventListener('input',e=>{const id=e.target.dataset.applicationReference;if(id){const value=e.target.value.trim();value?applicationRefs.set(id,value):applicationRefs.delete(id);invalidatePreview();updateSelection();}});
 $('ops-readers').addEventListener('change',e=>{const id=e.target.dataset.reader;if(id){e.target.checked?selected.add(id):selected.delete(id);invalidatePreview();$('ops-arc-status').textContent='';updateSelection();}});
 $('ops-campaign').onchange=()=>{selected.clear();blockedReaders=[];renderBlocked();invalidatePreview();$('ops-arc-status').textContent='';renderReaders();};$('ops-kind').onchange=()=>{invalidatePreview();$('ops-arc-status').textContent='';renderReaders();};
 $('ops-select').onclick=()=>{if(!campaign()){arcStatus('Choose an ARC campaign first.');return;}for(const r of data?.readers||[])selected.add(r.id);invalidatePreview();renderReaders();arcStatus(selected.size?'Readers selected. Set the review due date, then click Assign selected readers to create their book assignments.':'No active ARC team members are available to select.');};
 $('ops-select-ready').onclick=()=>{if(!campaign()){arcStatus('Choose an ARC campaign first.');return;}selected=new Set((data?.readers||[]).filter(canAssign).map(r=>r.id));invalidatePreview();renderReaders();arcStatus('Readers with an existing record or a linked application selected.');};
 $('ops-clear').onclick=()=>{selected.clear();invalidatePreview();renderReaders();arcStatus('Selection cleared.');};
 $('ops-refresh').onclick=()=>operation(async()=>{await loadOverview();arcStatus('Campaigns and assignments refreshed.');},arcStatus);
 $('ops-assign').onclick=()=>operation(async()=>{
  if(!campaign()||!selected.size)throw Error('Choose a campaign and select readers.');
  const due=$('ops-due');if(!due.value||!due.checkValidity()){due.reportValidity();throw Error('Choose a review due date before assigning this book.');}
  if(selected.size>200)throw Error('Assign up to 200 readers at a time.');
  arcStatus(`Assigning ${campaign().title} to ${selected.size} selected reader(s)…`);
  const result=await invoke({action:'assign',fileId:campaign().id,members:[...selected],due:$('ops-due').value,applicationRefs:Object.fromEntries([...applicationRefs].filter(([id])=>selected.has(id)))});
  const row=Array.isArray(result.result)?result.result[0]:result.result;
  if(!row||!Number.isInteger(row.created_count)||!Number.isInteger(row.existing_count))throw Error('The assignment service returned no result. Refresh assignments before trying again.');
  blockedReaders=Array.isArray(row.blocked_readers)?row.blocked_readers:[];
  const message=`${row.created_count} new assignment(s); ${row.existing_count} existing record(s) retained.`;
  try{await loadOverview();renderBlocked();const blocked=Number.isInteger(row.blocked_count)?row.blocked_count:(data?.readers||[]).filter(r=>selected.has(r.id)&&!assignment(r)).length;arcStatus(message+(blocked?` ${blocked} reader(s) still need a valid application reference; enter the real references below, then assign again.`:' Preview recipients next.'));}catch{renderBlocked();arcStatus(message+' The list could not be refreshed; click Refresh assignments.');}
 },arcStatus);
 $('ops-preview').onclick=()=>operation(async()=>{
  if(!campaign()||!selected.size)throw Error('Choose a campaign and select readers.');
  preview=await invoke({action:'preview',fileId:campaign().id,members:[...selected],kind:$('ops-kind').value});
  $('ops-preview-person').innerHTML=preview.recipients.map((r,i)=>`<option value="${i}">${esc(r.name)} · ${esc(r.email)}</option>`).join('');
  $('ops-email-preview').hidden=false;$('ops-send').disabled=!data.mailConfigured;showPreview();
  $('ops-send-status').textContent=`${preview.recipients.length} eligible recipient(s). Already downloaded, reviewed or previously notified readers are excluded.`;
  arcStatus('Preview ready. Check the recipients and message before sending.');
 },arcStatus);
 function showPreview(){const r=preview?.recipients[Number($('ops-preview-person').value)||0];$('ops-preview-text').textContent=r?'To: '+r.email+'\nSubject: '+r.subject+'\n\n'+r.text:'';}
 $('ops-preview-person').onchange=showPreview;
 $('ops-send').onclick=()=>operation(async()=>{
  if(!preview)throw Error('Create a fresh preview first.');const version=epoch,batchId=preview.batchId;let remaining=1,rounds=0,results=[];
  $('ops-send').disabled=true;
  while(remaining>0&&rounds++<25){const response=await invoke({action:'send',batchId});if(version!==epoch)return;results.push(...response.results);remaining=response.remaining;$('ops-send-status').textContent=`${results.filter(r=>r.state==='submitted').length} submitted to Outlook. ${remaining} recipient(s) left to check.`;}
  const sent=results.filter(r=>r.state==='submitted').length,unknown=results.filter(r=>r.state==='unknown').length,failed=results.filter(r=>r.state==='failed').length;
  await loadOverview();arcStatus(`${sent} notice(s) submitted to Outlook; ${failed} failed; ${unknown} unconfirmed. Submission is not proof of delivery. Check Sent Items for unconfirmed requests before taking further action.`);
 },arcStatus);
 $('ops-ai-form').onsubmit=e=>{e.preventDefault();void operation(async()=>{
  const result=await invoke({action:'generate',title:$('ops-ai-title-input').value.trim(),author:$('ops-ai-author').value.trim(),channel:$('ops-ai-channel').value,facts:$('ops-ai-facts').value.trim(),task:$('ops-ai-task').value.trim()});
  $('ops-ai-output').value=result.draft;status('AI draft ready for your review. Nothing has been published.');
 });};
 $('ops-copy-draft').onclick=()=>operation(async()=>{await navigator.clipboard.writeText($('ops-ai-output').value);status('Draft copied.');});
 $('ops-use-draft').onclick=()=>{if(!$('ops-ai-output').value.trim()){status('Write or generate a draft first.');return;}newPost();$('ops-post-title').value=$('ops-ai-title-input').value+' · '+$('ops-ai-channel').value;$('ops-post-book').value=$('ops-ai-title-input').value;$('ops-post-channel').value=$('ops-ai-channel').value;$('ops-post-content').value=$('ops-ai-output').value;copyCount();moveTo($('ops-calendar'));};
 async function loadPosts(){
  if(!client)return;const version=epoch,result=[];
  for(let start=0;start<10000;start+=500){const response=await client.from('bp_marketing_posts').select('*').order('created_at',{ascending:false}).range(start,start+499);if(version!==epoch)return;if(response.error)throw Error('Content storage is not available. Apply the publishing-desk migration first.');result.push(...response.data);if(response.data.length<500){posts=result;renderCalendar();return;}}
  throw Error('Too many posts to load safely.');
 }
 function newPost(){editing=null;$('ops-post-form').reset();$('ops-post-time').dataset.anchor='';copyCount();}
 function editPost(p){
  editing=p;for(const [field,id] of Object.entries({title:'title',book_title:'book',channel:'channel',content:'content',status:'status',cadence:'cadence',media_url:'media'}))$('ops-post-'+id).value=p[field]||'';
  $('ops-post-time').value=p.scheduled_at?local(p.scheduled_at):'';$('ops-post-time').dataset.anchor=p.cadence_anchor||'';copyCount();moveTo($('ops-post-form'));
 }
 function payload(){
  const time=$('ops-post-time').value;let scheduled_at=null;
  if(time){const date=new Date(time);if(!Number.isFinite(date.getTime())||local(date)!==time)throw Error('Choose a valid local date and time.');scheduled_at=date.toISOString();}
  const media_url=$('ops-post-media').value.trim();if(media_url&&new URL(media_url).protocol!=='https:')throw Error('Use an HTTPS media URL.');
  const p={title:$('ops-post-title').value.trim(),book_title:$('ops-post-book').value.trim(),channel:$('ops-post-channel').value,content:$('ops-post-content').value.trim(),status:$('ops-post-status').value,scheduled_at,cadence:$('ops-post-cadence').value,media_url,cadence_anchor:Number($('ops-post-time').dataset.anchor)||(scheduled_at?new Date(scheduled_at).getDate():1)};
  if(p.cadence==='monthly'&&p.channel!=='Email')throw Error('Monthly mailing-list cadence is for Email.');
  if(p.status==='scheduled'&&(!scheduled_at||Date.parse(scheduled_at)<=Date.now()))throw Error('Choose a future publishing slot.');
  return p;
 }
 $('ops-post-form').onsubmit=e=>{e.preventDefault();void operation(async()=>{
  if(!client)throw Error('Administrator sign-in required.');const value=payload(),version=epoch;
  const response=await client.rpc('bp_marketing_save_post',{p_id:editing?.id||null,p_revision:editing?.revision||0,p_payload:value});
  if(version!==epoch)return;if(response.error)throw Error(response.error.code==='40001'?'This post changed in another session. Reload content before editing.':response.error.code==='23505'?'A monthly mailing-list item already exists for this month. Edit the existing item.':'Content could not be saved. Check required fields, storage and permissions.');
  if(value.scheduled_at)$('ops-month').value=local(value.scheduled_at).slice(0,7);newPost();await loadPosts();status('Content saved. Scheduled items are publishing reminders until the channel is connected.');
 });};
 $('ops-new-post').onclick=newPost;
 $('ops-post-time').oninput=()=>{$('ops-post-time').dataset.anchor='';};
 function copyCount(){const n=$('ops-post-content').value.length;const channel=$('ops-post-channel').value;$('ops-copy-count').textContent=n+' characters'+(['Instagram','TikTok'].includes(channel)&&n>2200?' — shorten the final caption before publishing; this field may also contain script or shot notes.':'');}
 $('ops-post-content').oninput=copyCount;$('ops-post-channel').onchange=copyCount;
 $('ops-monthly').onclick=()=>{newPost();$('ops-post-title').value='Blackwood monthly reading letter';$('ops-post-channel').value='Email';$('ops-post-cadence').value='monthly';const date=new Date();date.setDate(1);date.setMonth(date.getMonth()+1);date.setHours(10,0,0,0);$('ops-post-time').value=local(date);$('ops-post-content').value='Subject: [confirm subject]\n\nThis month at Blackwood\n\n[Approved book news]\n\n[An author or behind-the-scenes note]\n\n[Confirmed reading links]\n\nUse the mailing platform’s subscriber list and unsubscribe footer.';copyCount();status('Monthly mailing-list draft prepared. Review the copy, choose a date and save.');};
 function filtered(){const channel=$('ops-channel-filter').value;return posts.filter(p=>channel==='all'||p.channel===channel);}
 function renderCalendar(){
  const month=$('ops-month').value;if(!/^\d{4}-\d{2}$/.test(month))return;
  const [year,number]=month.split('-').map(Number),first=new Date(year,number-1,1),start=new Date(first);start.setDate(1-((first.getDay()+6)%7));
  const visible=filtered(),due=visible.filter(p=>p.status==='scheduled'&&Date.parse(p.scheduled_at)<=Date.now()).length;
  $('ops-calendar-summary').textContent=`${visible.length} saved item(s) · ${due} due for manual publishing. Monthly email slots remain drafts until you schedule them.`;
  const grid=$('ops-calendar-grid');grid.replaceChildren();
  for(let day=0;day<42;day++){
   const date=new Date(start);date.setDate(start.getDate()+day);const key=local(date).slice(0,10),box=document.createElement('div');box.className='ops-calendar-day'+(date.getMonth()!==number-1?' outside':'')+(key===local(Date.now()).slice(0,10)?' today':'');box.textContent=date.toLocaleDateString('en-GB',{weekday:'short',day:'numeric'});
   for(const p of visible.filter(p=>p.scheduled_at&&local(p.scheduled_at).slice(0,10)===key)){const b=document.createElement('button');b.type='button';b.textContent=p.channel+' · '+p.title;b.onclick=()=>editPost(p);box.append(b);}grid.append(box);
  }
  const list=$('ops-posts');list.replaceChildren();
  for(const p of visible.filter(p=>!p.scheduled_at||local(p.scheduled_at).slice(0,7)===month).sort((a,b)=>(Date.parse(a.scheduled_at)||0)-(Date.parse(b.scheduled_at)||0))){
   const card=document.createElement('article');card.className='ops-post'+(p.status==='scheduled'&&Date.parse(p.scheduled_at)<=Date.now()?' due':'');
   const title=document.createElement('h4');title.textContent=p.title;
   const meta=document.createElement('p');meta.textContent=[p.channel,p.status==='published'?'Published manually':p.status,p.scheduled_at?new Date(p.scheduled_at).toLocaleString():'No date',p.cadence==='monthly'?'Monthly mailing list':''].filter(Boolean).join(' · ');
   const text=document.createElement('pre');text.textContent=p.content;
   const buttons=document.createElement('div');buttons.className='ops-actions';
   const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.className='bfa-button';b.textContent=label;b.onclick=fn;buttons.append(b);};
   button('Edit item',()=>editPost(p));button('Copy content',()=>operation(async()=>{await navigator.clipboard.writeText(p.content);status('Content copied for manual publication.');}));
   if(p.status!=='published')button('Mark published manually',()=>{editPost(p);$('ops-post-status').value='published';status('Check this item, then save to record that you published it.');});
   if(p.channel==='Email'&&p.cadence==='monthly'&&p.scheduled_at)button('Prepare next month',()=>{
    const date=monthAfter(p.scheduled_at,p.cadence_anchor);
    if(posts.some(post=>post.channel==='Email'&&post.cadence==='monthly'&&post.scheduled_at&&local(post.scheduled_at).slice(0,7)===local(date).slice(0,7))){status('A monthly mailing-list item already exists for that month. Edit the existing item.');return;}
    editPost({...p,id:null,revision:0,status:'draft',scheduled_at:date.toISOString()});editing=null;status('Next month prepared as an unsaved draft. Review and save it.');
   });card.append(title,meta,text,buttons);list.append(card);
  }
 }
 $('ops-month').onchange=renderCalendar;$('ops-channel-filter').onchange=renderCalendar;
 $('ops-reload-posts').onclick=()=>operation(async()=>{await loadPosts();status('Content reloaded.');});
 $('ops-export').onclick=()=>{const blob=new Blob([ics(filtered())],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='blackwood-content-calendar.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 window.BlackwoodOperations={lock,suspend(){epoch++;client=null;$('ops-controls').disabled=true;},helpers:{ics,monthAfter},async activate(id,supabase){
  if(owner===id){client=supabase;$('ops-controls').disabled=false;return;}lock();owner=id;client=supabase;
  $('ops-month').value=local(Date.now()).slice(0,7);$('ops-timezone').textContent='Planning timezone: '+Intl.DateTimeFormat().resolvedOptions().timeZone+'. Calendar exports use the equivalent UTC time.';
  const due=new Date();due.setDate(due.getDate()+14);$('ops-due').value=local(due).slice(0,10);
  const errors=[];for(const fn of [loadOverview,loadPosts])try{await fn();}catch(e){errors.push(e.message);}
  if(owner)$('ops-controls').disabled=false;
  if(owner)status(errors.length?errors.join(' '):'Desk ready. Select a campaign, draft copy or plan a publishing slot.');
 }};
})();
