/* Read-only projections of existing caller-scoped reader records. No access writes. */
(() => {
  'use strict';let generation=0;
  const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(cls)node.className=cls;return node;};
  const date=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/London'}):null;};
  const link=(text,href)=>{const a=el('a',text,'rs-button');a.href=href;return a;};
  window.initBlackwoodReadingCentre=async ({root,client,userId,isAdmin=false})=>{
    const version=++generation;if(!root||!userId)return;root.replaceChildren(el('h2','Reading account'),el('p','Checking your reading records…'));root.setAttribute('aria-busy','true');
    const current=()=>version===generation&&root.isConnected;
    try{
      // Validate against Auth, not a user ID or admin flag supplied by page markup.
      const verified=await client.auth.getUser();if(!current())return;if(verified.error||verified.data?.user?.id!==userId)throw Error();
      const results=await Promise.allSettled([
        client.from('bp_reading_memberships').select('access_until,revoked_at').eq('user_id',userId).maybeSingle(),
        client.from('bp_reading_purchases').select('book_id,purchased_at,revoked_at').eq('user_id',userId),
        client.from('bp_reading_catalog').select('edition_id,book_id,title').eq('available',true),
        client.from('bp_reading_state').select('edition_id,payload,updated_at').eq('user_id',userId).order('updated_at',{ascending:false})
      ]);
      if(!current())return;
      const read=index=>results[index].status==='fulfilled'&&!results[index].value.error?{ok:true,data:results[index].value.data}:{ok:false,data:null};
      const membership=read(0),purchases=read(1),catalogue=read(2),states=read(3);root.replaceChildren(el('h2','Your reading account'));
      const cards=el('div',null,'rs-account-grid'),account=el('section',null,'rs-panel');account.append(el('h3','Membership & access'));
      const m=membership.data,until=m&&date(m.access_until),active=membership.ok&&!m?.revoked_at&&Number.isFinite(Date.parse(m?.access_until))&&Date.parse(m.access_until)>Date.now();
      account.append(el('p',isAdmin?'Administrator reading access is granted through your existing account permissions.':!membership.ok?'Membership status could not be checked. Please refresh or contact us before starting another subscription.':m?.revoked_at?'This membership has been revoked. Contact us if this is unexpected.':active?'Your membership gives reading access through '+until+'.':until?'Your recorded membership access ended on '+until+'.':'No paid reading membership is recorded for this account.'));
      account.append(el('p','Your reading access date does not confirm whether automatic renewal is enabled. Manage renewal in Shopify using the email address used at checkout.'));
      account.append(link('Open Shopify account','https://blackwoodpublishing.myshopify.com/account'),link('Membership help','mailto:aidan@blackwoodpublishing.co.uk?subject=BP%20Reading%20membership%20help'));
      account.append(el('p','Cancelling renewal and requesting a refund are separate actions. Cancellation stops future renewals; access continues to the end of the paid period. Refund requests must be made within 7 days of purchase, subject to statutory rights.','rs-note'));
      const owned=el('section',null,'rs-panel');owned.append(el('h3','Permanent reading purchases'));const valid=Array.isArray(purchases.data)?purchases.data.filter(p=>!p.revoked_at):[];
      if(!purchases.ok)owned.append(el('p','Your purchase records could not be loaded. This does not mean your purchases are lost.'));
      else if(!valid.length)owned.append(el('p','No permanent in-reader purchases are recorded. Physical book orders and ARC assignments are separate.'));
      else{const list=el('ul');for(const purchase of valid){const book=(catalogue.data||[]).find(b=>b.book_id===purchase.book_id);list.append(el('li',(book?.title||'Purchased title')+' · permanent in-reader access'+(date(purchase.purchased_at)?' · purchased '+date(purchase.purchased_at):'')));}owned.append(list);}cards.append(account,owned);root.append(cards);
      const recent=el('section',null,'rs-panel');recent.append(el('h3','Continue where you left off'));
      const rows=Array.isArray(states.data)?states.data:[];const candidates=rows.filter(r=>r.payload?.hasStarted&&Number(r.payload.progress)<100).filter(r=>{const book=(catalogue.data||[]).find(b=>b.edition_id===r.edition_id);return book&&(isAdmin||active||valid.some(p=>p.book_id===book.book_id));});
      if(!states.ok||!catalogue.ok)recent.append(el('p','Your saved reading places could not be checked. You can still open the reading room to retry.'));
      else if(!candidates.length)recent.append(el('p','No unfinished book with current reading access is recorded yet.'));
      else{const row=candidates[0],book=catalogue.data.find(b=>b.edition_id===row.edition_id);const progress=Number.isFinite(Number(row.payload.progress))?Math.max(0,Math.min(100,Math.round(Number(row.payload.progress)))):0;recent.append(el('p',book.title+' · '+progress+'% complete'));const bar=el('progress');bar.max=100;bar.value=progress;bar.setAttribute('aria-label',book.title+' reading progress');recent.append(bar);}
      recent.append(link('Open your reading library','/pages/bp-reading.html'));root.append(recent);
      const support=el('p',null,'rs-note');support.append('Account access and payment support: ',link('Contact Blackwood','/pages/contact.html'), ' · ',link('Discover books & device wishlist','/pages/discover.html'), ' · ',link('Email preferences','/pages/newsletter.html'));root.append(support);
    }catch{if(current())root.replaceChildren(el('h2','Reading account unavailable'),el('p','Your reading records could not be verified. Refresh or contact Blackwood for help. Existing account and ARC features remain available.'));}
    finally{if(current())root.setAttribute('aria-busy','false');}
  };
})();
