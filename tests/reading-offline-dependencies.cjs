const {readFileSync}=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const {parse}=await import('../js/vendor/es-module-lexer-1.7.0.js');
 const events={},requests=[],cached=[];let reply,pending;
 const root='https://esm.sh/@supabase/supabase-js@2';
 const module='https://esm.sh/@supabase/supabase-js@2.118.0/es2022/supabase-js.mjs';
 const source=readFileSync('bp-reading-sw.js','utf8');
 vm.runInNewContext(source.replace(/^import .*;\n/m,''),{parse,
  URL,AbortSignal,Error,Set,Response,
  self:{location:{origin:'https://reader.test'},addEventListener(name,callback){events[name]=callback;}},
  caches:{open:async()=>({put:async url=>cached.push(url)})},
  async fetch(url){requests.push(url);
   if(url===root)return new Response(`export * from "${module}";`);
   if(url===module)return new Response(`import "/required.mjs";export const optional=()=>import("@supabase/supabase-js/tracing");const warning="Add import '@supabase/supabase-js/tracing' at your application entry point";/* import '@supabase/supabase-js/tracing' */`);
   if(url.endsWith('/required.mjs'))return new Response('export const required=true;');
   if(url.includes('/tracing'))return new Response('not found',{status:404});
   return new Response('public shell');
  }
 });
 events.message({data:{type:'PREPARE_READER'},ports:[{postMessage(value){reply=value;}}],waitUntil(value){pending=value;}});
 await pending;
 assert.equal(reply.ok,true,reply.error);
 assert(requests.includes('https://esm.sh/required.mjs'),'static side-effect import cached');
 assert(cached.includes(module),'static re-export cached');
 assert(!requests.some(url=>url.includes('/tracing')),'optional dynamic tracing import is not preloaded');
 console.log('PASS static module graph: static imports/re-exports cached; optional tracing import never fetched at its invalid URL');
})().catch(error=>{console.error(error);process.exitCode=1});
