/* Read-only projections of the Author Desk's existing, author-visible records. */
(function(root){
 'use strict';
 const terminal=new Set(['completed','complete','done','cancelled','canceled','closed','resolved','waived']);
 function dayKey(value){
  if(!value)return null;
  const raw=String(value),date=new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw)?raw+'T12:00:00Z':raw);
  if(!Number.isFinite(date.getTime()))return null;
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  return ['year','month','day'].map(type=>parts.find(p=>p.type===type).value).join('-');
 }
 function isOpen(action){return !action.completed_at&&!terminal.has(String(action.status||'').trim().toLowerCase());}
 function deadline(value,now=new Date()){
  const key=dayKey(value),today=dayKey(now);if(!key||!today)return {kind:'undated',label:'No deadline recorded',days:null};
  const days=Math.round((Date.parse(key+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000);
  return {days,kind:days<0?'overdue':days===0?'today':'upcoming',label:days<0?`${-days} day${days===-1?'':'s'} overdue`:days===0?'Due today':days===1?'Due tomorrow':`Due in ${days} days`};
 }
 function build(books,production,legal,now=new Date()){
  const ids=new Set(books.map(b=>b.id)),today=dayKey(now);
  const actions=(production.actions||[]).filter(a=>ids.has(a.book_id)&&isOpen(a)).slice().sort((a,b)=>(dayKey(a.due_at)||'9999').localeCompare(dayKey(b.due_at)||'9999')||String(a.title||'').localeCompare(String(b.title||'')));
  const docs=(legal.documents||[]).filter(d=>d.book_id==null||ids.has(d.book_id));
  const replaced=new Set(docs.map(d=>d.supersedes_document_id).filter(id=>id!=null));
  const signatures=docs.filter(d=>d.requires_signature===true&&!d.signed_at&&!replaced.has(d.id));
  const upcoming=(production.editions||[]).filter(e=>ids.has(e.book_id)&&dayKey(e.publication_date)&&dayKey(e.publication_date)>=today&&!['cancelled','canceled','withdrawn'].includes(String(e.status||'').toLowerCase())).slice().sort((a,b)=>dayKey(a.publication_date).localeCompare(dayKey(b.publication_date)));
  const recent=(production.events||[]).filter(e=>ids.has(e.book_id)&&dayKey(e.event_date||e.created_at)&&dayKey(e.event_date||e.created_at)<=today).slice().sort((a,b)=>String(b.event_date||b.created_at).localeCompare(String(a.event_date||a.created_at)));
  return {actions,signatures,upcoming,recent,overdue:actions.filter(a=>deadline(a.due_at,now).kind==='overdue').length};
 }
 root.BlackwoodAuthorInsights={dayKey,isOpen,deadline,build};
})(typeof window==='undefined'?globalThis:window);
