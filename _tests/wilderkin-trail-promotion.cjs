const test = require("node:test");
const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const modules = ["atlas", "bestiary", "call-habitats", "wild-calls", "activities", "story", "campaign", "duets",
  "fieldwork", "growth", "wardens", "sparring-gear", "trail-fittings", "fitting-notes", "caravans", "engine", "rehearsal-core"];
const scripts = modules.map(name => new vm.Script(readFileSync(path.join(__dirname, "../games/wilderkin", name + ".js"), "utf8"), {filename:name + ".js"}));
const key = "wilderkin.trail.v3";
const copy = value => JSON.parse(JSON.stringify(value));
const ok = result => { assert.equal(result?.ok, true, result?.message); return result; };
const party = {team:["opalclasp", "sprigkit", "dewfin"], lead:"sprigkit"};
const survivor = {substitute:"dewfin", slot:1, name:"  Marsh   patrol  ", fittings:true};

function boot(store = new Map()) {
  const writes = [];
  const localStorage = {getItem:k=>store.get(k)??null, setItem:(k,v)=>{writes.push(k);store.set(k,v);}};
  const window = {localStorage};
  const context = vm.createContext({window});
  scripts.forEach(script=>script.runInContext(context));
  return {game:window.WilderGame, window, store, writes};
}
function asStored(h) { return copy(h.game.state); }
function checkNoWrite(h, fn) {
  const before = asStored(h), bytes = h.store.get(key), count = h.writes.length;
  const result = fn();
  assert.deepEqual(asStored(h), before); assert.equal(h.store.get(key), bytes); assert.equal(h.writes.length, count);
  return result;
}
const otherFields = s => {
  const {team, lead, caravan, ...rest} = copy(s);
  return rest;
};
const member = (g,id) => g.state.party.find(p=>p.id===id);
const snapshot = g => ({team:Array.from(g.state.team), lead:g.state.lead});

let journey;
function played() {
  if (journey) return boot(new Map([[key, journey]]));
  const h=boot(), g=h.game;
  assert.ok(g.visitSite("camp")); ok(g.claimFittings("camp"));
  ok(g.equipFitting("sprigkit","opening-pennant"));
  ok(g.caravan.saveFormation(0,{name:"Starters"}));
  ok(g.startBattle("wild","opalclasp")); ok(g.useSkill("trail-feint")); ok(g.useSkill("trail-feint")); ok(g.recruit());
  ok(g.equipFitting("opalclasp","relay-bell")); ok(g.caravan.recallFormation(0));
  assert.equal(member(g,"opalclasp").hp>0,true); assert.ok(!g.state.team.includes("opalclasp"));
  ok(g.startBattle("wild","mossbell"));
  for(let turn=0;member(g,"sprigkit").hp>0 && turn<20;turn++) ok(g.useSkill("trail-feint"));
  assert.equal(member(g,"sprigkit").hp,0); ok(g.flee()); ok(g.setLead("cindlet"));
  assert.equal(g.state.caravan.previous.team.includes("opalclasp"),true);
  journey = h.store.get(key);
  return boot(new Map([[key, journey]]));
}

