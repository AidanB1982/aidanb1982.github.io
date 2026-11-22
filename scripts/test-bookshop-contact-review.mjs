import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const ctx = {window:{}, URL, Date};
vm.runInNewContext(
  fs.readFileSync("js/bookshop-verification-core.js", "utf8"), ctx
);
vm.runInNewContext(
  fs.readFileSync("js/bookshop-contact-review-core.js", "utf8"), ctx
);
const verify = ctx.window.BlackwoodVerification;
const contact = ctx.window.BlackwoodContactReview;
const shop = () => ({
  id:"1", name:"Example Books", status:"prospect",
  reviewOrigin:"public-directory", email:"",
  verification:{status:"verified-independent",sourceUrl:"https://example.org/about"}
});

test("unsaved and unreviewed directory candidates cannot open outreach", () => {
  const s = shop();
  assert.equal(contact.isReady(s), false);
  s.email = "shop@example.org";
  assert.equal(contact.isReady(s), false);
  s.verification.status = "needs-review";
  s.contactReview = {approved:true,email:s.email,
    sourceUrl:"https://example.org/contact",checkedAt:"2026-11-22"};
  assert.equal(contact.isReady(s), false);
});

test("human-reviewed contact must match current public email", () => {
  const s = shop();
  s.email = "shop@example.org";
  s.contactReview = contact.createReview({
    email:s.email,sourceUrl:"https://example.org/contact",
    notes:"Public trade enquiries",approved:true
  }, s, "2026-11-22");
  assert.equal(contact.isReady(s), true);
  s.email = "other@example.org";
  assert.equal(contact.isReady(s), false);
  s.email = "shop@example.org";
  s.status = "opted-out";
  assert.equal(contact.isReady(s), false);
});

test("a link and business address do not automatically authorise outreach", () => {
  const s = shop();
  s.email = "shop@example.org";
  const r = contact.createReview({
    email:s.email,sourceUrl:"https://example.org/contact",
    notes:"Trade enquiries need personal review",approved:false
  }, s, "2026-11-22");
  s.contactReview = r;
  assert.equal(r.approved, false);
  assert.equal(contact.isReady(s), false);
});

test("approval requires manual independence verification and no opt-out", () => {
  const s = shop();
  s.verification.status = "unreviewed";
  assert.throws(() => contact.createReview({
    email:"shop@example.org",sourceUrl:"https://example.org",approved:true
  }, s, "2026-11-22"), /Verify this shop/);
  s.verification.status = "verified-independent";
  s.status = "opted-out";
  assert.throws(() => contact.createReview({
    email:"shop@example.org",sourceUrl:"https://example.org",approved:true
  }, s, "2026-11-22"), /Do not approve/);
});

test("public source URLs disallow unsafe schemes and credentials", () => {
  assert.equal(contact.publicSourceUrl("javascript:alert(1)"), "");
  assert.equal(contact.publicSourceUrl("https://user:secret@example.org/"), "");
  assert.equal(contact.publicSourceUrl("mailto:hello@example.org"), "");
  assert.equal(contact.publicSourceUrl("https://example.org/contact"),
    "https://example.org/contact");
});

test("validated dates are real calendar dates", () => {
  assert.equal(contact.validCheckedDate("2026-02-29"), false);
  assert.equal(contact.validCheckedDate("2024-02-29"), true);
  assert.equal(contact.validCheckedDate("2026-11-22"), true);
});

test("changing contact details updates check date; identical evidence retains it", () => {
  const s = shop();
  const input = {email:"shop@example.org",sourceUrl:"https://example.org/contact",
    notes:"Shop page",approved:true};
  const old = contact.createReview(input,s,"2026-11-01");
  s.contactReview = old;
  assert.equal(contact.createReview(input,s,"2026-11-22").checkedAt,"2026-11-01");
  assert.equal(contact.createReview({...input,notes:"New page evidence"},s,
    "2026-11-22").checkedAt,"2026-11-22");
});

test("legacy saved records preserve prior contact behaviour", () => {
  const s = {name:"Legacy",email:"shop@example.org",status:"prospect"};
  assert.equal(contact.isReady(s),true);
  s.status="opted-out";
  assert.equal(contact.isReady(s),false);
});

test("source and manual permission controls are private, not auto-sending", () => {
  const desk = fs.readFileSync("js/bookshop-contact-review-desk.js","utf8");
  assert.match(desk,/api\.updateShopRecord\(shop\.id/);
  assert.doesNotMatch(desk,/functions\.invoke|sendPreparedEmailViaOutlook|mailto:/);
  const app = fs.readFileSync("js/bookshop-outreach.js","utf8");
  assert.match(app,/BlackwoodContactReview\?\.isReady\(shop\)/);
  assert.match(app,/BlackwoodContactDesk\?\.initialise/);
  assert.match(app,/blackwood-bookshop-outreach-v1/);
  assert.match(app,/function exportJSON\(/);
  assert.match(app,/function openContactDialog\(/);
});

test("reviewed contacts remain separate from verified independents and stockists", () => {
  const s = shop();
  s.status = "prospect";
  s.email="shop@example.org";
  s.contactReview=contact.createReview({
    email:s.email,sourceUrl:"https://example.org",approved:true
  },s,"2026-11-22");
  assert.equal(contact.isReady(s),true);
  assert.equal(s.status,"prospect");
  assert.equal(verify.statusOf(s),"verified-independent");
});
