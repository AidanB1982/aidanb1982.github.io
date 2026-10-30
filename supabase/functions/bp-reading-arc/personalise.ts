export async function personaliseArc(zipFactory:any,bytes:ArrayBuffer,reference:string):Promise<ArrayBuffer>{
 if(!/^[A-Za-z0-9_-]{1,100}$/.test(reference))throw Error('Invalid ARC reference');
 const zip=await zipFactory.loadAsync(bytes);let chapters=0;
 for(const name of Object.keys(zip.files)){
  const file=zip.files[name];if(file.dir||! /\.(xhtml|html|htm)$/i.test(name))continue;
  const text=await file.async('string');if(text.length>10000000)throw Error('ARC chapter too large');
  const marker=`<p data-bp-arc-reference="${reference}" style="font-size:0.7em;opacity:0.65;text-align:center">Private ARC review copy · ${reference} · Do not share</p>`;
  if(/<\/(?:[\w-]+:)?body\s*>/i.test(text)){zip.file(name,text.replace(/<\/(?:[\w-]+:)?body\s*>/i,match=>marker+match));chapters++;}
 }
 if(!chapters)throw Error('No readable ARC chapters');
 return zip.generateAsync({type:'arraybuffer',compression:'DEFLATE'});
}
