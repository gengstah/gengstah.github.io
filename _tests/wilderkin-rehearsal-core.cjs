const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const root=path.join(__dirname,"../games/wilderkin");
const files=["atlas","bestiary","call-habitats","wild-calls","activities","story","campaign","duets",
  "fieldwork","growth","wardens","second-bell","sparring-gear","trail-fittings","fitting-notes","engine","rehearsal-core","world"];
const script=name=>new vm.Script(fs.readFileSync(path.join(root,name+".js"),"utf8"),{filename:name+".js"});
const scripts=files.map(script),trailKey="wilderkin.trail.v3",copy=x=>JSON.parse(JSON.stringify(x));
const ok=r=>{assert.equal(r?.ok,true,r?.message);return r;};
function boot(store=new Map()){
  const writes=[],reads=[];
  const localStorage={getItem:k=>{reads.push(k);return store.get(k)??null;},setItem:(k,v)=>{writes.push(k);store.set(k,v);},
    removeItem:k=>{writes.push(k);store.delete(k);},key:i=>[...store.keys()][i]??null,get length(){return store.size;}};
  const noop=()=>{};
  const document={createElement(){const canvas={};canvas.getContext=()=>({canvas,drawImage:noop,fillRect:noop,putImageData:noop,
    beginPath:noop,lineTo:noop,moveTo:noop,stroke:noop,createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)})});return canvas;}};
  const ctx=vm.createContext({document,window:{localStorage}});
  scripts.forEach(s=>s.runInContext(ctx));
  return {g:ctx.window.WilderGame,w:ctx.window,store,reads,writes};
}
function at(h,kind){
  const site=h.w.WilderWorld.regions[h.g.state.region].sites.find(s=>(s.kind||s.id)===kind);
  assert.ok(site);assert.ok(h.g.setPosition(site.x,site.y));assert.ok(h.g.visitSite(kind));
}
function campaignFrame(g){
  const b=g.state.battle;
  return {party:copy(g.team()),id:b.activeId,enemy:copy(b.enemy),remaining:copy(b.remaining),turn:b.turn,
    beats:b.beats,intent:copy(g.foeIntent()),gear:copy(b.trailFittings||null),cover:b.cover,opening:b.opening};
}
function compareForecasts(a,b){
  assert.deepEqual(campaignFrame(a),campaignFrame(b));
  for(const s of a.kin(a.state.battle.activeId,{owned:true}).skills){
    assert.deepEqual(copy(a.ordinaryForecast(s.id)),copy(b.ordinaryForecast(s.id)));
    assert.deepEqual(copy(a.skillPreview(s.id)),copy(b.skillPreview(s.id)));
  }
}

