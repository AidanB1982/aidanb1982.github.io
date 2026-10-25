/* Popup closure and checkout return URLs never grant access. Only a server-paid intent does. */
async function checkoutFailureMessage(error) {
  const fallback='Subscription checkout could not be prepared. No payment has been requested. Please try again or contact Blackwood Publishing.';
  let payload;
  try {
    const response=error?.context;
    if(response?.clone)payload=await response.clone().json();
    else if(response?.json)payload=await response.json();
  }catch {return fallback;}
  const message=payload?.error || payload?.message || payload?.msg;
  const messages={
    'Membership checkout is not ready yet.':'Checkout is still closed for this account. During testing, BP_READING_TEST_USER_ID must match your signed-in member profile, and the latest checkout function must be deployed.',
    'Annual subscription checkout is not configured.':'The annual checkout settings are incomplete. Check the shop domain, Storefront token and annual selling-plan setting in Supabase.',
    'Your session could not be verified.':'Your sign-in session could not be verified. Sign out, sign back in and try again.',
    'Sign in to BP Reading before subscribing.':'Sign in to BP Reading before subscribing.',
    'Invalid JWT':'The checkout service rejected your sign-in token. Sign out and sign in again; if it continues, check the function authentication configuration.',
    'Invalid checkout action.':'The checkout page and function versions do not match. Refresh the page and confirm the latest checkout function is deployed.'
  };
  return typeof message==='string'&&Object.hasOwn(messages,message)?messages[message]:fallback;
}

export function initializeReadingCheckout(client, {button, status, retry}, platform = window) {
  let stopped = false, busy = false, intentId = null, popup = null, timer = null, deadline = 0, checkoutUrl = null;
  const say = text => {status.textContent = text;};
  const stopPolling = () => {if (timer) platform.clearTimeout(timer);timer=null;};
  async function check() {
    stopPolling();
    if (stopped || !intentId) return;
    try {
      const {data,error} = await client.rpc('bp_reading_checkout_status',{p_intent_id:intentId});
      if (stopped) return;
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : null;
      if (result?.status === 'paid' && Number.isFinite(Date.parse(result.access_until))) {
        const until = new Date(result.access_until);
        const date = until.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
        say(until > new Date() ? `Payment confirmed. Your BP Reading membership runs until ${date}.` : `Your paid membership ended on ${date}.`);
        busy=false;button.disabled=until > new Date();retry.hidden=true;
        if (until > new Date()) button.textContent='Membership active';
        else {intentId=null;checkoutUrl=null;button.textContent='Subscribe — £10.99 per year';}
        if (until > new Date()) platform.dispatchEvent(new CustomEvent('bp-reading-membership-confirmed',{detail:{accessUntil:result.access_until}}));
        return;
      }
      if (result?.status === 'refunded') {say('This payment was refunded. Membership access has not been activated from it.');busy=false;button.disabled=false;intentId=null;checkoutUrl=null;retry.hidden=true;return;}
      if (result?.status === 'failed') {say('This checkout could not be completed. You can start again.');busy=false;button.disabled=false;intentId=null;checkoutUrl=null;retry.hidden=true;return;}
      say('Waiting for Shopify to confirm payment. Closing the checkout window does not activate membership.');
    } catch {say('Payment confirmation is not available yet. If you paid, do not pay again—use Check payment in a moment.');}
    if (!stopped && Date.now() < deadline) timer=platform.setTimeout(()=>void check(),4000);
    else {busy=false;button.disabled=false;retry.hidden=false;}
  }
  button.addEventListener('click', async () => {
    if (busy || stopped) return;
    if (intentId && checkoutUrl) {
      popup=platform.open(checkoutUrl,'bp-reading-subscribe','popup,width=620,height=820,resizable=yes,scrollbars=yes');
      if(popup)try{popup.opener=null;}catch{}
      say(popup?'Your existing checkout has reopened. We are checking for payment confirmation.':'Allow popups to reopen your existing checkout.');
      deadline=Date.now()+5*60*1000;void check();return;
    }
    // Open synchronously during the click so browsers can permit the popup.
    popup = platform.open('about:blank','bp-reading-subscribe','popup,width=620,height=820,resizable=yes,scrollbars=yes');
    if (!popup) {say('Your browser blocked the checkout popup. Allow popups for this site, then try again.');return;}
    try {popup.opener=null;popup.document.title='Preparing BP Reading checkout';popup.document.body.textContent='Preparing secure Shopify checkout…';} catch {}
    busy=true;button.disabled=true;retry.hidden=true;say('Preparing your annual membership checkout…');
    let failureMessage='Subscription checkout is not ready yet. No payment has been requested. Please try again once the service is connected.';
    try {
      if (!client.functions?.invoke) throw Error('Checkout is not connected yet.');
      const {data,error} = await client.functions.invoke('bp-reading-create-checkout',{body:{}});
      if (stopped) {popup?.close();return;}
      if (error) {failureMessage=await checkoutFailureMessage(error);throw Error('Checkout request failed');}
      if (!data?.intentId || !data?.checkoutUrl) throw Error('Checkout is not connected yet.');
      const target = new URL(data.checkoutUrl);
      if (target.protocol!=='https:') throw Error('Invalid secure checkout URL.');
      intentId=data.intentId;checkoutUrl=target.href;
      if (!popup.closed) popup.location.replace(target.href);
      else say('The checkout popup was closed. Use Check payment if you already paid.');
      busy=false;button.disabled=false;button.textContent='Reopen checkout';
      retry.hidden=false;deadline=Date.now()+5*60*1000;void check();
    } catch {
      popup?.close();busy=false;button.disabled=false;
      say(failureMessage);
    }
  });
  retry.addEventListener('click',()=>{deadline=Date.now()+60000;void check();});
  return {stop(){stopped=true;stopPolling();button.disabled=true;if(popup && !popup.closed)popup.close();}};
}
