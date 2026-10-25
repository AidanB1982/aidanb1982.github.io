/** Shopify Dev Dashboard apps use expiring client-credentials Admin tokens. */
export function createAdminTokenProvider(
  env:(name:string)=>string|undefined,
  fetcher:typeof fetch=fetch,
  now:()=>number=Date.now
) {
  let cached:{token:string;until:number;shop:string;id:string;secret:string}|null=null;
  let pending:Promise<string>|null=null;
  return async function getToken(force=false):Promise<string> {
    const shop=env('SHOPIFY_STORE_DOMAIN')||'';
    const id=env('SHOPIFY_CLIENT_ID'),secret=env('SHOPIFY_CLIENT_SECRET');
    if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop))throw Error('Shopify shop is not configured');
    if(!id||!secret) {
      const legacy=env('SHOPIFY_ADMIN_ACCESS_TOKEN');
      if(legacy)return legacy;
      throw Error('Shopify app credentials are not configured');
    }
    if(!force&&cached&&cached.shop===shop&&cached.id===id&&cached.secret===secret&&now()<cached.until)return cached.token;
    if(pending)return pending;
    pending=(async()=>{
      const response=await fetcher(`https://${shop}/admin/oauth/access_token`,{
        method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({grant_type:'client_credentials',client_id:id,client_secret:secret}),
        signal:AbortSignal.timeout(15000)
      });
      if(!response.ok)throw Error('Shopify app authentication failed');
      const result=await response.json();
      if(typeof result.access_token!=='string'||!result.access_token||!Number.isFinite(result.expires_in)||result.expires_in<=0)throw Error('Shopify returned an invalid app token');
      cached={token:result.access_token,until:now()+Math.max(0,result.expires_in*1000-60000),shop,id,secret};
      return cached.token;
    })();
    try{return await pending;}finally{pending=null;}
  };
}
