import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";
import {createArcReadingHandler} from './handler.ts';
import {personaliseArc} from './personalise.ts';
Deno.serve(createArcReadingHandler({env:name=>Deno.env.get(name),client:(url,key)=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),personalise:(bytes,reference)=>personaliseArc(JSZip,bytes,reference),log:message=>console.error(message)}));
