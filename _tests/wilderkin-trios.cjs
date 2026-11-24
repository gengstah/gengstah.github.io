const test = require("node:test");
const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const modules = ["atlas","bestiary","call-habitats","wild-calls","activities","story","campaign","duets",
  "fieldwork","growth","wardens","second-bell","sparring-gear","trail-fittings","fitting-notes","third-beat","engine","rehearsal-core"];
const scripts = modules.map(name => new vm.Script(readFileSync(path.join(__dirname,"../games/wilderkin",name+".js"),"utf8"), {filename:name+".js"}));
const key = "wilderkin.trail.v3";
const copy = x => JSON.parse(JSON.stringify(x));
const ok = r => {assert.equal(r?.ok,true,r?.message);return r;};
function boot(saved) {
  let bytes = typeof saved==="string" ? saved : saved ? JSON.stringify(saved) : null, writes=0;
  const window={localStorage:{getItem:k=>k===key?bytes:null,setItem:(k,v)=>{assert.equal(k,key);bytes=v;writes++;}}};
  const ctx=vm.createContext({window});
  scripts.forEach(script=>script.runInContext(ctx));
  return {g:window.WilderGame,w:window,raw:()=>bytes,writes:()=>writes};
}
const kin=(g,id)=>g.state.party.find(p=>p.id===id);
const pick=(g,id,skill)=>g.trio()?.options.find(o=>o.id===id&&o.skill===skill);
const wild=(g,id="mossbell")=>ok(g.startBattle("wild",id));
function wound(g,id){
  ok(g.setLead(id));wild(g);ok(g.useSkill("trail-feint"));ok(g.useSkill("trail-feint"));ok(g.flee());ok(g.setLead("sprigkit"));
}
function openWild(h=boot(),foe="mossbell"){
  const g=h.g;wild(g,foe);assert.equal(g.trio(),null);
  ok(g.useSkill("brush-dash"));assert.equal(g.duets().beats,2);
  ok(g.useDuet("cindlet"));assert.ok(g.trio());return h;
}
function refuse(h,fn){
  const before=JSON.stringify(h.g.state),bytes=h.raw(),writes=h.writes();
  const result=fn();assert.equal(result.ok,false);assert.ok(result.message);
  assert.equal(JSON.stringify(h.g.state),before);assert.equal(h.raw(),bytes);assert.equal(h.writes(),writes);
}
// Control branch: replay precisely the proposed third kin's ordinary move from the same tactical snapshot.
// Changing only the front in this isolated control never grants a switch beat, guard or enemy turn.
function compareOrdinary(h,id,skill){
  const g=h.g, state=JSON.parse(h.raw()), control=boot(state).g;
  control.state.battle.activeId=id;
  control.state.battle.shellGuard=null; delete control.state.battle.emberBrace;
  const projection=control.ordinaryForecast(skill), actual=pick(g,id,skill);
  assert.ok(actual?.available && projection.available,JSON.stringify(actual));
  assert.deepEqual([actual.role,actual.name,actual.type,actual.kinName],
    [projection.skill.kind,projection.skill.name,projection.skill.type,g.kin(id,{owned:true}).name]);
  for(const f of ["damage","healing","returnDamage","finishes"])assert.equal(actual[f],projection[f],f);
  assert.ok(actual.detail);assert.deepEqual(copy(actual.fittingEvents||[]),copy(projection.fittingEvents||[]));
  const turn=g.state.battle.turn, was=g.state.battle.enemy;
  const ordinary=ok(control.useSkill(skill)), follow=ok(g.useTrio(id,skill));
  assert.equal(follow.kind,ordinary.kind);assert.deepEqual(copy(follow.fittingEvents||[]),copy(ordinary.fittingEvents||[]));
  assert.deepEqual(copy(g.state.party),copy(control.state.party));
  assert.deepEqual(copy(g.state.growth),copy(control.state.growth));
  assert.equal(g.trio(),null);
  assert.equal(follow.fieldHp?.[id]??kin(g,id).hp,actual.hpAfter);
  assert.equal(state.party.find(p=>p.id===id).maxHp,actual.maxHp);
  assert.equal(was.hp,actual.foeHpAfter);assert.equal(g.state.battle?.enemy.id||null,actual.foeAfter);
  if(g.state.battle){
    const b=g.state.battle,c=control.state.battle;assert.equal(b.turn,turn+1);assert.equal(b.turn,c.turn);
    assert.equal(b.activeId,c.activeId);assert.equal(b.activeId,actual.activeAfter);
    assert.deepEqual(copy(b.enemy),copy(c.enemy));assert.equal(b.beats,Math.max(0,c.beats-1),"the ordinary part produces no beat on a follow-through");
    assert.equal(b.lastPart,c.lastPart);assert.equal(b.beats,actual.beatsAfter);
    assert.deepEqual(copy(b.remaining),copy(c.remaining));assert.deepEqual(copy(b.coach||null),copy(c.coach||null));
    assert.deepEqual(copy(b.trailFittings||null),copy(c.trailFittings||null));
  }
  return {actual,follow,foe:was};
}

