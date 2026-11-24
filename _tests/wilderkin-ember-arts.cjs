const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const ctx=vm.createContext({window:{}});
for(const name of ["atlas","bestiary","activities","campaign","story","duets","engine","sparring-gear","sparring-signatures","sparring-battle"]){
  const filename=path.join(__dirname,"../games/wilderkin",name+".js");
  vm.runInContext(fs.readFileSync(filename,"utf8"),ctx,{filename});
}
const game=ctx.window.WilderGame,sim=ctx.window.WilderSparringBattle.create({game});
const copy=x=>JSON.parse(JSON.stringify(x));
const rivals=["mossbell","cindlet","glimmeray"];
function take(p,id){const next=sim.apply(p,id);assert.ok(next,id);return next;}
const ember=p=>sim.options(p).filter(m=>m.emberArtId);

test("each of the 26 families contributes exactly its two Ember variants; the trait never replaces an ordinary skill or family pass",()=>{
  const shapes=new Map(),shared=new Map();
  for(const k of Object.values(game.species)){
    const expected=k.description.includes("a flame crest")?"banked-warmth":k.description.includes("glowing vent scales")?"backdraft":null;
    assert.equal(k.emberArt?.id??null,expected,k.name);
    if(!expected)continue;
    const art=k.emberArt,shape=ctx.window.WilderKinDex.shapeOf(k.id);
    assert.ok(Object.isFrozen(art));assert.equal(art.cost,0);assert.equal(art.uses,1);
    if(shared.has(expected))assert.equal(art,shared.get(expected));else shared.set(expected,art);
    const entries=shapes.get(shape)||[];
    entries.push(expected);shapes.set(shape,entries);
    assert.ok(k.skills.every(s=>s.id!==expected));
    const p=sim.start([k.id,"sprigkit","dewfin"],rivals);
    const moves=ember(p);
    assert.ok(moves.length>0 && moves.every(m=>m.emberArtId===expected));
    if(shape==="heron"||shape==="glider")assert.ok(sim.options(p).some(m=>m.kind==="signature"));
  }
  assert.equal(shapes.size,26);
  for(const entries of shapes.values())assert.deepEqual(entries.sort(),["backdraft","banked-warmth"]);
  assert.equal(game.species.cindlet.emberArt,undefined);
});

test("Banked Warmth treats one wounded living reserve, holds the lead under a normal breakable brace and spends only that kin’s art",()=>{
  const left=["dewfin","charquill","charpad"];
  let p=sim.start(left,rivals,1,{left:{charquill:"mender-wrap"}});
  p=take(p,"skill:briar-bloom");p=take(p,"swap:charquill");p=take(p,"skill:briar-bloom");
  const side=p.sides[0],lead=side.team[1],patient=side.team[0];
  const prev=copy(p),f=sim.forecast(p,"warmth:dewfin"),expected=Math.min(patient.maxHp-patient.hp,Math.floor(patient.maxHp/4));
  assert.ok(f.available);assert.equal(f.healPartner,expected);assert.equal(f.heal,expected);
  assert.equal(f.healLead,0);assert.equal(f.damage,0);assert.equal(f.cover,.5);
  assert.equal(f.beatsAfter,side.beats);assert.ok(!f.gearEvents);
  assert.equal(sim.forecast(p,"warmth:charpad").available,false);
  assert.equal(sim.forecast(p,"warmth:charquill"),null);
  assert.deepEqual(copy(p),prev);
  const warmed=take(p,"warmth:dewfin"),our=warmed.sides[0],original=side.team.map(k=>k.hp);
  assert.equal(our.active,1);assert.equal(our.team[1].hp,original[1]);assert.equal(our.team[2].hp,original[2]);
  assert.equal(our.team[0].hp,original[0]+expected);assert.equal(our.team[1].recovery,lead.recovery);
  assert.equal(our.team[1].emberArtSpent,true);assert.equal(our.team[1].spent,false);
  assert.equal(our.beats,side.beats);assert.equal(our.lastPart,side.lastPart);
  assert.equal(our.cover,.5);assert.equal(our.braced,true);assert.deepEqual(copy(sim.restore(warmed)),copy(warmed));
  const fire=sim.forecast(warmed,"skill:briar-bloom"),uncovered=copy(warmed);
  uncovered.sides[0].cover=1;uncovered.sides[0].braced=false;
  assert.equal(fire.damage,Math.round(sim.forecast(uncovered,"skill:briar-bloom").damage/2));
  assert.match(sim.forecast(warmed,"skill:shell-bump").detail,/breaks brace/);
  p=take(warmed,"skill:briar-bloom");
  assert.equal(p.sides[0].team[1].hp,original[1]-fire.damage);
  assert.equal(sim.forecast(p,"warmth:dewfin").available,false);
  assert.equal(sim.apply(p,"warmth:dewfin"),null);
  p=take(p,"swap:charpad");p=take(p,"skill:briar-bloom");
  assert.ok(sim.forecast(p,"warmth:charquill").available);
  p.sides[0].team[0].hp=0;
  assert.equal(sim.forecast(p,"warmth:dewfin"),null);
  p.sides[0].team[1].hp=p.sides[0].team[1].maxHp-1;
  assert.equal(sim.forecast(p,"warmth:charquill").heal,1);
});