test("a real full-health rehearsal hands its exact order to a read-only preview of the wounded trail party",()=>{
  const h=played(), g=h.game, yard=h.window.WilderRehearsal.create({game:g});
  ok(yard.start({...party,kind:"wild",region:0,foe:"mossbell"}));
  const tried=yard.read();
  assert.equal(tried.game.state.battle.activeId,"sprigkit");
  assert.equal(member(tried.game,"sprigkit").hp,member(tried.game,"sprigkit").maxHp);
  ok(yard.act("swap","opalclasp")); ok(yard.act("flee"));
  checkNoWrite(h,()=>{
    const review=g.caravan.previewPromotion(yard.read().setup,{slot:1});
    assert.ok(review?.token); assert.deepEqual(copy(review.team),party.team);
    assert.equal(review.lead,"sprigkit"); assert.ok(!review.readyLead); assert.equal(review.canApply,false);
    assert.ok(review.applyReason); assert.equal(review.canSave,true); assert.deepEqual(copy(review.current),snapshot(g));
    assert.deepEqual(copy(review.leadChoices),["opalclasp","dewfin"]);
    assert.deepEqual(Array.from(review.currentMembers,p=>[p.id,p.hp,p.maxHp,p.level]),
      Array.from(g.team(),p=>[p.id,p.hp,p.maxHp,p.level]));
    assert.deepEqual(copy(review.joining),["opalclasp"]); assert.deepEqual(copy(review.leaving),["cindlet"]);
    for(const [i,id] of party.team.entries()){
      const row=review.members[i], owned=member(g,id);
      assert.deepEqual([row.id,row.name,row.hp,row.maxHp,row.level,row.gear||null,row.traveling],
        [id,g.kin(id,{owned:true}).name,owned.hp,owned.maxHp,owned.level,g.state.trailFittings.gear[id]||null,g.state.team.includes(id)]);
    }
    assert.equal(g.caravan.applyPromotion(review).ok,false);
  });
});

test("a conscious substitute applies the exact tested order in one write and a reload can undo it, keeping later gear",()=>{
  const h=played(), g=h.game, api=g.caravan, before=asStored(h), writes=h.writes.length;
  const review=api.previewPromotion(party,survivor);
  assert.equal(review.readyLead,"dewfin"); assert.ok(review.canApply);
  ok(api.applyPromotion(review));
  assert.equal(h.writes.length,writes+1); assert.deepEqual(snapshot(g),{team:party.team,lead:"dewfin"});
  assert.deepEqual(otherFields(g.state),otherFields(before));
  assert.deepEqual(copy(g.state.caravan.slots),before.caravan.slots);
  assert.equal(member(g,"sprigkit").hp,0);
  const reload=boot(h.store), live=reload.game;
  assert.deepEqual(snapshot(live),snapshot(g)); assert.deepEqual(copy(live.caravan.formations().previous.team),before.team);
  ok(live.equipFitting("cindlet","opening-pennant","sprigkit"));
  const later=otherFields(live.state);
  ok(live.caravan.undoFormation()); assert.deepEqual(snapshot(live),{team:before.team,lead:before.lead});
  assert.deepEqual(otherFields(live.state),later); assert.equal(live.state.caravan.previous,null);
});

test("saving preserves the fainted practiced lead, current lineup and earlier undo history, with or without fittings",()=>{
  for(const escorted of [false,true]){
    const h=played(), g=h.game, api=g.caravan, before=asStored(h), writes=h.writes.length;
    const options={...survivor,fittings:escorted};
    const review=api.previewPromotion(party,options); assert.ok(review.canSave);
    ok(api.savePromotion(review)); assert.equal(h.writes.length,writes+1);
    assert.deepEqual(otherFields(g.state),otherFields(before));
    assert.deepEqual(snapshot(g),{team:before.team,lead:before.lead});
    assert.deepEqual(copy(g.state.caravan.previous),before.caravan.previous);
    assert.deepEqual(copy(g.state.caravan.slots[0]),before.caravan.slots[0]); assert.equal(g.state.caravan.slots[2],null);
    const reload=boot(h.store).game, slot=copy(reload.state.caravan.slots[1]);
    assert.deepEqual(slot,{team:party.team,lead:party.lead,name:"Marsh patrol",
      ...(escorted?{gear:{opalclasp:"relay-bell",sprigkit:"opening-pennant"}}:{})});
    assert.equal(reload.caravan.formations().slots[1].lineup.lead,party.lead);
    assert.equal(member(reload,"sprigkit").hp,0);
    const duplicate=reload.caravan.previewPromotion(party,options);
    assert.equal(duplicate.canSave,false); assert.equal(reload.caravan.savePromotion(duplicate).ok,false);
  }
  const h=played(), api=h.game.caravan;
  const down=api.previewPromotion({team:["sprigkit"],lead:"sprigkit"},{slot:2});
  assert.ok(!down.canApply && down.canSave); ok(api.savePromotion(down)); assert.equal(member(h.game,"sprigkit").hp,0);
});

