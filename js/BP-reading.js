
"use strict";

import {
  createClient
} from "https://esm.sh/@supabase/supabase-js@2";

import { initializeReadingCheckout } from "/js/BP-reading-checkout.js?v=20261118";
import { mergeReadingCatalogue } from "/js/BP-reading-catalogue.js?v=20261124";
import { publicReadingWork, readingStorageKey, buildPublicReadingEpub } from "/js/BP-reading-public.js?v=20261122";
import {OfflineLibrary, offlineBookKey, OFFLINE_WINDOW, prepareOfflineShell} from "/js/BP-reading-offline.js?v=20261030-arc-offline1";
import {isArcBook,arcReadingBooks,arcStorageKey,requestArc,ARC_TERMS_VERSION} from "/js/BP-reading-arc.js?v=20261030-arc-offline1";
import { ReadingAccount } from "/js/BP-reading-account.js?v=20261127";

/* =====================================================
   BLACKWOOD PUBLISHING — BP READING
   Administrator testing edition
   EPUB.js reader with interactive page turning
   ===================================================== */

const ARC_MODE=new URL(location.href).searchParams.get('arc')==='1';
const arcConsent=new Set();
const deviceReadingKey=(userId,book)=>isArcBook(book)?arcStorageKey(userId,book):readingStorageKey(userId,book);
const SUPABASE_URL =
  "https://bmnlynjldlnxfvunqbqq.supabase.co";

const SUPABASE_ANON_KEY =
  "sb_publishable_eL7qdDe_6XWGhzmdsql_7w_7dg6psC0";

let EDITION_ID = 2;

let BOOK = {
  id: "BLACKWOOD-BOOK-001-EPUB",
  editionId: 2,
  author: "Aidan Blackwood",
  cover: "/assets/book7.png",
  series: "The Cursed Bothies",
  seriesOrder: 2,
  title: "Gualachulain",
  description:
    "Blackwood Publishing — administrator reading edition."
};

const ADMIN_TEST_BOOK = Object.freeze({...BOOK});

let STORAGE_KEY = "bp-reading-gualachulain-v1";
let activeUser = null;
let membershipStatus={known:false,active:false,expiresAt:null};
let membershipOfferNode=null;
let lastVerifiedMembershipActive=false;
let readerSizeObserver=null;
let readerResizeFrame=0;
let readerLastSize="";
let checkoutController = null;
let readingAccount = null;
let libraryBooks = ARC_MODE ? [] : [BOOK];
let catalogueVerified = false;
let plannedCatalogueLoaded = false;
let switchingEdition = false;
let sessionEpoch = 0;
const offlineLibrary=new OfflineLibrary();
let offlineRows=new Map();
const offlineSaving=new Set();
const offlineSaveErrors=new Map();
const offlineAccountKey='bp-reading-offline-account-v1';
async function refreshOfflineRows() {
  try{offlineRows=new Map((await offlineLibrary.list(activeUser.id)).map(row=>[row.id,row]));}
  catch{offlineRows=new Map();}
}
async function saveOfflineBook(book) {
  if(!activeUser||!navigator.onLine||!book.canRead||offlineSaving.has(offlineBookKey(book)))return;
  const user=activeUser,epoch=sessionEpoch,key=offlineBookKey(book);
  offlineSaveErrors.delete(key);offlineSaving.add(key);renderLibrary();
  $('reading-offline-status').textContent='Saving '+book.title+' and preparing the offline reader…';
  try {
    await prepareOfflineShell();
    const result=isArcBook(book)?await requestArc(supabase,SUPABASE_URL,SUPABASE_ANON_KEY,book,{saveOffline:true,acceptedTerms:arcConsent.has(book.arcAssignmentId)}):publicReadingWork(book.publicTextId)
      ? {bytes:await buildPublicReadingEpub(book.publicTextId),expiresAt:Date.now()+OFFLINE_WINDOW}
      : await fetchProtectedEpub({editionId:book.editionId,offline:true});
    if(activeUser?.id!==user.id||sessionEpoch!==epoch)return;
    const savedBook=isArcBook(book)?{...book,arcReference:result.reference,arcTermsAccepted:true}:book;
    await offlineLibrary.save(user.id,savedBook,result.bytes,result.expiresAt);
    if(isArcBook(book))libraryBooks=libraryBooks.map(item=>item.arcAssignmentId===book.arcAssignmentId?{...item,arcTermsAccepted:true,arcReference:result.reference}:item);
    if(activeUser?.id!==user.id||sessionEpoch!==epoch){await offlineLibrary.clear(user.id);return;}
    localStorage.setItem(offlineAccountKey,user.id);
    await refreshOfflineRows();
    $('reading-offline-status').textContent=book.title+' saved on this device until '+new Date(result.expiresAt).toLocaleDateString('en-GB')+'. Reconnect to check access and renew before it expires.';
  }catch(error){const message=error.message||'This book could not be saved. Check your connection and available device storage.';offlineSaveErrors.set(key,message);$('reading-offline-status').textContent=message;}
  finally{offlineSaving.delete(key);renderLibrary();}
}
async function initialiseOffline() {
  const userId=localStorage.getItem(offlineAccountKey);
  const cachedUser=JSON.parse(localStorage.getItem('sb-bmnlynjldlnxfvunqbqq-auth-token')||'null')?.user?.id;
  if(!userId||cachedUser!==userId)throw Error('Sign in online before opening this offline library.');
  activeUser={id:userId,isAdmin:false,offline:true};
  await refreshOfflineRows();
  const savedRows=[...offlineRows.values()].filter(row=>ARC_MODE?isArcBook(row.book):!isArcBook(row.book));
  if(!savedRows.length){activeUser=null;throw Error('No saved books remain available. Reconnect to save or renew your offline books.');}
  libraryBooks=savedRows.map(row=>({...row.book,readingReady:true,canRead:true,owned:false}));
  catalogueVerified=false;plannedCatalogueLoaded=true;
  membershipOfferNode=$('reading-membership-offer');membershipOfferNode.hidden=true;membershipOfferNode.remove();
  $('reading-membership-summary').hidden=true;$('load-synced').disabled=true;
  $('reading-offline-status').textContent='Offline · showing books saved on this device. Your reading place and notes are saved locally. Reconnect to check access and sync.';
  if(ARC_MODE){document.querySelector('.library h1').textContent='Your ARC reading room';document.querySelector('.library-note').textContent='Saved personalised ARC copies. Reconnect to renew access or file your review.';$('reading-offline-status').textContent='Offline · only your saved ARC copies are shown. Access expires at the saved deadline.';}
  renderLibrary();$('reader-access').hidden=true;$('library').hidden=false;
  document.documentElement.classList.add('bp-reader-verified');
}


const PAGE_TURN_DURATION = 280;
const TOUCH_EDGE_FRACTION = 0.22;
const MOUSE_EDGE_FRACTION = 0.18;
const DRAG_START_DISTANCE = 9;
const DRAG_COMPLETE_FRACTION = 0.42;
const FLICK_VELOCITY = 0.55;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const $ = id => document.getElementById(id);

const allowedThemes = [
  "parchment",
  "day",
  "night"
];

const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
);

function loadSavedState() {
  try {
    const value = JSON.parse(
      localStorage.getItem(STORAGE_KEY)
    );

    return value && typeof value === "object"
      ? value
      : {};
  } catch {
    return {};
  }
}

const saved = {};

const state = {
  theme: allowedThemes.includes(saved.theme)
    ? saved.theme
    : "parchment",

  fontSize: Number.isFinite(saved.fontSize)
    ? Math.max(15, Math.min(30, saved.fontSize))
    : 19,

  position:
    typeof saved.position === "string" &&
    saved.position.startsWith("epubcfi(")
      ? saved.position
      : null,

  progress: Number.isFinite(saved.progress)
    ? Math.max(0, Math.min(100, saved.progress))
    : 0,

  bookmarks: Array.isArray(saved.bookmarks)
    ? saved.bookmarks.filter(
        value =>
          typeof value === "string" &&
          value.startsWith("epubcfi(")
      )
    : [],

  hasStarted: saved.hasStarted === true,
  lastChapter: typeof saved.lastChapter === "string" ? saved.lastChapter.slice(0,500) : "",
  lastReadAt: Number.isFinite(saved.lastReadAt) ? saved.lastReadAt : 0,

  isOpen: false,
  isLoading: false,
  isNavigating: false,

  book: null,
  rendition: null,
  currentCfi: null,
  currentLocation: null,
  locationsReady: false,
  openingId: 0,

  gesture: null,
  suppressClickUntil: 0,
  turnSequence: 0
};

/* =====================================================
   GENERAL HELPERS
   ===================================================== */

function clamp(value, minimum, maximum) {
  return Math.max(
    minimum,
    Math.min(maximum, value)
  );
}

function snapshot() {
  return {theme:state.theme,fontSize:state.fontSize,position:state.position,progress:state.progress,
    bookmarks:state.bookmarks,hasStarted:state.hasStarted,appearance:{...appearance},bookmarkDetails,
    annotations,readingPace,lastChapter:state.lastChapter,lastReadAt:state.lastReadAt};
}
function saveState() {
  const payload = snapshot();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); }
  catch { showStatus("Unable to save reading data on this device."); }
  readingAccount?.schedule(payload);
}

let statusTimer;
function showStatus(message) {
  clearTimeout(statusTimer);
  $("reader-status").textContent = message;
  if (message) statusTimer = setTimeout(() => {$("reader-status").textContent = "";}, 6000);
}

let chromeTimer;
function wakeReaderChrome() {
  if (!state.isOpen) return;
  $('reader').dataset.chrome = 'awake';
  clearTimeout(chromeTimer);
  chromeTimer = setTimeout(() => {
    if (!state.isOpen) return;
    // Keep controls available while someone uses a panel or keyboard focus.
    if ($('reader-panel').open || document.activeElement?.closest('.reader-controls,.reader-bottom,.reading-scrubber,#reader-menu-toggle,#reader-panel')) {
      wakeReaderChrome(); return;
    }
    setControlsVisible(false);
    $('reader').dataset.chrome = 'quiet';
  }, 4000);
}
$('reader').addEventListener('pointermove', wakeReaderChrome, {passive:true});
$('reader').addEventListener('pointerdown', wakeReaderChrome, {passive:true});
$('reader').addEventListener('focusin', wakeReaderChrome);
document.addEventListener('keydown', () => { if(state.isOpen) wakeReaderChrome(); });
function setControlsVisible(visible) {
  if (visible) wakeReaderChrome();
  $("reading-scrubber").hidden = !visible;
  $("reader-controls").hidden = !visible;
  $("reader-bottom").hidden = !visible;

  $("reader-menu-toggle").setAttribute(
    "aria-expanded",
    String(visible)
  );
}

function showLibraryError(message) {
  const element = $("library-error");

  element.textContent = message;
  element.hidden = !message;
}

/* =====================================================
   LIBRARY
   ===================================================== */