test("Backdraft can strike from full health and separately caps recovery; normal cover, exposure, equipment, and counter stances apply",()=>{
  const left=["kilnbeak","sprigkit","dewfin"],right=["glimmeray","mossbell","fernprickle"];
  const p=sim.start(left,right),f=sim.forecast(p,"vent:backdraft");
  assert.ok(f.available);assert.equal(f.heal,0);assert.equal(f.damage,9);assert.equal(f.cover,1);
  const holder=p.sides[0].team[0];holder.hp-=1;
  assert.equal(sim.forecast(p,"vent:backdraft").heal,1);
  holder.hp=27;p.sides[0].beats=2;p.sides[0].lastPart="strike";
  p.sides[1].cover=.5;
  assert.equal(sim.forecast(p,"vent:backdraft").damage,5);
  const hot=sim.forecast(p,"vent:backdraft"),released=take(p,"vent:backdraft");
  assert.equal(hot.healLead,Math.floor(holder.maxHp/4));assert.equal(released.sides[0].team[0].hp,27+hot.healLead);
  assert.equal(released.sides[1].team[0].hp,p.sides[1].team[0].hp-hot.damage);
  assert.equal(released.sides[0].team[0].recovery,1);assert.equal(released.sides[0].team[0].emberArtSpent,true);
  assert.equal(released.sides[0].beats,2);assert.equal(released.sides[0].lastPart,"strike");
  assert.deepEqual(copy(sim.restore(released)),copy(released));
  const again=take(released,"skill:lunar-surge");assert.equal(sim.forecast(again,"vent:backdraft").available,false);
  const lens=sim.start(left,right,0,{left:{kilnbeak:"prism-lens"},right:{glimmeray:"last-stitch"}});
  lens.sides[1].cover=.25;lens.sides[1].team[0].exposed=true;lens.sides[1].team[0].hp=18;
  const forecast=sim.forecast(lens,"vent:backdraft"),burnt=take(lens,"vent:backdraft");
  assert.equal(forecast.consumeMark,true);assert.equal(forecast.damage,17);
  assert.deepEqual(copy(forecast.gearEvents.map(e=>e.gearId)),["prism-lens","last-stitch"]);
  assert.equal(burnt.sides[1].team[0].hp,1);assert.equal(burnt.sides[1].team[0].exposed,false);
  assert.ok(burnt.sides.every(side=>side.team[0].spent));
  const seam=sim.start(left,["fernprickle","dewfin","mossbell"],1,{left:{kilnbeak:"seam-hook"}});
  const stance=take(seam,"stance:thorn-read");
  stance.sides[1].team[0].exposed=true;stance.sides[1].beats=3;
  const die=sim.forecast(stance,"vent:backdraft"),countered=take(stance,"vent:backdraft");
  assert.equal(die.thornResponse.attackerId,"kilnbeak");assert.equal(die.gearEvents[0].gearId,"seam-hook");
  assert.equal(countered.sides[1].beats,2);assert.equal(countered.sides[0].team[0].exposed,true);
  assert.equal(countered.sides[1].team[0].exposed,false);assert.equal(countered.sides[0].team[0].spent,true);
});

