const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const scripts=["atlas","bestiary","activities","story","campaign","duets","engine"].map(name=>{
  const filename=path.join(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(fs.readFileSync(filename,"utf8"),{filename});
});

function boot(saved) {
  let record=saved;
  const storage={getItem:key=>key==="wilderkin.trail.v3"?record:null,setItem:(_,data)=>{record=data;}};
  const context=vm.createContext({window:{localStorage:storage}});
  scripts.forEach(script=>script.runInContext(context));
  const w=context.window;
  return {game:w.WilderGame,scores:w.WilderDuets,types:w.WilderKinDex.types,reload:()=>boot(record)};
}

function encounter(partnerType,overrides={}) {
  const {game}=boot();
  assert.equal(game.startBattle("wild","mossbell").ok,true);
  const state=JSON.parse(JSON.stringify(game.state));
  const id=Object.keys(game.species).find(id=>game.species[id].type===partnerType&&id!=="sprigkit");
  const newMember=(key,level)=>{
    const maxHp=game.species[key].baseHp+(level-5)*3;
    return {id:key,level,hp:maxHp-12,maxHp,xp:0};
  };
  const others=state.party.filter(p=>p.id!=="sprigkit"&&p.id!==id);
  state.party=[newMember("sprigkit",35),newMember(id,35),...others];
  state.team=["sprigkit",id];
  Object.assign(state.battle,{enemy:newMember("mossbell",47),beats:3,...overrides});
  const loaded=boot(JSON.stringify(state));
  return {loaded,game:loaded.game,id};
}

test("each pairing of the ten primary affinities has a symmetric named technique",()=>{
  const {game,scores,types}=boot();
  const names=new Set(),roles=new Set();
  for(const a of Object.keys(types))for(const b of Object.keys(types)) {
    const score=scores.score(a,b);
    assert.ok(score.name&&score.description&&score.cost);
    assert.equal(score,scores.score(b,a));
    names.add(score.name);roles.add(score.role);
  }
  assert.equal(names.size,55);assert.equal(roles.size,6);
  assert.equal(game.duetPair("sprigkit","cindlet").name,"Firebreak");
  assert.equal(game.duetPair("sprigkit","dewfin").name,"Rain Garden");
  assert.equal(game.duetPair("cindlet","dewfin").name,"Steam Exchange");
});

test("the starter party unlocks its first two duets in battle without requiring a catch",()=>{
  const {game:g}=boot();g.startBattle("wild","mossbell");
  assert.equal(g.duets().beats,1);
  assert.ok(g.duets().options.every(o=>!o.available));
  const start=JSON.stringify(g.state);
  assert.ok(!g.useDuet("cindlet").ok);
  assert.ok(!g.useSkill("sun-nap").ok);
  assert.equal(start,JSON.stringify(g.state));
  g.useSkill("leaf-flurry");
  assert.equal(g.duets().beats,2);
  assert.ok(g.duets().options.every(o=>o.available));
  g.useSkill("leaf-flurry");
  assert.equal(g.duets().beats,2);
  g.useSkill("brush-dash");
  assert.equal(g.duets().beats,3);
});

test("published forecasts match the resulting HP and leader across all 55 scores",()=>{
  const {game:catalog,types}=boot();
  const keys=Object.keys(types);
  const {game:g}=encounter("Tide");
  const opening=JSON.stringify(g.state);
  let tested=0;
  for(let a=0;a<keys.length;a++)for(let b=a;b<keys.length;b++) {
    const id=Object.keys(catalog.species).find(id=>catalog.species[id].type===keys[a]);
    const partner=Object.keys(catalog.species).find(k=>k!==id&&catalog.species[k].type===keys[b]);
    Object.assign(g.state,JSON.parse(opening));
    // Put two legal mid-campaign kin against a braced field opponent in a charged biome.
    const add=(id,hpLost)=>{
      const maxHp=g.species[id].baseHp+30*3;
      return {id,level:35,maxHp,hp:maxHp-hpLost,xp:0};
    };
    const left=add(id,34),right=add(partner,19);
    g.state.party=[left,right];g.state.team=[id,partner];
    const fight=g.state.battle;
    Object.assign(fight,{kind:"expedition",activeId:id,turn:4,weather:keys[b]});
    const {hp:beforeFoe}=fight.enemy,oldLead=left.hp,oldMate=right.hp;
    const snapshot=JSON.stringify(g.state);
    const [option]=g.duets().options;
    assert.equal(JSON.stringify(g.state),snapshot,"previews must be read-only");
    assert.ok(option.available);
    assert.equal(g.useDuet(partner).ok,true);
    assert.equal(beforeFoe-fight.enemy.hp,option.damage,option.name);
    assert.equal(left.hp,oldLead+option.healLead-(option.switchLead?0:option.returnDamage),option.name);
    assert.equal(right.hp,oldMate+option.healPartner-(option.switchLead?option.returnDamage:0),option.name);
    assert.equal(fight.activeId,option.switchLead?partner:id);
    assert.equal(fight.beats,3-option.cost);
    assert.equal(fight.opening,option.opens);
    tested++;
  }
  assert.equal(tested,55);
});

test("an exposed opponent survives reload, guard waits, and its next attack consumes the opening",()=>{
  const {game:g,id,loaded}=encounter("Arc",{kind:"expedition",turn:2,lastPart:"guard"});
  const [mark]=g.duets().options;
  assert.equal(mark.role,"Set up");assert.ok(g.useDuet(id).ok);
  const resumed=loaded.reload().game;
  assert.deepEqual(JSON.parse(JSON.stringify(resumed.state.battle)),JSON.parse(JSON.stringify(g.state.battle)));
  assert.ok(resumed.duets().opening);
  resumed.useSkill("brush-dash");
  assert.ok(resumed.duets().opening);assert.ok(resumed.foeIntent().guarding);
  const compare=boot(JSON.stringify(resumed.state)).game;
  compare.state.battle.opening=false;
  const hp=resumed.state.battle.enemy.hp;
  resumed.useSkill("leaf-flurry");compare.useSkill("leaf-flurry");
  assert.ok(!resumed.duets().opening);
  assert.ok(hp-resumed.state.battle.enemy.hp>2*(hp-compare.state.battle.enemy.hp));
});

test("a restrained foe can be captured and a knocked-out foe cannot retaliate",()=>{
  const {game:g,id}=encounter("Rime");
  g.state.battle.enemy.hp=3;
  const snare=g.duets().options[0];assert.equal(snare.role,"Restraint");
  assert.equal(snare.damage,2);assert.equal(g.useDuet(id).ok,true);
  assert.equal(g.state.battle.enemy.hp,1);assert.ok(g.recruit().ok);
  const {game:other,id:partner}=encounter("Ember");
  other.state.battle.enemy.hp=1;
  const [finish]=other.duets().options;
  assert.equal(finish.returnDamage,0);assert.equal(other.useDuet(partner).kind,"victory");
});

test("old and malformed battle rhythm migrate safely; invalid partners never spend a turn",()=>{
  const {game:g,id}=encounter("Chime");
  const original=g.state.battle;
  original.beats=-300;original.lastPart={bad:true};original.opening="yes";
  const recovered=boot(JSON.stringify(g.state)).game;
  assert.equal(recovered.duets().beats,1);assert.ok(!recovered.duets().opening);
  recovered.state.party.find(p=>p.id===id).hp=0;
  recovered.state.battle.beats=3;
  const before=JSON.stringify(recovered.state);
  for(const invalid of ["sprigkit",id,"dewfin","missing"])assert.ok(!recovered.useDuet(invalid).ok);
  assert.equal(JSON.stringify(recovered.state),before);
});