test("Brush Dash and Firebreak open one free entry for the third starter against a genuine charged Briar Bloom",()=>{
  const h=openWild(),g=h.g,t=g.trio(),b=g.state.battle;
  assert.deepEqual([t.source,t.partner,t.duet,t.turn,t.cost],["sprigkit","cindlet","Firebreak",3,0]);
  assert.deepEqual(Array.from(new Set(t.options.map(o=>o.id))),["dewfin"]);
  assert.deepEqual(Array.from(t.options,o=>o.skill).sort(),["bubble-jet","dew-bath","slick-slide"]);
  assert.equal(g.foeIntent().charged,true);assert.equal(g.foeIntent().skill.name,"Briar Bloom");
  assert.equal(b.enemy.hp,11);assert.equal(kin(g,"sprigkit").hp,29);assert.equal(b.beats,0);
  const jet=pick(g,"dewfin","bubble-jet"),glide=pick(g,"dewfin","slick-slide");
  assert.deepEqual([jet.damage,jet.returnDamage,jet.hpAfter,jet.foeHpAfter],[6,17,13,5]);
  assert.deepEqual([glide.damage,glide.returnDamage,glide.hpAfter,glide.foeHpAfter],[7,8,22,4]);
  assert.equal(pick(g,"dewfin","dew-bath").available,false);
  for(const [id,move] of [["sprigkit","leaf-flurry"],["cindlet","ember-pop"],["dewfin","ember-pop"],["dewfin","trail-feint"],
    ["dewfin","dew-bath"],["mossbell","briar-bloom"],["dewfin","wattle-ward"]])refuse(h,()=>g.useTrio(id,move));
  const persisted=h.raw(),n=h.writes();assert.deepEqual(copy(g.trio()),copy(boot(persisted).g.trio()));
  assert.equal(h.writes(),n);compareOrdinary(h,"dewfin","bubble-jet");
  assert.equal(g.state.battle.turn,4);assert.deepEqual(Array.from(g.team(),p=>p.hp),[29,28,13]);
  assert.equal(g.state.battle.beats,0);assert.equal(g.state.lead,"sprigkit");
  refuse(h,()=>g.useTrio("dewfin","slick-slide"));assert.equal(boot(h.raw()).g.trio(),null);
  compareOrdinary(boot(persisted),"dewfin","slick-slide");
});

test("a wounded third uses its own real heal before the charged reply, retaining earned equipment triggers and mastery",()=>{
  const h=boot(),g=h.g;wound(g,"dewfin");const injured=kin(g,"dewfin").hp;
  assert.ok(injured>0 && injured<30);openWild(h);
  const v=pick(g,"dewfin","dew-bath");assert.equal(v.healing,Math.min(30-injured,10));
  assert.equal(v.returnDamage,17);assert.equal(v.hpAfter,injured+v.healing-17);
  compareOrdinary(h,"dewfin","dew-bath");assert.equal(g.growthInfo("dewfin").requirements[1].done,true);
});

test("a normal paid choice relinquishes the immediate handoff without using the encounter's future opportunity",()=>{
  const h=openWild(),g=h.g;refuse(h,()=>g.swap("not-a-kin"));assert.ok(g.trio());
  ok(g.useSkill("sun-nap"));assert.equal(g.trio(),null);assert.equal(g.state.battle.turn,4);
  // Gain another beat without attacking the wounded enemy; a new native duet can reopen on a survivor.
  ok(g.swap("dewfin"));assert.equal(g.state.battle.beats,2);
  ok(g.useDuet("sprigkit"));assert.ok(g.state.battle && g.state.battle.enemy.hp>0);
  const next=g.trio();assert.equal(next.duet,"Rain Garden"); assert.ok(next.options.some(o=>o.id==="cindlet"));
  compareOrdinary(h,"cindlet","cinder-roll");
});

