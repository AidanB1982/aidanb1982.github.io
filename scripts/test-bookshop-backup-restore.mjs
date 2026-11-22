import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const ctx = {window:{}, JSON, Date};
vm.runInNewContext(fs.readFileSync("js/bookshop-backup-restore-core.js","utf8"),ctx);
const restore=ctx.window.BlackwoodBackupRestore;
const shop=(id,name="Books",town="Glasgow")=>({id,name,town,status:"prospect",
 contactHistory:[],email:"",followUpDate:""});
const parse=value=>restore.parseBackup(JSON.stringify(value));
const same=(a,b)=>a.name===b.name && a.town===b.town;

test("accepts the existing array-format exported records",()=>{
 const original=[shop("one"),{...shop("two","Second","Paisley"),
   verification:{status:"verified-independent",sourceUrl:"https://example.org"},
   contactHistory:[{type:"note",date:"2026-11-01",notes:"Existing contact"}]}];
 assert.equal(parse(original).length,2);
});
test("rejects malformed JSON, object wrappers and empty source",()=>{
 assert.throws(()=>restore.parseBackup(""),/nonempty/);
 assert.throws(()=>restore.parseBackup("{"),/valid JSON/);
 assert.throws(()=>restore.parseBackup('{"shops":[]}'),/array/);
});
test("rejects invalid records without allowing partial imports",()=>{
 assert.throws(()=>parse([shop("x"),{id:"two",name:"Missing town"}]),/town/);
 assert.throws(()=>parse([{...shop("x"),status:"unknown"}]),/status/);
 assert.throws(()=>parse([{...shop("x"),lat:500}]),/coordinate/);
 assert.throws(()=>parse([shop("x"),shop("x","Other")]),/repeats/);
});
test("rejects unsafe nested property names and excessive nesting",()=>{
 assert.throws(()=>restore.parseBackup(
   '[{"id":"1","name":"Shop","town":"Town","__proto__":{}}]'
 ),/unsafe property/);
 let nested={};for(let i=0;i<20;i++)nested={v:nested};
 assert.throws(()=>parse([{...shop("x"),verification:nested}]),/deeply nested/);
});
test("plan skips existing IDs and matching shops, retaining existing data",()=>{
 const old=[{...shop("a"),notes:"Do not overwrite",status:"opted-out"}];
 const incoming=[{...shop("a"),notes:"Try to overwrite",status:"contacted"},
   shop("b","Books","Glasgow"),shop("c","Different","Paisley")];
 const plan=restore.planImport(old,incoming,same);
 assert.equal(plan.additions.length,1);
 assert.equal(plan.skipped,2);
 assert.equal(plan.existing,1);
 assert.equal(old[0].notes,"Do not overwrite");
 assert.equal(old[0].status,"opted-out");
});
test("intra-backup duplicates are skipped when identities differ",()=>{
 const plan=restore.planImport([],[shop("a"),shop("b")],same);
 assert.equal(plan.additions.length,1);
 assert.equal(plan.skipped,1);
});
test("restore UI requires preview and explicit confirmation, no sending",()=>{
 const desk=fs.readFileSync("js/bookshop-backup-restore-desk.js","utf8");
 assert.match(desk,/parseBackup\(raw\)/);
 assert.match(desk,/backupRestoreConfirm/);
 assert.match(desk,/root\.confirm\(/);
 assert.match(desk,/pendingBaseline/);
 assert.doesNotMatch(desk,/sendPreparedEmailViaOutlook|functions\.invoke|mailto:/);
 const app=fs.readFileSync("js/bookshop-outreach.js","utf8");
 assert.match(app,/BlackwoodBackupDesk\?\.initialise/);
 assert.match(app,/function exportJSON\(/);
 assert.match(app,/blackwood-bookshop-outreach-v1/);
 const html=fs.readFileSync("pages/bookshop-outreach.html","utf8");
 assert.match(html,/id="backupRestoreFile"/);
 assert.match(html,/id="backupRestorePreview"/);
 assert.match(html,/id="backupRestoreConfirm"/);
});
