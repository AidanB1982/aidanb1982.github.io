type Dependencies={
  env(name:string):string|undefined;
  isAdmin(token:string):Promise<boolean>;
  checkDatabase():Promise<boolean>;
  fetch:typeof fetch;
};
type Check={name:string;ok:boolean;detail:string};
const origins=new Set(['https://blackwoodpublishing.co.uk','https://www.blackwoodpublishing.co.uk','https://aidanb1982.github.io']);
export function createSetupCheck(deps:Dependencies) {
 return async(request:Request):Promise<Response>=>{
  const origin=request.headers.get('Origin');
  const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
  if(origin&&origins.has(origin))headers['Access-Control-Allow-Origin']=origin;
  const json=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers});
  if(origin&&!origins.has(origin))return json(403,{error:'Origin not allowed'});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return json(405,{error:'Method not allowed'});
  const bearer=/^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization')||'')?.[1];
  if(!bearer)return json(401,{error:'Administrator sign-in required'});
  try {if(!await deps.isAdmin(bearer))return json(403,{error:'Administrator access required'});}catch{return json(503,{error:'Administrator verification unavailable'});}
  const checks:Check[]=[];
  const add=(name:string,ok:boolean,detail:string)=>checks.push({name,ok,detail});
  try {add('Database',await deps.checkDatabase(),'Required reader tables are checked without reading customer records.');}
  catch {add('Database',false,'Reader tables could not be verified.');}
  const shop=deps.env('SHOPIFY_STORE_DOMAIN')||'';
  if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop))return json(200,{checks:[...checks,{name:'Shop domain',ok:false,detail:'SHOPIFY_STORE_DOMAIN is missing or invalid.'}]});
  const clientId=deps.env('SHOPIFY_CLIENT_ID'),clientSecret=deps.env('SHOPIFY_CLIENT_SECRET');
  let adminToken=deps.env('SHOPIFY_ADMIN_ACCESS_TOKEN');
  if(clientId&&clientSecret) {
   try {
    const r=await deps.fetch(`https://${shop}/admin/oauth/access_token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:clientId,client_secret:clientSecret}),signal:AbortSignal.timeout(15000)});
    const payload=r.ok?await r.json():null;
    adminToken=typeof payload?.access_token==='string'?payload.access_token:undefined;
    add('Shopify app authentication',Boolean(adminToken),adminToken?'The installed app authenticated successfully.':'The installed app could not authenticate. Check credentials, installation and own-store eligibility.');
   }catch{adminToken=undefined;add('Shopify app authentication',false,'Shopify authentication could not be reached.');}
  }else add('Shopify app authentication',Boolean(adminToken),'Client credentials or a supported legacy Admin token are required.');
  if(adminToken) {
   try {
    const query='query ReaderSetup { currentAppInstallation { accessScopes { handle } } plan: __type(name:"LineItemSellingPlan") { fields { name } } transaction: __type(name:"OrderTransaction") { fields { name } } }';
    const r=await deps.fetch(`https://${shop}/admin/api/2026-10/graphql.json`,{method:'POST',headers:{'Content-Type':'application/json','X-Shopify-Access-Token':adminToken},body:JSON.stringify({query}),signal:AbortSignal.timeout(15000)});
    const p=r.ok?await r.json():null;
    const scopes=p?.data?.currentAppInstallation?.accessScopes?.map((s:{handle:string})=>s.handle)||[];
    const missing=['read_orders','read_products'].filter(scope=>!scopes.includes(scope));
    add('Admin API permissions',Boolean(p?.data)&&!p.errors?.length&&!missing.length,missing.length?'Missing scopes: '+missing.join(', '):'Required scopes verified.');
    const planFields=p?.data?.plan?.fields?.map((f:{name:string})=>f.name)||[];
    const transactionFields=p?.data?.transaction?.fields?.map((f:{name:string})=>f.name)||[];
    add('Payment verification fields',planFields.includes('sellingPlanId')&&transactionFields.includes('processedAt'),'Checking annual-plan identity and trusted transaction timestamps in the live schema.');
   }catch {add('Admin API permissions',false,'Admin API could not be verified.');}
  }
  const storefrontToken=deps.env('SHOPIFY_STOREFRONT_TOKEN');
  if(!storefrontToken)add('Storefront subscription access',false,'SHOPIFY_STOREFRONT_TOKEN has not been saved.');
  else {
   try {
    const query='query ReaderProduct { productByHandle(handle:"bp-reading-annual-membership") { id variants(first:10) { nodes { id } } sellingPlanGroups(first:10) { nodes { sellingPlans(first:10) { nodes { id } } } } } }';
    const r=await deps.fetch(`https://${shop}/api/2026-10/graphql.json`,{method:'POST',headers:{'Content-Type':'application/json','X-Shopify-Storefront-Access-Token':storefrontToken},body:JSON.stringify({query}),signal:AbortSignal.timeout(15000)});
    const p=r.ok?await r.json():null,product=p?.data?.productByHandle;
    const variant=product?.variants?.nodes?.some((v:{id:string})=>v.id==='gid://shopify/ProductVariant/60163522265433');
    const expectedPlan=deps.env('SHOPIFY_READING_SELLING_PLAN_ID')??'gid://shopify/SellingPlan/697040896345';
    const plan=product?.sellingPlanGroups?.nodes?.some((g:{sellingPlans:{nodes:{id:string}[]}})=>g.sellingPlans.nodes.some(s=>s.id===expectedPlan));
    add('Storefront subscription access',Boolean(product&&variant&&plan&&!p.errors?.length),product&&variant&&plan?'The membership variant and annual selling plan are visible to this token.':'The token could not read the membership variant and annual plan. Check its scopes and product publication.');
   }catch{add('Storefront subscription access',false,'Storefront permissions or connectivity could not be verified.');}
  }
  add('Webhook signing configuration',Boolean(deps.env('SHOPIFY_WEBHOOK_SECRET')),'Only secret presence is checked; a signed Shopify event is still needed to verify delivery.');
  // No cart creation, orders, charges, refunds, database writes or customer payloads.
  return json(200,{checks,billingTested:false,note:'Read-only setup check. A real initial-payment and renewal test is still required before launch.'});
 };
}