function kit(g,items,crest=false){
  assert.ok(g.visitSite("camp"));ok(g.claimFittings("camp"));
  if(crest){g.state.crests=[0];ok(g.claimFittings("crest"));}
  for(const [id,item] of Object.entries(items))ok(g.equipFitting(id,item));
}
function postgameLodge(ordinal,items={},options={}){
  const h=boot(),g=h.g,region=g.wardens[ordinal],s=g.state;
  // A previously earned trial can be revisited; its real regional roster, moves and coaching remain native.
  s.crests=Array.from(g.wardens.slice(0,ordinal+1));s.visited=Array.from({length:region+1},(_,i)=>i);
  s.region=region;
  if(options.train)for(const p of s.party)Object.assign(p,g.loaner(p.id,options.train));
  kit(g,items);assert.ok(g.visitSite("warden"));ok(g.meetWarden());ok(g.startBattle("warden"));return h;
}
test("only the third's native ordinary move is used; an incoming Relay Bell adds no switch beat and Mend cannot act from zero HP",()=>{
  const h=boot(),g=h.g;kit(g,{dewfin:"relay-bell"});openWild(h);
  assert.equal(g.switchForecast("dewfin").fittingEvents.some(e=>e.id==="relay-bell"),true);
  const f=pick(g,"dewfin","bubble-jet");assert.equal(f.beatsAfter,0);
  assert.ok(!f.fittingEvents?.some(e=>e.id==="relay-bell"));compareOrdinary(h,"dewfin","bubble-jet");
  assert.ok(!g.state.battle.trailFittings.spent.includes("relay-bell"));
  const noThird=boot();kin(noThird.g,"dewfin").hp=0;
  wild(noThird.g);ok(noThird.g.useSkill("brush-dash"));ok(noThird.g.useDuet("cindlet"));
  assert.ok(!noThird.g.trio()?.options.some(o=>o.available));
  refuse(noThird,()=>noThird.g.useTrio("dewfin","dew-bath"));assert.equal(kin(noThird.g,"dewfin").hp,0);
});

test("a real mark duet plus a resisted native attack consumes its opening and the third kin’s Prism Lens once",()=>{
  const h=boot(),g=h.g;kit(g,{dewfin:"prism-lens"},true);
  g.state.party.push(g.loaner("pincoil",5));ok(g.enlist("pincoil"));
  wild(g);ok(g.useSkill("brush-dash"));ok(g.useDuet("pincoil"));
  assert.equal(g.trio().duet,"Root Telegraph");assert.ok(g.state.battle.opening);
  const candidate=pick(g,"dewfin","bubble-jet");assert.deepEqual(Array.from(candidate.fittingEvents,e=>e.id),["prism-lens"]);
  const noLens=JSON.parse(h.raw());delete noLens.trailFittings.gear.dewfin;delete noLens.battle.trailFittings;
  const bare=boot(noLens).g;assert.ok(candidate.damage>pick(bare,"dewfin","bubble-jet").damage);
  const control=boot(h.raw());compareOrdinary(control,"dewfin","bubble-jet");
  if(control.g.state.battle){
    assert.equal(control.g.state.battle.opening,false);
    assert.ok(control.g.state.battle.trailFittings.spent.includes("prism-lens"));
    assert.ok(!control.g.ordinaryForecast("bubble-jet").fittingEvents.some(e=>e.id==="prism-lens"));
  }
});

