/* Two already-public recovered files; never a route to private storage or arbitrary URLs. */
const works = Object.freeze({
  'the-third-night': Object.freeze({title:'The Third Night',path:'/pages/the-third-night.html'}),
  'the-gatestein-log': Object.freeze({title:'The Gåtestein Log',path:'/pages/gatestein-log.html'})
});
export const publicReadingWork = id => Object.hasOwn(works,id) ? works[id] : null;
export function readingStorageKey(userId,book) {
  return publicReadingWork(book.publicTextId)
    ? `bp-reading:${userId}:public:${book.publicTextId}:v1`
    : `bp-reading:${userId}:edition:${book.editionId}:v2`;
}
const xml = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const allowed = new Set(['p','h1','h2','h3','h4','blockquote','ul','ol','li','em','strong','b','i','br','hr','span']);
function clean(node) {
  if(!node)return "";
  if(node.nodeType===3)return xml(node.textContent);
  if(node.nodeType!==1)return '';
  const tag=node.tagName.toLowerCase();
  if(['script','style','iframe','object','embed','form','button','input','img'].includes(tag))return '';
  const content=[...node.childNodes].map(clean).join('');
  if(!allowed.has(tag))return content;
  return ['br','hr'].includes(tag)?`<${tag}/>`:`<${tag}>${content}</${tag}>`;
}
export async function buildPublicReadingEpub(id) {
  const work=publicReadingWork(id);
  if(!work)throw Error('This public reading file is not available.');
  if(typeof window.JSZip!=='function')throw Error('The reading engine could not load. Please refresh.');
  const response=await fetch(work.path,{signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('The public reading text could not be loaded. Please try again.');
  const source=await response.text();
  if(source.length>2000000)throw Error('This public reading file could not be prepared.');
  const doc=new DOMParser().parseFromString(source,'text/html');
  const pages=[...doc.querySelectorAll('[data-reader-manuscript] > .reader-page')];
  if(!pages.length)throw Error('The public manuscript text is not available.');
  const zip=new window.JSZip(),manifest=[],spine=[],toc=[];
  zip.file('mimetype','application/epub+zip',{compression:'STORE'});
  zip.file('META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  const xhtml=(title,body)=>`<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en-GB"><head><title>${xml(title)}</title><link rel="stylesheet" href="../reading.css"/></head><body>${body}</body></html>`;
  let sectionNumber=0;
  pages.forEach((page,index)=>{
    const file=`chapters/section-${index+1}.xhtml`,item=`section-${index+1}`;
    const title=page.classList.contains('reader-page-final')?'Closing note':page.classList.contains('reader-page-rights')?'Copyright':page.classList.contains('reader-page-epigraph')?'Epigraph':page.querySelector('h1,h2,h3,.reader-date')?.textContent.trim() || `Reading section ${++sectionNumber}`;
    const content=page.classList.contains('reader-page-final')?clean(page.querySelector('p')):[...page.childNodes].map(clean).join('');
    zip.file('OEBPS/'+file,xhtml(title,content));
    manifest.push(`<item id="${item}" href="${file}" media-type="application/xhtml+xml"/>`);spine.push(`<itemref idref="${item}"/>`);toc.push(`<li><a href="${file}">${xml(title)}</a></li>`);
  });
  zip.file('OEBPS/reading.css','body{font-family:Georgia,serif;line-height:1.7}p{margin:0 0 1em}h1,h2,h3{line-height:1.3}');
  zip.file('OEBPS/nav.xhtml',`<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><h1>Contents</h1><ol>${toc.join('')}</ol></nav></body></html>`);
  zip.file('OEBPS/package.opf',`<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:blackwood:public:${xml(id)}</dc:identifier><dc:title>${xml(work.title)}</dc:title><dc:creator>Aidan Blackwood</dc:creator><dc:language>en-GB</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/,'Z')}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="reading.css" media-type="text/css"/>${manifest.join('')}</manifest><spine>${spine.join('')}</spine></package>`);
  return zip.generateAsync({type:'arraybuffer',compression:'DEFLATE'});
}
