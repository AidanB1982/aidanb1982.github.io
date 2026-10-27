import {publicReadingWork} from "./BP-reading-public.js?v=20261122";
/* Planned metadata is display-only. Only approved server rows carry edition IDs. */
const normalized = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function matches(planned, approved) {
  const ids = [planned.id,...(Array.isArray(planned.readingAliases) ? planned.readingAliases : [])].map(normalized);
  if (approved.bookId && ids.includes(normalized(approved.bookId))) return true;
  return [planned.title,...(Array.isArray(planned.readingAliases) ? planned.readingAliases : [])].map(normalized).includes(normalized(approved.title))
    && (!planned.author || !approved.author || normalized(planned.author) === normalized(approved.author));
}
function readingArtwork(entry, edition = {}) {
  const cover=entry?.readingCover;
  if(cover&&!entry.readingCoverPending)return {cover,coverAlt:entry.readingCoverAlt || entry.title+' cover'};
  if(edition.cover)return {cover:edition.cover,coverAlt:edition.title+' cover'};
  return {cover:cover || entry?.cover || '/assets/book12.jpg',coverAlt:cover ? entry.readingCoverAlt || entry.title+' cover' : entry?.coverAlt || (entry?.title ? entry.title+' cover' : 'Cover coming soon')};
}
export function mergeReadingCatalogue(planned, approved, {verified = true} = {}) {
  const metadata = Array.isArray(planned) ? planned.filter(book => book && typeof book.id === 'string' && typeof book.title === 'string') : [];
  const hidden = metadata.filter(book=>book.hideFromReading === true);
  const seen = new Set();
  const editions = (Array.isArray(approved) ? approved : []).filter(book => {
    if (!book || hidden.some(entry=>matches(entry,book)) || metadata.some(entry=>publicReadingWork(entry.id)&&matches(entry,book)) || !Number.isSafeInteger(book.editionId) || book.editionId <= 0 || seen.has(book.editionId)) return false;
    seen.add(book.editionId); return true;
  });
  const result = editions.map(book => {
    const entry = metadata.find(item => matches(item,book));
    return {...entry,...book,title:book.title || entry?.title || 'Reading edition',author:book.author || entry?.author || '',
      description:book.description || entry?.description || '',...readingArtwork(entry,book),
      collection:entry?.readingCollection || entry?.collection || entry?.series || book.series || 'Independent Works',
      series:book.series || entry?.series || '',seriesOrder:book.seriesOrder ?? entry?.order ?? null,
      readingOrder:entry?.readingOrder ?? null,readingReady:true,availabilityUnknown:false,canRead:book.canRead === true};
  });
  for (const entry of metadata) {
    if (entry.hideFromReading === true || editions.some(book => matches(entry,book))) continue;
    const publicWork = publicReadingWork(entry.id);
    result.push({id:'planned:'+entry.id,catalogueId:entry.id,title:entry.title,author:entry.author || '',collection:entry.readingCollection || entry.collection || entry.series || 'Independent Works',series:entry.series || '',
      readingOrder:entry.readingOrder ?? null,seriesOrder:entry.order ?? null,description:entry.description || '',...readingArtwork(entry),
      editionId:null,bookId:null,publicTextId:publicWork?entry.id:null,readingReady:Boolean(publicWork),availabilityUnknown:!publicWork&&!verified,canRead:Boolean(publicWork),owned:false});
  }
  return result;
}