test("Warden coaching hears the chosen ordinary role, and its forced changes interrupt either side's duet opening",()=>{
  const h=postgameLodge(1,{sprigkit:"opening-pennant"},{train:8}),g=h.g;
  ok(g.useDuet("cindlet"));assert.equal(g.wardenForecast().kind,"cadence");assert.equal(g.wardenForecast().active,true);
  compareOrdinary(h,"dewfin","slick-slide");
  assert.equal(g.state.battle.coach.last,"guard");assert.ok(g.state.battle.coach.heard.includes("cadence"));assert.ok(g.state.battle.opening);

  for(const [ordinal,kind] of [[2,"relay"],[3,"shunt"]]){
    const h=postgameLodge(ordinal,{sprigkit:"opening-pennant"},{train:8}),g=h.g,b=g.state.battle;
    assert.equal(g.wardenForecast().kind,kind);assert.ok(g.wardenForecast().active);
    const active=b.activeId,front=b.enemy.id;
    ok(g.useDuet("cindlet"));
    if(kind==="relay")assert.notEqual(b.enemy.id,front);else assert.notEqual(b.activeId,active);
    assert.equal(g.trio(),null);assert.equal(boot(h.raw()).g.trio(),null);
  }
});

test("the normal Steam Exchange handoff allows its actual third; another native duet cannot reopen after a completion",()=>{
  const h=postgameLodge(1,{sprigkit:"opening-pennant"},{train:8}),g=h.g;
  // Follow an opening Firebreak with a guarding third. Then build two beats with distinct, legal paid commands.
  ok(g.useDuet("cindlet"));ok(g.useTrio("dewfin","slick-slide"));assert.equal(g.state.battle.trioUsed,true);
  ok(g.swap("cindlet"));ok(g.useSkill("cinder-roll"));
  const steam=g.duets().options.find(o=>o.partnerId==="dewfin");assert.ok(steam.available&&steam.switchLead);
  ok(g.useDuet("dewfin"));assert.ok(g.state.battle);assert.equal(g.state.battle.activeId,"dewfin");assert.equal(g.trio(),null);
  const reloaded=boot(h.raw());assert.equal(reloaded.g.state.battle.trioUsed,true);assert.equal(reloaded.g.trio(),null);
  const a=boot();kit(a.g,{cindlet:"opening-pennant"});ok(a.g.setLead("cindlet"));
  wild(a.g,"opalclasp");ok(a.g.useDuet("dewfin"));assert.equal(a.g.state.battle.activeId,"dewfin");
  assert.deepEqual([a.g.trio().source,a.g.trio().partner],["cindlet","dewfin"]);
  assert.deepEqual(Array.from(new Set(a.g.trio().options.map(o=>o.id))),["sprigkit"]);
});

test("a duet that knocks out the foe or loses its front in a real charged reply never opens a free handoff",()=>{
  const h=postgameLodge(1,{sprigkit:"opening-pennant"}),g=h.g,b=g.state.battle;
  const front=b.enemy.id,next=b.remaining[0];assert.ok(next);b.enemy.hp=1;
  ok(g.useDuet("cindlet"));assert.equal(b.enemy.id,next);assert.notEqual(b.enemy.id,front);
  assert.equal(g.trio(),null);assert.equal(boot(h.raw()).g.trio(),null);
  const fragile=boot();kit(fragile.g,{sprigkit:"opening-pennant"});wild(fragile.g);
  const fb=fragile.g.state.battle;fb.turn=3;kin(fragile.g,"sprigkit").hp=1;
  ok(fragile.g.useDuet("cindlet"));assert.equal(kin(fragile.g,"sprigkit").hp,0);
  assert.ok(fragile.g.replacements());assert.equal(fragile.g.trio(),null);
  ok(fragile.g.replaceFainted("dewfin"));assert.equal(fragile.g.trio(),null);
});

