import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {featureToShop,buildExtractDataset} from "./geofabrik-bookshops-core.mjs";

function feature(name,id,lat,lng,props={}) {
  return {type:"Feature",
    properties:{"@type":"node","@id":id,shop:"books",name,...props},
    geometry:{type:"Point",coordinates:[lng,lat]}};
}

test("UK discovery strips email while retaining name, coordinates and URL",()=>{
  const input=feature("Open Page Books",42,51.5,-0.1,{
    email:"owner@example.org",website:"https://bookshop.example","addr:city":"London"});
  const dataset=buildExtractDataset({features:[input],mode:"uk",
    sourceUrl:"https://example.org/uk.osm.pbf",minimumCount:1});
  assert.equal(dataset.count,1);
  assert.equal(dataset.shops[0].osmId,"node/42");
  assert.equal(dataset.shops[0].town,"London");
  assert.equal(dataset.shops[0].email,undefined);
  assert.equal(dataset.coverage.complete,true);
});

test("Scottish cache can preserve existing public email during refresh",()=>{
  const dataset=buildExtractDataset({
    features:[feature("Lantern Books",91,55.95,-3.19)],
    previous:{shops:[{osmId:"node/91",name:"Lantern Books",
      email:"public@example.org",lat:55.95,lng:-3.19}]},
    mode:"scotland",sourceUrl:"https://example.org/scotland",minimumCount:1});
  assert.equal(dataset.shops[0].email,"public@example.org");
});

test("truncated extract cannot replace a populated cache",()=>{
  const previous={shops:Array.from({length:80},(_,i)=>({
    osmId:"node/"+(1000+i),name:"Bookshop "+i,lat:55.9,lng:-4.1}))};
  assert.throws(()=>buildExtractDataset({
    features:[feature("Only Shop",1,55.9,-4.1)],previous,
    mode:"scotland",sourceUrl:"https://example.org",minimumCount:1
  }),/unexpectedly shrank/);
});

test("reject non-bookshops, missing IDs, and dangerous website protocols",()=>{
  assert.equal(featureToShop(feature("Cafe",5,51.5,-0.1,{shop:"coffee"})),null);
  assert.equal(featureToShop(feature("No ID",undefined,51.5,-0.1)),null);
  assert.equal(featureToShop(feature("Books",7,51.5,-0.1,{
    website:"javascript:alert(1)"})).website,"");
});

test("real osmium tag filtering and export recover node and polygon IDs",()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),"blackwood-osmium-"));
  try {
    const input=path.join(cwd,"fixture.osm");
    const filtered=path.join(cwd,"books.osm.pbf");
    const sequence=path.join(cwd,"books.geojsonseq");
    const xml=[
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<osm version="0.6" generator="blackwood-test">',
      '  <node id="11" lat="55.950" lon="-3.190" version="1">',
      '    <tag k="shop" v="books"/><tag k="name" v="Cedar Books"/>',
      '  </node>',
      '  <node id="21" lat="55.9600" lon="-3.1900" version="1"/>',
      '  <node id="22" lat="55.9600" lon="-3.1898" version="1"/>',
      '  <node id="23" lat="55.9602" lon="-3.1898" version="1"/>',
      '  <node id="24" lat="55.9602" lon="-3.1900" version="1"/>',
      '  <node id="31" lat="55.970" lon="-3.180" version="1">',
      '    <tag k="shop" v="coffee"/><tag k="name" v="A Coffee Shop"/>',
      '  </node>',
      '  <way id="120" version="1">',
      '    <nd ref="21"/><nd ref="22"/><nd ref="23"/><nd ref="24"/><nd ref="21"/>',
      '    <tag k="shop" v="books"/><tag k="name" v="Page &amp; Ink"/>',
      '    <tag k="addr:city" v="Edinburgh"/>',
      '  </way>',
      '</osm>'
    ].join("\n");
    fs.writeFileSync(input,xml);
    for(const args of [
      ["tags-filter",input,"nwr/shop=books","-o",filtered],
      ["export","--attributes=type,id","--output-format=geojsonseq",filtered,"-o",sequence]
    ]){
      const result=spawnSync("osmium",args,{encoding:"utf8",maxBuffer:1024*1024});
      assert.equal(result.status,0,result.stderr||result.error?.message);
    }
    const features=fs.readFileSync(sequence,"utf8").split("\n")
      .map(line=>line.replace(/^\u001e/,"").trim()).filter(Boolean)
      .map(JSON.parse);
    const shops=features.map(x=>featureToShop(x)).filter(Boolean);
    assert.ok(shops.some(x=>x.osmId==="node/11"&&x.name==="Cedar Books"));
    assert.ok(shops.some(x=>x.osmId==="way/120"&&x.name==="Page & Ink"));
    assert.ok(!shops.some(x=>x.name==="A Coffee Shop"));
  }finally{fs.rmSync(cwd,{recursive:true,force:true});}
});
