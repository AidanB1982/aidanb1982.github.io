import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuthorInduction } from "../src/author-induction.js";

const fields = ["publishing_name", "biography", "genres", "website_url"];
function mount() {
  const ids = new Map();
  const make = name => {
    const e = {
      id: name,
      hidden: false,
      textContent: "",
      disabled: false,
      listeners: new Map(),
      values: {},
      addEventListener(type, callback) { this.listeners.set(type, callback); },
      reset() { this.values = {}; },
      elements: { namedItem(key) {
        if (!fields.includes(key)) throw Error("Unexpected author profile field: " + key);
        if (!ids.get(name).values[key]) ids.get(name).values[key] = {value: ""};
        return ids.get(name).values[key];
      } }
    };
    ids.set(name, e);
    return e;
  };
  for (const id of [
    "author-induction-form", "author-profile-form", "author-induction-intro",
    "author-induction-status", "induction-submit", "author-profile-save",
    "induction-charter", "induction-privacy"
  ]) make(id);
  globalThis.document = {
    getElementById(id) {
      if (!ids.has(id)) throw Error("Unknown author element " + id);
      return ids.get(id);
    },
    querySelectorAll() { return []; }
  };
  return id => ids.get(id);
}
const user = id => ({id, email: "test@example.invalid"});

test("Disabled author induction cannot query or submit to Supabase", async () => {
  const el = mount();
  let calls=0;
  const model = createAuthorInduction({
    client: { from() { calls++; throw Error("Must not query"); } },
    isOnline: () => true
  });
  await model.open(user("user-a"));
  assert.equal(calls,0);
  assert.equal(el("author-induction-form").hidden,true);
  assert.equal(el("author-profile-form").hidden,true);
  assert.match(el("author-induction-status").textContent,/not yet open/);
  model.clear();
  assert.equal(el("author-induction-status").textContent,"");
});

test("Even enabled author induction stays private and unavailable offline", async () => {
  const el = mount();
  let calls=0;
  const model = createAuthorInduction({
    client: { from() { calls++; throw Error("Must not query while offline"); } },
    isOnline: () => false,
    enabled: true
  });
  await model.open(user("user-a"));
  assert.equal(calls,0);
  assert.equal(el("author-profile-form").hidden,true);
  assert.match(el("author-induction-status").textContent,/Reconnect/);
});

test("An approved author receives a private draft editing screen, not a public profile", async () => {
  const el = mount();
  const ids=[];
  const authorId="author-a";
  const records={
    sgeul_author_inductions: {
      user_id:authorId,status:"approved",publishing_name:"Miren Vale",biography:"A long and thoughtful private biographical description of the author.",genres:"Folk horror",website_url:""
    },
    sgeul_author_profiles: null
  };
  const client={
    from(table) {
      return {select(){return {eq(key,id) {
        assert.equal(key,"user_id");
        ids.push({table,id});
        return {async maybeSingle(){return {data:records[table],error:null};}};
      }};}}
    }
  };
  const model=createAuthorInduction({client,isOnline:()=>true,enabled:true});
  await model.open(user(authorId));
  assert.deepEqual(ids,[
    {table:"sgeul_author_inductions",id:authorId},
    {table:"sgeul_author_profiles",id:authorId}
  ]);
  assert.equal(el("author-profile-form").hidden,false);
  assert.equal(el("author-induction-form").hidden,true);
  assert.equal(el("author-profile-form").elements.namedItem("publishing_name").value,"Miren Vale");
  assert.match(el("author-induction-status").textContent,/not published/);
});

test("Stale author requests cannot replace a new account's induction state", async () => {
  const el=mount();
  let resolveFirst;
  const client={
    from() {return { select(){return {eq(key,id){return {
      maybeSingle() {
        if(id==="reader-a")return new Promise(resolve=>{resolveFirst=resolve;});
        return Promise.resolve({data:null,error:null});
      }
    };}};}}; }
  };
  const model=createAuthorInduction({client,isOnline:()=>true,enabled:true});
  const a=model.open(user("reader-a"));
  const b=model.open(user("reader-b"));
  await b;
  assert.equal(el("author-induction-form").hidden,false);
  resolveFirst({data:{user_id:"reader-a",status:"approved"},error:null});
  await a;
  assert.equal(el("author-profile-form").hidden,true);
  assert.match(el("author-induction-status").textContent,/applications are open/);
});
