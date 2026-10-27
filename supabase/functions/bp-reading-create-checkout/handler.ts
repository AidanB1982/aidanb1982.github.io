type Dependencies = {
  env(name: string): string | undefined;
  authenticate(token: string): Promise<string | null>;
  isAdmin(userId: string): Promise<boolean>;
  createIntent(userId: string): Promise<string>;
  attachCart(intentId: string, cartId: string): Promise<void>;
  failIntent(intentId: string): Promise<void>;
  fetch: typeof fetch;
  log?(stage: string): void;
};
const VARIANT = 'gid://shopify/ProductVariant/60163522265433';
const origins = new Set(['https://blackwoodpublishing.co.uk','https://www.blackwoodpublishing.co.uk','https://aidanb1982.github.io']);
export function createCheckoutHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const origin=request.headers.get('Origin');
    const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Expose-Headers':'X-BP-Reading-Checkout','X-BP-Reading-Checkout':'controlled-test-v2'};
    if(origin && origins.has(origin)) headers['Access-Control-Allow-Origin']=origin;
    const json=(status:number,value:{error?:string;code?:string;[key:string]:unknown})=>{
      if(status>=400&&status!==405)deps.log?.(`REJECT_${status}_${value.code||'REQUEST'}`);
      return new Response(JSON.stringify(value),{status,headers});
    };
    if(origin && !origins.has(origin))return json(403,{error:'This origin is not allowed.'});
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')return json(405,{error:'Method not allowed.'});
    const shop=deps.env('SHOPIFY_STORE_DOMAIN')||'';
    const token=deps.env('SHOPIFY_STOREFRONT_TOKEN');
    const plan=deps.env('SHOPIFY_READING_SELLING_PLAN_ID') ?? 'gid://shopify/SellingPlan/697040896345';
    if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)||!token||!/^gid:\/\/shopify\/SellingPlan\/\d+$/.test(plan))return json(503,{error:'Annual subscription checkout is not configured.',code:'CONFIG_MISSING'});
    const bearer=/^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization')||'')?.[1];
    if(!bearer)return json(401,{error:'Sign in to BP Reading before subscribing.'});
    let intentId:string|null=null;
    let preview=false;
    let stage='AUTHENTICATION';
    try {
      const user=await deps.authenticate(bearer);
      if(!user)return json(401,{error:'Your session could not be verified.'});
      const raw=await request.text();
      if(new TextEncoder().encode(raw).byteLength>4096)return json(413,{error:'Request too large.'});
      let body;
      try{body=JSON.parse(raw||'{}');}catch{return json(400,{error:'Invalid request.'});}
      if(!body||typeof body!=='object'||Array.isArray(body))return json(400,{error:'Invalid request.'});
      if(body.action && body.action!=='admin_preview')return json(400,{error:'Invalid checkout action.'});
      preview=body.action==='admin_preview';
      if(preview) {
        if(!await deps.isAdmin(user))return json(403,{error:'Administrator access is required to preview checkout.'});
      }else {
        const tester=(deps.env('BP_READING_TEST_USER_ID')||'').trim().toLowerCase();
        if(tester!==user && (deps.env('BP_READING_CHECKOUT_ENABLED')!=='true'||deps.env('BP_READING_CUSTOMER_ACCESS')!=='true'))return json(503,{error:'Membership checkout is not ready yet.',code:tester?'TEST_ACCOUNT_MISMATCH':'TEST_ACCOUNT_NOT_CONFIGURED'});
      }
      stage='CHECKOUT_RECORD';
      intentId=await deps.createIntent(user);
      stage='SHOPIFY_CART_REQUEST';
      const query=`mutation ReadingCart($input:CartInput!){cartCreate(input:$input){cart{id checkoutUrl cost{subtotalAmount{amount currencyCode}} lines(first:2){nodes{quantity merchandise{... on ProductVariant{id}} sellingPlanAllocation{sellingPlan{id}}}}} userErrors{message}}}`;
      const response=await deps.fetch(`https://${shop}/api/2026-10/graphql.json`,{method:'POST',headers:{'Content-Type':'application/json','X-Shopify-Storefront-Access-Token':token},body:JSON.stringify({query,variables:{input:{buyerIdentity:{countryCode:'GB'},attributes:[{key:'bp_reading_intent',value:intentId}],lines:[{merchandiseId:VARIANT,sellingPlanId:plan,quantity:1,attributes:[{key:'_bp_reading_intent',value:intentId}]}]}}}),signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw Error('Shopify unavailable');
      stage='SHOPIFY_CART_VALIDATION';
      const payload=await response.json();
      const result=payload.data?.cartCreate;
      const cart=result?.cart;
      const lines=cart?.lines?.nodes;
      if(payload.errors?.length||result?.userErrors?.length||!cart?.id||!cart.checkoutUrl||lines?.length!==1||lines[0].quantity!==1||lines[0].merchandise?.id!==VARIANT||lines[0].sellingPlanAllocation?.sellingPlan?.id!==plan||cart.cost?.subtotalAmount?.currencyCode!=='GBP'||Number(cart.cost.subtotalAmount.amount)!==20)throw Error('The annual plan could not be confirmed');
      const target=new URL(cart.checkoutUrl);
      if(target.protocol!=='https:')throw Error('Invalid checkout URL');
      stage='CHECKOUT_LINK';
      await deps.attachCart(intentId,cart.id);
      return json(200,{intentId,checkoutUrl:target.href,preview});
    } catch {
      if(intentId)try{await deps.failIntent(intentId);}catch{/* Pending intent grants no access. */}
      return json(503,{error:'Your annual checkout could not be prepared. No membership has been activated.',code:stage,...(preview?{stage}:{})});
    }
  };
}
