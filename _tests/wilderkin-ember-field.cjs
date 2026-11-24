const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const scripts = ["atlas","bestiary","activities","campaign","story","duets","growth","wardens","wild-calls","engine"].map(name => {
  const filename = path.join(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(fs.readFileSync(filename,"utf8"),{filename});
});
const ok = r => assert.ok(r.ok,r.message);
const key = "wilderkin.trail.v3";

function boot(record) {
  const store = new Map(record ? [[key,record]] : []);
  const localStorage = {getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
  const context = vm.createContext({window:{localStorage}});
  for(const script of scripts)script.runInContext(context);
  return {g:context.window.WilderGame,reload:()=>boot(store.get(key)).g};
}

function party(lead="charquill") {
  const run=boot(),{g}=run;
  for(const id of ["charquill","kilnbeak","charpad"]){
    g.state.party.push(g.loaner(id,7));
    ok(g.enlist(id));
  }
  ok(g.setLead(lead));
  ok(g.startBattle("wild","mossbell"));
  return run;
}

const kin=(g,id)=>g.team().find(p=>p.id===id);
const front=g=>kin(g,g.state.battle.activeId);

test("Banked Warmth forecasts the chosen living reserve and half reply, persists per kin, and leaves beats untouched",()=>{
  const {g,reload}=party(),lead=front(g),b=g.state.battle;
  assert.match(g.emberTechnique().reason,/missing HP/);
  const patient=kin(g,"dewfin");
  patient.hp=4;kin(g,"sprigkit").hp=0;b.lastPart="switch";b.beats=0;
  const plan=g.emberTechnique(),target=plan.targets.find(p=>p.id===patient.id);
  assert.equal(plan.available,true);
  assert.equal(target.heal,Math.floor(patient.maxHp/4));assert.equal(target.hpAfter,4+target.heal);
  for(const id of [undefined,lead.id,"sprigkit","cindlet","mossbell"]){
    const before=JSON.stringify(g.state);
    assert.equal(g.useEmberTechnique(id).ok,false);assert.equal(JSON.stringify(g.state),before);
  }
  const hp=lead.hp,foeHp=b.enemy.hp;
  const result=g.useEmberTechnique(patient.id);
  ok(result);assert.match(result.message,/Charquill used Banked Warmth/);
  assert.equal(lead.hp,hp-plan.returnDamage);assert.equal(patient.hp,target.hpAfter);
  assert.equal(b.enemy.hp,foeHp);assert.equal(b.activeId,lead.id);assert.equal(b.beats,0);assert.equal(b.lastPart,"switch");
  const resumed=reload();
  assert.equal(resumed.emberTechnique().used,true);assert.equal(resumed.useEmberTechnique(patient.id).ok,false);
  ok(resumed.swap("charpad"));assert.equal(resumed.emberTechnique().available,true);
  ok(resumed.useEmberTechnique(patient.id));
  assert.deepEqual([...resumed.state.battle.emberUsers],["charquill","charpad"]);
  ok(resumed.flee());ok(resumed.startBattle("wild","mossbell"));assert.equal(resumed.emberTechnique().used,false);
});

test("Banked Warmth carries through support, survives reload and is consumed only by the holder's hit",()=>{
  const {g,reload}=party(),b=g.state.battle,patient=kin(g,"dewfin");
  b.kind="warden";b.coach={heard:[],screen:0,charge:false,last:null,action:null};delete b.wildCall;
  patient.hp--;assert.equal(g.foeIntent().support,true);
  assert.equal(g.emberTechnique().targets.find(t=>t.id==="dewfin").heal,1);
  ok(g.useEmberTechnique("dewfin"));assert.equal(b.emberBrace,"charquill");
  const resumed=reload(),lead=front(resumed),attack=resumed.kin(lead.id).skills.find(s=>s.kind==="attack");
  const plan=resumed.ordinaryForecast(attack.id),before=lead.hp;
  assert.ok(plan.returnDamage>0);ok(resumed.useSkill(attack.id));assert.equal(lead.hp,before-plan.returnDamage);
  assert.equal(resumed.state.battle.emberBrace,undefined);
  const switched=reload();ok(switched.swap("dewfin"));assert.equal(switched.state.battle.emberBrace,undefined);
});

test("Backdraft shares guard, exposure and echo strike arithmetic, spends only its own art and can finish before reply",()=>{
  for(const mark of ["opening","beaconMarked","pincerOpening"]){
    const {g}=party("kilnbeak"),b=g.state.battle,lead=front(g);
    b.kind="expedition";delete b.wildCall;b.turn=4;b.condition="echo";b.lastAttack="backdraft";b.lastPart="guard";b.beats=2;
    assert.equal(g.foeIntent().guarding,true);
    const guarded=g.emberTechnique();assert.equal(guarded.available,true);assert.equal(guarded.healing,0);
    b.enemy.emberBrace=true;
    const covered=g.emberTechnique();assert.ok(covered.damage<guarded.damage);
    if(mark==="opening")b.opening=true;else b.enemy[mark]=true;
    lead.hp-=11;
    const plan=g.emberTechnique();
    assert.ok(plan.exposed && !plan.braced && plan.repeated && plan.damage>guarded.damage);
    assert.equal(plan.healing,Math.min(11,Math.floor(lead.maxHp/4)));
    const hp=lead.hp,enemyHp=b.enemy.hp;ok(g.useEmberTechnique());
    assert.equal(b.enemy.hp,enemyHp-plan.damage);assert.equal(lead.hp,hp+plan.healing-plan.returnDamage);
    assert.ok(!b.opening&&!b.enemy.beaconMarked&&!b.enemy.pincerOpening&&!b.enemy.emberBrace);
    assert.equal(b.beats,2);assert.equal(b.lastPart,"guard");assert.equal(g.emberTechnique().available,false);
  }
  const {g}=party("kilnbeak"),b=g.state.battle; b.enemy.hp=1;b.lastPart="strike";
  const plan=g.emberTechnique();assert.equal(plan.healing,0);assert.equal(plan.finishes,true);assert.equal(plan.returnDamage,0);
  assert.equal(g.useEmberTechnique().kind,"victory");assert.equal(g.state.battle,null);
  assert.equal(g.emberTechnique(),null);
});

test("a waiting wild invitation or forced replacement cannot be bypassed by an Ember art",()=>{
  const {g}=party("kilnbeak"),b=g.state.battle;
  b.pendingFallen="sprigkit";let before=JSON.stringify(g.state);
  assert.equal(g.useEmberTechnique().ok,false);assert.equal(JSON.stringify(g.state),before);
  delete b.pendingFallen;b.wildCall={quarry:b.enemy.id,answered:{actor:"dewfin",skill:"bubble-jet"}};
  before=JSON.stringify(g.state);
  assert.match(g.emberTechnique().reason,/Kinweave/);assert.equal(g.useEmberTechnique().ok,false);
  assert.equal(JSON.stringify(g.state),before);
});

test("opponents telegraph their Ember art and carry individual use through a real formation and legacy restore",()=>{
  const {g}=party(),b=g.state.battle;
  // Explicit expedition formation with a wounded bench, after its first round.
  delete b.wildCall;b.kind="expedition";b.enemy=g.loaner("charquill",7);b.turn=2;
  b.remaining=["kilnbeak","charquill"];b.reserveHp=b.remaining.map(id=>g.loaner(id,7).maxHp-8);
  let intent=g.foeIntent();assert.equal(intent.emberArt,"banked-warmth");assert.equal(intent.patientId,"kilnbeak");
  const patient=b.reserveHp[0],guard=g.kin(b.activeId).skills.find(s=>s.kind==="guard");
  let result=g.useSkill(guard.id);ok(result);
  assert.equal(b.reserveHp[0],patient+intent.heal);assert.equal(b.enemy.emberArtSpent,true);
  assert.equal(b.enemy.emberBrace,true);assert.equal(result.foeHeal,true);
  b.turn=5;assert.equal(g.foeIntent().emberArt,undefined);
  const plan=g.ordinaryForecast(guard.id),before=b.enemy.hp;ok(g.useSkill(guard.id));
  assert.equal(b.enemy.hp,before-plan.damage);assert.equal(b.enemy.emberBrace,undefined);
  b.enemy.hp=1;ok(g.useSkill(guard.id));
  assert.equal(b.enemy.id,"kilnbeak");assert.equal(b.enemy.emberArtSpent,undefined);
  b.turn=8;intent=g.foeIntent();assert.equal(intent.skill.name,"Backdraft");assert.equal(intent.power,6);
  const next=g.ordinaryForecast(guard.id),allyHp=front(g).hp,foeHp=b.enemy.hp;
  result=g.useSkill(guard.id);ok(result);
  const foeHeal=Math.min(b.enemy.maxHp-foeHp+next.damage,Math.floor(b.enemy.maxHp/4));
  assert.equal(b.enemy.hp,foeHp-next.damage+foeHeal);assert.equal(front(g).hp,allyHp-next.returnDamage);
  assert.equal(b.enemy.emberArtSpent,true);assert.match(result.message,/Backdraft.+recovered/);
  b.turn=9;assert.equal(g.foeIntent().charged,true);
  const old=party().g;assert.equal(boot(JSON.stringify(old.state)).g.emberTechnique().used,false);
});

test("duplicate crest opponents retain separate charges through forced rotation and save restoration",()=>{
  const old=boot().g,s=old.state;
  s.lead="dewfin";s.crests=[...old.wardens];s.region=old.homes.charquill[0];s.visited=[0,s.region];
  s.growth.dewfin.demonstrated=true;s.growth.dewfin.selected="lockpilot";
  const ability=old.regions[s.region].ability;
  if(ability && !s.party.some(p=>old.species[p.id].ability===ability)){
    const carrier=Object.values(old.species).find(k=>k.ability===ability);s.party.push(old.loaner(carrier.id,7));
  }
  const {g,reload}=boot(JSON.stringify(s)),bench=g.pools[s.region].find(id=>id!=="charquill");
  ok(g.startBattle("wild","charquill"));
  const b=g.state.battle;delete b.wildCall;
  b.kind="expedition";b.beats=3;b.turn=2;b.enemy=g.loaner("charquill",7);b.enemy.hp-=9;
  b.remaining=["charquill",bench];b.reserveHp=b.remaining.map(id=>g.loaner(id,7).maxHp-5);
  const guard=g.kin("dewfin").skills.find(s=>s.kind==="guard");
  ok(g.useSkill(guard.id));assert.equal(b.enemy.emberArtSpent,true);assert.equal(b.enemy.emberBrace,true);
  b.turn=5;
  const preview=g.skillPreview("turn-the-lock");
  assert.equal(preview.replySkill.name,"Banked Warmth");
  const out=g.useSkill("turn-the-lock");ok(out);assert.equal(b.enemy.id,"charquill");
  assert.equal(b.enemy.emberArtSpent,true);assert.equal(b.enemy.emberBrace,true);
  assert.deepEqual([...b.reserveEmber],[false,true]);
  assert.equal(b.reserveHp[0],g.loaner(bench,7).maxHp);
  const resumed=reload(),next=resumed.state.battle;
  assert.equal(next.enemy.emberArtSpent,true);assert.equal(next.enemy.emberBrace,true);
  assert.deepEqual([...next.reserveEmber],[false,true]);
  next.enemy.hp=1;ok(resumed.useSkill("bubble-jet"));
  next.enemy.hp=1;ok(resumed.useSkill("bubble-jet"));
  assert.equal(next.enemy.id,"charquill");assert.equal(next.enemy.emberArtSpent,true);
  assert.equal(next.enemy.emberBrace,undefined);
});

test("a free Backdraft between two ordinary strikes produces no extra duet beat",()=>{
  const {g}=party("kilnbeak"),b=g.state.battle,attack=g.species.kilnbeak.skills.find(s=>s.kind==="attack");
  b.enemy=g.loaner("mossbell",18);delete b.wildCall;
  ok(g.useSkill(attack.id));const beats=b.beats;
  ok(g.useEmberTechnique());assert.equal(b.beats,beats);assert.equal(b.lastPart,"strike");
  ok(g.useSkill(attack.id));assert.equal(b.beats,beats);
});
