import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const ctx = {window:{}};
vm.runInNewContext(
  fs.readFileSync("js/bookshop-verification-core.js", "utf8"), ctx
);
const verify = ctx.window.BlackwoodVerification;
const make = (status, sourceUrl="", notes="", old=null) =>
  verify.createReview({status,sourceUrl,notes},old,"2026-11-22");

test("unreviewed legacy records are never silently considered verified", () => {
  assert.equal(verify.statusOf({name:"Existing shop"}),"unreviewed");
  assert.equal(verify.statusOf({verification:{status:"invalid"}}),"unreviewed");
  assert.equal(verify.statusOf({verification:{status:"verified-independent"}}),
    "verified-independent");
});

test("independence requires explicit human choice and a valid evidence link", () => {
  assert.throws(()=>make("verified-independent"),/evidence URL/);
  assert.throws(()=>make("verified-independent","javascript:alert(1)"),/HTTP or HTTPS/);
  const v=make("verified-independent","https://example.org/about","Shop information checked");
  assert.equal(v.sourceUrl,"https://example.org/about");
  assert.equal(v.status,"verified-independent");
  assert.equal(v.checkedAt,"2026-11-22");
});

test("exclusions must have a recorded reason or evidence", () => {
  assert.throws(()=>make("closed"),/reason/);
  assert.throws(()=>make("not-independent"),/reason/);
  assert.equal(make("closed","","Permanently closed").status,"closed");
  assert.equal(make("not-independent","https://example.org","").status,"not-independent");
});

test("a unchanged review keeps the prior date; altered evidence gets a new date", () => {
  const old={
    status:"needs-review",sourceUrl:"https://example.org/",
    notes:"Checking",checkedAt:"2026-11-01"
  };
  const unchanged=make("needs-review","https://example.org/","Checking",old);
  assert.equal(unchanged.checkedAt,"2026-11-01");
  const changed=make("needs-review","https://other.example/","Checking",old);
  assert.equal(changed.checkedAt,"2026-11-22");
});

test("evidence links reject credentials and non-web protocols", () => {
  assert.equal(verify.evidenceUrl("mailto:shop@example.org"),"");
  assert.equal(verify.evidenceUrl("https://name:password@example.org/"),"");
  assert.equal(verify.evidenceUrl("https://example.org/"),"https://example.org/");
});

test("discovery completeness improves review priority but cannot mark verified", () => {
  assert.ok(verify.candidateScore({website:"https://example.org",town:"Glasgow",address:"Here"}) >
    verify.candidateScore({town:"Glasgow"}));
  assert.equal(verify.statusOf({website:"https://example.org"}),"unreviewed");
});

test("existing outreach storage key, contact history, and export remain present", () => {
  const app=fs.readFileSync("js/bookshop-outreach.js","utf8");
  assert.match(app,/blackwood-bookshop-outreach-v1/);
  assert.match(app,/function exportJSON\(/);
  assert.match(app,/contactHistory:/);
  assert.match(app,/BlackwoodReviewDesk\?\.initialise/);
  assert.match(app,/verificationFilter/);
});

test("candidate module only saves after explicit click and does not send email", () => {
  const moduleText=fs.readFileSync("js/bookshop-verification-desk.js","utf8");
  assert.match(moduleText,/save\.addEventListener\("click"/);
  assert.match(moduleText,/saveShops\(\[\.\.\.api\.getShops\(\), saved\]\)/);
  assert.doesNotMatch(moduleText,/functions\.invoke|sendPreparedEmailViaOutlook|mailto:/);
});
