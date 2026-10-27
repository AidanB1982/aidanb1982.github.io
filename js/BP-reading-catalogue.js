/* Planned metadata is display-only. Only approved server rows carry edition IDs. */
const normalized = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function matches(planned, approved) {
  const ids = [planned.id,...(Array.isArray(planned.readingAliases) ? planned.readingAliases : [])].map(normalized);
  if (approved.bookId && ids.includes(normalized(approved.bookId))) return true;
  return [planned.title,...(Array.isArray(planned.readingAliases) ? planned.readingAliases : [])].map(normalized).includes(normalized(approved.title))
    && (!planned.author || !approved.author || normalized(planned.author) === normalized(approved.author));
}
export function mergeReadingCatalogue(planned, approved, {verified = true} = {}) {
  const metadata = Array.isArray(planned) ? planned.filter(book => book && typeof book.id === 'string' && typeof book.title === 'string') : [];
  const seen = new Set();
  const editions = (Array.isArray(approved) ? approved : []).filter(book => {
    if (!book || !Number.isSafeInteger(book.editionId) || book.editionId <= 0 || seen.has(book.editionId)) return false;
    seen.add(book.editionId); return true;
  });
  const result = editions.map(book => {
    const entry = metadata.find(item => matches(item,book));
    return {...entry,...book,title:book.title || entry?.title || 'Reading edition',author:book.author || entry?.author || '',
      description:book.description || entry?.description || '',cover:book.cover || entry?.cover || '/assets/logo1.png',
      coverAlt:book.cover ? book.title+' cover' : entry?.coverAlt,
      series:book.series || entry?.series || '',seriesOrder:book.seriesOrder ?? entry?.order ?? null,
      readingReady:true,availabilityUnknown:false,canRead:book.canRead === true};
  });
  for (const entry of metadata) {
    if (editions.some(book => matches(entry,book))) continue;
    result.push({id:'planned:'+entry.id,catalogueId:entry.id,title:entry.title,author:entry.author || '',series:entry.series || '',
      seriesOrder:entry.order ?? null,description:entry.description || '',cover:entry.cover || '/assets/logo1.png',coverAlt:entry.coverAlt,
      editionId:null,bookId:null,readingReady:false,availabilityUnknown:!verified,canRead:false,owned:false});
  }
  return result;
}
