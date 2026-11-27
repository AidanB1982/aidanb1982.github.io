"use strict";
const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const read = path => readFileSync(path,"utf8");
const submissions=read("pages/submissions.html");
const charter=read("pages/author-charter.html");
const desk=read("pages/authordesk.html");
const hub=read("pages/behind-files-admin.html");
const auth=read("js/behind-files-admin.js");
const admin=read("js/blackwood-acquisition-admin.js");
const model=read("js/blackwood-acquisition-workflow.js");

assert.match(submissions,/Submissions are currently closed/);
assert.match(submissions,/Please do not send a manuscript through the general contact form/);
assert.match(submissions,/How a manuscript is considered|Our consideration and offer process/);
assert.match(submissions,/Head[s]? of Terms/);
assert.match(submissions,/href="\/pages\/author-charter\.html"/);
assert.match(charter,/The manuscript desk is currently closed/);
assert.match(charter,/not a contract, an offer to publish/);
assert.match(desk,/id="desk" class="desk" hidden/);
assert.match(desk,/id="author-desk-introduction-title"/);
assert.match(desk,/Your publishing journey with Blackwood/);
assert.match(hub,/id="bfa-admin-content"[\s\S]*?hidden/);
assert.match(hub,/id="acquisition-workflow-reference"[\s\S]*?hidden/);
for(const path of ["submissions","author-charter","authordesk"]){
  assert(hub.includes('/pages/'+(path==="submissions"?"submissions":path)+'.html'),"Missing official "+path+" page");
}
assert.match(hub,/\/js\/blackwood-acquisition-workflow\.js/);
assert.match(hub,/\/js\/blackwood-acquisition-admin\.js/);
assert.match(hub,/\/css\/acquisition-workflow\.css/);
assert.match(auth,/window\.BlackwoodAcquisitionGuide\?\.activate\(\)/);
assert.match(auth,/window\.BlackwoodAcquisitionGuide\?\.suspend\(\)/);
assert.match(admin,/window\.BlackwoodAcquisitionGuide = Object\.freeze/);
assert.doesNotMatch(admin,/\bfetch\s*\(|\.rpc\s*\(|\.insert\s*\(|\.update\s*\(|\.upsert\s*\(|localStorage|sessionStorage/);
assert.doesNotMatch(model,/\bfetch\s*\(|\.rpc\s*\(|\.insert\s*\(|\.update\s*\(|\.upsert\s*\(|localStorage|sessionStorage/);
console.log("PASS: official pages and existing admin access gate, no intake activation or browser writes");
