/* Re-present only the existing public prologue. Never request a protected file. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),sample=$('public-sample');let size=20;
  function apply(){sample.dataset.theme=$('sample-theme').value;sample.style.setProperty('--sample-size',size+'px');sample.style.setProperty('--sample-font',$('sample-font').value==='sans'?'Arial, sans-serif':'Georgia, serif');$('sample-smaller').disabled=size<=16;$('sample-larger').disabled=size>=30;}
  $('sample-theme').onchange=apply;$('sample-font').onchange=apply;$('sample-smaller').onclick=()=>{size=Math.max(16,size-1);apply();};$('sample-larger').onclick=()=>{size=Math.min(30,size+1);apply();};apply();
  fetch('/pages/holdfast.html').then(response=>{if(!response.ok)throw Error();return response.text();}).then(html=>{const doc=new DOMParser().parseFromString(html,'text/html');const paragraphs=[...doc.querySelectorAll('#holdfast-prologue .prologue-text p')];if(!paragraphs.length)throw Error();for(const source of paragraphs){const p=document.createElement('p');p.textContent=source.textContent.trim();$('sample-text').append(p);}$('sample-status').textContent='Public prologue loaded. Adjust the page colour or text size to suit you.';}).catch(()=>{$('sample-status').textContent='The sample could not load. Use the original prologue link above or try again.';});
})();
