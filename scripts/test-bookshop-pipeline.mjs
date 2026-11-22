import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";

const builder = path.join(path.dirname(fileURLToPath(import.meta.url)), "build-public-bookshops.mjs");

function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "blackwood-bookshops-"));
  const directory = path.join(root, "data");
  fs.mkdirSync(directory);
  for (const [name, value] of Object.entries(files)) {
    fs.writeFileSync(path.join(directory, name), JSON.stringify(value));
  }
  return root;
}

function execute(root) {
  return spawnSync(process.execPath, [builder], {cwd:root, encoding:"utf8"});
}

test("public builder strips personal contact data, excludes chains and merges duplicates", () => {
  const root = fixture({
    "scotland-bookshops.json": {
      generatedAt:"2026-11-01", coverage:{complete:false,failedTiles:2},
      shops:[
        {osmId:"node/1",name:"Chapter House",town:"Aberdeen",address:"21 High Street",
          email:"private@example.org",notes:"private note",lat:57.1,lng:-2.1},
        {osmId:"node/2",name:"Waterstones",lat:57.0,lng:-2.2}
      ]
    },
    "uk-bookshops.json": {
      generatedAt:null,coverage:{complete:false,failedTiles:0},
      shops:[
        {osmId:"node/3",name:"Chapter House",town:"Aberdeen",website:"https://example.org",
          email:"never-publish@example.org",lat:57.1002,lng:-2.1002},
        {osmId:"node/4",name:"Reading Corner",town:"Cardiff",website:"javascript:alert(1)",
          lat:51.48,lng:-3.18}
      ]
    },
    "blackwood-bookshops.json": {shops:[]}
  });
  try {
    const result = execute(root);
    assert.equal(result.status,0,result.stderr);
    const publicData = JSON.parse(fs.readFileSync(path.join(root,"data/public-bookshops.json"),"utf8"));
    assert.equal(publicData.count,2);
    assert.equal(publicData.shops.find(s=>s.name==="Chapter House").website,"https://example.org/");
    assert.equal(publicData.shops.find(s=>s.name==="Reading Corner").website,"");
    assert.equal(publicData.coverageComplete,false);
    for (const shop of publicData.shops) {
      assert.deepEqual(Object.keys(shop).sort(),
        ["name","town","address","website","lat","lng","source"].sort());
    }
    assert.equal(JSON.stringify(publicData).includes("never-publish@example.org"),false);
    assert.equal(JSON.stringify(publicData).includes("private note"),false);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test("missing or invalid discovery sources cannot replace the previous public feed", () => {
  const old = {shops:[{name:"Existing record"}], count:1};
  const root=fixture({
    "scotland-bookshops.json":{shops:[],coverage:{complete:false}},
    "uk-bookshops.json":{wrong:true},
    "blackwood-bookshops.json":{shops:[]},
    "public-bookshops.json":old
  });
  try {
    const result=execute(root);
    assert.notEqual(result.status,0);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,"data/public-bookshops.json"),"utf8")),old);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test("incomplete source coverage cannot reduce an established public list drastically", () => {
  const previous=Array.from({length:100},(_,i)=>({name:"Legacy "+i}));
  const root=fixture({
    "scotland-bookshops.json":{shops:[{name:"One Shop",lat:55.9,lng:-4.1}],coverage:{complete:false}},
    "uk-bookshops.json":{shops:[],coverage:{complete:false}},
    "blackwood-bookshops.json":{shops:[]},
    "public-bookshops.json":{count:100,shops:previous}
  });
  try {
    const result=execute(root);
    assert.notEqual(result.status,0);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root,"data/public-bookshops.json"),"utf8")).count,100);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
