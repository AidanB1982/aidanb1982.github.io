import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createShopifyWebhook} from './handler.ts';
import {createReadingPaymentService} from './shopify-service.ts';
Deno.serve(createShopifyWebhook(createReadingPaymentService(name=>Deno.env.get(name))));
