export function createOutlookMailer(env:(name:string)=>string,transport:typeof fetch=fetch,now:()=>number=Date.now){
 const sender='aidan@blackwoodpublishing.co.uk';let token='',until=0,refresh:Promise<string>|null=null;
 const configured=()=>Boolean(env('MICROSOFT_TENANT_ID')&&env('MICROSOFT_CLIENT_ID')&&env('MICROSOFT_CLIENT_SECRET'));
 async function ready():Promise<string>{
  if(!configured())throw Error('OUTLOOK_NOT_CONFIGURED');
  if(token&&now()<until)return token;if(refresh)return refresh;
  refresh=(async()=>{
   const tenant=env('MICROSOFT_TENANT_ID');if(!/^[a-f0-9-]{36}$/i.test(tenant))throw Error('OUTLOOK_AUTH');
   const response=await transport(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env('MICROSOFT_CLIENT_ID'),client_secret:env('MICROSOFT_CLIENT_SECRET'),scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'}),signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw Error('OUTLOOK_AUTH');const data=await response.json();if(typeof data.access_token!=='string'||!Number.isFinite(data.expires_in))throw Error('OUTLOOK_AUTH');
   token=data.access_token;until=now()+Math.max(0,data.expires_in-90)*1000;return token;
  })();
  try{return await refresh;}finally{refresh=null;}
 }
 async function send(recipient:{email:string;subject:string;text:string},noticeId:string):Promise<'submitted'|'failed'|'unknown'>{
  const access=await ready();
  const response=await transport(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,{method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json','client-request-id':noticeId},body:JSON.stringify({message:{subject:recipient.subject,body:{contentType:'Text',content:recipient.text},toRecipients:[{emailAddress:{address:recipient.email}}]},saveToSentItems:true}),signal:AbortSignal.timeout(10000)});
  if(response.status===202)return 'submitted';
  if(response.status===401){token='';until=0;}
  // 5xx, timeouts and ambiguous responses may have accepted mail. Never auto-retry.
  return [400,401,403,404,413,422,429].includes(response.status)?'failed':'unknown';
 }
 return {configured,ready,send};
}