test("old careers without a fitting case or pennants retain starter identities, and trained forms use the owned name",()=>{
  const old=JSON.parse(played().store.get(key));old.version=2;
  delete old.caravan; delete old.trailFittings; delete old.growth;
  const older=boot(new Map([["wilderkin.trail.v2",JSON.stringify(old)]]));
  const legacy=older.game.caravan.previewPromotion(party,survivor);
  assert.equal(legacy.members[1].name,"Sprigkit"); assert.ok(legacy.members.every(p=>!p.gear));
  ok(older.game.caravan.savePromotion(legacy));
  assert.deepEqual(copy(boot(older.store).game.state.caravan.slots[1].gear),{});
  // Previously trained appearances retain their original roster ID even if the player selected the classic sprite.
  const grown=JSON.parse(played().store.get(key));
  grown.crests=[0]; grown.growth.sprigkit={demonstrated:true,selected:"hedgekeeper",classic:true};
  const h=boot(new Map([[key,JSON.stringify(grown)]])), g=h.game;
  assert.equal(g.kin("sprigkit",{owned:true}).appearanceId,"sprigkit");
  const preview=g.caravan.previewPromotion(party,survivor);
  assert.equal(preview.members[1].name,"Brackenveil");ok(g.caravan.applyPromotion(preview));
  assert.deepEqual(copy(g.state.growth),grown.growth);
  assert.equal(g.kin("sprigkit",{owned:true}).skills.at(-1).id,"wattle-ward");
});

test("same-tab decisions expire if a reviewed injury, fitting, pennant, or current travel order changes",()=>{
  const changes=[
    ["a reserve recovers",g=>ok(g.heal())],
    ["a fitted reserve passes its bell",g=>ok(g.equipFitting("dewfin","relay-bell","opalclasp"))],
    ["Finch records a different team on the selected slot",g=>ok(g.caravan.saveFormation(1,{name:"Newer party"}))],
    ["the field leader changes",g=>ok(g.setLead("dewfin"))]
  ];
  for(const [what,change] of changes){
    for(const action of ["applyPromotion","savePromotion"]){
      const h=played(), g=h.game, old=g.caravan.previewPromotion(party,survivor);
      change(g);
      const denied=checkNoWrite(h,()=>g.caravan[action](old));
      assert.equal(denied.ok,false,what+" must invalidate "+action); assert.ok(denied.message); assert.equal(denied.code,"changed");
      const fresh=g.caravan.previewPromotion(party,member(g,"sprigkit").hp?{slot:1,name:"Updated"}:survivor);
      assert.ok(fresh && fresh.token!==old.token);
    }
  }
});

test("a stale browser tab adopts the external career before confirmation and cannot replace its saved party or pennant",()=>{
  for(const action of ["applyPromotion","savePromotion"]){
    const left=played(), right=boot(left.store), api=left.game.caravan;
    const old=api.previewPromotion(party,survivor), sameObject=left.game.state;
    ok(right.game.caravan.saveFormation(1,{name:"Other tab"}));
    const published=left.store.get(key), count=left.writes.length;
    const denied=api[action](old); assert.equal(denied.ok,false); assert.equal(denied.code,"changed");
    assert.equal(left.store.get(key),published);
    assert.equal(left.writes.length,count); assert.strictEqual(left.game.state,sameObject);
    assert.equal(left.game.state.caravan.slots[1].name,"Other tab");
    const next=api.previewPromotion(party,survivor); ok(api[action](next));
    assert.equal(left.writes.length,count+1);
  }
});

