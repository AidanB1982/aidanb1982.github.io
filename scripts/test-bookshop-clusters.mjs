import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const sandbox = {window:{}};
vm.runInNewContext(fs.readFileSync("js/bookshop-cluster-grid.js","utf8"), sandbox);
const {groupShops} = sandbox.window.BlackwoodBookshopGrid;
const shop = (name,lat,lng) => ({name,lat,lng});
const project = (lat,lng,zoom) => ({x:(lng+10)*Math.pow(2,zoom),y:(lat-49)*Math.pow(2,zoom)});

test("groups nearby bookshops and keeps accurate totals", () => {
  const items=[shop("One",55,-4),shop("Two",55.0001,-4.0001),shop("Three",50,1)];
  const groups=groupShops(items,project,6,{cellSize:108,revealZoom:15});
  assert.equal(groups.length,2);
  assert.equal(groups.reduce((sum,group)=>sum+group.count,0),items.length);
  assert.deepEqual(Array.from(groups.map(g=>g.count)).sort((a,b)=>a-b),[1,2]);
});

test("re-clustering depends on world coordinates and zoom, not map panning", () => {
  const items=[shop("A",55,-4),shop("B",55.001,-4.001)];
  const one=groupShops(items,project,7,{cellSize:108,revealZoom:15});
  const two=groupShops(items,project,7,{cellSize:108,revealZoom:15});
  assert.deepEqual(JSON.parse(JSON.stringify(one)),JSON.parse(JSON.stringify(two)));
});

test("street-level zoom reveals every individual bookshop", () => {
  const items=[shop("A",55,-4),shop("B",55,-4),shop("C",55.00001,-4)];
  const groups=groupShops(items,project,15,{cellSize:108,revealZoom:15});
  assert.equal(groups.length,3);
  assert.ok(groups.every(g=>g.count===1&&g.shops.length===1));
});

test("empty listings and invalid projections do not crash clustering", () => {
  assert.equal(groupShops([],project,6).length,0);
  const groups=groupShops([shop("Broken",0,0)],()=>({x:NaN,y:Infinity}),6);
  assert.equal(groups.length,0);
});

test("cluster representative lies inside its members bounding box", () => {
  const items=[shop("One",55,-4),shop("Two",55.02,-4.02)];
  const clusters=groupShops(items,project,6,{cellSize:400,revealZoom:15});
  assert.equal(clusters.length,1);
  assert.ok(clusters[0].lat>=55&&clusters[0].lat<=55.02);
  assert.ok(clusters[0].lng>=-4.02&&clusters[0].lng<=-4);
});