test("the armed and spent states survive reload; missing or impossible saved handoffs cannot inject an action",()=>{
  const h=openWild(),g=h.g,saved=JSON.parse(h.raw()),pending=copy(saved.battle.trioWindow);
  assert.deepEqual(pending,{source:"sprigkit",partner:"cindlet",foe:"mossbell",turn:3});
  const load=boot(saved),at=load.g.trio();assert.deepEqual(copy(at),copy(g.trio()));
  for(const update of [
    s=>delete s.battle.trioWindow, s=>s.battle.trioWindow=null, s=>s.battle.trioWindow="sprigkit",
    s=>s.battle.trioWindow.source="__proto__",s=>s.battle.trioWindow.partner="sprigkit",
    s=>s.battle.trioWindow.foe="lustermoth",s=>s.battle.trioWindow.turn=2,
    s=>{s.battle.trioWindow.source="opalclasp";},s=>{s.battle.trioUsed=true;},
    s=>{s.party.find(p=>p.id==="dewfin").hp=0;}
  ]){
    const doc=copy(saved);update(doc);const re=boot(doc);assert.ok(re.g.state.battle);
    assert.ok(!re.g.trio()?.options.some(o=>o.available));refuse(re,()=>re.g.useTrio("dewfin","bubble-jet"));
    assert.equal(re.g.state.battle.turn,3);
  }
  ok(load.g.useTrio("dewfin","bubble-jet"));const {trioPlayed}=load.g.state.battle;
  assert.ok(load.g.state.battle.trioUsed);assert.deepEqual([trioPlayed.source,trioPlayed.partner,trioPlayed.third,trioPlayed.skill,trioPlayed.role,
    trioPlayed.foe,trioPlayed.region,trioPlayed.kind,trioPlayed.turn,trioPlayed.charged,trioPlayed.damageTaken,trioPlayed.hpAfter],
    ["sprigkit","cindlet","dewfin","bubble-jet","attack","mossbell",0,"wild",3,true,17,13]);
  const finished=boot(load.raw()).g;assert.deepEqual(copy(finished.state.battle.trioPlayed),copy(trioPlayed));assert.equal(finished.trio(),null);
  for(const bad of [{charged:"true"},{role:"heal"},{third:"cindlet"},{foe:"not-a-kin"},{turn:4},{hpAfter:80},{damageTaken:-1},{region:1}]){
    const doc=JSON.parse(load.raw());Object.assign(doc.battle.trioPlayed,bad);
    const g=boot(doc).g;assert.equal(g.state.battle.trioUsed,true);
    assert.equal(g.state.battle.trioPlayed,undefined);assert.equal(g.trio(),null);
  }
});

test("rehearsal checkpoints restore the pair and every participant; replaying the third can fork to another actual native skill",()=>{
  const h=boot(),g=h.g,w=h.w.WilderRehearsal.create({game:g});assert.ok(g.visitSite("camp"));
  const bytes=h.raw(),writes=h.writes(),career=JSON.stringify(g.state);
  ok(w.start({kind:"wild",region:0,foe:"mossbell",team:["sprigkit","cindlet","dewfin"],lead:"sprigkit"}));
  ok(w.act("useSkill","brush-dash"));ok(w.act("useDuet","cindlet"));
  const p=w.read().game,formation=copy(p.state),offers=copy(p.trio());
  ok(w.act("useTrio","dewfin","bubble-jet"));const jet=copy(p.state);
  assert.equal(w.read().history.at(-1).method,"useTrio");assert.ok(w.read().rewindLabel.includes("Bubble Jet"));
  assert.equal(jet.battle.trioPlayed.damageTaken,17);
  ok(w.rewind());assert.deepEqual(copy(p.state),formation);assert.deepEqual(copy(p.trio()),offers);
  assert.equal(w.act("useTrio","cindlet","bubble-jet").ok,false);assert.deepEqual(copy(p.state),formation);
  ok(w.act("useTrio","dewfin","slick-slide"));assert.equal(p.state.battle.trioPlayed.damageTaken,8);
  assert.notDeepEqual(copy(p.state),jet);assert.equal(p.trio(),null);w.leave();
  assert.equal(JSON.stringify(g.state),career);assert.equal(h.raw(),bytes);assert.equal(h.writes(),writes);
});

test("no trio action enters an exhibition or a borrowed Circuit bout and the next ordinary encounter resets it",()=>{
  const h=boot(),g=h.g;assert.ok(g.visitSite("warden"));ok(g.startBattle("second-bell"));assert.ok(g.state.battle.secondBell);
  ok(g.useSkill("brush-dash"));ok(g.useDuet("cindlet"));assert.ok(g.state.battle);
  assert.equal(g.trio(),null);refuse(h,()=>g.useTrio("dewfin","bubble-jet"));ok(g.flee());
  const snapshot={region:0,team:["sprigkit","cindlet","dewfin"],party:g.team().map(p=>g.loaner(p.id,5)),lead:"sprigkit",battle:null};
  const career=h.raw(),writes=h.writes();g.withLoaners(snapshot,start=>{
    ok(start(["mossbell"],8,"Round one"));ok(g.useSkill("brush-dash"));ok(g.useDuet("cindlet"));assert.equal(g.trio(),null);
    assert.equal(g.useTrio("dewfin","slick-slide").ok,false);
  });
  assert.equal(h.raw(),career);assert.equal(h.writes(),writes);
  openWild(h);ok(g.useTrio("dewfin","slick-slide"));ok(g.flee());ok(g.heal());openWild(h);
  assert.equal(g.state.battle.trioUsed===true,false);assert.ok(pick(g,"dewfin","bubble-jet").available);
});