test("invalid parties and forged confirmation requests cannot remove companions, write a slot or select a different substitute",()=>{
  const h=played(), api=h.game.caravan;
  checkNoWrite(h,()=>{
    for(const setup of [undefined,null,{}, {team:[],lead:"sprigkit"},{team:"sprigkit",lead:"sprigkit"},
      {team:["sprigkit","sprigkit"],lead:"sprigkit"},{team:["sprigkit"],lead:"dewfin"},
      {team:["gustlance"],lead:"gustlance"},{team:["__proto__"],lead:"__proto__"}])
      assert.equal(api.previewPromotion(setup),null);
    for(const substitute of ["sprigkit","cindlet","gustlance"]){
      const review=api.previewPromotion(party,{...survivor,substitute});
      assert.equal(review.canApply,false); assert.equal(api.applyPromotion(review).ok,false);
    }
    const original=api.previewPromotion(party,survivor);
    for(const altered of [
      null, {}, {...original,token:"expired"}, {...original,team:["cindlet","dewfin"],lead:"cindlet"},
      {...original,request:{...original.request,slot:0}},
      {...original,request:{...original.request,substitute:"opalclasp"}},
      {...original,request:{...original.request,name:"Not approved"}},
      {...original,request:{...original.request,fittings:false}}
    ]){
      for(const action of ["applyPromotion","savePromotion"]) assert.equal(api[action](altered).ok,false);
    }
  });
});

test("an occupied slot identifies the exact previous choice; invalid names and nonexistent slots cannot replace it",()=>{
  const h=played(), g=h.game, api=g.caravan;
  ok(api.saveFormation(1,{name:"Night patrol",fittings:true}));
  checkNoWrite(h,()=>{
    for(const name of [null,7,"","  ","bad\nname","Enemy\u202e","<custom>","a".repeat(33)]){
      const review=api.previewPromotion(party,{...survivor,name});
      assert.equal(review.canSave,false); assert.ok(review.saveReason); assert.equal(api.savePromotion(review).ok,false);
    }
    for (const slot of [undefined,-1,"01",3,true]){
      const review=api.previewPromotion(party,{...survivor,slot});
      assert.equal(review.canSave,false); assert.equal(api.savePromotion(review).ok,false);
    }
  });
  const review=api.previewPromotion(party,{...survivor,slot:"1",name:"Cafe\u0301   watch"});
  assert.equal(review.pennant.name,"Café watch"); assert.equal(review.pennant.occupied,true);
  assert.deepEqual(copy(review.pennant.existing),copy(g.state.caravan.slots[1]));
  ok(api.savePromotion(review));
  assert.equal(g.state.caravan.slots[1].name,"Café watch");
  const keep=api.previewPromotion({team:["dewfin","opalclasp"],lead:"opalclasp"},{slot:1});
  ok(api.savePromotion(keep)); assert.equal(g.state.caravan.slots[1].name,"Café watch");
});

test("an active career encounter or a loaner session cannot promote or overwrite a pennant",()=>{
  const h=played(), g=h.game, api=g.caravan, staged=api.previewPromotion(party,survivor);
  ok(g.startBattle("wild","mossbell"));
  checkNoWrite(h,()=>{
    const blocked=api.previewPromotion(party,survivor);assert.ok(!blocked.canApply && !blocked.canSave);
    for(const review of [blocked,staged]) for(const action of ["applyPromotion","savePromotion"])
      assert.equal(api[action](review).ok,false);
  });
  ok(g.flee());
  const ready=api.previewPromotion(party,survivor);
  checkNoWrite(h,()=>{
    const loaners={region:0,team:["dewfin"],lead:"dewfin",party:[g.loaner("dewfin",5)],battle:null};
    g.withLoaners(loaners,()=>{
      const blocked=api.previewPromotion({team:["dewfin"],lead:"dewfin"},{slot:0});
      assert.equal(blocked.canApply,false);assert.equal(blocked.canSave,false);
      for(const review of [blocked,ready]) for(const action of ["applyPromotion","savePromotion"])
        assert.equal(api[action](review).ok,false);
    });
  });
});