function renderLibrary() {
  const grid = $("book-grid"); grid.replaceChildren();
  const query = $("library-search").value.trim().toLowerCase();
  const filter = $("library-status").value;
  const collection = libraryBooks.map(book => {
    let saved = {};
    if (book.readingReady) try { saved = JSON.parse(localStorage.getItem(deviceReadingKey(activeUser?.id,book))) || {}; } catch {}
    const progress = Number.isFinite(saved.progress) ? clamp(saved.progress,0,100) : 0;
    return {...book, progress, started:saved.hasStarted === true,lastChapter:typeof saved.lastChapter==='string'?saved.lastChapter.slice(0,500):'',lastReadAt:Number.isFinite(saved.lastReadAt)?saved.lastReadAt:0};
  });
  renderContinueReading(collection);
  const collectionFilter = $('library-collection'), selectedCollection = collectionFilter.value;
  const collectionNames = [...new Set(collection.map(book=>book.collection || book.series || 'Independent Works'))];
  collectionFilter.replaceChildren(new Option('All collections',''));
  collectionNames.sort().forEach(name=>collectionFilter.add(new Option(name,name)));
  if (collectionNames.includes(selectedCollection)) collectionFilter.value = selectedCollection;
  const availability = $('library-availability').value;
  const books=collection.filter(book => (availability === 'all' || (availability === 'ready' ? book.readingReady : !book.readingReady)) && `${book.title} ${book.author} ${book.series} ${book.collection}`.toLowerCase().includes(query)
    && (!collectionFilter.value || book.collection === collectionFilter.value)
    && (filter === 'all' || (filter === 'finished' ? book.progress >= 100 : filter === 'unread' ? !book.started : book.started && book.progress < 100)));
  const collectionOrder=['The Archive Files','Recovered Files','Threshold Records','The Hollowing Veil','Hard Silence','Independent Works','The Cursed Bothies','Practical Guides'];
  const collectionRank=book=>{const index=collectionOrder.indexOf(book.collection);return index<0?collectionOrder.length:index;};
  books.sort((a,b)=>collectionRank(a)-collectionRank(b)||String(a.collection).localeCompare(String(b.collection))||($('library-sort').value==='title'?a.title.localeCompare(b.title):(a.readingOrder??a.seriesOrder??999)-(b.readingOrder??b.seriesOrder??999)||a.title.localeCompare(b.title)));

  const ready = collection.filter(book=>book.readingReady).length;
  $('library-catalogue-status').textContent = `${books.length} of ${collection.length} titles shown · ${ready} reading edition${ready===1?'':'s'} listed` + (!catalogueVerified ? ' · Reading availability could not be fully checked; refresh to retry.' : '') + (!plannedCatalogueLoaded ? ' · The full book list could not load; showing available reading editions only.' : ' · Other titles will follow as reading editions are prepared.');
  if(ARC_MODE)$('library-catalogue-status').textContent=books.length+' of '+collection.length+' ARC assignment(s) shown · access is checked independently of paid membership.';
  $('load-synced').disabled = ARC_MODE || !navigator.onLine || !readingAccount || switchingEdition;
  if (!books.length) { grid.textContent = 'No books match these filters.'; return; }
  let previousCollection = null;
  for (const book of books) {
    const collectionName = book.collection || book.series || 'Independent Works';
    if (collectionName !== previousCollection) {
      const group = document.createElement('h3'); group.className='reading-collection-heading'; group.textContent=collectionName;
      const count=document.createElement('span');const size=books.filter(item=>item.collection===collectionName).length;count.textContent=`${size} ${size===1?'title':'titles'}`;group.append(count);grid.append(group);
      previousCollection=collectionName;
    }
    const card = document.createElement('article'); card.className = 'book-card'+(isArcBook(book)?' arc-book-card':''); card.dataset.availability = book.readingReady ? 'ready' : 'coming-soon'; if(Number.isSafeInteger(book.editionId))card.dataset.editionId=String(book.editionId); if(book.publicTextId)card.dataset.publicTextId=book.publicTextId;
    const cover = document.createElement('div'); cover.className = 'book-cover';
    const image = document.createElement('img'); image.src = book.cover; image.alt = book.coverAlt || book.title + ' cover'; image.loading = 'lazy'; cover.append(image);
    const details = document.createElement('div'); details.className = 'book-details';
    const eyebrow = document.createElement('p'); eyebrow.className = 'eyebrow'; eyebrow.textContent = !book.readingReady ? 'IN THE BLACKWOOD COLLECTION' : book.started ? 'PICK UP WHERE YOU LEFT OFF' : 'YOUR NEXT CHAPTER AWAITS';
    const heading = document.createElement('h4'); heading.textContent = book.title;
    const meta = document.createElement('p'); meta.className = 'book-description'; meta.textContent = [book.author, book.series, book.seriesOrder ? 'Book ' + book.seriesOrder : ''].filter(Boolean).join(' · ');
    const description = document.createElement('p'); description.className = 'book-description book-synopsis'; description.textContent = book.description;
    const progress = document.createElement('p'); progress.className = 'progress-label'; progress.textContent = !book.readingReady ? book.availabilityUnknown ? 'Availability could not be checked.' : 'The reading edition is being prepared.' : book.started ? `${book.progress}% complete` : 'Not started';
    const track = document.createElement('div'); track.className = 'progress-track'; const fill = document.createElement('div'); fill.className = 'progress-fill'; fill.style.width = book.progress + '%'; track.append(fill);
    const offlineMissing=!navigator.onLine&&!offlineRows.has(offlineBookKey(book));
    const button = document.createElement('button'); button.type = 'button'; button.className = 'open-book'; button.textContent = isArcBook(book)&&offlineMissing ? 'Save online first' : offlineMissing ? 'Save online first' : !book.readingReady ? book.availabilityUnknown ? 'Check back later' : 'Coming soon' : switchingEdition || state.isLoading ? 'Opening…' : !book.canRead ? 'Subscribe to read' : book.started ? 'Continue Reading' : 'Read Book'; button.disabled = offlineMissing || !book.readingReady || switchingEdition || state.isLoading;
    button.onclick = () => {if (!book.readingReady) return; if (book.canRead) void openEdition(book); else {membershipOfferNode?.querySelector('#subscribe-reading')?.focus();showLibraryError(membershipStatus.active?'Reading access could not be verified for this title. Please refresh and try again.':'An active membership or purchase of this title is required to read it.');}};
    const badges=document.createElement('div');badges.className='book-badges';
    const access=document.createElement('span');access.className='book-badge';access.textContent=isArcBook(book)?'Private ARC assignment':offlineMissing ? 'Not saved offline' : book.publicTextId ? 'Free recovered file' : !book.readingReady ? book.availabilityUnknown ? 'Availability unverified' : 'Coming soon' : !book.canRead?'Membership required':activeUser?.isAdmin?'Administrator':book.owned?'Owned':membershipStatus.active?'Included':'Available';badges.append(access);
    if(book.progress>=100){const finished=document.createElement('span');finished.className='book-badge finished';finished.textContent='Finished';badges.append(finished);}
    track.hidden = !book.readingReady;
    track.setAttribute('role','progressbar');track.setAttribute('aria-label',book.title+' reading progress');track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',String(book.progress));
    const offlineControls=document.createElement('div');offlineControls.className='book-offline-controls';
    const offlineKey=offlineBookKey(book),savedOffline=offlineRows.get(offlineKey);
    if(savedOffline){
      const label=document.createElement('span');label.className='device-note';label.textContent='Saved offline · until '+new Date(savedOffline.expiresAt).toLocaleDateString('en-GB');
      const remove=document.createElement('button');remove.type='button';remove.className='offline-action';remove.textContent='Remove offline';remove.onclick=async()=>{try{await offlineLibrary.remove(activeUser.id,offlineKey);await refreshOfflineRows();if(!navigator.onLine)libraryBooks=libraryBooks.filter(item=>offlineBookKey(item)!==offlineKey);renderLibrary();$('reading-offline-status').textContent='Offline copy removed from this device.';}catch{$('reading-offline-status').textContent='The saved copy could not be removed. Please try again.';}};
      offlineControls.append(label,remove);
    }
    if(navigator.onLine&&book.readingReady&&book.canRead){
      const save=document.createElement('button');save.type='button';save.className='offline-action';save.textContent=offlineSaving.has(offlineKey)?'Saving…':savedOffline?'Refresh offline':'Save offline';save.dataset.saveOffline='true';save.disabled=offlineSaving.has(offlineKey)||(isArcBook(book)&&!book.arcTermsAccepted&&!arcConsent.has(book.arcAssignmentId));save.onclick=()=>void saveOfflineBook(book);offlineControls.append(save);
    }
    if(offlineSaveErrors.has(offlineKey)){const error=document.createElement('p');error.className='offline-save-error device-note';error.setAttribute('role','status');error.textContent=offlineSaveErrors.get(offlineKey);offlineControls.append(error);}
    if(isArcBook(book)){
      if(!book.readingReady){button.textContent='ARC reading closed';progress.textContent='Your assignment and review record are retained.';}
      else button.textContent=offlineMissing?'Save online first':'Read your ARC';
      const terms=document.createElement('fieldset');terms.className='arc-reading-terms';
      const legend=document.createElement('legend');legend.textContent=ARC_TERMS_VERSION;terms.append(legend);
      if(book.arcTermsAccepted){const accepted=document.createElement('p');accepted.textContent='Copyright terms accepted.';terms.append(accepted);}
      else if(book.readingReady){
        const inputs=[];
        for(const text of ['I understand this ARC is for my personal review use only.','I will not upload, sell, share, copy, forward, or redistribute this file.','I understand this is an advance/review copy and may differ from the final published edition.']){
          const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=arcConsent.has(book.arcAssignmentId);inputs.push(input);label.append(input,document.createTextNode(text));terms.append(label);
          input.onchange=()=>{const accepted=inputs.every(item=>item.checked);if(accepted)arcConsent.add(book.arcAssignmentId);else arcConsent.delete(book.arcAssignmentId);button.disabled=!accepted||switchingEdition||state.isLoading||(!navigator.onLine&&offlineMissing);const offlineSave=offlineControls.querySelector('[data-save-offline]');if(offlineSave)offlineSave.disabled=!accepted||offlineSaving.has(offlineKey);};
        }
        button.disabled=button.disabled||!arcConsent.has(book.arcAssignmentId);
      }
      const due=document.createElement('p');due.className='device-note';due.textContent=book.reviewDue?'Review due '+book.reviewDue:'No review due date recorded.';
      const form=document.createElement('form');form.className='arc-reading-review';const label=document.createElement('label');label.textContent='Your review link';const input=document.createElement('input');input.type='url';input.required=true;input.maxLength=2048;input.placeholder='https://';input.value=book.reviewLink||'';label.append(input);
      const save=document.createElement('button');save.type='submit';save.className='control';save.disabled=!navigator.onLine;save.textContent=!navigator.onLine?'Connect to file review':book.reviewLink?'Update review link':'Save review link';const message=document.createElement('p');message.setAttribute('role','status');
      form.append(label,save,message);form.onsubmit=async event=>{event.preventDefault();save.disabled=true;try{const url=new URL(input.value);if(url.protocol!=='https:'||url.username||url.password)throw Error('Use an HTTPS review link.');const result=await supabase.rpc('bp_arc_reading_review',{p_assignment_id:book.arcAssignmentId,p_review_link:url.href});if(result.error||result.data!==true)throw Error('Your review link could not be saved.');message.textContent='Review link filed.';}catch(error){message.textContent=error.message;}finally{save.disabled=false;}};
      details.append(badges,heading,meta,due,progress,terms,button,offlineControls,form);
    }else details.append(badges,eyebrow,heading,meta,description,progress,track,button,offlineControls); card.append(cover,details); grid.append(card);
  }
}
function renderContinueReading(collection) {
  const host=$('continue-reading');host.replaceChildren();
  const book=collection.filter(book=>book.canRead&&book.started&&book.progress<100).sort((a,b)=>b.lastReadAt-a.lastReadAt)[0];
  host.hidden=!book;
  if(!book)return;
  const image=document.createElement('img');image.src=book.cover;image.alt=book.title+' cover';
  const details=document.createElement('div');
  const eyebrow=document.createElement('p');eyebrow.className='eyebrow';eyebrow.textContent='CONTINUE READING';
  const title=document.createElement('h2');title.textContent=book.title;
  const meta=document.createElement('p');meta.className='resume-meta';meta.textContent=book.author;
  const chapter=document.createElement('p');chapter.className='resume-chapter';chapter.textContent=book.lastChapter||'Your saved place is waiting.';
  const progress=document.createElement('progress');progress.max=100;progress.value=book.progress;progress.setAttribute('aria-label',book.title+' reading progress');
  const label=document.createElement('span');label.className='resume-percent';label.textContent=book.progress+'% complete';
  const button=document.createElement('button');button.type='button';button.className='open-book';button.textContent='Return to your book';button.disabled=switchingEdition||state.isLoading;button.onclick=()=>void openEdition(book);
  details.append(eyebrow,title,meta,chapter,progress,label,button);host.append(image,details);
}
function reportSync(text) { $('reading-sync-status').textContent = text; }
async function connectEdition(book) {
  readingAccount?.stop();
  if(isArcBook(book)){readingAccount=null;EDITION_ID=book.editionId;BOOK=book;STORAGE_KEY=arcStorageKey(activeUser.id,book);restorePreferences(loadSavedState());reportSync('Private ARC reading · your place and notebook are saved on this device. Online access is required.');return;}
  if (publicReadingWork(book.publicTextId)) {
    readingAccount = null; EDITION_ID = null; BOOK = book;
    STORAGE_KEY = deviceReadingKey(activeUser.id,book);
    restorePreferences(loadSavedState());
    reportSync('Public recovered file · your place, appearance and notebook are saved on this device.');
    return;
  }
  EDITION_ID = book.editionId; BOOK = book;
  STORAGE_KEY = deviceReadingKey(activeUser.id,book);
  restorePreferences(loadSavedState());
  const account = new ReadingAccount(supabase,activeUser.id,EDITION_ID,reportSync);
  readingAccount = account;
  const remote = navigator.onLine ? await account.load() : null;
  if (readingAccount !== account || account.stopped) return;
  if (remote) restorePreferences(remote);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot())); } catch {}
}
async function openEdition(book) {
  if (!activeUser || !book.readingReady || (!Number.isSafeInteger(book.editionId) && !publicReadingWork(book.publicTextId)) || !book.canRead || switchingEdition || state.isOpen) return;
  const epoch = sessionEpoch;
  switchingEdition = true; renderLibrary();
  try {
    await readingAccount?.flush();
    await connectEdition(book);
    if (!activeUser || epoch !== sessionEpoch) return;
    $('reader-book-title').textContent = BOOK.title;
    $('epub-viewer').setAttribute('aria-label',BOOK.title + ' book pages');
    await openBook();
  } catch {showLibraryError('This reading edition could not be prepared. Please reload and try again.');}
  finally {switchingEdition = false; renderLibrary();}
}
function renderReadingMembership() {
  const user=activeUser;
  if(!user)return;
  const summary=$('reading-membership-summary'),text=$('reading-membership-text');
  const offer=membershipOfferNode||$('reading-membership-offer');
  membershipOfferNode=offer;
  const hideOffer=user.isAdmin||membershipStatus.active||!membershipStatus.known;
  $('library').dataset.membership=user.isAdmin?'admin':membershipStatus.active?'active':membershipStatus.known?'inactive':'unknown';
  if(offer) {
    offer.hidden=hideOffer;
    if(hideOffer)offer.remove();
    else if(!offer.isConnected)summary.after(offer);
  }
  summary.hidden=false;
  $('reading-account-heading').textContent=user.isAdmin?'Your reading access':'Your reading membership';
  if(user.isAdmin)text.textContent='Administrator access · No subscription is required.';
  else if(!membershipStatus.known)text.textContent='Your membership status could not be verified. Refresh to check it before starting another subscription.';
  else if(membershipStatus.active) {
    const until=new Date(membershipStatus.expiresAt).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
    text.textContent='Annual membership active · Reading access through '+until+'.';
  }else if(membershipStatus.expiresAt)text.textContent='No active annual membership. Purchased books remain available in your library.';
  else summary.hidden=true;
  const subscribe=offer?.querySelector('#subscribe-reading');
  if(subscribe&&!user.isAdmin)subscribe.disabled=!membershipStatus.known;
}
async function refreshReadingMembership() {
  const user=activeUser;
  if(!user)return;
  if(user.isAdmin) {membershipStatus={known:true,active:false,expiresAt:null};renderReadingMembership();return;}
  try {
    const {data,error}=await supabase.from('bp_reading_memberships').select('access_until,revoked_at').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    if(activeUser?.id!==user.id)return;
    const expiresAt=typeof data?.access_until==='string'&&Number.isFinite(Date.parse(data.access_until))?data.access_until:null;
    membershipStatus={known:true,active:Boolean(expiresAt&&!data.revoked_at&&Date.parse(expiresAt)>Date.now()),expiresAt};
    if(lastVerifiedMembershipActive&&!membershipStatus.active)checkoutController?.reset();
    lastVerifiedMembershipActive=membershipStatus.active;
  }catch {if(activeUser?.id!==user.id)return;membershipStatus={known:false,active:false,expiresAt:null};}
  renderReadingMembership();
}
window.addEventListener('focus',()=>{if(activeUser)void refreshReadingMembership();});