test("a charged follow-through can faint, or spend the third's own Lifeline Stitch; no credited survival is fabricated",()=>{
  for(const stitch of [false,true]){
    const h=boot(),g=h.g;if(stitch)kit(g,{dewfin:"last-stitch"});kin(g,"dewfin").hp=4;
    openWild(h);const p=pick(g,"dewfin","bubble-jet");
    assert.equal(p.returnDamage,stitch?3:4);assert.equal(p.hpAfter,stitch?1:0);
    assert.deepEqual(Array.from(p.fittingEvents,e=>e.id),stitch?["last-stitch"]:[]);
    compareOrdinary(h,"dewfin","bubble-jet");
    assert.equal(g.state.battle.trioPlayed.charged,stitch);
    if(stitch)assert.equal(g.state.battle.activeId,"dewfin");else{
      assert.ok(g.replacements());assert.equal(g.state.battle.activeId,p.activeAfter);
      ok(g.replaceFainted("cindlet"));assert.equal(g.trio(),null);
    }
  }
});

test("a terminal trio reports the actual combat HP before career XP, makes no forecast writes and suppresses the reply",()=>{
  const h=boot(),g=h.g;kin(g,"dewfin").xp=30;
  openWild(h);g.state.battle.enemy.hp=1;assert.ok(g.setSound(true).ok);
  const before=h.raw(),writes=h.writes(),v=pick(g,"dewfin","bubble-jet");assert.ok(v.finishes);
  assert.equal(v.returnDamage,0);assert.equal(v.hpAfter,30);assert.equal(v.maxHp,30);
  assert.equal(v.foeHpAfter,0);assert.equal(v.activeAfter,null);assert.equal(v.foeAfter,null);
  assert.equal(h.raw(),before);assert.equal(h.writes(),writes);
  const {follow}=compareOrdinary(h,"dewfin","bubble-jet");
  assert.equal(follow.kind,"victory");assert.equal(follow.fieldHp.dewfin,30);
  assert.equal(kin(g,"dewfin").level,6);assert.equal(kin(g,"dewfin").hp,33);
});

test("the caught third's Pincer Block can really learn and expose on this charge; its worn Mender’s Wrap heals a different living partner",()=>{
  const h=boot(),g=h.g;wild(g,"opalclasp");ok(g.useSkill("trail-feint"));ok(g.useSkill("trail-feint"));ok(g.recruit());ok(g.heal());
  kit(g,{opalclasp:"mender-wrap"},true);wound(g,"cindlet");
  openWild(h);const forecast=pick(g,"opalclasp","pincer-block"),patient=kin(g,"cindlet"),hp=patient.hp;
  const mender=forecast.fittingEvents.find(e=>e.id==="mender-wrap");assert.equal(mender.target,"cindlet");assert.ok(mender.heal>0);
  assert.equal(g.guardTraining("opalclasp").learned,false);const {follow}=compareOrdinary(h,"opalclasp","pincer-block");
  assert.equal(follow.learnedGuard,g.guardTraining("opalclasp").name);assert.ok(g.guardTraining("opalclasp").learned);
  assert.equal(g.state.battle.enemy.pincerOpening,true);assert.equal(patient.hp,hp+mender.heal);
  const resume=boot(h.raw()).g;assert.ok(resume.guardTraining("opalclasp").learned);
  assert.deepEqual(copy(resume.state.battle.trailFittings.spent),["mender-wrap"]);
});

