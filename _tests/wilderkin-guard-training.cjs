const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const files=["atlas","bestiary","activities","story","campaign","duets","growth","wardens","engine"].map(id=>{
  const filename=path.join(__dirname,"../games/wilderkin",id+".js");
  return new vm.Script(fs.readFileSync(filename,"utf8"),{filename});
});
function boot(record=null) {
  const storage={getItem:k=>k==="wilderkin.trail.v3"?record:null,setItem:(_,v)=>{record=v;}};
  const ctx=vm.createContext({window:{localStorage:storage}});
  files.forEach(f=>f.runInContext(ctx));
  return {g:ctx.window.WilderGame,reload:()=>boot(record)};
}
const ok=r=>assert.ok(r.ok,r.message);
const kin=(g,id)=>g.team().find(p=>p.id===id);
function escort(id) {
  const run=boot(),g=run.g;
  g.state.party.push(g.loaner(id,5));ok(g.enlist(id));ok(g.setLead(id));
  ok(g.startBattle("wild","mossbell"));
  return run;
}
const guard=(g,id)=>g.useSkill(g.kin(id).skills.find(s=>s.kind==="guard").id);
function practice(g,id){
  for(let i=0;i<2;i++){
    assert.equal(g.foeIntent().charged,false);
    const action=guard(g,id);ok(action);assert.equal(action.learnedGuard,undefined);
    assert.equal(g.guardTraining(id).learned,false);
  }
  assert.equal(g.foeIntent().charged,true);
  const trained=guard(g,id);ok(trained);
  assert.equal(trained.learnedGuard,g.guardTraining(id).name);
  assert.equal(g.guardTraining(id).learned,true);
}

test("all 38 eligible recruits learn independently on the charged hit they survive",()=>{
  const {g}=boot();
  const schools=Object.keys(g.species).filter(id=>g.guardTraining(id));
  assert.equal(schools.filter(id=>g.guardTraining(id).id==="shell").length,19);
  assert.equal(schools.filter(id=>g.guardTraining(id).id==="pincer").length,19);
  assert.equal(g.guardTraining("sprigkit"),null);
  for(const id of schools){
    g.state.party.push(g.loaner(id,5));
    ok(g.enlist(id,g.state.team.at(-1)));ok(g.setLead(id));
    ok(g.startBattle("wild","mossbell"));
    practice(g,id);
    assert.equal(g.state.trainedGuards.filter(k=>k===id).length,1);
    ok(g.flee());
  }
  assert.equal(g.state.trainedGuards.length,38);
});

test("an owned crab can be caught, trained, and score a single ordinary opening across reload",()=>{
  const run=boot(),g=run.g;
  ok(g.startBattle("wild","opalclasp"));ok(g.useSkill("trail-feint"));ok(g.useSkill("trail-feint"));ok(g.recruit());
  ok(g.setLead("opalclasp"));ok(g.startBattle("wild","mossbell"));
  practice(g,"opalclasp");
  const resumed=run.reload().g,b=resumed.state.battle;
  assert.equal(resumed.guardTraining("opalclasp").learned,true);
  assert.equal(resumed.guardTraining("creekclasp").learned,false);
  assert.equal(resumed.duets().opening,true);
  // Healing and switching leave the opening available.
  ok(resumed.useSkill("burrow-rest"));ok(resumed.swap("sprigkit"));
  const plain=boot(JSON.stringify(resumed.state)).g;
  delete plain.state.battle.enemy.pincerOpening;
  const hp=b.enemy.hp;
  ok(resumed.useSkill("leaf-flurry"));ok(plain.useSkill("leaf-flurry"));
  assert.equal(hp-b.enemy.hp,Math.min(hp,Math.round(1.5*(hp-plain.state.battle.enemy.hp))));
  assert.equal(b.enemy.pincerOpening,undefined);
});

test("Shell Escort saves a reserve on an ordinary switch, even after reloading, without stacking with gale",()=>{
  const {g,reload}=escort("cragroll");practice(g,"cragroll");
  const resumed=reload().g;
  assert.equal(resumed.state.battle.shellGuard,"cragroll");
  for(const terrain of [null,"gale"]) for(const cover of [0,1]){
    const snapshot=JSON.parse(JSON.stringify(resumed.state));
    // A late charged wild hit makes the terrain and Wattle reductions visible after rounding.
    snapshot.battle.turn=6;snapshot.battle.condition=terrain;snapshot.battle.cover=cover;
    snapshot.battle.enemy=resumed.loaner("mossbell",40);
    const field=boot(JSON.stringify(snapshot)).g;
    const ordinary=boot(JSON.stringify(snapshot)).g;
    ordinary.state.battle.shellGuard=null;
    const receiver=kin(field,"cindlet");
    const protectedHit=field.switchForecast("cindlet").damage;
    const normalHit=ordinary.switchForecast("cindlet").damage;
    assert.equal(field.switchForecast("cindlet").normalDamage,normalHit);
    if(terrain==="gale")assert.equal(protectedHit,normalHit);
    else assert.ok(protectedHit<normalHit);
    receiver.hp=protectedHit+1;
    kin(ordinary,"cindlet").hp=receiver.hp;
    const preview=field.switchForecast("cindlet");assert.equal(preview.hpAfter,1);
    assert.equal(preview.protected,true);
    ok(field.swap("cindlet"));ok(ordinary.swap("cindlet"));
    assert.equal(receiver.hp,preview.hpAfter);assert.equal(field.state.battle.activeId,"cindlet");
    if(terrain!=="gale")assert.equal(kin(ordinary,"cindlet").hp,0);
    assert.equal(field.state.battle.shellGuard,null);assert.equal(field.state.battle.cover,0);
  }
});