function fightToWin(g){
  let res;
  for(let n=0;g.state.battle&&n<100;n++){
    const options=g.kin(g.state.battle.activeId,{owned:true}).skills.filter(s=>s.kind==="attack"||s.kind==="guard")
      .map(s=>{const f=g.ordinaryForecast(s.id);return {score:f.damage-.3*f.returnDamage,do:()=>g.useSkill(s.id)};});
    for(const d of g.duets().options.filter(o=>o.available))
      options.push({score:d.damage-.3*d.returnDamage,do:()=>g.useDuet(d.partnerId)});
    res=ok(options.sort((a,b)=>b.score-a.score)[0].do());
  }
  assert.equal(res.kind,"victory");
}
// Capture Opalclasp, learn Pincer Hold, and earn Fern's crest and Sprigkit's named discipline through normal actions.
function fieldVeteran(){
  const h=boot(),g=h.g;
  at(h,"camp");ok(g.claimFittings("camp"));ok(g.equipFitting("sprigkit","opening-pennant"));
  ok(g.startBattle("wild","opalclasp"));ok(g.useSkill("trail-feint"));ok(g.useSkill("trail-feint"));ok(g.recruit());
  ok(g.setLead("opalclasp"));ok(g.startBattle("wild","mossbell"));
  for(let n=0;n<3;n++)ok(g.useSkill("pincer-block"));
  assert.ok(g.guardTraining("opalclasp").learned);ok(g.flee());
  at(h,"camp");ok(g.heal());ok(g.setLead("sprigkit"));ok(g.startBattle("wild","mossbell"));
  ok(g.useSkill("trail-feint"));ok(g.useSkill("trail-feint"));ok(g.useSkill("brush-dash"));ok(g.flee());ok(g.setLead("cindlet"));
  while(!g.expedition().done){
    at(h,"camp");ok(g.heal());const job=g.expedition();at(h,job.targetSite);
    const route=job.choices.filter(c=>c.available).sort((a,b)=>a.foes-b.foes)[0];
    ok(g.expeditionAction(route.id));if(g.state.battle)fightToWin(g);
  }
  while(!h.w.WilderStory.chapterDone(g.state,0)){
    const scene=h.w.WilderStory.scene(g.state,"chapter-1");ok(g.storyStep("chapter-1",scene.choices[0]?.id));
  }
  at(h,"camp");ok(g.heal());at(h,"warden");ok(g.meetWarden());ok(g.startBattle("warden"));fightToWin(g);
  ok(g.travel(1));at(h,"camp");ok(g.chooseGrowth("sprigkit","hedgekeeper"));ok(g.claimFittings("crest"));
  ok(g.equipFitting("dewfin","prism-lens"));ok(g.equipFitting("opalclasp","last-stitch"));ok(g.travel(0));
  at(h,"camp");ok(g.heal());ok(g.setLead("sprigkit"));ok(g.startBattle("wild","mossbell"));ok(g.useSkill("brush-dash"));ok(g.flee());
  assert.ok(g.team()[0].hp<g.team()[0].maxHp);return h;
}

