// Run with: node --test _tests/wilderkin-expedition.cjs
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function load(save) {
  const records = new Map();
  if (save) records.set(JSON.parse(save).version === 1 ? "wilderkin.trail.v1" : "wilderkin.trail.v2", save);
  const storage = {getItem:key => records.get(key) ?? null, setItem:(key, value) => records.set(key, value)};
  const ctx = vm.createContext({window:{localStorage:storage}});
  for (const script of ["atlas", "bestiary", "activities", "engine"]) {
    const file = path.join(__dirname, "../games/wilderkin", script+".js");
    vm.runInContext(readFileSync(file, "utf8"), ctx, {filename:file});
  }
  return {game:ctx.window.WilderGame, dex:ctx.window.WilderKinDex, fair:ctx.window.WilderActivities, save:() => records.get("wilderkin.trail.v2"), records};
}

function ok(outcome) { assert.ok(outcome.ok, outcome.message); }

test("a version-one save resumes at the same turn and retains earned crests", () => {
  const party = [["sprigkit",32],["cindlet",28],["dewfin",30]].map(([id,maxHp]) =>
    ({id,level:5,hp:maxHp,maxHp,xp:4}));
  party[0].hp = 17;
  const battle = {kind:"warden", activeId:"sprigkit", enemy:{id:"glimmeray",level:10,hp:12,maxHp:46,xp:0},turn:4,log:["Glimmeray used Lunar Surge!"]};
  const original = {version:1,region:2,met:[0,1,2],crests:[0,1],seen:["glimmeray"],positions:{0:{x:11,y:7},2:{x:5,y:5}},party,lead:"sprigkit",battle,wins:3,sound:false};
  const migrated = load(JSON.stringify(original));
  const g = migrated.game;
  assert.equal(g.state.region,2);
  assert.equal(g.state.party[0].hp,17);
  assert.equal(g.state.battle.turn,4);
  assert.equal(g.state.battle.enemy.hp,12);
  assert.equal(g.state.positions[2].x,5);
  assert.equal(g.state.sound,false);
  ok(g.useSkill("leaf-flurry"));
  assert.equal(g.state.crests.length,3);
  assert.equal(g.access(3).open,true);
  assert.equal(migrated.records.get("wilderkin.trail.v1"),JSON.stringify(original));
  const restored = load(migrated.save()).game;
  assert.equal(restored.state.crests.length,3);
  assert.equal(restored.state.battle,null);
});

