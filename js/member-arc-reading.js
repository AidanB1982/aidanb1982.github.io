/* Only server-returned pilot assignments appear; no global BP Reading navigation change. */
window.initBlackwoodArcReading=async function({root,client}){
 if(!root||!client)return;root.hidden=true;
 try{
  const result=await client.rpc('bp_arc_reading_catalogue');
  if(!root.isConnected||result.error||!Array.isArray(result.data)||!result.data.length)return;
  const heading=document.createElement('h2');heading.textContent='Your ARC reading room';
  const intro=document.createElement('p');intro.textContent='Read your assigned advance copies privately inside BP Reading.';
  const link=document.createElement('a');link.className='circle-reader-record-button';link.href='/pages/bp-reading.html?arc=1';link.textContent='Open your ARC reading room';
  const list=document.createElement('ul');for(const row of result.data){const item=document.createElement('li');item.textContent=row.title+(row.can_read?' · Ready to read':' · Reading closed; record retained')+(row.review_due_date?' · Review due '+row.review_due_date:'');list.append(item);}
  root.replaceChildren(heading,intro,list,link);root.hidden=false;
 }catch{/* The pilot is absent until deployed; the existing member area remains usable. */}
};