function rehearsal(h){
  return h.w.WilderRehearsal.create({game:h.g});
}
function options(desk,kind,foe,team,lead){
  const target=desk.targets().find(t=>t.kind===kind&&(kind==="warden"||t.foe===foe));
  assert.ok(target,"missing "+kind+" target "+foe);
  return {kind,foe:target.foe,region:target.region,team,lead};
}
function snapshot(h){return {state:copy(h.g.state),bytes:h.store.get(trailKey),writes:h.writes.length,reads:h.reads.length};}
function unchanged(h,old){
  assert.deepEqual(copy(h.g.state),old.state);assert.equal(h.store.get(trailKey),old.bytes);
  assert.equal(h.writes.length,old.writes,"rehearsal made a storage write");assert.equal(h.reads.length,old.reads,"rehearsal touched career storage");
}
let played;
function veteran(){
  if(!played)played=fieldVeteran().store.get(trailKey);
  return boot(new Map([[trailKey,played]]));
}
test("the choices are published local tracks and a Warden the traveler has actually met",()=>{
  const h=boot(),desk=rehearsal(h),start=snapshot(h);
  assert.equal(desk.read(),null);const rows=desk.targets();
  assert.deepEqual(Array.from(rows.filter(t=>t.kind==="wild"),t=>t.foe).sort(),Array.from(h.g.pools[0]).sort());
  assert.ok(rows.filter(t=>t.kind==="wild").every(t=>t.region===0&&t.name&&t.level===h.g.wildLevel(0)));
  assert.ok(!rows.some(t=>t.kind==="warden"));assert.equal(desk.targets(999).length,0);
  const choose=options(desk,"wild","mossbell",["sprigkit","dewfin"],"dewfin");
  for(const bad of [{...choose,foe:"coalmoth"},{...choose,region:100},{...choose,kind:"second-bell"},
    {...choose,team:["sprigkit","sprigkit"]},{...choose,team:["gustlance"]},{...choose,lead:"cindlet"},{...choose,team:[]}]){
    assert.equal(desk.preview(bad),null);assert.equal(desk.start(bad).ok,false);assert.equal(desk.read(),null);
  }
  unchanged(h,start);at(h,"warden");ok(h.g.meetWarden());
  const fern=desk.targets().find(t=>t.kind==="warden");assert.ok(fern);assert.equal(fern.level,h.g.regions[0].wardenLevel);
  assert.ok(fern.roster.length>=1);const now=snapshot(h);
  assert.equal(desk.start({...choose,kind:"warden",foe:"flint"}).ok,false);
  ok(desk.start({...choose,kind:"warden",foe:fern.foe}));const w=desk.read().game;
  assert.equal(w.state.battle.kind,"warden");assert.equal(w.state.battle.enemy.id,fern.roster[0]);
  assert.equal(w.state.battle.enemy.level,fern.level);assert.equal(w.wardenForecast().kind,"screen");
  unchanged(h,now);
});
test("full-health practice reproduces a genuinely trained party's exact skills, gear, charged reply and rotations",()=>{
  const h=veteran(),g=h.g,d=rehearsal(h),opts=options(d,"wild","mossbell",Array.from(g.state.team),"sprigkit");
  const old=snapshot(h),actual=boot(new Map(h.store));
  at(actual,"camp");ok(actual.g.heal());ok(actual.g.startBattle("wild","mossbell"));const real=actual.g;
  const preview=d.preview(opts);assert.ok(preview);assert.equal(preview.kin("sprigkit",{owned:true}).name,"Brackenveil");
  assert.deepEqual(copy(preview.guardTraining("opalclasp")),copy(g.guardTraining("opalclasp")));
  assert.equal(preview.kin("sprigkit",{owned:true}).skills[3].id,"wattle-ward");
  assert.equal(g.team()[0].hp,30);assert.equal(preview.team()[0].hp,32);
  assert.deepEqual(copy(preview.state.bag),copy(g.state.bag));assert.equal(d.read(),null);
  ok(d.start(opts));const sim=d.read().game;assert.notEqual(sim,preview);compareForecasts(sim,real);
  assert.equal(sim.state.battle.beats,2);assert.deepEqual(copy(sim.state.battle.trailFittings.spent),["opening-pennant"]);
  for(const [method,argument] of [["useSkill","wattle-ward"],["swap","opalclasp"],["useSkill","pincer-block"],["swap","dewfin"],["useSkill","bubble-jet"]]){
    const trail=ok(real[method](argument)),local=ok(d.act(method,argument));assert.equal(local.kind,trail.kind);
    compareForecasts(d.read().game,real);
  }
  const p=d.read().game;assert.equal(p.state.battle.enemy.hp,11);assert.equal(p.state.battle.activeId,"dewfin");
  assert.ok(p.state.battle.trailFittings.spent.includes("prism-lens"));assert.equal(p.team().find(k=>k.id==="dewfin").hp,26);
  unchanged(h,old);
});
test("practice spends the copied stock and finishes a real opponent without granting career rewards, catches or notes",()=>{
  const h=veteran(),g=h.g,d=rehearsal(h),opts=options(d,"wild","mossbell",["dewfin","sprigkit"],"dewfin"),old=snapshot(h);
  ok(d.start(opts));assert.ok(!d.read().game.state.team.includes("cindlet"));
  for(const id of ["recruit","answerWildCall","setLead","setSound","reset","constructor","__proto__"]){
    const before=copy(d.read().game.state);assert.equal(d.act(id,"mossbell").ok,false);
    assert.deepEqual(copy(d.read().game.state),before);
  }
  ok(d.act("useSkill","bubble-jet"));const sim=d.read().game;
  assert.ok(sim.state.battle.trailFittings.spent.includes("prism-lens"));
  const xp=Array.from(sim.team(),p=>[p.id,p.level,p.xp]),priorWins=sim.state.wins;
  assert.deepEqual(copy(sim.state.fittingNotes),{});
  const bag=sim.state.bag.balm;
  const medicine=sim.itemForecast("balm","dewfin");assert.ok(medicine.available);ok(d.act("useItem","balm","dewfin"));
  assert.equal(sim.state.bag.balm,bag-1);assert.equal(sim.team()[0].hp,medicine.activeHpAfter);
  while(sim.state.battle.enemy.hp>sim.state.battle.enemy.maxHp/2)ok(d.act("useSkill","bubble-jet"));
  const vulnerable=copy(sim.state);
  assert.equal(d.act("useItem","kinweave","dewfin").ok,false);
  assert.equal(sim.useItem("kinweave").ok,false,"the returned combat scope must also preserve the no-capture rule");
  assert.deepEqual(copy(sim.state),vulnerable);
  for(let i=0;d.read().phase==="battle"&&i<30;i++)ok(d.act("useSkill","bubble-jet"));
  const finished=d.read();assert.equal(finished.phase,"done");assert.equal(finished.result.kind,"victory");
  assert.equal(d.act("useSkill","bubble-jet").ok,false);
  assert.deepEqual(Array.from(sim.team(),p=>[p.id,p.level,p.xp]),xp);assert.equal(sim.state.wins,priorWins);
  assert.deepEqual(copy(sim.state.fittingNotes),{});unchanged(h,old);
});
test("an owned off-team kin may rehearse at full health; retry uses the original party and supplies after career changes",()=>{
  const from=veteran(),data=copy(from.g.state);data.team=data.team.filter(id=>id!=="opalclasp");
  data.party.find(p=>p.id==="opalclasp").hp=0;
  const h=boot(new Map([[trailKey,JSON.stringify(data)]])),g=h.g,d=rehearsal(h);
  const opts=options(d,"wild","mossbell",["opalclasp","sprigkit"],"opalclasp");
  ok(d.start(opts));const initial=campaignFrame(d.read().game);
  assert.deepEqual(Array.from(d.read().game.team(),p=>p.id),opts.team);
  assert.equal(d.read().game.team()[0].hp,d.read().game.team()[0].maxHp);
  assert.equal(g.state.party.find(p=>p.id==="opalclasp").hp,0);assert.ok(!g.state.team.includes("opalclasp"));
  ok(d.act("useSkill","pincer-block"));const during=campaignFrame(d.read().game);
  assert.equal(rehearsal(h).read(),null);assert.equal(rehearsal(boot(new Map(h.store))).read(),null);
  // Deliberately advance the actual career, including its fitting, without touching the in-memory bout.
  at(h,"camp");ok(g.heal());ok(g.equipFitting("opalclasp",null));ok(g.setLead("cindlet"));
  ok(g.startBattle("wild","gustlance"));ok(g.useSkill("cinder-roll"));ok(g.flee());
  assert.deepEqual(campaignFrame(d.read().game),during);const career=snapshot(h);
  ok(d.retry());assert.deepEqual(campaignFrame(d.read().game),initial);
  assert.equal(d.read().game.state.battle.trailFittings.gear.opalclasp,"last-stitch");
  ok(d.act("flee"));assert.equal(d.read().phase,"done");d.leave();assert.equal(d.read(),null);
  unchanged(h,career);
});
test("the charged opponent reference switches to a published Warden reserve and never mutates or registers a trial",()=>{
  const h=veteran(),g=h.g;ok(g.travel(1));at(h,"warden");ok(g.meetWarden());
  const d=rehearsal(h),opts=options(d,"warden",null,["sprigkit","dewfin"],"dewfin");
  const target=d.targets().find(t=>t.kind==="warden");assert.ok(target.roster.length>=2);
  const old=snapshot(h),absent=g.pools[1].find(id=>!target.roster.includes(id));assert.ok(absent);
  assert.equal(d.reference(opts,absent),null);
  for(const id of target.roster){
    const ref=d.reference(opts,id);assert.ok(ref);
    assert.equal(ref.state.battle.enemy.id,id);assert.equal(ref.state.battle.enemy.level,target.level);
    assert.equal(ref.state.battle.enemy.hp,ref.state.battle.enemy.maxHp);assert.equal(ref.foeIntent().charged,true);
    assert.equal(ref.state.battle.activeId,"dewfin");assert.ok(ref.team().every(p=>p.hp===p.maxHp));
    assert.equal(ref.state.battle.cover,0);assert.equal(ref.state.battle.opening,false);assert.equal(ref.state.battle.lastAttack,null);
    assert.equal(ref.state.battle.trailFittings?.spent.length||0,0);
  }
  assert.equal(d.read(),null);unchanged(h,old);
});
test("rewind restores spent fittings, HP, medicine, beats and history exactly, and allows a different choice after a knockout",()=>{
  const h=veteran(),d=rehearsal(h),opts=options(d,"wild","mossbell",["dewfin","sprigkit"],"dewfin"),old=snapshot(h);
  ok(d.start(opts));const sim=d.read().game;
  const opening=copy(sim.state);assert.equal(d.read().canRewind,false);assert.equal(d.rewind().ok,false);
  ok(d.act("useSkill","bubble-jet"));assert.ok(sim.state.battle.trailFittings.spent.includes("prism-lens"));
  assert.equal(d.read().rewindLabel,"Bubble Jet");assert.equal(d.act("useItem","sparkseed","dewfin").ok,false);
  assert.equal(d.read().rewindLabel,"Bubble Jet");ok(d.rewind());assert.equal(d.rewind().ok,false);
  assert.deepEqual(copy(sim.state),opening);assert.deepEqual(copy(d.read().history),[]);assert.equal(d.read().rewindLabel,null);
  ok(d.act("swap","sprigkit"));assert.equal(sim.state.battle.activeId,"sprigkit");
  assert.ok(!sim.state.battle.trailFittings.spent.includes("prism-lens"));
  ok(d.retry());const second=d.read().game;ok(d.act("useSkill","bubble-jet"));
  const wounded=copy(second.state);ok(d.act("useItem","balm","dewfin"));assert.equal(second.state.bag.balm,wounded.bag.balm-1);
  assert.match(d.read().rewindLabel,/balm.*Dewfin/i);ok(d.rewind());assert.deepEqual(copy(second.state),wounded);
  // Make a different, legal treatment choice, then play the opponent to its final hit.
  ok(d.act("useItem","tonic","dewfin"));
  while(!second.ordinaryForecast("bubble-jet").finishes)ok(d.act("useSkill","bubble-jet"));
  const decision=copy(second.state),history=copy(d.read().history);ok(d.act("useSkill","bubble-jet"));
  assert.equal(d.read().phase,"done");assert.equal(d.read().result.kind,"victory");
  assert.equal(d.act("useSkill","bubble-jet").ok,false);assert.equal(d.read().rewindLabel,"Bubble Jet");
  ok(d.rewind());assert.equal(d.read().phase,"battle");assert.deepEqual(copy(d.read().history),history);
  assert.deepEqual(copy(second.state),decision);assert.equal(d.rewind().ok,false);
  ok(d.act("swap","sprigkit"));assert.equal(second.state.battle.enemy.hp,decision.battle.enemy.hp);
  assert.equal(d.read().phase,"battle");unchanged(h,old);
});
test("a victory over newly met Fern and a solo defeat to Flint have no trail payouts or forced rest",()=>{
  const h=boot(),g=h.g,d=rehearsal(h);at(h,"warden");ok(g.meetWarden());
  const old=snapshot(h),opts=options(d,"warden",null,["cindlet","sprigkit"],"cindlet");ok(d.start(opts));
  const local=d.read().game,bag=copy(local.state.bag),leads=Array.from(local.team(),p=>[p.level,p.xp]);
  ok(d.act("useSkill","cinder-roll"));
  for(let t=0;d.read().phase==="battle"&&t<20;t++)ok(d.act("useSkill","ember-pop"));
  assert.equal(d.read().result.kind,"victory");assert.deepEqual(copy(local.state.crests),[]);
  assert.deepEqual(copy(local.state.wardenLessons),[]);assert.deepEqual(copy(local.state.bag),bag);
  assert.deepEqual(Array.from(local.team(),p=>[p.level,p.xp]),leads);unchanged(h,old);
  const v=veteran(),y=rehearsal(v);ok(v.g.travel(1));at(v,"warden");ok(v.g.meetWarden());
  const trail=snapshot(v);ok(y.start(options(y,"warden",null,["cindlet"],"cindlet")));
  for(let t=0;y.read().phase==="battle"&&t<20;t++)ok(y.act("useSkill","ember-pop"));
  assert.equal(y.read().phase,"done");assert.equal(y.read().result.kind,"defeat");assert.equal(y.read().game.team()[0].hp,0);
  ok(y.rewind());assert.ok(y.read().game.team()[0].hp>0);assert.equal(y.read().phase,"battle");
  unchanged(v,trail);
});