async function loadReadingCatalogue() {
  const user = activeUser;
  if (!user) return;
  await refreshReadingMembership();
  if(activeUser?.id!==user.id)return;
  let approved = user.isAdmin ? [{...ADMIN_TEST_BOOK}] : [];
  catalogueVerified = false;
  try {
    const {data,error} = await supabase.from('bp_reading_catalog').select('edition_id,book_id,title,author,description,cover_url,series,series_order').eq('available',true);
    if (error) throw error;
    if (activeUser?.id !== user.id) return;
    catalogueVerified = Array.isArray(data);
    if (Array.isArray(data)) approved = data.map(row => ({editionId:row.edition_id,id:String(row.edition_id),bookId:row.book_id,title:row.title,author:row.author || '',description:row.description || '',cover:row.cover_url ? safeCover(row.cover_url) : '',series:row.series || '',seriesOrder:row.series_order}));
    const states = await supabase.from('bp_reading_state').select('edition_id,payload').eq('user_id',activeUser.id);
    if (!states.error && Array.isArray(states.data)) {
      for (const row of states.data) {
        const key = `bp-reading:${activeUser.id}:edition:${row.edition_id}:v2`;
        const pending = localStorage.getItem(`bp-reading-outbox:${activeUser.id}:${row.edition_id}`);
        if (!pending && row.payload && typeof row.payload === 'object') localStorage.setItem(key,JSON.stringify(row.payload));
      }
    }
  } catch { /* Existing administrator test edition remains the only local fallback. */ }
  let planned = [];
  plannedCatalogueLoaded = false;
  const catalogueRequest = new AbortController();
  const catalogueTimeout = setTimeout(()=>catalogueRequest.abort(),8000);
  try {
    const response = await fetch('/data/book-discovery.json?v=20261124',{signal:catalogueRequest.signal});
    if (!response.ok) throw Error();
    const data = await response.json();
    if (!Array.isArray(data)) throw Error();
    planned = data; plannedCatalogueLoaded = true;
  } catch { /* Approved server editions remain usable if display metadata is unavailable. */ }
  finally { clearTimeout(catalogueTimeout); }
  if (activeUser?.id !== user.id) return;
  libraryBooks = mergeReadingCatalogue(planned,approved,{verified:catalogueVerified});
  if (activeUser?.id !== user.id) return;
  // Labels describe verified purchases; they never grant access.
  let purchases=[];
  try {const result=await supabase.from('bp_reading_purchases').select('book_id,revoked_at').eq('user_id',user.id);if(!result.error&&Array.isArray(result.data))purchases=result.data.filter(row=>!row.revoked_at).map(row=>row.book_id);}catch {}
  if(activeUser?.id!==user.id)return;
  libraryBooks=libraryBooks.map(book=>({...book,owned:purchases.includes(book.bookId)}));
  const checked = await Promise.all(libraryBooks.map(async book => {
    if (publicReadingWork(book.publicTextId)) return {...book,canRead:true};
    if (!book.readingReady) return {...book,canRead:false};
    if (user.isAdmin) return {...book,canRead:true,accessVerified:true};
    try {const access = await supabase.rpc('bp_reading_can_read',{p_edition_id:book.editionId});return {...book,canRead:!access.error && access.data === true,accessVerified:!access.error};}
    catch {return {...book,canRead:false};}
  }));
  if (activeUser?.id === user.id) libraryBooks=checked;
}
window.addEventListener('bp-reading-membership-confirmed',async()=>{if(activeUser&&!ARC_MODE){await loadReadingCatalogue();renderLibrary();}});
function safeCover(value) {
  if (typeof value !== 'string') return '/assets/book7.png';
  try { const url = new URL(value,location.origin); return url.protocol === 'https:' || url.origin === location.origin ? url.href : '/assets/book7.png'; } catch {return '/assets/book7.png';}
}

/* =====================================================
   ADMIN AUTHENTICATION
   ===================================================== */

async function verifyBPReadingUser() {
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Authentication required");
  }

  const {
    data: profile,
    error: profileError
  } = await supabase
    .from("member_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return {...user,isAdmin:!profileError && profile?.is_admin === true};
}

/* =====================================================
   PROTECTED EPUB DELIVERY
   ===================================================== */

