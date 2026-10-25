import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createReadingHandler } from "./handler.ts";

Deno.serve(createReadingHandler({
  env: name => Deno.env.get(name),
  createClient: (url,key,options) => createClient(url,key,options),
  log: (message,error) => console.error(message,error)
}));