test("an earned Warden is available from a later camp with the original regional rules; remote wilds and unmet trials stay local",()=>{
  const h=veteran(),g=h.g,d=rehearsal(h);ok(g.travel(1));at(h,"camp");
  const old=snapshot(h),remote=d.targets(0);
  assert.deepEqual(Array.from(remote,t=>[t.kind,t.region,t.name]),[["warden",0,"Warden Fern"]]);
  const fern=remote[0];assert.equal(fern.level,g.regions[0].wardenLevel);assert.deepEqual(copy(fern.roster),copy(g.wardenRoster(0)));
  const opts={kind:"warden",region:0,foe:fern.foe,team:["sprigkit","dewfin"],lead:"sprigkit"};
  assert.equal(d.preview({...opts,kind:"wild",foe:"mossbell"}),null);
  const local=boot(new Map(h.store));ok(local.g.travel(0));at(local,"camp");ok(local.g.heal());
  at(local,"warden");ok(local.g.startBattle("warden"));
  const remotePreview=d.preview(opts);assert.ok(remotePreview);
  assert.equal(remotePreview.state.region,0);assert.equal(remotePreview.foeIntent().skill.name,local.g.foeIntent().skill.name);
  assert.equal(remotePreview.wardenForecast().title,local.g.wardenForecast().title);
  assert.equal(remotePreview.state.battle.enemy.level,local.g.state.battle.enemy.level);
  ok(d.start(opts));const scope=d.read().game;assert.equal(scope.state.region,0);assert.equal(scope.state.battle.beats,2);
  assert.equal(scope.kin("sprigkit",{owned:true}).name,"Brackenveil");
  assert.deepEqual(copy(scope.state.battle.trailFittings.gear),{sprigkit:"opening-pennant",dewfin:"prism-lens"});
  ok(d.act("useSkill","brush-dash"));ok(d.act("flee"));unchanged(h,old);
  ok(g.travel(0));assert.ok(g.state.visited.includes(1));assert.equal(g.state.met.includes(1),false);
  assert.equal(d.targets(1).length,0,"a visited trail alone does not introduce its Warden");
  ok(g.travel(1));at(h,"warden");ok(g.meetWarden());ok(g.travel(0));
  assert.equal(g.state.crests.includes(1),false);
  assert.deepEqual(Array.from(d.targets(1),t=>t.name),["Warden Flint"]);
});

