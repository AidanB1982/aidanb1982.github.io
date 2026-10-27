export type PaidOrder = {
  id:string; financialStatus:string; currency:string; test:boolean;
  intentId:string|null; variantId:string|null; sellingPlanId:string|null;
  quantity:number; lineCount:number; lineAmount:string; paidAt:string|null;
};
export type ReadingPaymentDependencies = {
  env(name:string):string|undefined;
  loadOrder(id:string):Promise<PaidOrder>;
  allowTestPayment(intentId:string):Promise<boolean>;
  applyPayment(intentId:string,paymentId:string,paidAt:string):Promise<void>;
  revokePayment(paymentId:string):Promise<void>;
  log(message:string,level?:'info'|'error'):void;
};
export function createShopifyWebhook(deps:ReadingPaymentDependencies) {
  return async(request:Request):Promise<Response>=>{
    const json=(status:number,message:string)=>{
      deps.log('BP_READING_WEBHOOK_REPLY_'+status+'_'+message.replace(/[^A-Za-z0-9]+/g,'_').toUpperCase(),status>=400?'error':'info');
      return Response.json({message},{status,headers:{'Cache-Control':'no-store'}});
    };
    if(request.method!=='POST')return json(405,'Method not allowed');
    const secret=deps.env('SHOPIFY_WEBHOOK_SECRET'),shop=deps.env('SHOPIFY_STORE_DOMAIN');
    if(!secret||!shop)return json(503,'Webhook is not configured');
    const receivedShop=(request.headers.get('X-Shopify-Shop-Domain')||'').trim().toLowerCase();
    const expectedShop=shop.trim().toLowerCase();
    const allowedShops=new Set([expectedShop]);
    // The owner confirmed these are two names for the SAME Shopify store.
    // Shopify can identify a renamed shop by its original myshopify hostname.
    const blackwoodAliases=['blackwoodpublishing.myshopify.com','vmbd0z-c6.myshopify.com'];
    if(blackwoodAliases.includes(expectedShop))blackwoodAliases.forEach(alias=>allowedShops.add(alias));
    if(!allowedShops.has(receivedShop)) {
      const safeDomain=(value:string)=>/^[a-z0-9][a-z0-9-]{0,62}\.myshopify\.com$/.test(value)?value:'[invalid domain]';
      deps.log('BP_READING_WEBHOOK_SHOP_MISMATCH expected='+safeDomain(shop.trim().toLowerCase())+' received='+safeDomain(receivedShop));
      return json(401,'Unverified shop');
    }
    const raw=await request.arrayBuffer();
    if(raw.byteLength>1024*1024)return json(413,'Payload too large');
    try {
      const signature=request.headers.get('X-Shopify-Hmac-Sha256')||'';
      const bytes=Uint8Array.from(atob(signature),c=>c.charCodeAt(0));
      const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
      if(bytes.length!==32||!await crypto.subtle.verify('HMAC',key,bytes,raw))return json(401,'Invalid signature');
    } catch{return json(401,'Invalid signature');}
    const topic=request.headers.get('X-Shopify-Topic');
    if(!['orders/paid','refunds/create'].includes(topic||''))return json(200,'Ignored topic');
    let event:Record<string,unknown>;
    try {event=JSON.parse(new TextDecoder().decode(raw));if(!event||typeof event!=='object'||Array.isArray(event))throw Error();}
    catch{return json(400,'Invalid event');}
    const numeric=topic==='refunds/create'?event.order_id:event.id;
    const gid=topic==='orders/paid'&&typeof event.admin_graphql_api_id==='string'?event.admin_graphql_api_id:
      typeof numeric==='number'&&Number.isSafeInteger(numeric)&&numeric>0?`gid://shopify/Order/${numeric}`:'';
    if(!/^gid:\/\/shopify\/Order\/\d+$/.test(gid))return json(400,'Invalid order');
    return verifyAndApplyReadingOrder(gid,topic as 'orders/paid'|'refunds/create',deps);
  };
}


// Shared by signed webhook delivery and authenticated administrator recovery.
// Both paths re-query Shopify and retain every offer, identity and payment check.
export async function verifyAndApplyReadingOrder(gid:string,topic:'orders/paid'|'refunds/create',deps:ReadingPaymentDependencies):Promise<Response> {
  const shop=deps.env('SHOPIFY_STORE_DOMAIN');
  if(!shop)return Response.json({message:'Shopify is not configured'},{status:503});
  const json=(status:number,message:string,extra:Record<string,string>={})=>{
    deps.log('BP_READING_PAYMENT_REPLY_'+status+'_'+message.replace(/[^A-Za-z0-9]+/g,'_').toUpperCase(),status>=400?'error':'info');
    return Response.json({message,...extra},{status,headers:{'Cache-Control':'no-store'}});
  };
  let phase='ORDER_LOOKUP';
  try {
    // Re-query Shopify's Admin API. Never use a browser or webhook header as paid_at.
    const order=await deps.loadOrder(gid);
    phase='ORDER_IDENTITY';
    if(order.id!==gid)throw Error('Order identity mismatch');
    phase='PAYMENT_PROVENANCE';
    if(typeof order.test!=='boolean')throw Error('Payment provenance is missing');
    const paymentId=`${order.test?'shopify-test':'shopify'}:${shop}:${gid}`;
    if(order.financialStatus==='REFUNDED') {await deps.revokePayment(paymentId);return json(200,'Refund recorded');}
    if(topic==='refunds/create'||order.financialStatus==='PARTIALLY_REFUNDED') {deps.log('Partial refund requires membership review.');return json(200,'Refund received for review');}
    if(order.variantId!=='gid://shopify/ProductVariant/60163522265433')return json(200,'Not a reader membership order');
    const plan=deps.env('SHOPIFY_READING_SELLING_PLAN_ID')??'gid://shopify/SellingPlan/697040896345';
    for(const [reason,valid] of [
      ['PAYMENT_STATUS',order.financialStatus==='PAID'],
      ['CURRENCY',order.currency==='GBP'],
      ['QUANTITY',order.quantity===1],
      ['LINE_COUNT',order.lineCount===1],
      ['ANNUAL_AMOUNT',Number(order.lineAmount)===20],
      ['SELLING_PLAN',order.sellingPlanId===plan],
      ['CHECKOUT_REFERENCE',Boolean(order.intentId&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order.intentId))],
      ['PAYMENT_TIMESTAMP',Boolean(order.paidAt&&Number.isFinite(Date.parse(order.paidAt)))]
    ] as const) {if(!valid){phase=reason;throw Error('VERIFICATION_FAILED');}}
    phase='TEST_ACCOUNT_APPROVAL';
    if(order.test&&!await deps.allowTestPayment(order.intentId!)){deps.log('Simulated payment ignored: designated test-account approval is missing.');return json(200,'Test payment not enabled for this account');}
    phase='MEMBERSHIP_SAVE';
    await deps.applyPayment(order.intentId!,paymentId,order.paidAt!);
    return json(200,'Membership payment recorded');
  } catch(error) {
    const code=error instanceof Error&&/^[A-Z0-9_]{1,300}$/.test(error.message)?error.message:'VERIFICATION_FAILED';
    deps.log('BP_READING_WEBHOOK_FAILED phase='+phase+' code='+code);
    return json(503,'Payment verification is pending',{phase,code});
  }
}
