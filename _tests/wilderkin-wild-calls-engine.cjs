const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const scripts=["atlas","bestiary","activities","campaign","story","duets","growth","wardens","second-bell","call-habitats","wild-calls","engine"].map(name=>{
  const filename=path.join(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(fs.readFileSync(filename,"utf8"),{filename});
});
const copy=value=>JSON.parse(JSON.stringify(value));
const ok=res=>assert.ok(res.ok,res.message);
function boot(raw) {
  const localStorage={getItem:key=>key==="wilderkin.trail.v3"?raw:null,setItem:(_,data)=>{raw=data;}};
  const context=vm.createContext({window:{localStorage}});
  scripts.forEach(script=>script.runInContext(context));
  return {g:context.window.WilderGame,calls:context.window.WilderWildCalls,reload:()=>boot(raw),raw:()=>raw};
}

test("tracks point to a usable partner in the clearing, in reserve or on the earliest reachable trail",()=>{
  const {g,calls}=boot();
  const hint=id=>calls.helper(g,g.wildCall(id));
  assert.equal(hint("mossbell"),null);
  const local=hint("opalclasp");
  assert.equal(local.id,"gustlance");assert.equal(local.skill,"Beacon Pass");assert.equal(local.region,0);

  const distant=hint("sedgejell");
  assert.equal(g.regions[distant.region].name,"Rattlegrass Station");
  assert.equal(distant.id,"volttine");assert.equal(distant.skill,"Spark Thread");
  assert.equal(g.access(distant.region).open,true);

  g.state.party.push(g.loaner("opalclasp",5));
  const reserve=hint("cragroll");
  assert.equal(reserve.id,"opalclasp");assert.equal(reserve.skill,"Tuning Fork");
  assert.ok(reserve.owned&&reserve.healthy&&!reserve.traveling);
  ok(g.enlist("opalclasp"));assert.equal(hint("cragroll"),null);
  g.team().find(k=>k.id==="opalclasp").hp=0;
  const resting=hint("cragroll");assert.ok(resting.owned&&resting.traveling&&!resting.healthy);
});
function catchNormally(g,id) {
  ok(g.startBattle("wild",id));
  ok(g.useSkill("trail-feint"));
  ok(g.useSkill("trail-feint"));
  assert.ok(g.captureStatus().available);
  ok(g.recruit());
}
function answeredMossbell() {
  const run=boot(),g=run.g;
  ok(g.setLead("dewfin"));ok(g.startBattle("wild","mossbell"));ok(g.answerWildCall("bubble-jet"));
  return run;
}
function beaconTeam() {
  const run=boot(),g=run.g;
  catchNormally(g,"gustlance");
  ok(g.heal());ok(g.setLead("gustlance"));ok(g.startBattle("wild","opalclasp"));
  return run;
}

test("tracks name actual ordinary skills and the wild first reply matches the scouting forecast",()=>{
  for (const [quarry,actor,skill] of [["mossbell","dewfin","bubble-jet"],["gustlance","cindlet","ember-pop"],["leafshuttle","sprigkit","leaf-flurry"]]) {
    const {g}=boot();
    ok(g.setLead(actor));
    const tracks=g.wildCall(quarry);
    assert.ok(tracks.options.some(o=>o.actor===actor && o.skill===skill && o.available));
    const first=g.species[quarry].skills.find(s=>s.kind==="attack");
    assert.equal(tracks.warning.name,first.name);assert.equal(tracks.warning.type,first.type);
    ok(g.startBattle("wild",quarry));
    const b=g.state.battle,intent=g.foeIntent(),lead=g.team().find(p=>p.id===actor);
    assert.equal(intent.skill.name,first.name);assert.equal(intent.charged,false);assert.equal(intent.power,5);
    const hp=lead.hp,foeHp=b.enemy.hp,forecast=g.ordinaryForecast(skill);
    assert.equal(forecast.damage,tracks.strike.damage);assert.equal(forecast.returnDamage,tracks.warning.damage);
    ok(g.useSkill(skill));
    assert.equal(lead.hp,hp-forecast.returnDamage);assert.equal(b.enemy.hp,foeHp-forecast.damage);
    assert.equal(g.wildCall().waiting,false);assert.equal(g.foeIntent().skill.name,"Pebble Toss");
    ok(g.useSkill("trail-feint"));assert.equal(g.foeIntent().charged,true);assert.equal(g.foeIntent().skill.name,first.name);
  }
});

test("answering targets the scenery, consumes one turn, survives reload and closes destructive actions",()=>{
  const run=boot(),g=run.g;
  ok(g.startBattle("wild","mossbell"));
  assert.ok(g.wildCall().options.some(o=>o.actor==="dewfin" && o.available));
  const before=JSON.stringify(g.state);
  for (const args of [["bubble-jet"],["leaf-flurry"],["trail-feint"],["beacon","dewfin"]]) {
    assert.equal(g.answerWildCall(...args).ok,false);
  }
  assert.equal(JSON.stringify(g.state),before);
  ok(g.swap("dewfin"));
  const party=copy(g.state.party),hp=g.state.battle.enemy.hp,turn=g.state.battle.turn,bag=copy(g.state.bag);
  const res=g.answerWildCall("bubble-jet");ok(res);assert.ok(res.skipCounterFx);
  assert.equal(g.state.battle.turn,turn+1);assert.equal(g.state.battle.enemy.hp,hp);
  assert.deepEqual(copy(g.state.party),party);assert.deepEqual(copy(g.state.bag),bag);
  assert.deepEqual(copy(g.wildCall().answered),{actor:"dewfin",skill:"bubble-jet"});
  const resumed=run.reload().g,sealed=JSON.stringify(resumed.state);
  assert.equal(resumed.wildCall().waiting,true);assert.equal(resumed.foeIntent().support,true);
  for (const action of [
    ()=>resumed.useSkill("bubble-jet"),()=>resumed.useSkill("trail-feint"),()=>resumed.useSkill("dew-bath"),
    ()=>resumed.useDuet("cindlet"),()=>resumed.swap("sprigkit"),()=>resumed.useFamilyTechnique("cindlet"),
    ()=>resumed.replaceFainted("sprigkit"),()=>resumed.useItem("balm","dewfin"),()=>resumed.answerWildCall("bubble-jet")
  ]) assert.equal(action().ok,false);
  assert.equal(JSON.stringify(resumed.state),sealed);
  assert.ok(resumed.captureStatus().available);
  ok(resumed.useItem("kinweave"));
  assert.equal(resumed.state.battle,null);assert.equal(resumed.state.wins,0);
  assert.equal(resumed.state.bag.kinweave,bag.kinweave-1);
  assert.deepEqual(copy(resumed.state.party.slice(0,3)),party);
  assert.deepEqual(copy(resumed.state.growth),copy(boot().g.state.growth));
  assert.equal(resumed.state.party.at(-1).id,"mossbell");assert.ok(resumed.state.team.includes("mossbell"));
  assert.equal(resumed.wildCall("mossbell"),null);assert.equal(resumed.recruit().ok,false);
});

test("an answering Beacon Pass spends the real pass, hands off and never exposes or hits the wild kin",()=>{
  const run=beaconTeam(),g=run.g,b=g.state.battle,party=copy(g.state.party);
  const card=g.wildCall();
  assert.ok(card.options.some(o=>o.actor==="gustlance" && o.skill==="beacon" && o.partner==="dewfin"));
  const sealed=JSON.stringify(g.state);
  for (const target of [undefined,"gustlance","unknown","opalclasp"]) assert.equal(g.answerWildCall("beacon",target).ok,false);
  assert.equal(JSON.stringify(g.state),sealed);
  const conventional=boot(sealed).g;
  ok(conventional.useFamilyTechnique("dewfin"));
  assert.equal(conventional.state.battle.enemy.beaconMarked,true);assert.equal(conventional.wildCall().waiting,false);
  assert.ok(conventional.team().find(p=>p.id==="dewfin").hp<party.find(p=>p.id==="dewfin").hp);
  ok(g.answerWildCall("beacon","dewfin"));
  assert.deepEqual(copy(g.state.party),party);
  assert.equal(b.beats,0);assert.equal(b.familyUsed,true);assert.equal(b.activeId,"dewfin");
  assert.equal(b.enemy.hp,b.enemy.maxHp);assert.ok(!b.enemy.beaconMarked);
  const resumed=run.reload().g;
  assert.deepEqual(copy(resumed.wildCall().answered),{actor:"gustlance",skill:"beacon",partner:"dewfin"});
  ok(resumed.recruit());assert.equal(resumed.state.lead,"gustlance");assert.equal(resumed.state.wins,0);
  const dry=beaconTeam().g;
  dry.state.battle.beats=0;
  assert.ok(dry.wildCall().options.every(o=>!o.available && o.reason));
  assert.equal(dry.answerWildCall("beacon","dewfin").ok,false);
  dry.state.battle.beats=1;
  dry.team().filter(p=>p.id!=="gustlance").forEach(p=>{p.hp=0;});
  assert.equal(dry.wildCall().options.length,0);assert.equal(dry.answerWildCall("beacon","dewfin").ok,false);
});

test("a waiting animal can leave without supplies or career effects and a crowded party recruits into reserve",()=>{
  const {g}=answeredMossbell();g.state.bag.kinweave=0;
  assert.equal(g.captureStatus().available,false);assert.equal(g.recruit().ok,false);assert.ok(g.wildCall().waiting);
  const expected=copy(g.state);expected.battle=null;
  const freed=g.flee();ok(freed);assert.equal(freed.kind,"escaped");assert.deepEqual(copy(g.state),expected);
  assert.equal(g.state.party.length,3);assert.ok(g.state.seen.includes("mossbell"));
  const full=boot().g;
  for (const id of ["gustlance","opalclasp","leafshuttle"]) {catchNormally(full,id);ok(full.heal());}
  ok(full.setLead("dewfin"));ok(full.startBattle("wild","mossbell"));ok(full.answerWildCall("bubble-jet"));
  const prior=copy(full.state.team);ok(full.recruit());
  assert.deepEqual(copy(full.state.team),prior);assert.ok(full.state.party.some(p=>p.id==="mossbell"));
});

test("traditional captures remain guaranteed across the twelve starter and Mossbrook pairings",()=>{
  for (const lead of ["sprigkit","cindlet","dewfin"]) for (const quarry of ["mossbell","gustlance","opalclasp","leafshuttle"]) {
    const {g}=boot();ok(g.setLead(lead));
    catchNormally(g,quarry);
    assert.equal(g.state.bag.kinweave,3);assert.equal(g.state.wins,0);
    assert.ok(g.state.party.some(p=>p.id===quarry));
    ok(g.startBattle("wild",quarry));
    assert.equal(g.wildCall(),null);assert.equal(g.captureStatus().available,false);
    assert.equal(g.foeIntent().skill.name,"Pebble Toss");
  }
});

test("Hold back forecasts real chip against an overlevel adult and a party that reaches half HP recruits it at wild level",()=>{
  const {g}=boot(),region=g.regions.findIndex(r=>r.wildLevel===14);
  ok(g.travel(region));const id=g.pools[region][0];ok(g.startBattle("wild",id));
  const b=g.state.battle;
  for(let step=0;step<12&&!g.captureStatus().available;step++){
    if(g.replacements()){
      ok(g.replaceFainted(g.replacements().options[0].id));continue;
    }
    const before=b.enemy.hp,forecast=g.ordinaryForecast("trail-feint");
    assert.ok(forecast.available);
    assert.ok(forecast.damage<Math.ceil(b.enemy.maxHp/4));
    ok(g.useSkill("trail-feint"));assert.equal(before-b.enemy.hp,forecast.damage);
    assert.ok(g.state.battle,"a party can earn this capture by weathering the replies");
  }
  assert.ok(b.enemy.hp*2<=b.enemy.maxHp);
  const ready=g.captureStatus();assert.ok(ready.available);assert.equal(ready.offer.young,false);
  assert.equal(ready.offer.level,14);ok(g.recruit());assert.equal(g.state.party.at(-1).level,14);
});

test("a newly caught kin can answer using a secondary affinity and a fainted traveler cannot volunteer",()=>{
  const {g}=boot();
  catchNormally(g,"opalclasp");
  assert.equal(g.species.opalclasp.type,"Chime");
  const options=g.wildCall("mossbell").options;
  assert.ok(options.some(o=>o.actor==="opalclasp" && o.skill==="rill-jet" && o.available));
  g.team().find(p=>p.id==="dewfin").hp=0;
  assert.ok(!g.wildCall("mossbell").options.some(o=>o.actor==="dewfin"));
  ok(g.setLead("opalclasp"));ok(g.startBattle("wild","mossbell"));ok(g.answerWildCall("rill-jet"));
  assert.ok(g.captureStatus().available);ok(g.recruit());
});

test("Wardens, exhibitions, expedition patrols, and loaner fights never expose wild capture actions",()=>{
  const {g}=boot();
  g.visitSite("warden");ok(g.startBattle("second-bell"));
  assert.equal(g.wildCall(),null);assert.equal(g.captureStatus().available,false);assert.ok(!g.foeIntent().warning);
  ok(g.flee());
  const loaners={team:["sprigkit","dewfin"],party:[g.loaner("sprigkit",5),g.loaner("dewfin",5)],
    lead:"dewfin",region:0,battle:null};
  g.withLoaners(loaners,begin=>{
    ok(begin(["mossbell"],5,"Trial"));
    assert.equal(g.wildCall(),null);assert.equal(g.answerWildCall("bubble-jet").ok,false);
    assert.equal(g.captureStatus().available,false);assert.ok(!g.foeIntent().warning);
  });
  const job=g.expedition();assert.ok(g.visitSite(job.targetSite));
  const patrol=g.expedition().choices.find(c=>c.available && c.foes);
  ok(g.expeditionAction(patrol.id));assert.equal(g.state.battle.kind,"expedition");
  assert.equal(g.wildCall(),null);assert.equal(g.captureStatus().available,false);ok(g.flee());
  g.state.crests=[0];g.visitSite("warden");ok(g.meetWarden());ok(g.startBattle("warden"));
  assert.equal(g.state.battle.kind,"warden");assert.equal(g.wildCall(),null);assert.ok(!g.foeIntent().warning);
  assert.equal(g.captureStatus().available,false);
});

test("untagged earlier battles keep their old reply and corrupt or unrelated saves cannot grant a cooperative catch",()=>{
  const run=answeredMossbell(),clean=JSON.parse(run.raw());
  for (const mutate of [
    s=>{delete s.battle.wildCall;},s=>{s.battle.wildCall.quarry="opalclasp";},s=>{s.battle.turn=1;},
    s=>{s.battle.wildCall.answered.skill="ember-pop";},s=>{s.battle.wildCall.answered.actor="cindlet";},
    s=>{s.battle.wildCall.answered.partner="sprigkit";},s=>{s.battle.kind="expedition";},
    s=>{s.battle.pendingFallen="sprigkit";},s=>{s.version=2;}
  ]){
    const s=copy(clean);mutate(s);
    const g=boot(JSON.stringify(s)).g;assert.ok(g.state.battle);
    assert.ok(!g.wildCall()?.waiting);assert.equal(g.captureStatus().available,false);
  }
  const old=copy(clean);old.battle.turn=1;delete old.battle.wildCall;
  assert.equal(boot(JSON.stringify(old)).g.foeIntent().skill.name,"Pebble Toss");
  const pass=beaconTeam();ok(pass.g.answerWildCall("beacon","dewfin"));
  for (const mutate of [
    s=>{s.battle.familyUsed=false;},s=>{s.battle.activeId="cindlet";},s=>{s.battle.wildCall.answered.actor="dewfin";},
    s=>{s.battle.wildCall.answered.partner="gustlance";},s=>{s.party.find(p=>p.id==="gustlance").hp=0;},
    s=>{s.battle.enemy.beaconMarked=true;},s=>{s.battle.beats=3;}
  ]) {
    const s=JSON.parse(pass.raw());mutate(s);
    const g=boot(JSON.stringify(s)).g;assert.ok(g.state.battle);assert.ok(!g.wildCall()?.waiting);
    assert.equal(g.captureStatus().available,false);
  }
});
