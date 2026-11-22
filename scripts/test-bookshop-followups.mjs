import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = {window:{}, Date};
vm.runInNewContext(fs.readFileSync("js/bookshop-followup-core.js", "utf8"), context);
const core = context.window.BlackwoodFollowUps;
const today = "2026-11-22";
const shop = (id, status, followUpDate="", verification=null) => ({
  id, name:"Shop "+id, town:"Glasgow", status, followUpDate,
  verification, contactHistory:[]
});

test("classifies overdue, today, next fortnight and undated contact records", () => {
  assert.equal(core.bucketOf(shop("a","contacted","2026-11-20"),today),"overdue");
  assert.equal(core.bucketOf(shop("b","contacted",today),today),"today");
  assert.equal(core.bucketOf(shop("c","interested","2026-12-06"),today),"upcoming");
  assert.equal(core.bucketOf(shop("d","contacted"),today),"unscheduled");
  assert.equal(core.bucketOf(shop("e","interested"),today),"unscheduled");
  assert.equal(core.bucketOf(shop("f","contacted","2026-12-07"),today),"");
  assert.equal(core.bucketOf(shop("g","prospect"),today),"");
});

test("filters opt-outs, confirmed stockists, closures and non-independents", () => {
  for (const status of ["opted-out","stockist"]) {
    assert.equal(core.bucketOf(shop("x",status,"2026-11-01"),today),"");
  }
  for (const status of ["closed","not-independent"]) {
    assert.equal(core.bucketOf(shop("x","contacted","2026-11-01",{status}),today),"");
  }
});

test("rejects nonexistent calendar dates instead of declaring them overdue", () => {
  assert.equal(core.validDate("2026-02-29"),false);
  assert.equal(core.validDate("2024-02-29"),true);
  assert.equal(core.bucketOf(shop("a","contacted","2026-02-29"),today),"unscheduled");
});

test("14-day interval crosses month and year boundaries correctly", () => {
  assert.equal(core.addDays("2026-12-25",14),"2027-01-08");
  assert.equal(core.bucketOf(shop("x","contacted","2027-01-08"),"2026-12-25"),"upcoming");
  assert.equal(core.bucketOf(shop("x","contacted","2027-01-09"),"2026-12-25"),"");
});

test("tracks most recent valid date from existing contact history", () => {
  const item=shop("x","interested");
  item.contactHistory=[{date:"2026-11-11"},{date:"invalid"},
    {date:"2026-11-20"},{date:"2026-11-15"}];
  assert.equal(core.latestActivity(item),"2026-11-20");
});

test("groups have deterministic dates, order and totals", () => {
  const result=core.build([
    shop("z","contacted","2026-11-20"),
    shop("a","contacted","2026-11-18"),
    shop("b","contacted",today),
    shop("c","interested","2026-12-01"),
    shop("d","contacted"),
    shop("e","stockist","2026-11-18")
  ],today);
  assert.equal(result.totals.overdue,2);
  assert.equal(result.totals.today,1);
  assert.equal(result.totals.upcoming,1);
  assert.equal(result.totals.unscheduled,1);
  assert.equal(result.totals.all,5);
  assert.equal(result.groups.overdue[0].id,"a");
  assert.equal(result.groups.overdue[1].id,"z");
});

test("planning does not mutate original saved records", () => {
  const records=[shop("a","contacted","2026-11-20")];
  const before=JSON.stringify(records);
  core.build(records,today);
  assert.equal(JSON.stringify(records),before);
});

test("dashboard only navigates, never sends or alters contact history", () => {
  const desk=fs.readFileSync("js/bookshop-followup-desk.js","utf8");
  assert.match(desk,/focusSavedShop\(item\.id\)/);
  assert.doesNotMatch(desk,/sendPreparedEmail|functions\.invoke|mailto:|saveShops\(/);
  const app=fs.readFileSync("js/bookshop-outreach.js","utf8");
  assert.match(app,/BlackwoodFollowUpDesk\?\.initialise/);
  assert.match(app,/BlackwoodFollowUpDesk\?\.render/);
  assert.match(app,/function focusFollowUpShop\(/);
  assert.match(app,/function exportJSON\(/);
  assert.match(app,/blackwood-bookshop-outreach-v1/);
  assert.match(app,/function openContactDialog\(/);
});

test("private workspace includes filter and existing admin gate", () => {
  const html=fs.readFileSync("pages/bookshop-outreach.html","utf8");
  assert.match(html,/id="followupDashboard"/);
  assert.match(html,/id="followupView"/);
  assert.match(html,/bookshop-outreach-access\.js/);
  assert.doesNotMatch(
    html,/src="\/js\/bookshop-outreach\.js/
  );
});