async function fetchProtectedEpub({editionId=EDITION_ID,offline=false}={}) {
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();

  if (
    sessionError ||
    !session?.access_token
  ) {
    throw new Error(
      "Your session has expired. Please sign in again."
    );
  }

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/bp-reading-deliver-epub`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization":
          `Bearer ${session.access_token}`,
        "apikey": SUPABASE_ANON_KEY
      },

      body: JSON.stringify({
        editionId,offline
      }),

      cache: "no-store"
    }
  );

  if (!response.ok) {
    let message =
      "The reading edition could not be loaded.";

    try {
      const payload = await response.json();

      if (typeof payload.error === "string") {
        message = payload.error === 'Administrator access is required.'
          ? 'This book’s delivery service is not yet enabled for members. Please contact Blackwood Publishing.'
          : payload.error;
      }
    } catch {
      // Keep generic error.
    }

    throw new Error(message);
  }

  const contentType =
    response.headers.get("Content-Type") || "";

  if (
    !contentType.includes("application/epub+zip")
  ) {
    throw new Error(
      "The server returned an unexpected file type."
    );
  }

  const bytes = await response.arrayBuffer();

  const signature = new Uint8Array(
    bytes,
    0,
    Math.min(4, bytes.byteLength)
  );

  const validZip =
    signature.length === 4 &&
    signature[0] === 0x50 &&
    signature[1] === 0x4b &&
    signature[2] === 0x03 &&
    signature[3] === 0x04;

  if (!validZip) {
    throw new Error(
      "The returned file is not a valid EPUB archive."
    );
  }

  if(offline) {
    const expiresAt=Date.parse(response.headers.get('X-BP-Offline-Until'));
    if(!Number.isFinite(expiresAt))throw Error('Offline saving needs the updated bp-reading-deliver-epub function. Online reading is still available.');
    return {bytes,expiresAt};
  }
  return bytes;
}

/* =====================================================
   READING THEMES
   ===================================================== */

function registerThemes(rendition) {
  rendition.themes.register(
    "parchment",
    {
      body: {
        background: "#f5f0e6 !important",
        color: "#30271f !important",
        "font-family":
          "Georgia, 'Times New Roman', serif !important",
        "line-height": "1.85 !important"
      }
    }
  );

  rendition.themes.register(
    "day",
    {
      body: {
        background: "#ffffff !important",
        color: "#242424 !important",
        "font-family":
          "Georgia, 'Times New Roman', serif !important",
        "line-height": "1.85 !important"
      }
    }
  );

  rendition.themes.register(
    "night",
    {
      body: {
        background: "#201c1a !important",
        color: "#e9dfd2 !important",
        "font-family":
          "Georgia, 'Times New Roman', serif !important",
        "line-height": "1.85 !important"
      }
    }
  );
}

function applyReaderPreferences() {
  $("reader").dataset.theme = state.theme;
  $("reading-theme").value = state.theme;
  document.querySelectorAll('[data-reading-theme]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.readingTheme===state.theme)));
  const preview=$('type-preview');
  preview.style.fontFamily=fontFamilies[appearance.font];preview.style.lineHeight=appearance.spacing;preview.style.fontSize=state.fontSize+'px';
  preview.dataset.theme=state.theme;

  if (!state.rendition) {
    return;
  }

  document.querySelector('.reading-column').style.maxWidth = appearance.width + 'px';
  state.rendition.themes.select(state.theme);
  state.rendition.themes.override('font-family', fontFamilies[appearance.font], true);
  state.rendition.themes.override('line-height', appearance.spacing, true);
  state.rendition.themes.override('text-align', appearance.alignment, true);

  for(const contents of state.rendition.getContents()||[])applyDocumentAppearance(contents);
  state.rendition.themes.fontSize(
    `${Math.round(
      state.fontSize / 19 * 100
    )}%`
  );
}

function applyDocumentAppearance(contents) {
  const doc=contents?.document;
  if(!doc?.body)return;
  const palette={parchment:['#f5f0e6','#30271f'],day:['#ffffff','#242424'],night:['#201c1a','#e9dfd2']}[state.theme];
  doc.documentElement.style.setProperty('font-size',state.fontSize+'px','important');
  for(const root of [doc.documentElement,doc.body]) {
    root.style.setProperty('background-color',palette[0],'important');
    root.style.setProperty('color',palette[1],'important');
  }
  doc.body.style.setProperty('font-size','1rem','important');
  doc.body.style.setProperty('font-family',fontFamilies[appearance.font],'important');
  doc.body.style.setProperty('line-height',appearance.spacing,'important');
  // Publisher-specific colours must not make prose invisible in the chosen theme.
  // Preserve images, SVG artwork, structure, emphasis and heading-size hierarchy.
  for(const node of doc.body.querySelectorAll('p,span,li,blockquote,pre,td,th,h1,h2,h3,h4,h5,h6,em,strong,a')) {
    node.style.setProperty('color',palette[1],'important');
    node.style.setProperty('background-color','transparent','important');
    node.style.setProperty('font-family',fontFamilies[appearance.font],'important');
  }
}
function resizeReaderViewport() {
  if(!state.rendition||!state.isOpen)return;
  const rect=$('epub-viewer').getBoundingClientRect();
  const width=Math.floor(rect.width),height=Math.floor(rect.height),key=width+'x'+height;
  if(width>0&&height>0&&key!==readerLastSize){readerLastSize=key;state.rendition.resize(width,height);}
}
function observeReaderViewport() {
  readerSizeObserver?.disconnect();
  if(typeof ResizeObserver==='function') {
    readerSizeObserver=new ResizeObserver(()=>{cancelAnimationFrame(readerResizeFrame);readerResizeFrame=requestAnimationFrame(resizeReaderViewport);});
    readerSizeObserver.observe($('epub-viewer'));
  }
}
window.addEventListener('resize',resizeReaderViewport);
$('reader-display-check').onclick=()=>{
  const report=$('reader-display-report');
  if(!report.hidden){report.hidden=true;return;}
  const contents=state.rendition?.getContents()?.[0],doc=contents?.document;
  const frame=$('epub-viewer').querySelector('iframe'),rect=$('epub-viewer').getBoundingClientRect();
  const textNode=doc?.querySelector('p,h1,h2,h3,li');
  const style=textNode?contents.window.getComputedStyle(textNode):null;
  const body=doc?.body?.cloneNode(true);
  body?.querySelectorAll('script,style,#bp-personal-copy').forEach(node=>node.remove());
  report.textContent=[
    'Reader build: 20261103',
    'Library headline size: '+getComputedStyle(document.querySelector('.library h1')).fontSize,
    'Subscription offer in page: '+Boolean($('reading-membership-offer')?.isConnected),
    'Membership: '+(membershipStatus.known?(membershipStatus.active?'active':'inactive'):'unverified'),
    'Viewer: '+Math.round(rect.width)+' × '+Math.round(rect.height),
    'EPUB frames: '+$('epub-viewer').querySelectorAll('iframe').length,
    'Current section characters: '+(body?.textContent?.trim().length||0),
    'Paragraphs: '+(doc?.querySelectorAll('p').length||0),
    'Text colour: '+(style?.color||'no prose node'),
    'Text size: '+(style?.fontSize||'unknown'),
    'Text visibility: '+(style?style.display+' / '+style.visibility+' / opacity '+style.opacity:'unknown'),
    'Frame visible: '+Boolean(frame&&frame.getBoundingClientRect().height>0),
    'No book text or credentials are included in this report. Tap Display help to close.'
  ].join('\n');
  report.hidden=false;
};

/* =====================================================
   BOOKMARKS
   ===================================================== */

function getCurrentCfi() {
  return state.currentLocation?.start?.cfi ||
    state.currentCfi ||
    null;
}

function updateBookmarkButton() {
  const current = getCurrentCfi();

  const bookmarked =
    current !== null &&
    state.bookmarks.includes(current);

  $("bookmark").textContent = bookmarked
    ? "★ Bookmarked"
    : "☆ Bookmark";

  $("bookmark").setAttribute(
    "aria-pressed",
    String(bookmarked)
  );

  $("bookmark").disabled = !current;
}

/* =====================================================
   READING PROGRESS
   ===================================================== */

function updateReaderProgress() {
  const location = state.currentLocation;

  if (!location) {
    $("reader-progress").textContent =
      "Preparing…";

    for (const id of [
      "previous",
      "next",
      "page-arrow-left",
      "page-arrow-right"
    ]) {
      $(id).disabled = true;
    }

    updateBookmarkButton();
    return;
  }

  const start = location.start || {};
  const displayed = start.displayed || {};

  const page = Number.isFinite(displayed.page)
    ? displayed.page
    : null;

  const total = Number.isFinite(displayed.total)
    ? displayed.total
    : null;

  let label = "";

  if (
    state.locationsReady &&
    state.book &&
    typeof start.cfi === "string"
  ) {
    const fraction =
      state.book.locations.percentageFromCfi(
        start.cfi
      );

    if (Number.isFinite(fraction)) {
      state.progress = clamp(
        Math.round(fraction * 100),
        0,
        100
      );
    }

    label = `${state.progress}% complete${page && total ? ` · ${page}/${total} in chapter` : ""}`;
  } else if (
    page !== null &&
    total !== null
  ) {
    label = `Page ${page} of ${total}`;
  } else {
    label = "Reading";
  }

  $("reader-progress").textContent = label;
  $("quiet-percent").textContent = state.locationsReady ? `${state.progress}% complete` : label;
  $("quiet-chapter").textContent = chapterName(start.href);
  const estimate = chapterTimeRemaining();
  if (estimate) $("reader-progress").textContent += " · " + estimate;
  $("reader-seek").disabled = !state.locationsReady;
  $("reader-seek").value = state.progress;
  $("seek-value").value = state.progress + '%';

  const previousDisabled = location.atStart === true;

  const nextDisabled = location.atEnd === true;

  $("previous").disabled = previousDisabled;
  $("next").disabled = nextDisabled;

  $("page-arrow-left").disabled =
    previousDisabled;

  $("page-arrow-right").disabled =
    nextDisabled;

  updateBookmarkButton();
}

function handleRelocation(location) {
  if (!state.isOpen) {
    return;
  }

  const cfi = location?.start?.cfi;

  if (
    typeof cfi !== "string" ||
    !cfi.startsWith("epubcfi(")
  ) {
    return;
  }

  state.currentLocation = location;
  state.currentCfi = cfi;
  state.position = cfi;
  state.hasStarted = true;
  state.lastChapter = chapterName(location.start.href);
  state.lastReadAt = Date.now();
  sampleReadingPace();

  updateReaderProgress();
  saveState();
}

async function prepareLocations(book, openingId) {
  try {
    await book.locations.generate(1024);

    if (
      openingId !== state.openingId ||
      !state.isOpen ||
      state.book !== book
    ) {
      return;
    }

    state.locationsReady = true;

    updateReaderProgress();
    saveState();
    renderLibrary();
  } catch (error) {
    console.warn(
      "EPUB percentage calculation unavailable:",
      error
    );
  }
}

/* =====================================================
   PAGE-TURN VISUAL ENGINE

   Uses the existing decorative page-turn overlay.
   A finger drag controls the sheet rotation.
   EPUB navigation occurs only after commitment.
   ===================================================== */

let turnAnimation=null;
let queuedTurn=0;
let pageTurnActive=false;
function getPageTurnElements() {
  return {overlay:$('page-turn-overlay'),sheet:$('page-turn-sheet')};
}
function resetPageTurn() {
  turnAnimation?.cancel();turnAnimation=null;
  const {overlay,sheet}=getPageTurnElements();
  overlay.hidden=true;overlay.classList.remove('turn-next','turn-prev','turn-dragging');
  overlay.removeAttribute('style');sheet.removeAttribute('style');
  sheet.querySelector('.turn-page-snapshot')?.remove();
  state.gesture=null;
}
// Copy the outgoing page outside the EPUB iframe. The real renderer can advance
// immediately beneath it without transforms changing its pagination geometry.
function captureTurnPage() {
  const viewer=$('epub-viewer'),frame=viewer.querySelector('iframe');
  const doc=frame?.contentDocument;
  if(!doc?.body)return;
  const host=document.createElement('div');host.className='turn-page-snapshot';
  host.setAttribute('inert','');host.setAttribute('aria-hidden','true');
  const shadow=host.attachShadow({mode:'open'});
  const root=doc.documentElement.cloneNode(true);
  root.querySelectorAll('head,script,link,style,iframe,object,embed,form').forEach(node=>node.remove());
  [root,...root.querySelectorAll('*')].forEach(node=>{
    for(const attr of [...node.attributes])if(/^on/i.test(attr.name))node.removeAttribute(attr.name);
  });
  // rem units belong to the EPUB document, not the surrounding website.
  const rem=parseFloat(frame.contentWindow.getComputedStyle(doc.documentElement).fontSize)||19;
  const pixels=text=>text.replace(/(-?[\d.]+)rem\b/g,(_,number)=>(Number(number)*rem)+'px');
  const styles=document.createElement('style');let css='';
  for(const sheet of doc.styleSheets)try{css += [...sheet.cssRules].map(rule=>rule.cssText).join('\n');}catch{}
  styles.textContent=pixels(css).replace(/:root\b/g,'html');
  for(const node of [root,...root.querySelectorAll('[style]')])node.setAttribute('style',pixels(node.getAttribute('style')||''));
  const clip=viewer.getBoundingClientRect(),bounds=frame.getBoundingClientRect();
  Object.assign(root.style,{position:'absolute',margin:'0',left:(bounds.left-clip.left)+'px',top:(bounds.top-clip.top)+'px',width:bounds.width+'px',height:bounds.height+'px'});
  shadow.append(styles,root);
  $('page-turn-sheet').append(host);
}
function prepareTurnSheet(direction) {
  const {overlay,sheet}=getPageTurnElements(),viewer=$('epub-viewer');
  sheet.querySelector('.turn-page-snapshot')?.remove();
  overlay.style.inset=viewer.offsetTop+'px auto auto '+viewer.offsetLeft+'px';
  overlay.style.width=viewer.clientWidth+'px';overlay.style.height=viewer.clientHeight+'px';
  overlay.hidden=false;overlay.classList.remove('turn-next','turn-prev');overlay.classList.add('turn-dragging');
  overlay.dataset.direction=direction>0?'next':'previous';
  sheet.style.transformOrigin=direction>0?'left center':'right center';
  captureTurnPage();setTurnProgress(direction,0);
}
function setTurnProgress(direction,progress) {
  const {sheet}=getPageTurnElements(),fraction=clamp(progress,0,1);
  sheet.style.transform=`rotateY(${(direction>0?-90:90)*fraction}deg)`;
  sheet.style.opacity='1'; // Paper stays opaque; the destination appears around its edge.
}
async function settleTurnSheet(direction,startProgress,complete) {
  if(reducedMotion.matches||appearance.motion==='instant')return;
  const {sheet}=getPageTurnElements(),destination=complete?1:0;
  const duration=clamp(Math.round(PAGE_TURN_DURATION*Math.abs(destination-startProgress)),70,PAGE_TURN_DURATION);
  const from={transform:sheet.style.transform,opacity:sheet.style.opacity,offset:0};
  setTurnProgress(direction,startProgress+(destination-startProgress)*.65);
  const middle={transform:sheet.style.transform,opacity:sheet.style.opacity,offset:.65};
  setTurnProgress(direction,destination);
  const to={transform:sheet.style.transform,opacity:sheet.style.opacity,offset:1};
  const animation=sheet.animate([from,middle,to],{duration,easing:'cubic-bezier(.2,.65,.3,1)',fill:'both'});
  turnAnimation=animation;
  try{await animation.finished;}catch{} // Closing a book cancels the visual immediately.
  finally{if(turnAnimation===animation){animation.cancel();turnAnimation=null;}}
}

/* =====================================================
   PAGE NAVIGATION
   ===================================================== */

function canTurn(direction) {
  if (
    !state.rendition ||
    !state.isOpen ||
    state.isLoading ||
    state.isNavigating ||
    !state.currentLocation
  ) {
    return false;
  }

  if (
    direction > 0 &&
    state.currentLocation.atEnd === true
  ) {
    return false;
  }

  if (
    direction < 0 &&
    state.currentLocation.atStart === true
  ) {
    return false;
  }

  return true;
}

async function changePage(direction,options={}) {
  if(state.isNavigating) {
    // Retain one follow-up turn instead of dropping rapid taps or restarting a curl.
    if(pageTurnActive)queuedTurn=direction;
    return;
  }
  if(!canTurn(direction))return;
  const openingId=state.openingId,turnSequence=++state.turnSequence;
  const isCurrent=()=>state.isOpen&&openingId===state.openingId&&turnSequence===state.turnSequence;
  pageTurnActive=true;state.isNavigating=true;updateReaderProgress();
  try {
    let motion=Promise.resolve();
    if(appearance.motion==='instant'||reducedMotion.matches)resetPageTurn();
    else {
      if(!options.fromGesture)prepareTurnSheet(direction);
      motion=settleTurnSheet(direction,options.fromGesture?clamp(options.progress||0,0,1):0,true);
    }
    // Render the destination during the curl, rather than after an artificial wait.
    await Promise.all([direction>0?state.rendition.next():state.rendition.prev(),motion]);
  } catch(error) {
    queuedTurn=0;
    if(isCurrent()){console.error('Page navigation failed:',error);showStatus('Unable to turn the page.');}
  } finally {
    if(isCurrent()) {
      resetPageTurn();pageTurnActive=false;state.isNavigating=false;updateReaderProgress();
      const next=queuedTurn;queuedTurn=0;
      if(next)void changePage(next);
    }
  }
}

/* =====================================================
   TOUCH GESTURES

   The reader content is inside an EPUB.js iframe.
   We register handlers on each EPUB document.

   Only gestures starting near the page edges
   begin a physical page turn.

   Central text selection and ordinary links
   are left alone.
   ===================================================== */

function getPageDirection(
  x,
  width,
  pointerType
) {
  const fraction =
    pointerType === "mouse"
      ? MOUSE_EDGE_FRACTION
      : TOUCH_EDGE_FRACTION;

  if (x <= width * fraction) {
    return -1;
  }

  if (x >= width * (1 - fraction)) {
    return 1;
  }

  return 0;
}

function isInteractiveTarget(target) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      "a, button, input, textarea, select, " +
      "[contenteditable='true']"
    )
  );
}

function registerPageGestures(contents) {
  contents.document.addEventListener("pointermove",wakeReaderChrome,{passive:true});
  contents.document.addEventListener("pointerdown",wakeReaderChrome,{passive:true});
  contents.document.addEventListener("keydown",wakeReaderChrome);
  const doc = contents.document;

  if (!doc || doc.__bpReadingGesturesInstalled) {
    return;
  }

  doc.__bpReadingGesturesInstalled = true;

  // Browser deterrents only: screenshots and deliberate extraction cannot be blocked.
  // Scope to EPUB documents; library/search/settings keep normal clipboard access.
  for (const type of ["copy", "cut", "paste", "contextmenu"]) {
    doc.addEventListener(type, event => {
      event.preventDefault();
      showStatus("Copying from this reading edition is disabled.");
    }, true);
  }


 
  const getCoordinates = event => {
    // An EPUB iframe spans the whole chapter. Gestures belong to the visible
    // page, with the iframe's current horizontal offset accounted for.
    const clip=$('epub-viewer').getBoundingClientRect();
    const frame=doc.defaultView.frameElement.getBoundingClientRect();
    return {x:event.clientX+frame.left-clip.left,y:event.clientY,width:Math.max(1,clip.width)};
  };


  const begin = event => {
    if (
      !state.isOpen ||
      state.isLoading ||
      state.isNavigating ||
      state.gesture ||
      event.isPrimary === false ||
      (event.pointerType === "mouse" &&
        event.button !== 0)
    ) {
      return;
    }

    if (isInteractiveTarget(event.target)) {
      return;
    }

    const point = getCoordinates(event);

    const direction = getPageDirection(
      point.x,
      point.width,
      event.pointerType
    );

    if (!direction || !canTurn(direction)) {
      return;
    }

    // Mouse users click to turn pages.
    // Touch users drag the page.
    if (event.pointerType === "mouse") {
      return;
    }

    state.gesture = {
      pointerId: event.pointerId,
      direction,
      startX: point.x,
      startY: point.y,
      lastX: point.x,
      lastTime: performance.now(),
      velocity: 0,
      progress: 0,
      active: false,
      cancelled: false,
      width: point.width
    };
  };

  const move = event => {
    const gesture = state.gesture;

    if (
      !gesture ||
      event.pointerId !== gesture.pointerId
    ) {
      return;
    }

    const point = getCoordinates(event);

    const dx = point.x - gesture.startX;
    const dy = point.y - gesture.startY;

    const towardTurn =
      gesture.direction > 0
        ? -dx
        : dx;

    if (!gesture.active) {
      if (
        Math.abs(dx) < DRAG_START_DISTANCE &&
        Math.abs(dy) < DRAG_START_DISTANCE
      ) {
        return;
      }

      // Do not hijack predominantly vertical
      // movements or drags away from the page.
      if (
        Math.abs(dy) > Math.abs(dx) ||
        towardTurn <= 0
      ) {
        state.gesture = null;
        return;
      }

      gesture.active = true;

      if(appearance.motion!=='instant'&&!reducedMotion.matches)prepareTurnSheet(gesture.direction);
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    const now = performance.now();
    const elapsed = Math.max(
      1,
      now - gesture.lastTime
    );

    const movement =
      point.x - gesture.lastX;

    const signedMovement =
      gesture.direction > 0
        ? -movement
        : movement;

    const instantVelocity =
      signedMovement / elapsed;

    gesture.velocity =
      gesture.velocity * 0.65 +
      instantVelocity * 0.35;

    gesture.lastX = point.x;
    gesture.lastTime = now;

    gesture.progress = clamp(
      towardTurn / (gesture.width * 0.8),
      0,
      1
    );

    if(appearance.motion!=='instant'&&!reducedMotion.matches)setTurnProgress(gesture.direction,gesture.progress);
  };

  const finish = async (
    event,
    cancelled = false
  ) => {
    const gesture = state.gesture;

    if (
      !gesture ||
      event.pointerId !== gesture.pointerId
    ) {
      return;
    }

    state.gesture = null;

    if (!gesture.active) {
      return;
    }

    state.suppressClickUntil =
      performance.now() + 500;

    const shouldComplete =
      !cancelled &&
      (
        gesture.progress >=
          DRAG_COMPLETE_FRACTION ||
        (
          gesture.progress >= 0.08 &&
          gesture.velocity >= FLICK_VELOCITY
        )
      );

    if (shouldComplete) {
      // The gesture no longer owns the pointer.
      // Navigation now owns the animation.
      await changePage(
        gesture.direction,
        {
          fromGesture: true,
          progress: gesture.progress
        }
      );
    } else {
      // Cancelled or insufficient drag:
      // gently return the sheet to its edge.
      state.isNavigating = true;
      updateReaderProgress();

      const openingId = state.openingId;
      const turnSequence = ++state.turnSequence;

      try {
        await settleTurnSheet(
          gesture.direction,
          gesture.progress,
          false
        );
      } finally {
        if (
          openingId === state.openingId &&
          turnSequence === state.turnSequence
        ) {
          resetPageTurn();

          state.isNavigating = false;
          updateReaderProgress();
        }
      }
    }
  };

  const click = event => {
    if (
      performance.now() <
      state.suppressClickUntil
    ) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (
      !state.isOpen ||
      isInteractiveTarget(event.target)
    ) {
      return;
    }

    const selection = doc.getSelection?.()?.toString() || "";
    if (selection.trim()) return;
    const point = getCoordinates(event);

    const direction = getPageDirection(
      point.x,
      point.width,
      "mouse"
    );

    if (!direction) { setControlsVisible($("reader-controls").hidden); return; }
    if (!canTurn(direction)&&!pageTurnActive) return;

    event.preventDefault();

    void changePage(direction);
  };

  doc.addEventListener(
    "pointerdown",
    begin,
    { passive: true }
  );

  doc.addEventListener(
    "pointermove",
    move,
    { passive: false }
  );

  doc.addEventListener(
    "pointerup",
    event => {
      void finish(event);
    }
  );

  doc.addEventListener(
    "pointercancel",
    event => {
      void finish(event, true);
    }
  );

  doc.addEventListener(
    "click",
    click,
    true
  );

  doc.addEventListener(
    "keydown",
    event => {
      handleReadingKeys(event);
      if (event.key === "Escape") {
        event.preventDefault();

        if (!$("reader-controls").hidden) {
          setControlsVisible(false);
        } else {
          closeBook();
        }
      }
    }
  );
}

/* =====================================================
   OPEN BOOK
   ===================================================== */

async function openBook() {
  if (
    state.isLoading ||
    state.isOpen
  ) {
    return;
  }

  if (
    typeof window.ePub !== "function" ||
    typeof window.JSZip === "undefined"
  ) {
    showLibraryError(
      "The EPUB reading library could not load. " +
      "Please refresh the page and try again."
    );
    return;
  }

  state.isLoading = true;
  state.isOpen = true;
  state.locationsReady = false;
  $("reader-seek").disabled = true;
  $("quiet-percent").textContent = "Preparing…";
  state.currentLocation = null;
  state.currentCfi = null;

  const openingId = ++state.openingId;

  showLibraryError("");
  renderLibrary();

  $("library").hidden = true;
  $("reader").hidden = false;

  $("reader-loading").hidden = false;
  $("reader-loading").textContent =
    "Preparing your book…";

  $("epub-viewer").hidden = true;
  $("reader-page-arrows").hidden = true;
  $("reader-menu-toggle").hidden = true;

  resetPageTurn();
  setControlsVisible(false);
  showStatus("");

  try {
    let bytes;
    if(isArcBook(BOOK)){
      const arc=navigator.onLine?await requestArc(supabase,SUPABASE_URL,SUPABASE_ANON_KEY,BOOK,{acceptedTerms:arcConsent.has(BOOK.arcAssignmentId)}):{bytes:await offlineLibrary.read(activeUser.id,BOOK),reference:BOOK.arcReference};
      bytes=arc.bytes;$('reader-watermark').textContent='Personal ARC review copy · '+arc.reference;
      libraryBooks=libraryBooks.map(book=>book.arcAssignmentId===BOOK.arcAssignmentId?{...book,arcTermsAccepted:true}:book);
    }else bytes = !navigator.onLine ? await offlineLibrary.read(activeUser.id,BOOK) : publicReadingWork(BOOK.publicTextId) ? await buildPublicReadingEpub(BOOK.publicTextId) : await fetchProtectedEpub();

    if (openingId !== state.openingId) {
      return;
    }

    $("reader-loading").textContent =
      `Opening ${BOOK.title}…`;

    if (typeof window.ePub !== "function" || !window.JSZip) throw new Error("The reading engine could not load. Check your connection and reload this page.");
    const book = window.ePub(bytes);
    state.book = book;

    await book.ready;
    await book.loaded.navigation;
    if (openingId === state.openingId) renderContents();

    if (openingId !== state.openingId) {
      return;
    }

    $("reader-loading").hidden = true;
    document.querySelector('.reading-column').style.maxWidth=appearance.width+'px';
    $("epub-viewer").hidden = false;

    await new Promise(resolve=>requestAnimationFrame(resolve));
    const viewport=$('epub-viewer').getBoundingClientRect();
    if(viewport.width<1||viewport.height<1)throw Error('The reading area has no visible size. Resize the window and reopen the book.');
    readerLastSize=Math.floor(viewport.width)+'x'+Math.floor(viewport.height);
    const rendition = book.renderTo(
      "epub-viewer",
      {
        width: Math.floor(viewport.width),
        height: Math.floor(viewport.height),
        manager: "default",
        flow: "paginated",
        spread: "none"
      }
    );

    state.rendition = rendition;

    rendition.on('selected', (cfi, contents) => {
      const selected = contents.window.getSelection()?.toString().trim();
      if (!selected || !cfi || selected.length > 4000) return;
      selectedPassage = {cfi,quote:selected,chapter:chapterName()};
      $('selection-tools').hidden = false;
    });
    rendition.on('rendered', () => { renderHighlights(); });
    registerThemes(rendition);
    applyReaderPreferences();

    rendition.on(
      "relocated",
      handleRelocation
    );

    rendition.on(
      "displayError",
      error => {
        console.error(
          "EPUB display error:",
          error
        );

        showStatus(
          "A book page could not be displayed."
        );
      }
    );

    // Register for each EPUB document as it loads.
    rendition.hooks.content.register(
      contents => {
        applyDocumentAppearance(contents);
        registerPageGestures(contents);
      }
    );

    const savedPosition = state.position;

    try {
      await rendition.display(
        savedPosition || undefined
      );
    } catch (error) {
      if (!savedPosition) {
        throw error;
      }

      console.warn(
        "Saved position unavailable; opening start:",
        error
      );

      state.position = null;

      await rendition.display();
    }

    if (openingId !== state.openingId) {
      return;
    }

    $("reader-loading").hidden = true;
    observeReaderViewport();

    state.isLoading = false;
    state.hasStarted = true;
    wakeReaderChrome();

    $("reader-page-arrows").hidden = false;
    $("reader-menu-toggle").hidden = false;

    updateReaderProgress();
    saveState();
    renderHighlights();
    renderLibrary();

    void prepareLocations(
      book,
      openingId
    );
  } catch (error) {
    if (openingId !== state.openingId) {
      return;
    }

    console.error(
      "BP Reading failed to open EPUB:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "An unexpected reading error occurred.";

    closeBook();

    showLibraryError(
      `Unable to open ${BOOK.title}: ${message}`
    );
  } finally {
    if (openingId === state.openingId) {
      state.isLoading = false;
      renderLibrary();
    }
  }
}

/* =====================================================
   CLOSE BOOK
   ===================================================== */

function closeBook() {
  readerSizeObserver?.disconnect();readerSizeObserver=null;cancelAnimationFrame(readerResizeFrame);readerLastSize='';
  $('reader-display-report').hidden=true;
  closePanel();
  $('selection-tools').hidden = true; selectedPassage = null; lastPageSample = null;
  if (document.fullscreenElement === $('reader')) void document.exitFullscreen().catch(() => {});
  ++searchVersion;
  $('search-results').replaceChildren();
  $('book-search-form').reset();
  $('cancel-book-search').hidden = true;
  $('search-status').textContent = '';
  previousPlace = null;
  $("return-position").hidden = true;
  ++state.openingId;
  ++state.turnSequence;

  clearTimeout(chromeTimer);
  queuedTurn=0;pageTurnActive=false;
  state.isOpen = false;
  state.isLoading = false;
  state.isNavigating = false;
  state.locationsReady = false;
  $("reader-seek").disabled = true;
  $("quiet-percent").textContent = "Preparing…";
  state.currentLocation = null;
  state.currentCfi = null;

  resetPageTurn();

  if (state.rendition) {
    try {
      state.rendition.destroy();
    } catch (error) {
      console.warn(
        "Reader cleanup warning:",
        error
      );
    }
  }

  state.rendition = null;
  highlightedCfis.clear();

  if (state.book) {
    try {
      state.book.destroy();
    } catch (error) {
      console.warn(
        "EPUB cleanup warning:",
        error
      );
    }
  }

  state.book = null;

  $("epub-viewer").replaceChildren();
  $("epub-viewer").hidden = true;

  $("reader-page-arrows").hidden = true;
  $("reader-menu-toggle").hidden = true;

  $("reader").hidden = true;
  $("library").hidden = false;

  setControlsVisible(false);
  showStatus("");

  saveState();
  renderLibrary();
}

/* Reader workspace: device-local preferences and navigation. */
const fontFamilies = {
  literary: "Georgia, 'Times New Roman', serif",
  classic: "Palatino, 'Palatino Linotype', 'Book Antiqua', serif",
  clean: "Arial, Helvetica, sans-serif"
};
const appearance = {font: 'literary', spacing: '1.7', width: '760', alignment: 'left', motion: 'gentle'};
let bookmarkDetails = {};
let previousPlace = null;
let panelTrigger = null;
let chapterItems = [];
let searchVersion = 0;
let annotations = [];
let readingPace = {wpm:220,samples:0};
let lastPageSample = null;
let selectedPassage = null;
const highlightedCfis = new Set();
function validAnnotation(item) {
  return item && typeof item.id === 'string' && typeof item.cfi === 'string' && item.cfi.startsWith('epubcfi(')
    && typeof item.quote === 'string' && item.quote.length <= 4000 && typeof item.note === 'string' && item.note.length <= 6000
    && typeof item.chapter === 'string' && item.chapter.length <= 500;
}
// The personalised watermark lives on the reader shell. Fixed elements inside
// EPUB columns inflate their scroll width on each pagination pass.
function renderHighlights() {
  if (!state.rendition) return;
  for (const item of annotations) {
    if (!item.quote || highlightedCfis.has(item.cfi)) continue;
    try {
      state.rendition.annotations.highlight(item.cfi,{id:item.id},() => {openPanel('notebook',$('open-notebook'));},'bp-saved-highlight', {fill:'#bf9c54','fill-opacity':'0.3','mix-blend-mode':'multiply'});
      highlightedCfis.add(item.cfi);
    } catch { /* Saved text remains available in the notebook if an edition changed. */ }
  }
}
function renderNotebook() {
  const host = $('notebook-list'); host.replaceChildren();
  if (!annotations.length) {host.textContent = 'Your notebook is waiting. Keep a passage or leave a thought on your current page.'; return;}
  for (const item of annotations.slice().reverse()) {
    const card = document.createElement('article'); card.className = 'notebook-card';
    const title = document.createElement('button'); title.className = 'chapter-link'; title.type = 'button'; title.textContent = item.chapter || 'Saved page'; title.onclick = () => void jumpTo(item.cfi);
    const quote = document.createElement('blockquote'); quote.textContent = item.quote;
    const label = document.createElement('label'); label.textContent = 'Your private note';
    const input = document.createElement('textarea'); input.maxLength = 6000; input.rows = 3; input.value = item.note; label.append(input);
    const actions = document.createElement('div'); actions.className = 'notebook-actions';
    const save = document.createElement('button'); save.type = 'button'; save.className = 'control'; save.textContent = 'Save note';
    save.onclick = () => {item.note = input.value.trim(); saveState(); save.textContent = 'Saved';};
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'control'; remove.textContent = 'Delete';
    remove.onclick = () => {
      if (!confirm('Delete this saved passage and note?')) return;
      annotations = annotations.filter(a => a.id !== item.id);
      if (!annotations.some(a => a.cfi === item.cfi && a.quote)) {
        try {state.rendition?.annotations.remove(item.cfi,'highlight');} catch {}
        highlightedCfis.delete(item.cfi);
      }
      saveState(); renderNotebook();
    };
    actions.append(save,remove); card.append(title); if (item.quote) card.append(quote); card.append(label,actions); host.append(card);
  }
}
function addAnnotation(passage) {
  if (!passage?.cfi || annotations.length >= 500) {showStatus('This notebook can hold up to 500 saved places.'); return;}
  annotations.push({id:crypto.randomUUID(),cfi:passage.cfi,quote:passage.quote || '',note:'',chapter:passage.chapter || chapterName(),createdAt:new Date().toISOString()});
  $('selection-tools').hidden = true; selectedPassage = null;
  saveState(); renderHighlights();
  if ($('reader-panel').open) renderNotebook(); else openPanel('notebook',$('open-notebook'));
}
function pageWordEstimate() {
  const content = state.rendition?.getContents()?.[0];
  const text = content?.document?.body?.textContent || '';
  const total = state.currentLocation?.start?.displayed?.total || 1;
  return Math.max(20,text.trim().split(/\s+/u).length / total);
}
function sampleReadingPace() {
  const now = performance.now();
  const cfi = getCurrentCfi();
  const chapter = state.currentLocation?.start?.href;
  if (!cfi || !state.isOpen || document.hidden) {lastPageSample = null; return;}
  if (lastPageSample && lastPageSample.cfi === cfi) return;
  if (lastPageSample && lastPageSample.chapter === chapter && !state.isLoading) {
    const seconds = (now - lastPageSample.time) / 1000;
    if (seconds >= 8 && seconds <= 180) {
      const measured = lastPageSample.words / seconds * 60;
      if (measured >= 60 && measured <= 700) {readingPace.wpm = readingPace.samples ? readingPace.wpm * .8 + measured * .2 : measured; readingPace.samples++;}
    }
  }
  lastPageSample = {cfi,chapter,time:now,words:pageWordEstimate()};
}
function chapterTimeRemaining() {
  const displayed = state.currentLocation?.start?.displayed;
  if (!displayed?.total || !displayed.page) return '';
  const minutes = Math.ceil(Math.max(0,displayed.total-displayed.page) * pageWordEstimate() / readingPace.wpm);
  return `${minutes < 1 ? '<1' : minutes} min left in chapter${readingPace.samples < 3 ? ' (estimate)' : ''}`;
}
$('save-highlight').onclick = () => addAnnotation(selectedPassage);
$('dismiss-selection').onclick = () => {$('selection-tools').hidden = true; selectedPassage = null;};
$('add-page-note').onclick = () => {const cfi = getCurrentCfi(); if (cfi) addAnnotation({cfi,chapter:chapterName()});};
for (const id of ['library-search','library-status','library-sort','library-availability','library-collection']) $(id).addEventListener(id === 'library-search' ? 'input' : 'change',renderLibrary);
$('load-synced').onclick = async () => {
  if (!readingAccount || state.isOpen || switchingEdition) return;
  if (!confirm('Load this book’s synced reading data? Any unsynced local changes for this book will be replaced.')) return;
  try {const data = await readingAccount.useServerCopy(); restorePreferences(data); localStorage.setItem(STORAGE_KEY,JSON.stringify(snapshot())); renderLibrary();} catch (e) {reportSync(e.message);}
};
document.addEventListener('visibilitychange', () => {lastPageSample = null; if (document.hidden) void readingAccount?.flush();});
window.addEventListener('online', () => void readingAccount?.flush());

function restorePreferences(stored) {
  state.theme = allowedThemes.includes(stored.theme) ? stored.theme : 'parchment';
  state.fontSize = Number.isFinite(stored.fontSize) ? clamp(stored.fontSize, 15, 30) : 19;
  state.position = typeof stored.position === 'string' && stored.position.startsWith('epubcfi(') ? stored.position : null;
  annotations = Array.isArray(stored.annotations) ? stored.annotations.filter(validAnnotation).slice(0,500) : [];
  readingPace = stored.readingPace && Number.isFinite(stored.readingPace.wpm) ? {wpm:clamp(stored.readingPace.wpm,60,700),samples:clamp(Number(stored.readingPace.samples)||0,0,100)} : {wpm:220,samples:0};
  lastPageSample = null;
  state.progress = Number.isFinite(stored.progress) ? clamp(stored.progress, 0, 100) : 0;
  state.bookmarks = Array.isArray(stored.bookmarks) ? stored.bookmarks.filter(c => typeof c === 'string' && c.startsWith('epubcfi(')) : [];
  state.hasStarted = stored.hasStarted === true;
  state.lastChapter=typeof stored.lastChapter==='string'?stored.lastChapter.slice(0,500):'';
  state.lastReadAt=Number.isFinite(stored.lastReadAt)?stored.lastReadAt:0;
  Object.assign(appearance, {font:'literary',spacing:'1.7',width:'760',alignment:'left',motion:'gentle'});
  const options = {font: Object.keys(fontFamilies), spacing: ['1.5','1.7','1.9'], width: ['620','760','920'], alignment: ['left','justify'], motion: ['gentle','instant']};
  for (const key of Object.keys(options)) {
    if (options[key].includes(stored.appearance?.[key])) appearance[key] = stored.appearance[key];
  }
  bookmarkDetails = stored.bookmarkDetails && typeof stored.bookmarkDetails === 'object' && !Array.isArray(stored.bookmarkDetails) ? stored.bookmarkDetails : {};
  for (const [key, id] of Object.entries({font:'reader-font',spacing:'reader-spacing',width:'reader-width',alignment:'reader-alignment',motion:'reader-motion'})) $(id).value = appearance[key];
}
function chapterName(href = state.currentLocation?.start?.href) {
  const path = String(href || '').split('#')[0];
  return chapterItems.find(c => c.href.split('#')[0] === path)?.label || BOOK.title;
}
function closePanel() {
  if ($('reader-panel').open) {
    $('reader-panel').close();
    panelTrigger?.focus();
  }
}
function openPanel(kind, trigger) {
  if (!state.isOpen || state.isLoading) return;
  panelTrigger = trigger;
  lastPageSample = null;
  for (const name of ['appearance','contents','bookmarks','search','notebook']) $('panel-' + name).hidden = name !== kind;
  $('reader-panel-title').textContent = {appearance:'Your perfect page',contents:'Inside this book',bookmarks:'Saved places',search:'Between the lines',notebook:'Your private notebook'}[kind];
  if (kind === 'bookmarks') renderBookmarks();
  if (kind === 'notebook') renderNotebook();
  if (kind === 'contents') {
    const current = String(state.currentLocation?.start?.href || '').split('#')[0];
    $('chapter-list').querySelectorAll('button').forEach((button, i) => {
      if (chapterItems[i]?.href.split('#')[0] === current) button.setAttribute('aria-current', 'location');
      else button.removeAttribute('aria-current');
    });
  }
  $('reader-panel').showModal();
  (kind === 'search' ? $('book-search') : $('close-panel')).focus();
}
function renderContents() {
  chapterItems = [];
  const list = $('chapter-list'); list.replaceChildren();
  function walk(items, depth = 0) {
    for (const item of items || []) {
      if (typeof item.href !== 'string') continue;
      const label = String(item.label || 'Untitled chapter').trim();
      chapterItems.push({href:item.href, label});
      const button = document.createElement('button'); button.type = 'button'; button.className = 'chapter-link'; button.textContent = label;
      button.style.paddingLeft = (16 + Math.min(depth, 5) * 16) + 'px';
      button.onclick = () => void jumpTo(item.href);
      list.append(button); walk(item.subitems, depth + 1);
    }
  }
  walk(state.book?.navigation?.toc);
  if (!chapterItems.length) list.textContent = 'This edition does not include a chapter list.';
}
async function jumpTo(target, remember = true) {
  if (!state.rendition || state.isNavigating || state.isLoading) return;
  const current = getCurrentCfi();
  lastPageSample = null;
  const opening = state.openingId;
  state.isNavigating = true; updateReaderProgress();
  try {
    await state.rendition.display(target);
    if (opening !== state.openingId) return;
    if (remember && current) { previousPlace = current; $('return-position').hidden = false; }
    closePanel();
  } catch { showStatus('That place could not be opened. Your reading position has been kept.'); }
  finally { if (opening === state.openingId) {state.isNavigating = false; updateReaderProgress();} }
}
function renderBookmarks() {
  const list = $('bookmark-list'); list.replaceChildren();
  if (!state.bookmarks.length) {list.textContent = 'No saved places yet. Tap Bookmark while reading to keep a page here.'; return;}
  state.bookmarks.forEach((cfi, i) => {
    const row = document.createElement('div'); row.className = 'saved-place';
    const jump = document.createElement('button'); jump.type = 'button'; jump.className = 'chapter-link';
    const detail = bookmarkDetails[cfi];
    jump.textContent = typeof detail?.label === 'string' ? detail.label : `Saved place ${i + 1}`;
    const sub = document.createElement('small'); sub.textContent = typeof detail?.progress === 'number' ? `${detail.progress}% through the book` : 'Open this page'; jump.append(sub);
    jump.onclick = () => void jumpTo(cfi);
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'control'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', 'Remove ' + jump.textContent);
    remove.onclick = () => {state.bookmarks = state.bookmarks.filter(c => c !== cfi); delete bookmarkDetails[cfi]; saveState(); updateBookmarkButton(); renderBookmarks();};
    row.append(jump, remove); list.append(row);
  });
}
function handleReadingKeys(event) {
  if (!state.isOpen || $('reader-panel').open || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.target?.closest?.('input,select,textarea,[contenteditable]')) return;
  if (['ArrowRight','PageDown','ArrowLeft','PageUp'].includes(event.key)) {
    event.preventDefault(); void changePage(['ArrowRight','PageDown'].includes(event.key) ? 1 : -1);
  }
}
for (const name of ['contents','appearance','bookmarks','search','notebook']) $('open-' + name).onclick = event => openPanel(name, event.currentTarget);
$('close-panel').onclick = closePanel;
$('reader-panel').addEventListener('click', event => {if (event.target === $('reader-panel')) {const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closePanel();}});
for (const [key, id] of Object.entries({font:'reader-font',spacing:'reader-spacing',width:'reader-width',alignment:'reader-alignment',motion:'reader-motion'})) {
  $(id).onchange = () => {
    appearance[key] = $(id).value;
    applyReaderPreferences();
    if (key === 'width') resizeReaderViewport();
    saveState();
  };
}
$('cancel-book-search').onclick = () => {
  ++searchVersion;
  $('cancel-book-search').hidden = true;
  $('search-status').textContent = 'Search stopped. Any matches already found are kept below.';
  $('book-search').focus();
};
$('book-search-form').onsubmit = async event => {
  event.preventDefault();
  const query = $('book-search').value.trim();
  if (query.length < 2 || !state.book || state.isLoading) return;
  const version = ++searchVersion;
  const book = state.book;
  const output = $('search-results'); output.replaceChildren();
  $('cancel-book-search').hidden = false;
  $('search-status').textContent = 'Searching your book…';
  let count = 0, checked = 0;
  const sections = book.spine.spineItems;
  try {
    // Search independently loaded XML; never unload or replace the visible page.
    for (const section of sections) {
      if (version !== searchVersion || book !== state.book) return;
      const response = await book.load(section.url);
      if (version !== searchVersion || book !== state.book) return;
      const original = section.document;
      const originalContents = section.contents;
      let found;
      try {
        section.document = response;
        section.contents = response.documentElement;
        found = section.find(query);
      } finally {
        section.document = original;
        section.contents = originalContents;
      }
      const chapter = chapterItems.find(item => item.href.split('#')[0] === section.href.split('#')[0]);
      for (const result of found) {
        if (count >= 100) break;
        const button = document.createElement('button'); button.type = 'button'; button.className = 'chapter-link';
        button.textContent = result.excerpt;
        if (chapter) {const label = document.createElement('small'); label.textContent = chapter.label; button.prepend(label);}
        button.onclick = () => void jumpTo(result.cfi);
        output.append(button); count++;
      }
      checked++;
      $('search-status').textContent = `Searched ${checked} of ${sections.length} sections · ${count} matching passages`;
      if (count >= 100) break;
      // Keep stop controls responsive even when cached sections load immediately.
      await new Promise(resolve => setTimeout(resolve,0));
    }
    if (version === searchVersion) $('search-status').textContent = count ? `${count === 100 ? 'First ' : ''}${count} matching passages` : 'No matching passages. Try another word or phrase.';
  } catch {
    if (version === searchVersion) $('search-status').textContent = 'Search could not finish. Please try again.';
  } finally {
    if (version === searchVersion) $('cancel-book-search').hidden = true;
  }
};
$('reader-fullscreen').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($('reader').requestFullscreen) await $('reader').requestFullscreen();
    else showStatus('Full screen is not supported by this browser. The reader already fills your window.');
  } catch {showStatus('Full screen is unavailable in this browser.');}
};
document.addEventListener('fullscreenchange', () => {$('reader-fullscreen').textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen'; state.rendition?.resize();});
$('reader-seek').oninput = () => {$('seek-value').value = $('reader-seek').value + '%';};
$('reader-seek').onchange = () => {
  if (!state.locationsReady || !state.book) return;
  const target = state.book.locations.cfiFromPercentage(Number($('reader-seek').value) / 100);
  if (target) void jumpTo(target);
};
$('return-position').onclick = async () => {if (previousPlace) {await jumpTo(previousPlace, false); previousPlace = null; $('return-position').hidden = true;}};
$('bookmark').addEventListener('click', () => {
  const cfi = getCurrentCfi();
  if (cfi) {bookmarkDetails[cfi] = {label:chapterName(),progress:state.progress}; saveState();}
});
supabase.auth.onAuthStateChange((event,session) => {
  if(event==='SIGNED_IN'&&activeUser&&session?.user?.id&&session.user.id!==activeUser.id){
    const previousUser=activeUser.id;sessionEpoch++;readingAccount?.stop();checkoutController?.stop();closeBook();activeUser=null;offlineRows.clear();arcConsent.clear();
    localStorage.removeItem(offlineAccountKey);void offlineLibrary.clear(previousUser).catch(()=>{});location.reload();return;
  }
  if (event === 'SIGNED_OUT') {
    const signedOutId=activeUser?.id||localStorage.getItem(offlineAccountKey);
    localStorage.removeItem(offlineAccountKey);if(signedOutId)void offlineLibrary.clear(signedOutId).catch(()=>{});offlineRows.clear();arcConsent.clear();
    sessionEpoch++; readingAccount?.stop(); checkoutController?.stop(); activeUser = null;
    membershipStatus={known:false,active:false,expiresAt:null};
    lastVerifiedMembershipActive=false;
    $('reading-membership-summary').hidden=true;$('reading-membership-text').textContent='';
    closeBook(); $('library').hidden = true; $('reader-access').hidden = false;
    $('access-message').textContent = 'Your session has ended. Sign in through The Archivists to continue.';
    state.bookmarks = []; bookmarkDetails = {}; annotations = [];
    $('reading-setup-result').textContent='';$('check-reading-setup').hidden=true;$('preview-reading-checkout').hidden=true;$('reading-reconcile-form').hidden=true;
    $('chapter-list').replaceChildren(); $('bookmark-list').replaceChildren(); $('notebook-list').replaceChildren();
  }
});

/* =====================================================
   BUTTON EVENTS
   ===================================================== */

$("back-to-library").addEventListener(
  "click",
  closeBook
);

$("previous").addEventListener(
  "click",
  () => void changePage(-1)
);

$("next").addEventListener(
  "click",
  () => void changePage(1)
);

$("page-arrow-left").addEventListener(
  "click",
  () => void changePage(-1)
);

$("page-arrow-right").addEventListener(
  "click",
  () => void changePage(1)
);

$("reader-menu-toggle").addEventListener(
  "click",
  () => {
    setControlsVisible(
      $("reader-controls").hidden
    );
  }
);

$("font-smaller").addEventListener(
  "click",
  () => {
    state.fontSize = Math.max(
      15,
      state.fontSize - 1
    );

    saveState();
    applyReaderPreferences();

    showStatus(
      `Text size: ${state.fontSize}px`
    );
  }
);

$("font-larger").addEventListener(
  "click",
  () => {
    state.fontSize = Math.min(
      30,
      state.fontSize + 1
    );

    saveState();
    applyReaderPreferences();

    showStatus(
      `Text size: ${state.fontSize}px`
    );
  }
);

document.querySelectorAll('[data-reading-theme]').forEach(button=>button.addEventListener('click',()=>{
  $('reading-theme').value=button.dataset.readingTheme;
  $('reading-theme').dispatchEvent(new Event('change'));
}));
$("reading-theme").addEventListener(
  "change",
  event => {
    const requested = event.target.value;

    if (!allowedThemes.includes(requested)) {
      return;
    }

    state.theme = requested;

    saveState();
    applyReaderPreferences();

    showStatus(
      `Page colour: ${{day:'White',parchment:'Off-white',night:'Dark'}[requested]}`
    );
  }
);

$("bookmark").addEventListener(
  "click",
  () => {
    const cfi = getCurrentCfi();

    if (!cfi) {
      showStatus(
        "Reading position is not ready."
      );
      return;
    }

    const existing =
      state.bookmarks.indexOf(cfi);

    if (existing >= 0) {
      state.bookmarks.splice(
        existing,
        1
      );

      showStatus(
        "Bookmark removed."
      );
    } else {
      state.bookmarks.push(cfi);

      showStatus(
        "Page bookmarked."
      );
    }

    saveState();
    updateBookmarkButton();
  }
);

/* =====================================================
   KEYBOARD
   ===================================================== */

document.addEventListener(
  "keydown",
  event => {
    if (event.key === "Escape" && $("reader-panel").open) {
      event.preventDefault();
      closePanel();
      return;
    }
    handleReadingKeys(event);
    if (!state.isOpen) {
      return;
    }

    if (event.key === "Escape") {
      if (!$("reader-controls").hidden) {
        setControlsVisible(false);
      } else {
        closeBook();
      }
    }
  }
);

/* =====================================================
   ADMIN GATE
   ===================================================== */

$('reading-reconcile-form').onsubmit=async event=>{
  event.preventDefault();
  if(!activeUser?.isAdmin)return;
  const value=$('reading-reconcile-order').value.trim();
  let body;
  if(/^#[0-9]{1,20}$/.test(value))body={orderName:value};
  else {
    const urlId=/^https:\/\/admin\.shopify\.com\/store\/[^/]+\/orders\/([0-9]+)(?:[/?#]|$)/.exec(value)?.[1];
    const id=urlId||(/^[0-9]{1,25}$/.test(value)?value:null);
    if(!id){$('reading-setup-result').textContent='Enter an order number such as #1017, a numeric Shopify order ID, or its admin URL.';return;}
    body={orderId:id};
  }
  const button=$('reading-reconcile-submit'),output=$('reading-setup-result');
  button.disabled=true;output.textContent='Verifying the existing Shopify order. No new payment is being created…';
  try {
    const {data,error}=await supabase.functions.invoke('bp-reading-reconcile-order',{body});
    if(!activeUser?.isAdmin)return;
    let result=data;
    if(error?.context?.clone)try{result=await error.context.clone().json();}catch{}
    if(!result)throw Error();
    const summary=typeof result.message==='string'?result.message:typeof result.error==='string'?result.error:'Order verification did not complete.';
    const phase=typeof result.phase==='string'&&/^[A-Z_]{1,60}$/.test(result.phase)?' Check: '+result.phase+'.':'';
    const code=typeof result.code==='string'&&/^[A-Z0-9_]{1,300}$/.test(result.code)?' Detail: '+result.code+'.':'';
    output.textContent=summary+phase+code+(summary==='Membership payment recorded'?' Return to the test-member window and click Check payment or refresh the library.':' No new payment has been made.');
  }catch{if(activeUser?.isAdmin)output.textContent='Order recovery is unavailable. Confirm bp-reading-reconcile-order is deployed with JWT verification on. Do not repeat the payment.';}
  finally{button.disabled=false;}
};

$('preview-reading-checkout').onclick=async()=>{
  if(!activeUser?.isAdmin)return;
  if(!confirm('This opens a REAL Shopify checkout for £20 per year. Inspect it only; do not complete payment during this preview. Continue?'))return;
  const popup=window.open('about:blank','bp-reading-admin-preview','popup,width=620,height=820,resizable=yes,scrollbars=yes');
  const button=$('preview-reading-checkout'),output=$('reading-setup-result');
  if(!popup){output.textContent='Allow popups for this site, then try the checkout preview again.';return;}
  try{popup.opener=null;popup.document.body.textContent='Preparing the annual checkout preview…';}catch{}
  button.disabled=true;
  try{
    const result=await supabase.functions.invoke('bp-reading-create-checkout',{body:{action:'admin_preview'}});
    if(!activeUser?.isAdmin){popup.close();return;}
    if(result.error||!result.data?.checkoutUrl||result.data.preview!==true)throw Error();
    const target=new URL(result.data.checkoutUrl);
    if(target.protocol!=='https:')throw Error();
    if(!popup.closed)popup.location.replace(target.href);
    output.textContent='Annual checkout created with the verified £20 GBP plan. Check the price, yearly renewal and absence of shipping in Shopify. Do not complete payment during this preview.';
  }catch{popup.close();if(activeUser?.isAdmin)output.textContent='Checkout preview failed. Check that bp-reading-create-checkout has the latest index.ts and handler.ts, then inspect its Supabase logs. Customer checkout remains disabled.';}
  finally{button.disabled=false;}
};

$('check-reading-setup').onclick=async()=>{
  if(!activeUser?.isAdmin)return;
  const button=$('check-reading-setup'),output=$('reading-setup-result');
  button.disabled=true;output.textContent='Checking Shopify configuration without creating a checkout…';
  try {
    const {data,error}=await supabase.functions.invoke('bp-reading-setup-check',{body:{}});
    if(!activeUser?.isAdmin)return;
    if(error||!Array.isArray(data?.checks))throw Error();
    output.textContent=data.checks.map(check=>`${check.ok?'PASS':'CHECK'} · ${check.name}: ${check.detail}`).join('\n')+(typeof data.note==='string'?'\n'+data.note:'');
  }catch{if(activeUser?.isAdmin)output.textContent='Setup check is not available. Confirm the bp-reading-setup-check function is deployed and you are signed in as an administrator.';}
  finally{button.disabled=false;}
};

setInterval(()=>{
  if(navigator.onLine||!activeUser)return;
  const current=offlineRows.get(offlineBookKey(BOOK));
  if(state.isOpen&&current&&current.expiresAt<=Date.now()){
    closeBook();showLibraryError('Offline access for this book has expired. Reconnect to refresh it.');
    libraryBooks=libraryBooks.map(book=>offlineBookKey(book)===current.id?{...book,canRead:false}:book);renderLibrary();
    void offlineLibrary.remove(activeUser.id,current.id).catch(()=>{});offlineRows.delete(current.id);
  }
},30000);
window.addEventListener('offline',async()=>{
  if(!activeUser)return;
  if(ARC_MODE){await refreshOfflineRows();if(state.isOpen&&!offlineRows.has(offlineBookKey(BOOK)))closeBook();libraryBooks=libraryBooks.map(book=>({...book,arcReference:offlineRows.get(offlineBookKey(book))?.book.arcReference||book.arcReference,canRead:offlineRows.has(offlineBookKey(book))}));renderLibrary();$('reading-offline-status').textContent='Offline · saved personalised ARC copies remain available until their saved deadline. Reconnect to renew access or file a review.';return;}
  await refreshOfflineRows();
  libraryBooks=libraryBooks.map(book=>({...book,canRead:offlineRows.has(offlineBookKey(book))}));
  $('reading-offline-status').textContent=offlineRows.size ? 'Offline · saved books can open. Books marked “Save online first” need to be saved while connected; you do not need another subscription.' : 'Offline · no usable saved copies were found. Reconnect, choose Save offline and wait for the saved confirmation. Your existing membership has not changed.';
  renderLibrary();
});
window.addEventListener('online',async()=>{
  if(!activeUser)return;
  $('reading-offline-status').textContent='Connection restored. Refresh the library to verify access and sync your reading place.';
  if(!state.isOpen)location.reload();else if(ARC_MODE)void checkOpenArcAccess();
});
let arcAccessChecking=false;
async function checkOpenArcAccess(){
 if(!ARC_MODE||!activeUser||!state.isOpen||!isArcBook(BOOK)||arcAccessChecking||!navigator.onLine)return;
 const assignment=BOOK.arcAssignmentId,epoch=sessionEpoch;arcAccessChecking=true;
 try{const result=await requestArc(supabase,SUPABASE_URL,SUPABASE_ANON_KEY,BOOK,{check:true});const saved=offlineRows.get(offlineBookKey(BOOK));if(saved&&Date.parse(result.offlineUntil)<saved.expiresAt-1000){await offlineLibrary.remove(activeUser.id,saved.id);await refreshOfflineRows();}}
 catch(error){if(epoch===sessionEpoch&&BOOK.arcAssignmentId===assignment&&state.isOpen){closeBook();if([401,403,404].includes(error.status)){await offlineLibrary.remove(activeUser.id,offlineBookKey(BOOK));await refreshOfflineRows();renderLibrary();}showLibraryError('ARC access could not be verified. Reconnect and refresh your assignments.');}}
 finally{arcAccessChecking=false;}
}
setInterval(()=>void checkOpenArcAccess(),60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void checkOpenArcAccess();});
async function initialiseArcShelf(){
 const result=await supabase.rpc('bp_arc_reading_catalogue');
 if(result.error)throw Error('The ARC pilot database is not ready.');
 libraryBooks=arcReadingBooks(result.data);catalogueVerified=true;plannedCatalogueLoaded=true;
 await refreshOfflineRows();
 for(const saved of offlineRows.values()){if(!isArcBook(saved.book))continue;const assigned=libraryBooks.find(book=>book.arcAssignmentId===saved.book.arcAssignmentId);if(!assigned?.canRead){await offlineLibrary.remove(activeUser.id,saved.id);continue;}try{const check=await requestArc(supabase,SUPABASE_URL,SUPABASE_ANON_KEY,assigned,{check:true});if(!Number.isFinite(Date.parse(check.offlineUntil))||Date.parse(check.offlineUntil)<saved.expiresAt-1000)await offlineLibrary.remove(activeUser.id,saved.id);}catch(error){if([401,403,404].includes(error.status))await offlineLibrary.remove(activeUser.id,saved.id);}}
 await refreshOfflineRows();
 membershipOfferNode=$('reading-membership-offer');membershipOfferNode?.remove();$('reading-membership-summary').hidden=true;
 $('reading-offline-status').textContent='Private ARC assignments · save personalised copies for offline reading after accepting the terms. Your place and notebook stay on this device.';
 document.querySelector('.library h1').textContent='Your ARC reading room';
 document.querySelector('.library-note').textContent='Only your assigned ARC editions appear here. Accept the copyright terms before reading. Review records remain in your member area.';
 $('load-synced').disabled=true;
 renderLibrary();$('reader-access').hidden=true;$('library').hidden=false;document.documentElement.classList.add('bp-reader-verified');
 if(!libraryBooks.length)showLibraryError('No in-reader ARC assignments are available for this account yet.');
}
async function initialise() {
  const heading=document.querySelector('.library h1');
  if(parseFloat(getComputedStyle(heading).fontSize)>28)heading.style.fontSize='28px';
  const epoch = sessionEpoch;
  renderLibrary();

  try {
    if(!navigator.onLine){await initialiseOffline();return;}
    const user = await verifyBPReadingUser();
    if (epoch !== sessionEpoch) return;
    activeUser = user;
    if(ARC_MODE){await initialiseArcShelf();return;}
    $("reading-membership-offer").hidden = true;
    membershipOfferNode=$("reading-membership-offer");
    $("check-reading-setup").hidden = !user.isAdmin;
    $("preview-reading-checkout").hidden = !user.isAdmin;
    $("reading-reconcile-form").hidden = !user.isAdmin;
    checkoutController = initializeReadingCheckout(supabase,{button:$("subscribe-reading"),status:$("reading-payment-status"),retry:$("check-reading-payment")});
    $('reader-watermark').textContent = 'Personal reading copy · Reader ' + user.id.slice(0,8).toUpperCase();
    await loadReadingCatalogue();
    if (!activeUser || epoch !== sessionEpoch) return;
    await refreshOfflineRows();
    for(const row of offlineRows.values()) {
      const matched=libraryBooks.find(book=>book.editionId===row.book.editionId);
      if(!isArcBook(row.book)&&!row.book.publicTextId&&catalogueVerified&&(!matched||(matched.accessVerified&&!matched.canRead)))await offlineLibrary.remove(user.id,row.id);
    }
    await refreshOfflineRows();
    const firstReadable = libraryBooks.find(book=>book.canRead);
    if (firstReadable) await connectEdition(firstReadable);
    else reportSync("Your collection is listed below. Reading editions will become available when prepared and authorised.");
    if (!activeUser || epoch !== sessionEpoch) return;
    renderLibrary();
    $("reader-access").hidden = true;
    $("library").hidden = false;

    document.documentElement.classList.add(
      "bp-reader-verified"
    );
  } catch (error) {
    console.warn(
      "BP Reading access denied:",
      error.message
    );

    $("access-message").textContent = navigator.onLine ? "Your library could not be opened. Sign in through The Archivists, then try again." : "No valid offline library is available for this account. Reconnect and sign in to save or refresh your books.";
  }
}

await initialise();
