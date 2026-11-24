const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const scripts=["atlas","bestiary","activities","campaign","story","duets","growth","engine"].map(id=>{
  const file=path.join(__dirname,"../games/wilderkin",id+".js");
  return new vm.Script(fs.readFileSync(file,"utf8"),{filename:file});
});
const copy=x=>JSON.parse(JSON.stringify(x));
function load(record=null){
  const window={localStorage:{getItem:key=>key==="wilderkin.trail.v3"?record:null,setItem:(_,s)=>{record=s;}}};
  const ctx=vm.createContext({window});scripts.forEach(s=>s.runInContext(ctx));
  return {g:window.WilderGame,story:window.WilderStory,dex:window.WilderKinDex,reload:()=>load(record)};
}
const ok=r=>assert.ok(r.ok,r.message);
function mission(h){
  const {g,story,dex}=h;
  function fight(){
    for(let i=0;i<80&&g.state.battle;i++){
      const b=g.state.battle,a=g.state.party.find(p=>p.id===b.activeId);
      const best=g.species[a.id].skills.filter(s=>s.kind!=="heal").sort((x,y)=>score(y)-score(x))[0];
      function score(s){return dex.effectiveness(s.type,g.species[b.enemy.id].types)*s.power*(s.kind==="guard"?1.12:1);}
      const candidates=g.duets().options.filter(o=>o.available&&o.damage>score(best)).sort((a,b)=>b.damage-a.damage);
      if(candidates.length)ok(g.useDuet(candidates[0].partnerId));else ok(g.useSkill(best.id));
    }
    assert.equal(g.state.battle,null);
  }
  const rest=()=>{assert.ok(g.visitSite("camp"));ok(g.heal());};
  const ordinal=g.state.region;
  for(let i=0;!g.expedition().done&&i<12;i++){
    rest();const job=g.expedition();assert.ok(g.visitSite(job.targetSite));
    const choice=g.expedition().choices.filter(c=>c.available).sort((a,b)=>a.foes-b.foes)[0];
    ok(g.expeditionAction(choice.id));if(g.state.battle)fight();
  }
  assert.ok(g.expedition().done);
  const id="chapter-"+(ordinal+1);
  while(!story.chapterDone(g.state,ordinal))ok(g.storyStep(id,story.scene(g.state,id).choices[0]?.id));
  rest();assert.ok(g.visitSite("warden"));ok(g.meetWarden());ok(g.startBattle("warden"));fight();
  assert.ok(g.state.crests.includes(ordinal));ok(g.travel(ordinal+1));
}

test("the first three regions and ordinary trail actions can unlock all starter forms",()=>{
  const h=load(),g=h.g;
  assert.ok(g.visitSite("camp"));assert.ok(!g.chooseGrowth("sprigkit","hedgekeeper").ok);
  assert.ok(g.growthInfo("sprigkit").requirements.every(r=>!r.done));
  ok(g.startBattle("wild","mossbell"));ok(g.useSkill("trail-feint"));ok(g.useSkill("trail-feint"));
  assert.ok(g.foeIntent().charged);ok(g.useSkill("brush-dash"));ok(g.useDuet("cindlet"));if(g.state.battle)ok(g.flee());
  ok(g.setLead("dewfin"));ok(g.startBattle("wild","mossbell"));ok(g.useSkill("slick-slide"));ok(g.useSkill("dew-bath"));ok(g.flee());
  assert.ok(g.state.team.every(id=>g.growthInfo(id).requirements[1].done));
  mission(h);assert.ok(g.growthInfo("sprigkit").earned&&g.growthInfo("cindlet").earned);
  assert.ok(!g.growthInfo("dewfin").earned);mission(h);
  assert.ok(g.visitSite("camp"));
  const party=copy(g.state.party),roster=copy(g.state.team),seen=copy(g.state.seen);
  for(const id of roster){
    const info=g.growthInfo(id);assert.ok(info.earned);
    ok(g.chooseGrowth(id,info.disciplines[0].id));
    const who=g.kin(id,{owned:true});
    assert.equal(who.id,id);assert.equal(who.name,info.formName);assert.equal(who.appearanceId,info.formId);
    assert.equal(who.ability,g.species[id].ability);assert.deepEqual(who.types,g.species[id].types);
    assert.equal(who.skills.length,4);assert.equal(g.kin(id).skills.length,3);
    ok(g.growthAppearance(id,true));assert.equal(g.kin(id,{owned:true}).appearanceId,id);
    ok(g.chooseGrowth(id,info.disciplines[1].id));assert.equal(g.kin(id,{owned:true}).skills[3].id,info.disciplines[1].skill.id);
    ok(g.chooseGrowth(id,null));assert.ok(!g.kin(id,{owned:true}).formId);
  }
  assert.deepEqual(copy(g.state.party),party);assert.deepEqual(copy(g.state.team),roster);assert.deepEqual(copy(g.state.seen),seen);
  assert.ok(h.reload().g.growthInfo("dewfin").earned);
});

