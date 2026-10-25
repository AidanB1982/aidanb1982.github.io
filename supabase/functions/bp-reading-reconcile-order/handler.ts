type ReconcileDependencies={
  isAdmin(token:string):Promise<boolean>;
  resolveOrderName(name:string):Promise<string|null>;
  reconcile(orderId:string):Promise<Response>;
};
const reconcileOrigins=new Set(['https://blackwoodpublishing.co.uk','https://www.blackwoodpublishing.co.uk','https://aidanb1982.github.io']);
export function createOrderReconciliation(deps:ReconcileDependencies) {
  return async(request:Request):Promise<Response>=>{
    const origin=request.headers.get('Origin');
    const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
    if(origin&&reconcileOrigins.has(origin))headers['Access-Control-Allow-Origin']=origin;
    const json=(status:number,error:string)=>Response.json({error},{status,headers});
    if(origin&&!reconcileOrigins.has(origin))return json(403,'Origin not allowed');
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')return json(405,'Method not allowed');
    const token=/^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization')||'')?.[1];
    if(!token)return json(401,'Administrator sign-in required');
    try {
      if(!await deps.isAdmin(token))return json(403,'Administrator access required');
      const raw=await request.text();
      if(new TextEncoder().encode(raw).byteLength>4096)return json(413,'Request too large');
      let body;
      try{body=JSON.parse(raw);}catch{return json(400,'Invalid JSON');}
      let gid:string|null=null;
      if(typeof body?.orderName==='string') {
        const name=body.orderName.trim();
        if(!/^#[0-9]{1,20}$/.test(name))return json(400,'Enter a Shopify order number such as #1017');
        gid=await deps.resolveOrderName(name);
        if(!gid)return json(404,'No unique matching order was found in the configured Shopify store');
      }else {
        const value=body?.orderId;
        const id=typeof value==='number'&&Number.isSafeInteger(value)&&value>0?String(value):typeof value==='string'?value.trim():'';
        const numeric=/^[1-9]\d{0,24}$/.test(id)?id:/^gid:\/\/shopify\/Order\/[1-9]\d{0,24}$/.test(id)?id.split('/').pop():null;
        if(!numeric)return json(400,'Enter the Shopify admin order ID or order number');
        gid='gid://shopify/Order/'+numeric;
      }
      if(!/^gid:\/\/shopify\/Order\/[1-9]\d{0,24}$/.test(gid))return json(503,'Shopify returned an invalid order identity');
      // No user ID, amount, payment status or access date is accepted from the browser.
      const result=await deps.reconcile(gid);
      return new Response(await result.text(),{status:result.status,headers});
    }catch{return json(503,'Order recovery could not be completed. Inspect the function logs; do not place another order.');}
  };
}