test("a Warden relay stops only for the trained crab, while its ordinary guard and the Warden's seal still resolve",()=>{
  const {g}=escort("opalclasp");practice(g,"opalclasp");ok(g.flee());ok(g.heal());
  const i=g.wardens[2];g.state.region=i;g.state.visited=[0,1,i];g.state.crests=Array.from(g.wardens.slice(0,3));
  ok(g.meetWarden());ok(g.startBattle("warden"));
  const b=g.state.battle,front=b.enemy,queue=Array.from(b.remaining);
  assert.match(g.wardenForecast().counter,/Pincer Block/);
  const raw=JSON.parse(JSON.stringify(g.state));raw.trainedGuards=[];
  const untrained=boot(JSON.stringify(raw)).g;
  const hp=kin(g,"opalclasp").hp;
  const hold=guard(g,"opalclasp");ok(hold);
  assert.equal(hold.learnedGuard,undefined);
  assert.match(hold.message,/Pincer Block holds/);assert.equal(b.enemy,front);
  assert.deepEqual(Array.from(b.remaining),queue);assert.ok(front.hp<front.maxHp);
  assert.equal(b.activeId,"opalclasp");assert.equal(kin(g,"opalclasp").hp,hp);
  assert.ok(b.coach.heard.includes("relay"));
  const normal=guard(untrained,"opalclasp");ok(normal);assert.equal(normal.foeShifted,true);
  assert.equal(untrained.guardTraining("opalclasp").learned,false);
});

test("support turns, one-hit finishes, guarding a lethal charge and loaner bouts do not train recruits",()=>{
  for(const id of ["cragroll","opalclasp"]){
    for(const byKO of ["ally","foe"]){
      const {g}=escort(id),b=g.state.battle;b.turn=3;
      if(byKO==="ally")kin(g,id).hp=1;else b.enemy.hp=1;
      const event=guard(g,id);ok(event);
      assert.equal(event.learnedGuard,undefined);
      assert.equal(g.guardTraining(id).learned,false);
      if(g.state.battle)assert.equal(b.shellGuard,null);
    }
    const {g}=escort(id);practice(g,id);
    const prior=JSON.stringify(g.state);
    const temp={region:0,party:[g.loaner(id,8),g.loaner("cindlet",8)],team:[id,"cindlet"],lead:id,battle:null};
    g.withLoaners(temp,start=>{
      ok(start(["mossbell"],10,"Loaner lesson"));
      g.state.battle.turn=3;assert.equal(g.guardTraining(id),null);
      const event=guard(g,id);ok(event);assert.equal(event.learnedGuard,undefined);
      assert.equal(g.state.battle.shellGuard,null);assert.equal(g.duets().opening,false);
      assert.equal(g.switchForecast("cindlet").protected,false);
    });
    assert.equal(JSON.stringify(g.state),prior);
  }
});

test("Shell Escort clears on a handoff or knockout and survives an invalid switch untouched",()=>{
  const run=escort("smelteroll"),g=run.g;
  practice(g,"smelteroll");
  const b=g.state.battle,prior=JSON.stringify(b);
  assert.equal(g.swap("smelteroll").ok,false);
  assert.equal(JSON.stringify(b),prior);
  b.enemy=g.loaner("mossbell",40);
  const raw=JSON.stringify(g.state);
  const duet=g.duets().options.find(o=>o.partnerId==="dewfin");assert.equal(duet.switchLead,true);
  ok(g.useDuet("dewfin"));
  assert.equal(b.activeId,"dewfin");assert.equal(b.shellGuard,null);
  const other=boot(raw).g;
  kin(other,"smelteroll").hp=1;
  ok(guard(other,"smelteroll"));assert.equal(other.state.battle.shellGuard,null);
});

test("old and malformed saves keep only specialties on owned members of the eligible family",()=>{
  const {g}=escort("cragroll");
  const save=JSON.parse(JSON.stringify(g.state));
  save.trainedGuards=["cragroll","cragroll","creekroll","sprigkit",null];
  save.battle.shellGuard="creekroll";save.battle.enemy.pincerOpening=true;
  let clean=boot(JSON.stringify(save)).g;
  assert.deepEqual(Array.from(clean.state.trainedGuards),["cragroll"]);
  assert.equal(clean.state.battle.shellGuard,null);assert.equal(clean.duets().opening,false);
  delete save.trainedGuards;delete save.battle.shellGuard;
  clean=boot(JSON.stringify(save)).g;
  assert.equal(clean.guardTraining("cragroll").learned,false);assert.equal(clean.state.battle.shellGuard,null);
});