test("all content is reachable through the expedition, collection and quest actions", () => {
  const loaded = load(null);
  const {game:g,dex,fair} = loaded;
  const stat = () => g.state;
  const ids = Object.keys(g.species);
  assert.equal(g.regions.length,150);
  assert.equal(new Set(g.regions.map(r=>r.name)).size,150);
  assert.equal(ids.length,500);
  assert.equal(new Set(ids.map(id=>g.species[id].name)).size,500);
  assert.equal(new Set(g.pools.flat()).size,500);
  assert.equal(g.wardens.length,30);
  assert.equal(new Set(g.wardens.map(i=>g.regions[i].warden)).size,30);
  assert.equal(new Set(g.wardens.map(i=>g.regions[i].crest)).size,30);
  assert.ok(fair.games.length>=20 && fair.quests.length>=30);
  assert.equal(new Set(fair.games.map(g=>g.id)).size,fair.games.length);
  assert.equal(new Set(fair.quests.map(q=>q.id)).size,fair.quests.length);
  assert.equal(dex.effectiveness("Arc",["Vane","Tide"]),2.25);
  assert.equal(dex.effectiveness("Ember",["Grove","Tide"]),1);
  assert.ok(!g.travel(149).ok);
  assert.ok(!g.startBattle("wild","unknown").ok);
  assert.ok(!g.awardGame(fair.games.at(-1).id).ok);
  assert.ok(!g.questAction(fair.quests.at(-1).id).ok);
  const crossed = new Set();
  let checkpoints = 0;
  const train = id => {
    if (!stat().team.includes(id)) {
      const weakest = g.team().sort((a,b)=>a.level-b.level)[0];
      ok(g.enlist(id,weakest.id));
    }
    ok(g.setLead(id));
  };
  for (const [i,r] of g.regions.entries()) {
    if (r.ability) {
      const gate = g.access(i);
      assert.ok(gate.carrier,r.name+" needs an available carrier");
      assert.equal(g.species[gate.carrier].ability,r.ability);
      if (!crossed.has(r.ability)) {
        // Fork this point in the campaign with the same crests but no carrier of this ability.
        const alternate = JSON.parse(loaded.save());
        alternate.party = alternate.party.filter(p=>g.species[p.id].ability !== r.ability);
        alternate.team = alternate.team.filter(id=>alternate.party.some(p=>p.id===id));
        const branch = load(JSON.stringify(alternate)).game;
        assert.ok(!branch.travel(i).ok, r.name+" allowed entry without "+r.ability);
        const hint = branch.access(i).hintRegion;
        assert.ok(branch.access(hint).open);
        assert.ok(branch.pools[hint].some(id=>branch.species[id].ability===r.ability));
      }
      crossed.add(r.ability);
    }
    ok(g.travel(i));
    assert.equal(stat().region,i);
    assert.ok(stat().visited.includes(i));
    for (const id of g.pools[i]) {
      if (stat().party.some(p=>p.id===id)) continue;
      ok(g.heal());
      train(g.team().sort((a,b)=>b.level-a.level)[0].id);
      ok(g.startBattle("wild",id));
      assert.equal(stat().battle.enemy.id,id);
      assert.ok(!g.recruit().ok);
      ok(g.useSkill("trail-feint"));
      ok(g.useSkill("trail-feint"));
      ok(g.recruit());
      if (r.wildLevel > Math.min(...g.team().map(k=>k.level))) train(id);
    }
    for (const q of fair.quests.filter(q=>q.region===i)) ok(g.questAction(q.id));
    // The separate activity tests exercise the board rules. Here we check claim/replay persistence.
    for (const activity of fair.games.filter(g=>g.region===i)) {
      ok(g.awardGame(activity.id));
      ok(g.awardGame(activity.id));
      assert.equal(stat().clears[activity.id],2);
    }
    if (!r.warden) {
      assert.equal(g.startBattle("warden").ok,false);
      continue;
    }
    ok(g.heal());
    const signature = g.species[g.pools[i][0]];
    const score = p => p.level + Math.max(...g.species[p.id].skills.filter(s=>s.kind==="attack").map(s=>dex.effectiveness(s.type,signature.types)*10));
    train([...stat().party].sort((a,b)=>score(b)-score(a))[0].id);
    ok(g.meetWarden());
    ok(g.startBattle("warden"));
    const pre = JSON.stringify(stat().battle);
    assert.deepEqual(JSON.parse(JSON.stringify(load(loaded.save()).game.state.battle)),JSON.parse(pre));
    for (let turn=0; stat().battle && turn<100; turn++) {
      const b = stat().battle;
      const kin = g.species[b.activeId];
      const enemy = g.species[b.enemy.id];
      const attacks = kin.skills.filter(s=>s.kind==="attack");
      const best = attacks.sort((a,b)=>b.power*dex.effectiveness(b.type,enemy.types)-a.power*dex.effectiveness(a.type,enemy.types))[0];
      ok(g.useSkill(best.id));
    }
    assert.ok(stat().crests.includes(i),"Warden trial at "+r.name);
    checkpoints++;
  }
  assert.equal(crossed.size,6);
  assert.equal(checkpoints,30);
  assert.equal(stat().visited.length,150);
  assert.equal(stat().party.length,500);
  assert.equal(stat().team.length,6);
  assert.equal(g.objective().title,"The trail is yours");
  for (const q of fair.quests) {
    const p = fair.progress(q,stat());
    assert.equal(p.current,p.total,q.name);
    ok(g.questAction(q.id));
    assert.ok(!g.questAction(q.id).ok,"duplicate reward: "+q.id);
  }
  const restored = load(loaded.save()).game;
  assert.deepEqual(JSON.parse(JSON.stringify(restored.state)),JSON.parse(JSON.stringify(stat())));
});