test("a posted field expedition accepts a player-owned trio through the commission's normal battle entry",()=>{
  const h=boot(),g=h.g;kit(g,{sprigkit:"opening-pennant"});
  const job=g.expedition();assert.ok(g.visitSite(job.targetSite));
  const route=g.expedition().choices.find(c=>c.available&&c.foes>0);assert.ok(route);
  ok(g.expeditionAction(route.id));assert.equal(g.state.battle.kind,"expedition");
  ok(g.useDuet("cindlet"));assert.equal(g.trio().turn,2);
  const next=boot(h.raw());compareOrdinary(next,"dewfin","slick-slide");
  assert.equal(next.g.state.battle.trioPlayed.kind,"expedition");
  assert.equal(next.g.state.battle.trioPlayed.region,0);
});

test("Iona signs three bells on the real first-crest route, and a damaged journal entry cannot reset that career",()=>{
  let h=boot(),g=h.g;
  function reload(){h=boot(h.raw());g=h.g;}
  function fight(){
    for(let n=0;g.state.battle&&n<100;n++){
      if(g.replacements())ok(g.replaceFainted(g.replacements().defaultId));
      const choices=g.kin(g.state.battle.activeId,{owned:true}).skills.filter(s=>!s.trained&&["attack","guard"].includes(s.kind))
        .map(s=>({id:s.id,f:g.ordinaryForecast(s.id)})).filter(c=>c.f.available);
      choices.sort((a,b)=>(b.f.damage-.3*b.f.returnDamage)-(a.f.damage-.3*a.f.returnDamage));
      ok(g.useSkill(choices[0].id));
    }
    assert.equal(g.state.battle,null);
  }
  function opening(expectedHit){
    ok(g.useSkill("brush-dash"));ok(g.useDuet("cindlet"));reload();
    const option=pick(g,"dewfin","slick-slide"),n=h.writes();
    assert.equal(option.returnDamage,expectedHit);assert.equal(g.foeIntent().charged,true);
    ok(g.useTrio("dewfin","slick-slide"));assert.equal(h.writes(),n+1);
    const stamp=g.state.battle.trioPlayed;
    assert.deepEqual([stamp.charged,stamp.damageTaken,stamp.hpAfter],[true,expectedHit,option.hpAfter]);
    reload();assert.equal(g.state.battle.trioPlayed.damageTaken,expectedHit);
  }

  wild(g);opening(8);assert.deepEqual(Object.keys(g.state.thirdBeat).sort(),["first","guard"]);fight();
  assert.ok(g.visitSite("camp"));ok(g.heal());ok(g.setLead("cindlet"));
  while(!g.expedition().done){
    assert.ok(g.visitSite("camp"));ok(g.heal());const leg=g.expedition();assert.ok(g.visitSite(leg.targetSite));
    const route=leg.choices.filter(c=>c.available).sort((a,b)=>a.foes-b.foes)[0];ok(g.expeditionAction(route.id));
    if(g.state.battle)fight();
  }
  while(!h.w.WilderStory.chapterDone(g.state,0)){
    const chapter=h.w.WilderStory.scene(g.state,"chapter-1");ok(g.storyStep("chapter-1",chapter.choices[0]?.id));
  }
  assert.ok(g.visitSite("camp"));ok(g.heal());ok(g.setLead("sprigkit"));assert.ok(g.visitSite("warden"));
  ok(g.meetWarden());assert.ok(g.trialAccess().open);ok(g.startBattle("warden"));opening(9);
  assert.ok(!g.state.thirdBeat.warden);fight();reload();
  assert.ok(g.state.crests.includes(0));assert.deepEqual(Object.keys(g.state.thirdBeat).sort(),["first","guard","warden"]);
  assert.deepEqual(Array.from(h.w.WilderThirdBeat.song(g),n=>[n.id,n.note]),[["sprigkit","C3"],["cindlet","E4"],["dewfin","D5"]]);

  const valid=JSON.parse(h.raw()),damaged=copy(valid);
  damaged.thirdBeat.guard.charged=false;damaged.thirdBeat.warden.third="missing-kin";
  const restored=boot(damaged);
  assert.deepEqual(copy(restored.g.state.thirdBeat),{first:valid.thirdBeat.first});assert.equal(restored.w.WilderThirdBeat.song(restored.g),null);
  assert.deepEqual(copy(restored.g.state.crests),valid.crests);assert.deepEqual(copy(restored.g.state.party),valid.party);
  assert.equal(restored.g.state.wins,valid.wins);
});
