/* Cache only the public reader shell. Auth/API/private EPUB responses never enter CacheStorage. */
const CACHE='bp-reader-shell-v1';
const SHELL='/pages/bp-reading.html';
const CORE=[SHELL,'/css/header.css?v=20261115','/css/styles.css?v=20260913','/css/site-polish.css?v=20261120','/css/BP-Reading.css?v=20261127','/js/BP-reading.js?v=20261127','/js/BP-reading-offline.js?v=20261127','/js/BP-reading-catalogue.js?v=20261124','/js/BP-reading-public.js?v=20261122','/js/BP-reading-account.js?v=20261127','/js/BP-reading-checkout.js?v=20261118','/js/header.js?v=20261116','/js/analytics-consent.js?v=20261116','/header-simple.html','/footer.html','/data/book-discovery.json?v=20261124','https://esm.sh/@supabase/supabase-js@2','https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js','https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js'];
const moduleHost=url=>url.origin==='https://esm.sh';
function allowed(url) {
  if(url.origin===self.location.origin)return url.pathname===SHELL||url.pathname==='/header-simple.html'||url.pathname==='/footer.html'||/^\/(js|css|assets)\//.test(url.pathname)||url.pathname==='/data/book-discovery.json';
  return moduleHost(url)||(url.origin==='https://cdn.jsdelivr.net'&&/^\/npm\/(jszip@3\.10\.1|epubjs@0\.3\.93)\//.test(url.pathname));
}
async function prepare() {
  const cache=await caches.open(CACHE),seen=new Set();
  async function save(path) {
    const url=new URL(path,self.location.origin);if(seen.has(url.href))return;
    if(!allowed(url)||seen.size>=100)throw Error('Unexpected reader dependency');seen.add(url.href);
    const response=await fetch(url.href,{cache:'reload',credentials:url.origin===self.location.origin?'same-origin':'omit',mode:'cors',signal:AbortSignal.timeout(15000)});
    if(!response.ok||response.type==='opaque')throw Error('Reader resource unavailable');
    await cache.put(url.href,response.clone());
    if(moduleHost(url)) {
      const code=await response.text();
      for(const match of code.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["']([^"']+)["']/g)) {
        const dependency=new URL(match[1],url);if(!moduleHost(dependency))throw Error('Unexpected module host');await save(dependency.href);
      }
    }
  }
  for(const path of CORE)await save(path);
}
self.addEventListener('install',event=>{self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});
self.addEventListener('message',event=>{if(event.data?.type==='PREPARE_READER')event.waitUntil(prepare().then(()=>event.ports[0]?.postMessage({ok:true})).catch(()=>event.ports[0]?.postMessage({ok:false})));});
self.addEventListener('fetch',event=>{
  const {request}=event,url=new URL(request.url);
  if(request.method!=='GET'||!allowed(url)||(request.mode==='navigate'&&url.pathname!==SHELL))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try {const response=await fetch(request);if(response.ok&&response.type!=='opaque')await cache.put(request,response.clone());return response;}
    catch {const cached=await cache.match(request,{ignoreSearch:true});if(cached)return cached;throw Error('Not available offline');}
  })());
});
