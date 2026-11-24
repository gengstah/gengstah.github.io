const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const scripts = ["atlas","bestiary","activities","campaign","story","duets","growth","wardens","engine"].map(name => {
  const filename = path.join(__dirname, "../games/wilderkin", name + ".js");
  return new vm.Script(fs.readFileSync(filename, "utf8"), {filename});
});
const saveKey = "wilderkin.trail.v3";
const ok = result => assert.ok(result.ok, result.message);

function boot(record) {
  const store = new Map(record ? [[saveKey, record]] : []);
  const localStorage = {getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value)};
  const context = vm.createContext({window: {localStorage}});
  scripts.forEach(script => script.runInContext(context));
  return {game: context.window.WilderGame, story: context.window.WilderStory, reload: () => boot(store.get(saveKey))};
}

function travelers(lead = "fenstillet") {
  const run = boot(), g = run.game;
  for (const id of ["fenstillet","rillsail"]) {
    g.state.party.push(g.loaner(id, 9));
    ok(g.enlist(id));
  }
  ok(g.setLead(lead));
  return run;
}

function wild(lead) {
  const run = travelers(lead);
  ok(run.game.startBattle("wild","mossbell"));
  return run;
}

test("Beacon passes without switch cover, survives a reload, and marks only the next ordinary strike", () => {
  const {game:g,reload} = wild();
  const res = g.team().find(p => p.id === "rillsail");
  const before = res.hp;
  const option = g.familyTechnique();
  assert.equal(option.id, "beacon");
  assert.equal(option.available, true);
  const target = option.targets.find(p => p.id === res.id);
  const ordinary = boot(JSON.stringify(g.state)).game;
  ok(ordinary.swap(res.id));
  ok(g.useFamilyTechnique(res.id));
  assert.ok(before - ordinary.team().find(p => p.id === res.id).hp < target.returnDamage);
  assert.equal(res.hp, target.hpAfter);
  assert.equal(res.hp, before - target.returnDamage);
  const resumed = reload().game;
  const battle = resumed.state.battle;
  assert.equal(battle.activeId, res.id);
  assert.equal(battle.turn, 2);
  assert.equal(battle.beats, 0);
  assert.equal(resumed.familyTechnique().used, true);
  assert.equal(resumed.duets().opening, true);
  const kin = resumed.kin(res.id);
  ok(resumed.useSkill(kin.skills.find(s => s.kind === "guard").id));
  assert.equal(resumed.duets().opening, true);
  assert.equal(resumed.familyTechnique().available, false);
  assert.equal(resumed.useFamilyTechnique("sprigkit").ok, false);
  const control = boot(JSON.stringify(resumed.state)).game;
  delete control.state.battle.enemy.beaconMarked;
  const hit = kin.skills.find(s => s.kind === "attack").id;
  const hp = battle.enemy.hp;
  ok(resumed.useSkill(hit)); ok(control.useSkill(hit));
  const plain = hp - control.state.battle.enemy.hp;
  assert.equal(hp - battle.enemy.hp, Math.round(plain * 1.5));
  assert.equal(resumed.duets().opening, false);
  ok(resumed.flee());
  ok(resumed.startBattle("wild","mossbell"));
  assert.equal(resumed.familyTechnique().available, true);
});

test("Slipstream heals each chosen reserve before damage, caps at maximum HP and never revives", () => {
  for (const [hp,heal] of [[1,7],[29,1],[30,0]]) {
    const run = wild("rillsail"), g = run.game;
    const receiver = g.team().find(p => p.id === "dewfin");
    receiver.hp = hp;
    const plan = g.familyTechnique().targets.find(p => p.id === receiver.id);
    assert.equal(plan.heal,heal);
    assert.equal(plan.maxHp,30);
    const oldFoe = g.state.battle.enemy.hp;
    ok(g.useFamilyTechnique(receiver.id));
    assert.equal(g.state.battle.activeId,receiver.id);
    assert.equal(receiver.hp,hp + heal - plan.returnDamage);
    assert.equal(receiver.hp,plan.hpAfter);
    assert.equal(g.state.battle.enemy.hp,oldFoe);
    const resumed = run.reload().game;
    assert.equal(resumed.state.battle.familyUsed,true);
    assert.equal(resumed.team().find(p => p.id === receiver.id).hp,receiver.hp);
  }
  const {game:g} = wild("rillsail");
  g.team().find(p => p.id === "sprigkit").hp = 0;
  assert.ok(!g.familyTechnique().targets.some(t => t.id === "sprigkit"));
  const before = JSON.stringify(g.state);
  for (const id of ["rillsail","sprigkit","mossbell","unknown"]) assert.equal(g.useFamilyTechnique(id).ok,false);
  assert.equal(JSON.stringify(g.state),before);
});