test("the warmth bearer can stay braced through quiet replies; the next real hit or leaving the field clears its protection",()=>{
  let p=sim.start(["dewfin","charquill","sprigkit"],rivals,1);
  for(const id of ["skill:briar-bloom","swap:charquill","skill:briar-bloom","warmth:dewfin","swap:cindlet"])p=take(p,id);
  const side=p.sides[0];assert.equal(side.warmthBrace,"charquill");assert.equal(side.braced,true);assert.equal(side.cover,.5);
  assert.deepEqual(copy(sim.restore(p)),copy(p));
  assert.equal(sim.forecast(p,"skill:crosswind-cut").cover,.5);
  for(const id of ["swap:dewfin","beacon:dewfin"]){
    const switched=take(p,id);assert.equal(switched.sides[0].warmthBrace,undefined);
    assert.equal(switched.sides[0].braced,false);
    assert.equal(switched.sides[0].cover,sim.forecast(p,id).cover||1);
  }
  p=take(p,"skill:crosswind-cut");p=take(p,"skill:rekindle");p=take(p,"skill:hearth-rush");
  assert.equal(p.sides[0].warmthBrace,"charquill");assert.equal(p.sides[0].cover,.5);
  const bare=copy(p);delete bare.sides[0].warmthBrace;bare.sides[0].cover=1;bare.sides[0].braced=false;
  const reduced=sim.forecast(p,"skill:ember-pop").damage,normal=sim.forecast(bare,"skill:ember-pop").damage;
  assert.equal(reduced,Math.round(normal/2));
  const before=p.sides[0].team[1].hp;
  p=take(p,"skill:ember-pop");
  assert.equal(p.sides[0].team[1].hp,before-reduced);
  assert.equal(p.sides[0].warmthBrace,undefined);assert.equal(p.sides[0].cover,1);
  const forged=copy(p);forged.sides[0].warmthBrace="charquill";assert.equal(sim.restore(forged),null);
});

test("two different tactical situations let the Hall coach recommend different Ember arts",()=>{
  const support=sim.start(["charquill","sprigkit","dewfin"],["dewfin","charquill","glimmeray"]);
  support.sides[0].team[1].hp=10;support.sides[0].team[2].hp=17;support.sides[1].team[0].hp=72;
  assert.equal(sim.recommend(support).id,"warmth:sprigkit");
  const attack=sim.start(["kilnbeak","sprigkit","dewfin"],rivals);
  attack.sides[0].team[0].hp=22;attack.sides[0].team[1].hp=19;attack.sides[0].team[2].hp=32;
  assert.equal(sim.recommend(attack).id,"vent:backdraft");
});

test("v1 Bellpost always replays original moves and unmarked old Hall saves restore with unused arts",()=>{
  const a=["kilnbeak","charquill","dewfin"];
  let v1=sim.start(a,rivals,0,undefined,1),latest=sim.start(a,rivals,0,undefined,2);
  assert.equal(v1.protocol,1);assert.equal(latest.protocol,undefined);
  assert.equal(sim.restore(v1).protocol,1);assert.equal(ember(v1).length,0);
  for(const id of ["skill:hearth-rush","skill:shell-bump","swap:charquill","skill:briar-bloom"]){
    assert.deepEqual(copy(sim.options(v1)),copy(sim.options(latest).filter(m=>!m.emberArtId)));
    v1=take(v1,id);latest=take(latest,id);
    const stripped=copy(v1);delete stripped.protocol;
    assert.deepEqual(stripped,copy(latest));
  }
  assert.ok(ember(latest).length);assert.ok(!ember(v1).length);
  const saved=copy(latest);assert.deepEqual(copy(sim.restore(saved)),saved);
  saved.sides[0].team[1].emberArtSpent=true;
  assert.ok(sim.restore(saved));saved.protocol=1;assert.equal(sim.restore(saved),null);
  delete saved.protocol;saved.sides[0].team[2].emberArtSpent=true;assert.equal(sim.restore(saved),null);
  const opening=sim.start(a,rivals);opening.sides[0].team[0].emberArtSpent=true;assert.equal(sim.restore(opening),null);
});