test("Buried Spring shows its real healing even when Backdraft recovers the foe and cancels the lead's HP gain",()=>{
  const h=veteran(),g=h.g,desk=rehearsal(h);
  script("chalkyard-duets").runInNewContext({window:h.w});
  const region=27,team=["flintstilt","sprigkit"];
  g.state.region=region;
  g.state.party=team.map(id=>g.loaner(id,g.wildLevel(region)));
  g.state.team=team;
  const setup={kind:"wild",region,foe:"cinderplate",team,lead:"flintstilt"},original=snapshot(h);
  const [plan]=h.w.WilderChalkyardDuets.lines(desk,setup);
  assert.deepEqual(Array.from(plan.steps,s=>s.label),["Clay Anchor","Buried Spring"]);
  assert.equal(plan.partnerName,"Brackenveil");
  const duet=plan.steps[1];
  assert.match(duet.detail,/24 damage · Cinderplate 89 → 95 HP/);
  assert.match(duet.detail,/Cinderplate recovered 30 HP after the hit/);
  assert.match(duet.detail,/Flintstilt healed 13 HP before the reply/);

  ok(desk.start(setup));
  ok(desk.act("useSkill","clay-anchor"));
  const branch=desk.read().game,lead=branch.team()[0],before=lead.hp;
  assert.equal(branch.state.battle.enemy.hp,89);
  assert.equal(branch.foeIntent().skill.name,"Backdraft");
  const actual=ok(desk.act(duet.method,duet.arg));
  assert.match(actual.message,/Restored 13 \/ 0 HP\. Cinderplate used Backdraft for 13 damage\. Cinderplate recovered 30 HP/);
  assert.equal(lead.hp,before);
  assert.equal(branch.state.battle.enemy.hp,95);
  assert.equal(plan.foeHp,branch.state.battle.enemy.hp);
  unchanged(h,original);
});