test("missing beats, an exhausted team, and a lead without a pass cannot spend a turn", () => {
  const {game:g} = wild();
  g.state.battle.beats = 0;
  assert.equal(g.familyTechnique().available,false);
  assert.equal(g.useFamilyTechnique("dewfin").ok,false);
  g.state.battle.beats = 1;
  g.team().filter(p => p.id !== "fenstillet").forEach(p => { p.hp = 0; });
  assert.equal(g.familyTechnique().available,false);
  assert.equal(g.familyTechnique().targets.length,0);
  assert.equal(g.useFamilyTechnique("dewfin").ok,false);
  assert.equal(g.state.battle.turn,1);
  assert.equal(g.state.battle.familyUsed,false);
  const normal = boot().game;
  ok(normal.startBattle("wild","mossbell"));
  assert.equal(normal.familyTechnique(),null);
  assert.equal(normal.useFamilyTechnique("dewfin").ok,false);
  ok(normal.swap("dewfin"));
  assert.equal(normal.state.battle.familyUsed,false);
});

test("a lethal reply selects a surviving lead and a replaced expedition foe does not inherit the mark", () => {
  const run = travelers(), g = run.game;
  g.state.surveys[0] = 2; // The final Mossbrook field leg offers a two-kin patrol.
  const job = g.expedition();
  assert.ok(g.visitSite(job.targetSite));
  const route = g.expedition().choices.find(c => c.available && c.foes > 1);
  ok(g.expeditionAction(route.id));
  const recipient = g.team().find(p => p.id === "dewfin");
  recipient.hp = 1;
  assert.equal(g.familyTechnique().targets.find(p => p.id === recipient.id).hpAfter,0);
  ok(g.useFamilyTechnique(recipient.id));
  assert.equal(recipient.hp,0);
  const after = run.reload().game;
  assert.equal(after.state.battle.activeId,"sprigkit");
  assert.equal(after.duets().opening,true);
  after.state.battle.enemy.hp = 1;
  ok(after.useSkill("brush-dash"));
  assert.equal(after.duets().opening,false);
  assert.equal(after.state.battle.familyUsed,true);
});

test("a Warden screen cannot stop the marked strike, and an older active save starts with its pass unused", () => {
  const {game:g,story} = travelers();
  g.state.surveys[0] = g.expedition(0).total;
  while (!story.chapterDone(g.state,0)) ok(g.storyStep("chapter-1",story.scene(g.state,"chapter-1").choices[0]?.id));
  ok(g.meetWarden());
  ok(g.startBattle("warden"));
  const old = JSON.parse(JSON.stringify(g.state));
  delete old.battle.familyUsed;
  const restored = boot(JSON.stringify(old)).game;
  assert.equal(restored.familyTechnique().available,true);
  ok(restored.useFamilyTechnique("sprigkit"));
  assert.equal(restored.state.battle.coach.last,"switch");
  assert.equal(restored.foeIntent().guarding,true);
  const baseline = boot(JSON.stringify(restored.state)).game;
  delete baseline.state.battle.enemy.beaconMarked;
  const before = restored.state.battle.enemy.hp;
  ok(restored.useSkill("leaf-flurry")); ok(baseline.useSkill("leaf-flurry"));
  assert.ok(before - restored.state.battle.enemy.hp > 2 * (before - baseline.state.battle.enemy.hp));
});

test("a trained attack uses its own beat and leaves Beacon for the next ordinary strike", () => {
  const {game:g} = wild();
  g.state.visited.push(1);
  Object.assign(g.state.growth.cindlet,{demonstrated:true,selected:"fluewatch"});
  Object.assign(g.state.battle,{turn:2,beats:2});
  ok(g.useFamilyTechnique("cindlet"));
  assert.equal(g.foeIntent().charged,true);
  ok(g.useSkill("backdraft-cut"));
  assert.equal(g.duets().opening,true);
  assert.equal(g.duets().beats,0);
  const strike = g.useSkill("ember-pop");
  ok(strike);
  assert.match(strike.message,/Struck the opening/);
});

