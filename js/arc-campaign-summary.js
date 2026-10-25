/* Current campaign presentation comes from assigned files, never the application sheet. */
(function(){
 'use strict';
 function file(assignment){const value=assignment?.arc_files;return (Array.isArray(value)?value[0]:value)||{};}
 function summarize(assignments,now=Date.now()){
  const active=(Array.isArray(assignments)?assignments:[]).filter(a=>a.status==='active'&&file(a).is_active!==false&&(!file(a).downloads_close_at||Date.parse(file(a).downloads_close_at)>now));
  const pending=active.filter(a=>!a.review_link);
  const ordered=pending.slice().sort((a,b)=>(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0)||Number(b.id)-Number(a.id));
  const latest=ordered[0]||null;
  return {active,pending,latest,title:latest?file(latest).title||'Assigned ARC':'',due:latest?.review_due_date||'',reviewed:active.filter(a=>Boolean(a.review_link)).length,opened:active.filter(a=>Number(a.download_count)>0).length};
 }
 window.BlackwoodArcCampaignSummary={file,summarize};
})();
