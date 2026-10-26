/* Native MailerLite form submission; iframe loading cannot prove subscription. */
(() => {
  'use strict';const form=document.getElementById('newsletter-form');if(!form)return;
  form.addEventListener('submit',event=>{if(!form.reportValidity()){event.preventDefault();return;}document.getElementById('newsletter-status').textContent='Your signup request is being sent to MailerLite. Check your inbox for any confirmation request. If nothing arrives, try again or contact us.';window.BlackwoodAnalytics?.event('newsletter_request');});
})();