test("a Warden relay benches the marked individual, even among duplicates, until its own return", () => {
  const {game:g}=travelers();
  const region=g.wardens[2],s=g.state;
  s.region=region;s.visited=Array.from({length:region+1},(_,i)=>i);
  s.crests=Array.from(g.wardens.slice(0,3)); // Rematch Lune at the Moonwell.
  ok(g.meetWarden());ok(g.startBattle("warden"));
  const battle=s.battle,id=battle.enemy.id;
  // Three individuals, each with its own health. Lune's next relay is on turn seven.
  battle.remaining=[id,id];battle.reserveHp=[2,1];battle.turn=6;
  ok(g.useFamilyTechnique("sprigkit"));
  assert.equal(battle.enemy.beaconMarked,true);
  assert.equal(g.wardenForecast().kind,"relay");assert.equal(g.wardenForecast().active,true);
  battle.opening=true; // Ordinary openings still end with a change of front.
  const move=g.useSkill("brush-dash");ok(move);assert.ok(move.foeShifted);
  const originalHp=battle.reserveHp[1];
  assert.ok(originalHp>2);
  assert.equal(battle.enemy.id,id);assert.equal(battle.enemy.hp,2);
  assert.equal(battle.beaconReserve,1);assert.equal(g.duets().opening,false);
  const saved=JSON.stringify(s);
  for(const viaRelay of [false,true]){
    let resumed=boot(saved),live=resumed.game;
    for(const [index,hp] of [[1,2],[0,1]]){
      const b=live.state.battle;
      assert.equal(b.enemy.id,id);assert.equal(b.enemy.hp,hp);
      assert.equal(b.beaconReserve,index);assert.equal(b.enemy.beaconMarked,undefined);
      assert.equal(live.duets().opening,false);
      if(viaRelay){
        b.turn=index?13:19; // Let the next two Warden relays run without knocking anyone out.
        live.team().find(p=>p.id==="sprigkit").hp-=1;
        assert.equal(live.wardenForecast().kind,"relay");assert.equal(live.wardenForecast().active,true);
        ok(live.useSkill("sun-nap"));
      } else ok(live.useSkill("leaf-flurry"));
      resumed=resumed.reload();live=resumed.game;
    }
    const b=live.state.battle;
    assert.equal(b.enemy.id,id);assert.equal(b.enemy.hp,originalHp);
    assert.equal(b.beaconReserve,undefined);assert.equal(b.enemy.beaconMarked,true);assert.equal(live.duets().opening,true);
    const hit=live.useSkill("leaf-flurry");ok(hit);assert.match(hit.message,/Struck the opening/);
    if(live.state.battle)assert.equal(live.state.battle.enemy.beaconMarked,undefined);
  }
  for(const value of [-1,2,"1",null]){
    const broken=JSON.parse(saved);broken.battle.beaconReserve=value;
    assert.equal(boot(JSON.stringify(broken)).game.state.battle.beaconReserve,undefined);
  }
  const older=JSON.parse(saved);delete older.battle.familyUsed;
  assert.equal(boot(JSON.stringify(older)).game.state.battle.beaconReserve,undefined);
});

test("Reedbank records each course and loaner once, survives reload, and clears on a new adventure", () => {
  const {game:g,reload} = boot();
  const career = JSON.stringify(g.state);
  for (const [course,id] of [["ferry","fenstillet"],["else","galeskip"],[["bell"],"gustlance"]])
    assert.equal(g.recordRelay(course,id).ok,false);
  const loaners = {region:0,lead:"gustlance",party:[g.loaner("gustlance",9)],team:["gustlance"],battle:null};
  g.withLoaners(loaners,() => assert.equal(g.recordRelay("bell","gustlance").ok,false));
  assert.equal(JSON.stringify(g.state),career);

  for (const course of ["ferry","bell"]) for (const id of ["galeskip","gustlance"]) {
    ok(g.recordRelay(course,id));
    ok(g.recordRelay(course,id));
  }
  const resumed = reload().game;
  assert.deepEqual(Array.from(resumed.state.relayClears),["ferry|galeskip","ferry|gustlance","bell|galeskip","bell|gustlance"]);
  const pristine = JSON.parse(career);
  const stamped = JSON.parse(JSON.stringify(resumed.state));
  stamped.relayClears = [];
  assert.deepEqual(stamped,pristine);
  const bad = JSON.parse(career);
  bad.relayClears = ["bell|gustlance",null,"bell|gustlance","invalid",{}];
  assert.deepEqual(Array.from(boot(JSON.stringify(bad)).game.state.relayClears),["bell|gustlance"]);
  delete bad.relayClears;
  assert.deepEqual(Array.from(boot(JSON.stringify(bad)).game.state.relayClears),[]);
  ok(resumed.reset());
  assert.equal(resumed.state.relayClears.length,0);
});
