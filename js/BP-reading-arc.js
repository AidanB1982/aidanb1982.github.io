export const ARC_TERMS_VERSION='ARC Copyright Terms v1';
export const isArcBook=book=>Number.isSafeInteger(book?.arcAssignmentId)&&book.arcAssignmentId>0;
export function arcReadingBooks(rows){
 return (Array.isArray(rows)?rows:[]).filter(row=>Number.isSafeInteger(row.assignment_id)&&row.assignment_id>0&&Number.isSafeInteger(row.edition_id)&&row.edition_id>0).map(row=>({id:'arc:'+row.assignment_id,arcAssignmentId:row.assignment_id,editionId:row.edition_id,bookId:row.book_id,title:row.title,author:row.author||'',cover:row.cover_url||'/assets/book7.png',series:row.series||'',seriesOrder:row.series_order,collection:'Your ARC assignments',readingReady:row.can_read===true,canRead:row.can_read===true,reviewLink:row.review_link||'',arcTermsAccepted:row.terms_accepted===true,reviewDue:row.review_due_date||null,owned:false}));
}
export function arcStorageKey(userId,book){return `bp-reading:${userId}:arc-assignment:${book.arcAssignmentId}:v1`;}
export async function requestArc(client,serviceUrl,apiKey,book,{check=false,acceptedTerms=false}={}){
 if(!isArcBook(book)||!navigator.onLine)throw Error('ARC reading requires an internet connection.');
 const {data,error}=await client.auth.getSession();if(error||!data?.session?.access_token)throw Error('Sign in again to read your ARC.');
 const response=await fetch(serviceUrl+'/functions/v1/bp-reading-arc',{method:'POST',headers:{Authorization:'Bearer '+data.session.access_token,apikey:apiKey,'Content-Type':'application/json'},body:JSON.stringify({action:check?'check':'open',assignmentId:book.arcAssignmentId,acceptedTerms,termsVersion:ARC_TERMS_VERSION}),cache:'no-store',signal:AbortSignal.timeout(45000)});
 if(!response.ok){let message='ARC access could not be verified.';try{const result=await response.json();if(typeof result.error==='string')message=result.error;}catch{}throw Error(message);}
 if(check)return;
 if(!response.headers.get('Content-Type')?.includes('application/epub+zip'))throw Error('The ARC service did not return a reading edition.');
 const reference=response.headers.get('X-BP-ARC-Reference')||'';if(!/^[A-Za-z0-9_-]{1,100}$/.test(reference))throw Error('The personal ARC reference could not be verified.');
 return {bytes:await response.arrayBuffer(),reference};
}