function ready(id,discipline,opts={}){
  const base=load().g,save=copy(base.state);
  save.region=0;save.crests=[0,1];save.visited=[0,1,2];save.landmark="camp";save.lead=id;
  save.growth[id].demonstrated=true;save.growth[id].selected=discipline;
  const h=load(JSON.stringify(save)),g=h.g;ok(g.startBattle("wild","mossbell"));
  const b=g.state.battle;
  Object.assign(b,{turn:3,beats:3,...opts});
  return h;
}
test("a two-hit ward follows a switch and survives reloading between replies",()=>{
  const h=ready("sprigkit","hedgekeeper"),g=h.g,lead=g.team()[0];
  const plan=g.skillPreview("wattle-ward"),hp=lead.hp;assert.ok(plan.available);
  ok(g.useSkill("wattle-ward"));assert.equal(lead.hp,hp-plan.returnDamage);assert.equal(g.state.battle.cover,1);
  const g2=h.reload().g;assert.equal(g2.state.battle.cover,1);
  assert.ok(!g2.skillPreview("wattle-ward").available);
  const other=load(JSON.stringify(g2.state)).g;other.state.battle.cover=0;
  ok(g2.swap("cindlet"));ok(other.swap("cindlet"));
  assert.ok(g2.team()[1].hp>other.team()[1].hp);assert.equal(g2.state.battle.cover,0);
});
test("Briar Seam breaks a guard, refunds exactly one beat and exposes the target",()=>{
  const {g}=ready("sprigkit","seamreader",{turn:4,kind:"expedition",beats:1});
  assert.ok(g.foeIntent().guarding);const p=g.skillPreview("briar-seam"),hp=g.state.battle.enemy.hp;
  ok(g.useSkill("briar-seam"));assert.equal(g.state.battle.beats,1);assert.equal(g.state.battle.enemy.hp,hp-p.damage);
  assert.ok(g.state.battle.opening);ok(g.useSkill("leaf-flurry"));assert.ok(!g.state.battle?.opening);
});
test("Kilnwing can interrupt a charge or exchange its health and place for a partner's beats",()=>{
  const {g}=ready("cindlet","fluewatch",{turn:2,beats:1}),id="backdraft-cut";
  const snapshot=JSON.stringify(g.state);assert.ok(!g.useSkill(id).ok);assert.equal(JSON.stringify(g.state),snapshot);
  g.state.battle.turn=3;const hp=g.team()[1].hp;assert.ok(g.skillPreview(id).available);
  const reply=g.useSkill(id);ok(reply);assert.ok(reply.skipCounterFx);assert.equal(g.team()[1].hp,hp);assert.equal(g.state.battle.turn,4);
  const {g:relay}=ready("cindlet","kindler",{beats:1});
  const offer=relay.skillPreview("cinder-handoff"),leader=relay.team()[1],other=relay.team()[2],before=other.hp;
  assert.equal(offer.target,"dewfin");ok(relay.useSkill("cinder-handoff"));assert.equal(relay.state.battle.beats,3);
  assert.equal(relay.state.battle.activeId,"dewfin");assert.equal(leader.maxHp-leader.hp,offer.tax);assert.equal(other.hp,before-offer.returnDamage);
});
test("Harbor Pool treats the most injured conscious partner and forecasts the leader's return damage",()=>{
  const {g}=ready("dewfin","harborhand"),id="harbor-pool";
  assert.ok(!g.skillPreview(id).available);
  const [hurt,down,lead]=g.team();hurt.hp=3;down.hp=0;
  const before=lead.hp,p=g.skillPreview(id);assert.equal(p.target,hurt.id);ok(g.useSkill(id));
  assert.equal(hurt.hp,3+p.healing);assert.equal(down.hp,0);assert.equal(lead.hp,before-p.returnDamage);
});
test("Turn the Lock preserves the exact HP of duplicate species as they rotate, reload, and return",()=>{
  const {g}=ready("dewfin","lockpilot",{kind:"expedition",remaining:["mossbell","mossbell"],beats:3});
  const [first,second,third]=[8,14,19];
  g.state.battle.enemy.hp=first;g.state.battle.reserveHp=[second,third];
  const oldHp=g.team()[2].hp,p=g.skillPreview("turn-the-lock");const outcome=g.useSkill("turn-the-lock");
  ok(outcome);assert.ok(outcome.foeShifted);assert.equal(g.team()[2].hp,oldHp-p.returnDamage);
  assert.equal(g.state.battle.enemy.hp,second);assert.deepEqual(Array.from(g.state.battle.reserveHp),[third,first]);
  const restored=load(JSON.stringify(g.state)).g;
  // A trained ally finishes the front opponent. The next opponent arrives with its stored injuries.
  restored.state.battle.enemy.hp=1;ok(restored.useSkill("bubble-jet"));assert.equal(restored.state.battle.enemy.hp,third);
  restored.state.battle.enemy.hp=1;ok(restored.useSkill("bubble-jet"));assert.equal(restored.state.battle.enemy.hp,first);
  restored.state.battle.beats=2;ok(restored.useSkill("turn-the-lock"));assert.ok(restored.state.battle.opening);
});
test("loaner fights cannot award training proof or borrow a campaign discipline; old saves load untrained",()=>{
  const {g}=ready("cindlet","kindler");
  const prior=JSON.stringify(g.state.growth);const guest={party:["cindlet","dewfin"].map(id=>g.loaner(id,18)),team:["cindlet","dewfin"],region:0,lead:"cindlet",battle:null};
  g.withLoaners(guest,start=>{
    ok(start(["mossbell"],18,"school"));assert.equal(g.kin("cindlet",{owned:true}).skills.length,3);
    ok(g.useSkill("cinder-roll"));ok(g.useDuet("dewfin"));assert.ok(!g.chooseGrowth("cindlet","kindler").ok);
  });
  assert.equal(JSON.stringify(g.state.growth),prior);assert.equal(g.kin("cindlet",{owned:true}).skills.length,4);
  const legacy=copy(g.state);delete legacy.growth;delete legacy.battle.cover;delete legacy.battle.reserveHp;
  const old=load(JSON.stringify(legacy)).g;assert.equal(old.kin("cindlet",{owned:true}).skills.length,3);
  assert.equal(old.state.battle.cover,0);assert.equal(old.growthInfo("cindlet").selected,null);
});
