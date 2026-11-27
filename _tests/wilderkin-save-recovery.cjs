const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const scripts=["atlas","bestiary","activities","campaign","story","duets","engine"].map(name=>{
  const filename=path.join(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(fs.readFileSync(filename,"utf8"),{filename});
});
const primary="wilderkin.trail.v3",checkpoint="wilderkin.trail.checkpoint.v1",damaged="wilderkin.trail.unreadable.v1";
const ok=r=>assert.equal(r.ok,true,r.message);
function device(records=new Map(),overrides={}){
  const timers=[],bus=new EventTarget();
  const storage={getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v),...overrides};
  const window={localStorage:storage,Event,addEventListener:(...a)=>bus.addEventListener(...a),
    dispatchEvent:e=>bus.dispatchEvent(e),setTimeout:f=>timers.push(f)};
  const ctx=vm.createContext({window});
  scripts.forEach(script=>script.runInContext(ctx));
  return {g:window.WilderGame,records,flush:()=>timers.splice(0).forEach(f=>f()),hide:()=>bus.dispatchEvent(new Event("pagehide")),bus};
}

test("cold-start corruption resumes a validated checkpoint in memory, keeping the original until the player confirms",()=>{
  const first=device(),{g,records}=first;
  ok(g.setLead("dewfin"));ok(g.travel(1));ok(g.startBattle("wild",g.pools[1][0]));
  const original=records.get(primary);first.hide();assert.equal(records.get(checkpoint),original);
  records.set(primary,"{unfinished save");
  const next=device(records),resume=next.g;
  assert.equal(resume.saveRecovery,"recovered");assert.equal(resume.canSave,false);
  assert.equal(resume.state.region,1);assert.equal(resume.state.battle.activeId,"dewfin");
  ok(resume.setSound(false));next.flush();next.hide();
  assert.equal(records.get(primary),"{unfinished save");assert.equal(records.get(checkpoint),original);
  ok(resume.resumeSaving());assert.equal(records.get(damaged),"{unfinished save");assert.equal(resume.saveRecovery,null);
  const restored=device(records).g;
  assert.equal(restored.state.battle.activeId,"dewfin");assert.equal(restored.state.sound,false);
});

test("an unreadable primary without a checkpoint permits a session and an export; a quota failure keeps the primary intact",()=>{
  const records=new Map([[primary,""],[checkpoint,"also broken"]]);
  let rejectWrite=true;
  const h=device(records,{setItem(k,v){if(rejectWrite&&k===damaged)throw Error("quota");records.set(k,v);}});
  assert.equal(h.g.saveRecovery,"fresh");
  ok(h.g.travel(2));assert.equal(JSON.parse(h.g.exportCampaign()).region,2);
  h.flush();assert.equal(records.get(primary),"");
  assert.equal(h.g.resumeSaving().ok,false);assert.equal(records.get(primary),"");assert.equal(h.g.state.region,2);
  rejectWrite=false;ok(h.g.resumeSaving());assert.equal(records.get(damaged),"");assert.equal(device(records).g.state.region,2);
});

test("a checkpoint may fail independently or become stale in another tab without changing the newer career",()=>{
  const records=new Map(),h=device(records,{setItem(k,v){if(k===checkpoint)throw Error("quota");records.set(k,v);}});
  ok(h.g.setLead("cindlet"));h.flush();assert.equal(h.g.canSave,true);assert.equal(JSON.parse(records.get(primary)).lead,"cindlet");
  const newer=device(records);ok(newer.g.setLead("dewfin"));newer.hide();
  const right=records.get(primary);h.hide();assert.equal(records.get(checkpoint),right);
  assert.equal(h.g.setSound(false).code,"changed");assert.equal(records.get(primary),right);
  records.delete(primary);assert.equal(h.g.setSound(false).code,"changed");
  assert.equal(device(records).g.state.lead,"sprigkit");
});

test("backup import previews, rejects invalid files, detects stale reviews and only replaces a verified durable campaign",()=>{
  const source=device();ok(source.g.travel(1));ok(source.g.setLead("cindlet"));
  ok(source.g.startBattle("wild",source.g.pools[1][0]));const file=source.g.exportCampaign();
  const h=device();ok(h.g.setLead("dewfin"));const previous=h.records.get(primary);
  for(const bad of ["", "{","null",JSON.stringify({version:99}),JSON.stringify({version:3,party:[]})])
    assert.equal(h.g.previewBackup(bad).ok,false);
  const review=h.g.previewBackup(file);ok(review);assert.match(review.summary,/Cinderfall Ridge.*battle in progress/);
  assert.equal(h.records.get(primary),previous);assert.equal(h.g.state.lead,"dewfin");
  ok(h.g.setSound(false));assert.equal(review.restore().ok,false);assert.equal(h.g.state.lead,"dewfin");
  const race=h.g.previewBackup(file);const other=device(h.records);ok(other.g.setLead("sprigkit"));
  const external=h.records.get(primary);assert.equal(race.restore().code,"changed");assert.equal(h.records.get(primary),external);
  const fail=device(h.records,{setItem(){throw Error("denied");}});
  assert.equal(fail.g.previewBackup(file).restore().ok,false);assert.equal(h.records.get(primary),external);
  assert.equal(fail.g.state.lead,"sprigkit");
  ok(h.g.previewBackup(file).restore());const final=device(h.records).g;
  assert.equal(final.state.region,1);assert.equal(final.state.battle.activeId,"cindlet");assert.equal(final.state.visited.includes(1),true);
});

test("unavailable browser storage reports session-only progress, still exports, and recovers after writes become possible",()=>{
  let denied=true;const h=device(new Map(),{setItem(k,v){if(denied)throw Error("denied");h.records.set(k,v);}});
  const changes=[];h.bus.addEventListener("wilder-save-status",()=>changes.push(h.g.canSave));
  ok(h.g.travel(1));assert.equal(h.g.canSave,false);assert.equal(JSON.parse(h.g.exportCampaign()).region,1);
  denied=false;ok(h.g.setLead("dewfin"));assert.equal(h.g.canSave,true);assert.deepEqual(changes,[false,true]);
  assert.equal(device(h.records).g.state.region,1);
  const noReader=device(new Map(),{getItem(){throw Error("disabled");},setItem(){throw Error("disabled");}});
  assert.equal(noReader.g.canSave,false);ok(noReader.g.travel(2));assert.equal(JSON.parse(noReader.g.exportCampaign()).region,2);
});
