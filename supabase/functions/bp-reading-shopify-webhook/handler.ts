export type PaidOrder = {
  id:string; financialStatus:string; currency:string; test:boolean;
  intentId:string|null; variantId:string|null; sellingPlanId:string|null;
  quantity:number; lineCount:number; lineAmount:string; paidAt:string|null;
};
type Dependencies = {
  env(name:string):string|undefined;
  loadOrder(id:string):Promise<PaidOrder>;
  allowTestPayment(intentId:string):Promise<boolean>;
  applyPayment(intentId:string,paymentId:string,paidAt:string):Promise<void>;
  revokePayment(paymentId:string):Promise<void>;
  log(message:string):void;
};
export function createShopifyWebhook(deps:Dependencies) {
  return async(request:Request):Promise<Response>=>{
    const json=(status:number,message:string)=>Response.json({message},{status,headers:{'Cache-Control':'no-store'}});
    if(request.method!=='POST')return json(405,'Method not allowed');
    const secret=deps.env('SHOPIFY_WEBHOOK_SECRET'),shop=deps.env('SHOPIFY_STORE_DOMAIN');
    if(!secret||!shop)return json(503,'Webhook is not configured');
    if(request.headers.get('X-Shopify-Shop-Domain')?.toLowerCase()!==shop.toLowerCase())return json(401,'Unverified shop');
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
    try {
      // Re-query Shopify's Admin API. Never use a browser or webhook header as paid_at.
      const order=await deps.loadOrder(gid);
      if(order.id!==gid)throw Error('Order identity mismatch');
      if(typeof order.test!=='boolean')throw Error('Payment provenance is missing');
      const paymentId=`${order.test?'shopify-test':'shopify'}:${shop}:${gid}`;
      if(order.financialStatus==='REFUNDED') {await deps.revokePayment(paymentId);return json(200,'Refund recorded');}
      if(topic==='refunds/create'||order.financialStatus==='PARTIALLY_REFUNDED') {deps.log('Partial refund requires membership review.');return json(200,'Refund received for review');}
      if(order.variantId!=='gid://shopify/ProductVariant/60163522265433')return json(200,'Not a reader membership order');
      const plan=deps.env('SHOPIFY_READING_SELLING_PLAN_ID')??'gid://shopify/SellingPlan/697040896345';
      if(order.financialStatus!=='PAID'||order.currency!=='GBP'||order.quantity!==1||order.lineCount!==1||Number(order.lineAmount)!==10.99||order.sellingPlanId!==plan)throw Error('Paid annual offer could not be verified');
      if(!order.intentId||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order.intentId)||!order.paidAt||!Number.isFinite(Date.parse(order.paidAt)))throw Error('Checkout binding or payment time is missing');
      if(order.test&&!await deps.allowTestPayment(order.intentId)){deps.log('Simulated payment ignored: designated test-account approval is missing.');return json(200,'Test payment not enabled for this account');}
      await deps.applyPayment(order.intentId,paymentId,order.paidAt);
      return json(200,'Membership payment recorded');
    } catch {deps.log('Reader payment verification failed; no access was granted.');return json(503,'Payment verification is pending');}
  };
}
