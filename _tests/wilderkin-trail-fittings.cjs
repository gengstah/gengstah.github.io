const test=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm"),fs=require("node:fs"),path=require("node:path");
const scripts=["atlas","bestiary","activities","campaign","story","duets","growth","wardens","second-bell",
  "wild-calls","sparring-gear","trail-fittings","fitting-notes","engine"].map(name=>{
  const filename=path.join(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(fs.readFileSync(filename,"utf8"),{filename});
});
const key="wilderkin.trail.v3",copy=x=>JSON.parse(JSON.stringify(x));
const ok=result=>{assert.equal(result?.ok,true,result?.message);return result;};
function boot(raw=null,sharedStore){
  const store=sharedStore||new Map(raw?[[key,raw]]:[]);
  let saves=0;
  const localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>{saves++;store.set(k,v);}};
  const bus=new EventTarget();
  const ctx=vm.createContext({window:{localStorage,Event,dispatchEvent:e=>bus.dispatchEvent(e),
    addEventListener:(name,fn)=>bus.addEventListener(name,fn)}});
  scripts.forEach(s=>s.runInContext(ctx));
  return {g:ctx.window.WilderGame,window:ctx.window,saves:()=>saves,reload:()=>boot(store.get(key))};
}
const member=(g,id)=>g.state.party.find(p=>p.id===id);
const wild=(g,foe="mossbell")=>ok(g.startBattle("wild",foe));
function add(g,id,level=5){
  g.state.party.push(g.loaner(id,level));g.state.seen.push(id);ok(g.enlist(id));
}
function action(g,fn){
  const before=copy(g.state);const result=fn();assert.equal(result.ok,false);
  assert.deepEqual(copy(g.state),before,result.message);
}
const allGear=["opening-pennant","relay-bell","mender-wrap","prism-lens","seam-hook","last-stitch"];
const fitted=(g,id)=>g.state.battle?.trailFittings?.spent.includes(id)===true;
const event=(preview,id)=>preview.fittingEvents?.find(e=>e.id===id);
function issue(g,assignments){
  assert.ok(g.visitSite("camp"));ok(g.claimFittings("camp"));
  // A saved, earned first crest unlocks the second case; the trial itself has its own suite.
  g.state.crests=[g.wardens[0]];ok(g.claimFittings("crest"));
  for(const [id,item] of Object.entries(assignments))ok(g.equipFitting(id,item));
}
test("the two claimed cases, explicitly consented transfers and one-copy equipment persist at camp",()=>{
  const r=boot(),g=r.g;const before=copy(g.state.bag);
  assert.equal(g.trailFittings().atCamp,false);assert.equal(g.trailFittings().items.length,6);
  action(g,()=>g.claimFittings("camp"));action(g,()=>g.claimFittings("unknown"));
  assert.ok(g.visitSite("camp"));action(g,()=>g.claimFittings("crest"));
  ok(g.claimFittings("camp"));assert.equal(g.trailFittings().groups.find(c=>c.id==="camp").claimed,true);
  action(g,()=>g.claimFittings("camp"));action(g,()=>g.equipFitting("missing","relay-bell"));
  const early=Array.from(g.trailFittings().items.filter(k=>k.claimed),k=>k.id);
  assert.ok(early.length>0 && early.length<6);
  ok(g.equipFitting("sprigkit",early[0]));action(g,()=>g.equipFitting("dewfin",early[0]));
  action(g,()=>g.equipFitting("dewfin",early[0],"cindlet"));
  ok(g.equipFitting("dewfin",early[0],"sprigkit"));
  assert.deepEqual(copy(g.trailFittings().gear),{dewfin:early[0]});
  for(const next of allGear.filter(id=>!early.includes(id)))action(g,()=>g.equipFitting("cindlet",next));
  g.state.crests=[g.wardens[0]];ok(g.claimFittings("crest"));
  assert.deepEqual(Array.from(g.trailFittings().items.filter(k=>k.claimed),k=>k.id).sort(),allGear.slice().sort());
  ok(g.equipFitting("dewfin",null));assert.deepEqual(copy(g.trailFittings().gear),{});
  ok(g.equipFitting("cindlet","last-stitch"));wild(g);
  action(g,()=>g.equipFitting("dewfin","last-stitch","cindlet"));
  action(g,()=>g.equipFitting("cindlet",null));
  const next=r.reload().g;assert.deepEqual(copy(next.state.trailFittings),copy(g.state.trailFittings));
  assert.deepEqual(copy(next.state.battle.trailFittings),copy(g.state.battle.trailFittings));
  assert.deepEqual(copy(next.state.bag),before);
});
test("a lead Pennant starts each fresh real battle with an extra beat and a voluntary Bell handoff honors the cap",()=>{
  const r=boot(),g=r.g;issue(g,{sprigkit:"opening-pennant",cindlet:"relay-bell"});wild(g);
  assert.equal(g.duets().beats,2);assert.equal(fitted(g,"opening-pennant"),true);
  assert.equal(event(g.switchForecast("cindlet"),"relay-bell"),undefined,"the normal switch would already fill the meter");
  ok(g.swap("cindlet"));assert.equal(g.duets().beats,3);assert.equal(fitted(g,"relay-bell"),false);
  ok(g.flee());ok(g.setLead("dewfin"));wild(g);
  assert.equal(g.duets().beats,1);assert.equal(fitted(g,"opening-pennant"),false);
  const f=g.switchForecast("cindlet"),receiver=member(g,"cindlet"),hp=receiver.hp;
  assert.equal(event(f,"relay-bell").holder,"cindlet");ok(g.swap("cindlet"));
  assert.equal(receiver.hp,hp-f.damage);assert.equal(g.duets().beats,3);assert.equal(fitted(g,"relay-bell"),true);
  const live=r.reload().g;assert.equal(fitted(live,"relay-bell"),true);
  ok(live.flee());wild(live);assert.equal(fitted(live,"relay-bell"),false);
});
test("a normal guard heals the most wounded conscious reserve exactly once, including on the finishing strike",()=>{
  for(const finish of [false,true]){
    const r=boot(),g=r.g;issue(g,{sprigkit:"mender-wrap"});
    member(g,"cindlet").hp=8;member(g,"dewfin").hp=10;
    if(finish)member(g,"dewfin").hp=0;
    wild(g);if(finish)g.state.battle.enemy.hp=1;
    const holder=member(g,"sprigkit"),patient=member(g,"cindlet"),bystander=member(g,"dewfin");
    const hp=patient.hp,other=bystander.hp,leadHp=holder.hp;
    const p=g.ordinaryForecast("brush-dash"),e=event(p,"mender-wrap");
    assert.equal(e.target,"cindlet");assert.equal(e.heal,Math.ceil(patient.maxHp/5));
    ok(g.useSkill("brush-dash"));assert.equal(patient.hp,hp+e.heal);assert.equal(bystander.hp,other);
    if(!finish){
      assert.equal(holder.hp,leadHp-p.returnDamage);const after=r.reload().g;
      assert.equal(fitted(after,"mender-wrap"),true);
      assert.equal(event(after.ordinaryForecast("brush-dash"),"mender-wrap"),undefined);
      ok(after.useSkill("brush-dash"));assert.equal(member(after,"cindlet").hp,patient.hp);
    }else assert.equal(g.state.battle,null);
  }
});
test("Prism Lens forecasts the neutralized resisted strike and restores the normal matchup after its first spend",()=>{
  const r=boot(),g=r.g;issue(g,{dewfin:"prism-lens"});ok(g.setLead("dewfin"));wild(g);
  const holder=member(g,"dewfin"),enemy=g.state.battle.enemy;
  const f=g.ordinaryForecast("bubble-jet");assert.equal(event(f,"prism-lens").holder,"dewfin");
  assert.equal(f.damage,9);const before=enemy.hp;ok(g.useSkill("bubble-jet"));
  assert.equal(enemy.hp,before-f.damage);assert.equal(holder.hp,holder.maxHp-f.returnDamage);
  const next=r.reload().g,q=next.ordinaryForecast("bubble-jet");
  assert.ok(q.damage<f.damage);assert.equal(event(q,"prism-lens"),undefined);
  const secondTarget=next.state.battle.enemy,secondHp=secondTarget.hp,leadHp=member(next,"dewfin").hp;
  ok(next.useSkill("bubble-jet"));assert.equal(secondTarget.hp,secondHp-q.damage);
  assert.equal(member(next,"dewfin").hp,leadHp-q.returnDamage);
});
test("Beacon Pass and an exposed ordinary strike trigger Seam Hook exactly once, with HP-cap improvement required",()=>{
  for(const finishing of [false,true]){
    const r=boot(),g=r.g;add(g,"gustlance");issue(g,{cindlet:"seam-hook"});ok(g.setLead("gustlance"));wild(g);
    assert.equal(g.familyTechnique().id,"beacon");ok(g.useFamilyTechnique("cindlet"));
    const p=g.state.battle.enemy;if(finishing)p.hp=1;
    assert.equal(g.ordinaryForecast("cinder-roll").exposed,false);
    const hook=g.ordinaryForecast("ember-pop"),control=boot(JSON.stringify(g.state)).g;
    delete control.state.battle.trailFittings.gear.cindlet;
    const ordinary=control.ordinaryForecast("ember-pop");
    if(finishing){assert.equal(hook.damage,ordinary.damage);assert.equal(event(hook,"seam-hook"),undefined);}
    else {assert.ok(hook.damage>ordinary.damage);assert.equal(event(hook,"seam-hook").holder,"cindlet");}
    const before=p.hp;ok(g.useSkill("ember-pop"));assert.equal(before-p.hp,hook.damage);
    if(g.state.battle){assert.equal(g.duets().opening,false);assert.equal(fitted(r.reload().g,"seam-hook"),true);}
  }
});
test("the Stitch predicts the actual recipient's surviving HP on a strike, healed lead, guarded swap, family pass and relay duet",()=>{
  for(const choice of ["strike","heal","swap","pass","duet"]){
    const r=boot(),g=r.g;add(g,"gustlance");issue(g,{dewfin:"last-stitch",cindlet:"opening-pennant"});
    ok(g.setLead(({strike:"dewfin",heal:"dewfin",swap:"sprigkit",pass:"gustlance",duet:"cindlet"})[choice]));wild(g);
    const defender=member(g,"dewfin"),b=g.state.battle;
    defender.hp=choice==="heal"?1:2;
    if(choice==="heal")b.turn=3; // This announced Grove charged attack would defeat even a freshly healed Dewfin.
    const moves={
      strike:[()=>g.ordinaryForecast("bubble-jet"),()=>g.useSkill("bubble-jet")],
      heal:[()=>g.ordinaryForecast("dew-bath"),()=>g.useSkill("dew-bath")],
      swap:[()=>g.switchForecast("dewfin"),()=>g.swap("dewfin")],
      pass:[()=>g.familyTechnique().targets.find(p=>p.id==="dewfin"),()=>g.useFamilyTechnique("dewfin")],
      duet:[()=>g.duets().options.find(o=>o.partnerId==="dewfin"),()=>g.useDuet("dewfin")]
    };
    const [preview,execute]=moves[choice],before=JSON.stringify(g.state),forecast=preview();
    assert.equal(JSON.stringify(g.state),before);
    const e=event(forecast,"last-stitch");assert.ok(e,choice);assert.equal(e.holder,"dewfin");
    assert.equal((defender.hp+(forecast.healing||0))-(forecast.returnDamage??forecast.damage),1,choice);
    ok(execute());assert.equal(b.activeId,"dewfin",choice);assert.equal(defender.hp,1,choice);
    const next=r.reload().g;assert.equal(fitted(next,"last-stitch"),true);
    assert.equal(next.ordinaryForecast("trail-feint").returnDamage,1);
    assert.equal(event(next.ordinaryForecast("trail-feint"),"last-stitch"),undefined);
    ok(next.useSkill("trail-feint"));assert.equal(member(next,"dewfin").hp,0);
  }
});
test("a free replacement and a duet handoff do not spend a Relay Bell; the next direct switch can",()=>{
  const r=boot(),g=r.g;issue(g,{dewfin:"relay-bell",cindlet:"opening-pennant"});
  ok(g.setLead("cindlet"));wild(g);const handoff=g.duets().options.find(o=>o.partnerId==="dewfin");
  assert.equal(handoff.switchLead,true);assert.equal(event(handoff,"relay-bell"),undefined);
  ok(g.useDuet("dewfin"));assert.equal(g.state.battle.activeId,"dewfin");assert.equal(fitted(g,"relay-bell"),false);
  ok(g.flee());member(g,"cindlet").hp=1;wild(g);ok(g.useSkill("trail-feint"));assert.ok(g.replacements());
  ok(g.replaceFainted("dewfin"));assert.equal(fitted(g,"relay-bell"),false);
  ok(g.swap("sprigkit"));assert.equal(g.state.battle.activeId,"sprigkit");
  assert.equal(fitted(g,"relay-bell"),false);ok(g.useDuet("dewfin"));
  const option=g.switchForecast("dewfin");assert.ok(event(option,"relay-bell"));
  ok(g.swap("dewfin"));assert.equal(fitted(g,"relay-bell"),true);
});
test("wild and Warden trail encounters snapshot the true starting kit while exhibitions, loaners and legacy active saves keep their old rules",()=>{
  const r=boot(),g=r.g;issue(g,{sprigkit:"opening-pennant",dewfin:"prism-lens"});
  wild(g);const record=copy(g.state),legacy=copy(record);delete legacy.battle.trailFittings;
  const restored=boot(JSON.stringify(legacy)).g;
  assert.equal(restored.state.battle.trailFittings?.gear?.dewfin,undefined);
  ok(restored.swap("dewfin"));assert.equal(event(restored.ordinaryForecast("bubble-jet"),"prism-lens"),undefined);
  ok(restored.flee());ok(restored.setLead("dewfin"));wild(restored);
  assert.equal(event(restored.ordinaryForecast("bubble-jet"),"prism-lens").holder,"dewfin");
  ok(g.flee());
  const career=copy(g.state);const snapshot={region:0,party:g.team().map(p=>g.loaner(p.id,p.level)),
    team:Array.from(g.state.team),lead:"sprigkit",battle:null};
  g.withLoaners(snapshot,start=>{
    ok(start(["mossbell"],5,"Loaner bell"));assert.equal(g.duets().beats,1);
    assert.equal(g.state.battle.trailFittings?.gear?.sprigkit,undefined);
    action(g,()=>g.claimFittings("camp"));action(g,()=>g.equipFitting("sprigkit","relay-bell"));
    ok(g.swap("dewfin"));assert.equal(event(g.ordinaryForecast("bubble-jet"),"prism-lens"),undefined);
  });
  assert.deepEqual(copy(g.state),career);
  assert.ok(g.visitSite("warden"));ok(g.startBattle("second-bell","sprigkit"));
  assert.equal(g.duets().beats,1);assert.equal(g.state.battle.trailFittings?.gear?.sprigkit,undefined);
  const exhibition=r.reload().g;assert.equal(exhibition.duets().beats,1);ok(exhibition.flee());
  ok(g.flee());ok(g.meetWarden());ok(g.startBattle("warden"));
  assert.equal(g.state.battle.kind,"warden");assert.equal(g.duets().beats,2);
  assert.equal(fitted(g,"opening-pennant"),true);
  ok(g.flee());g.state.surveys[0]=2;
  const job=g.expedition();assert.ok(g.visitSite(job.targetSite));
  const route=g.expedition().choices.find(c=>c.available&&c.foes>1);ok(g.expeditionAction(route.id));
  assert.equal(g.state.battle.kind,"expedition");assert.equal(g.duets().beats,2);
  assert.equal(fitted(g,"opening-pennant"),true);
});
test("gear planning and save restoration only accept claimable, unique, owned equipment and fail atomically",()=>{
  const r=boot(),g=r.g,kit=r.window.WilderTrailFittings;
  const old=copy(g.state);delete old.trailFittings;
  assert.deepEqual(copy(boot(JSON.stringify(old)).g.trailFittings().gear),{});
  const corrupted={claimed:["camp","camp","crest","missing"],gear:{sprigkit:"relay-bell",cindlet:"relay-bell",dewfin:"prism-lens",mossbell:"last-stitch"}};
  assert.deepEqual(copy(kit.restore(corrupted,g.state)),{claimed:["camp"],gear:{sprigkit:"relay-bell"}});
  issue(g,{sprigkit:"last-stitch",cindlet:"prism-lens"});
  const before=copy(g.state),desired={sprigkit:"prism-lens",cindlet:"last-stitch"};
  const plan=kit.plan(g.state,desired);assert.ok(plan.ok);assert.deepEqual(copy(plan.gear),desired);
  assert.deepEqual(copy(plan.changes),[{id:"sprigkit",before:"last-stitch",after:"prism-lens"},
    {id:"cindlet",before:"prism-lens",after:"last-stitch"}]);assert.deepEqual(copy(g.state),before);
  for(const bad of [{sprigkit:"last-stitch",cindlet:"last-stitch"},{sprigkit:"last-stitch",missing:"relay-bell"},
    {dewfin:"unknown"},["last-stitch"],null]){assert.equal(kit.apply(g.state,bad).ok,false);assert.deepEqual(copy(g.state),before);}
  ok(kit.apply(g.state,desired));assert.deepEqual(copy(g.trailFittings().gear),desired);
  assert.ok(g.visitSite("travel"));ok(g.equipFitting("cindlet",null));wild(g);
  assert.equal(kit.plan(g.state,desired).ok,false);
  const active=copy(g.state.battle.trailFittings);
  for(const dirty of [{...active,spent:["not-issued"]},{...active,spent:["prism-lens","prism-lens"]},
      {...active,gear:{...active.gear,dewfin:"relay-bell"}}]){
    const data=copy(g.state);data.battle.trailFittings=dirty;const next=boot(JSON.stringify(data)).g;
    assert.ok(next.state.battle);assert.equal(next.state.battle.trailFittings?.gear?.sprigkit,undefined);
    assert.deepEqual(copy(next.trailFittings().gear),{sprigkit:"prism-lens"});
  }
});
test("Backdraft's real once-per-kin strike can use either a resisted lens or a teammate's Beacon opening",()=>{
  for(const id of ["prism-lens","seam-hook"]){
    const r=boot(),g=r.g,art="kilnbeak";add(g,art);add(g,"gustlance");
    assert.equal(g.species[art].emberArt.id,"backdraft");issue(g,{[art]:id});
    ok(g.setLead(id==="prism-lens"?art:"gustlance"));
    const quarry=id==="prism-lens"?g.pools[0].find(k=>r.window.WilderKinDex.effectiveness("Ember",g.species[k].types)<1):"mossbell";
    assert.ok(quarry);wild(g,quarry);
    if(id==="seam-hook")ok(g.useFamilyTechnique(art));
    const h=member(g,art);h.hp=Math.min(h.hp,h.maxHp-8);const hp=h.hp,enemy=g.state.battle.enemy,oldHp=enemy.hp;
    const f=g.emberTechnique();assert.equal(event(f,id).holder,art);
    ok(g.useEmberTechnique());assert.equal(h.hp,hp+f.healing-f.returnDamage);
    assert.equal(enemy.hp,oldHp-f.damage);assert.equal(fitted(g,id),true);
    const next=r.reload().g;assert.equal(next.emberTechnique().used,true);assert.equal(fitted(next,id),true);
  }
});
test("a fresh career carries the free case through Mossbrook's field commission and earns the crest case by defeating Fern",()=>{
  const r=boot(),g=r.g;assert.ok(g.visitSite("camp"));ok(g.claimFittings("camp"));
  ok(g.equipFitting("cindlet","opening-pennant"));ok(g.equipFitting("dewfin","last-stitch"));
  ok(g.setLead("cindlet"));let battles=0;
  function win(){
    assert.equal(g.duets().beats,2);assert.ok(fitted(g,"opening-pennant"));battles++;
    let result;
    for(let turn=0;g.state.battle && turn<48;turn++){
      const lead=g.kin(g.state.battle.activeId,{owned:true});
      const choices=lead.skills.filter(s=>s.kind==="attack"||s.kind==="guard").map(skill=>{
        const p=g.ordinaryForecast(skill.id);return {score:p.damage-p.returnDamage*.25,go:()=>g.useSkill(skill.id)};
      });
      g.duets().options.filter(o=>o.available).forEach(o=>choices.push({score:o.damage-o.returnDamage*.25,go:()=>g.useDuet(o.partnerId)}));
      result=ok(choices.sort((a,b)=>b.score-a.score)[0].go());
    }
    assert.equal(g.state.battle,null);assert.equal(result.kind,"victory");
  }
  for(let leg=0;!g.expedition().done&&leg<3;leg++){
    assert.ok(g.visitSite("camp"));ok(g.heal());
    const work=g.expedition();assert.ok(g.visitSite(work.targetSite));
    const route=work.choices.filter(c=>c.available).sort((a,b)=>a.foes-b.foes)[0];
    ok(g.expeditionAction(route.id));if(g.state.battle)win();
  }
  assert.equal(g.expedition().done,true);assert.ok(g.visitSite("camp"));ok(g.heal());
  while(!r.window.WilderStory.chapterDone(g.state,0)){
    const scene=r.window.WilderStory.scene(g.state,"chapter-1");ok(g.storyStep("chapter-1",scene.choices[0]?.id));
  }
  assert.ok(g.visitSite("warden"));ok(g.meetWarden());ok(g.startBattle("warden"));win();
  assert.deepEqual(copy(g.state.crests),[0]);assert.ok(battles>=3);
  assert.ok(g.visitSite("camp"));ok(g.claimFittings("crest"));ok(g.equipFitting("dewfin","prism-lens"));
  const next=r.reload().g;assert.deepEqual(copy(next.state.crests),[0]);
  assert.deepEqual(copy(next.trailFittings().gear),{cindlet:"opening-pennant",dewfin:"prism-lens"});
});
test("the workshop's projected wild hit matches the actual resisted strike or full-HP Beacon opening",()=>{
  for(const [piece,lead] of [["prism-lens","dewfin"],["seam-hook","cindlet"]]){
    const {g}=boot();add(g,"gustlance");issue(g,{[lead]:piece});
    const workshop=g.trailFittingPreview(lead,piece,"mossbell");
    assert.ok(workshop.after>workshop.before);assert.equal(workshop.after-workshop.before,workshop.delta);
    assert.equal(g.trailFittingPreview("not-owned",piece,"mossbell"),null);
    assert.equal(g.trailFittingPreview(lead,piece,"not-local"),null);
    ok(g.setLead(piece==="seam-hook"?"gustlance":lead));wild(g);
    if(piece==="seam-hook")ok(g.useFamilyTechnique(lead));
    const baseline=boot(JSON.stringify(g.state)).g;delete baseline.state.battle.trailFittings;
    assert.equal(baseline.ordinaryForecast(workshop.skillId).damage,workshop.before);
    assert.equal(g.ordinaryForecast(workshop.skillId).damage,workshop.after);
    const enemy=g.state.battle.enemy,old=enemy.hp,played=ok(g.useSkill(workshop.skillId));
    assert.equal(old-enemy.hp,workshop.after);assert.equal(event(played,piece).holder,lead);
  }
});
test("trained cover keeps a Stitch ready on a nonlethal reply and a trained handoff saves the receiving kin when forecast lethal",()=>{
  for(const guarded of [true,false]){
    const r=boot(),g=r.g,lead=guarded?"sprigkit":"cindlet";
    issue(g,{[guarded?lead:"dewfin"]:"last-stitch"});g.state.visited=[0,1,2];
    Object.assign(g.state.growth[lead],{demonstrated:true,selected:guarded?"hedgekeeper":"kindler"});
    ok(g.setLead(lead));wild(g);const b=g.state.battle;b.turn=3;b.beats=guarded?2:1;
    const id=guarded?"wattle-ward":"cinder-handoff",defender=member(g,guarded?lead:"dewfin");
    defender.hp=guarded?6:2;const hp=defender.hp,p=g.skillPreview(id);assert.ok(p.available);
    const trigger=event(p,"last-stitch");
    if(guarded){assert.equal(trigger,undefined);assert.ok(p.returnDamage>0 && p.returnDamage<hp);}
    else {assert.equal(trigger.holder,defender.id);assert.equal(p.returnDamage,1);}
    const res=ok(g.useSkill(id));
    assert.deepEqual(copy(res.fittingEvents||[]),copy(p.fittingEvents||[]));
    assert.equal(defender.hp,hp-p.returnDamage);assert.equal(fitted(r.reload().g,"last-stitch"),!guarded);
  }
});

function takeMedicine(g,item,id){
  const stateBefore=JSON.stringify(g.state),p=g.itemForecast(item,id);
  assert.deepEqual(copy(g.itemForecast(item,id)),copy(p));assert.equal(JSON.stringify(g.state),stateBefore);
  assert.ok(p.available,p.reason);assert.equal(p.itemId,item);
  const target=member(g,p.targetId),active=p.activeId&&member(g,p.activeId),bag=g.state.bag[item],turn=g.state.battle?.turn;
  assert.equal(p.targetHp,target.hp);assert.equal(p.targetMaxHp,target.maxHp);
  assert.equal(p.targetName,g.kin(target.id,{owned:true}).name);
  if(active){
    assert.equal(p.activeHp,active.hp);assert.equal(p.activeMaxHp,active.maxHp);
    assert.equal(p.activeName,g.kin(active.id,{owned:true}).name);
    assert.equal(p.replyName,g.foeIntent().skill.name);
  }
  const played=ok(g.useItem(item,id));
  assert.equal(target.hp,p.targetHpAfter);if(active)assert.equal(active.hp,p.activeHpAfter);
  assert.equal(g.state.bag[item],bag-1);
  if(turn!=null)assert.equal(g.state.battle.turn,turn+1);
  assert.deepEqual(copy(played.fittingEvents||[]),copy(p.fittingEvents));
  return p;
}
test("reserve balm leaves 3 HP Sprigkit facing a 5 HP reply; its forecasted Stitch becomes a persistent notebook entry",()=>{
  const run=boot(),g=run.g;issue(g,{sprigkit:"last-stitch"});member(g,"sprigkit").hp=3;member(g,"dewfin").hp=4;
  wild(g);const saves=run.saves(),before=g.itemForecast("balm","dewfin");assert.equal(run.saves(),saves);
  assert.equal(before.gain,15);assert.equal(before.targetHpAfterHeal,19);assert.equal(before.targetHpAfter,19);
  assert.equal(before.activeHpAfterHeal,3);assert.equal(before.activeHpAfter,1);assert.equal(before.returnDamage,2);
  assert.equal(before.activeId,"sprigkit");assert.equal(before.targetId,"dewfin");
  const stitch=event(before,"last-stitch");assert.equal(stitch.holder,"sprigkit");assert.match(stitch.text,/5 HP hit/);
  assert.deepEqual(copy(g.state.fittingNotes),{});assert.equal(fitted(g,"last-stitch"),false);
  const unplayed=run.reload().g;assert.deepEqual(copy(unplayed.itemForecast("balm","dewfin")),copy(before));
  takeMedicine(g,"balm","dewfin");assert.equal(g.state.battle.beats,2);assert.equal(fitted(g,"last-stitch"),true);
  const reloaded=run.reload().g;const note=reloaded.state.fittingNotes["last-stitch"];
  assert.deepEqual(copy(note),{item:"last-stitch",holder:"sprigkit",foe:"mossbell",kind:"wild",region:0,turn:1,text:stitch.text});
  assert.equal(member(reloaded,"sprigkit").hp,1);assert.equal(member(reloaded,"dewfin").hp,19);
  const again=reloaded.itemForecast("balm","dewfin");
  assert.equal(again.returnDamage,1);assert.equal(again.activeHpAfter,0);assert.deepEqual(copy(again.fittingEvents),[]);
});
test("active tonic changes Stitch qualification before the reply, while a reserve Sparkseed revives without taking the reply",()=>{
  const run=boot(),g=run.g;issue(g,{sprigkit:"last-stitch"});member(g,"sprigkit").hp=3;member(g,"dewfin").hp=0;
  wild(g);const offered=g.itemForecast("sparkseed","dewfin");assert.ok(event(offered,"last-stitch"));
  const tonic=takeMedicine(g,"tonic");
  assert.equal(tonic.targetId,"sprigkit");assert.equal(tonic.gain,29);
  assert.equal(tonic.targetHpAfterHeal,32);assert.equal(tonic.activeHpAfterHeal,32);
  assert.equal(tonic.targetHpAfter,27);assert.equal(tonic.activeHpAfter,27);assert.equal(tonic.returnDamage,5);
  assert.deepEqual(copy(tonic.fittingEvents),[]);assert.equal(fitted(g,"last-stitch"),false);
  const revive=takeMedicine(g,"sparkseed","dewfin");
  assert.equal(revive.targetHp,0);assert.equal(revive.gain,15);assert.equal(revive.targetHpAfter,15);
  assert.equal(revive.activeHp,27);assert.equal(revive.activeHpAfter,22);
  assert.deepEqual(copy(run.reload().g.state.fittingNotes),{});
});
test("field and battle satchel forecasts honor quantity, custody, injuries and the exhibition medicine ban",()=>{
  const r=boot(),g=r.g;const shelved=g.loaner("mossbell",5);g.state.party.push(shelved);shelved.hp=1;
  for(const id of ["reed","sap","broth","kinweave","missing","__proto__"])assert.equal(g.itemForecast(id,"sprigkit"),null);
  const field=takeMedicine(g,"balm","mossbell");assert.equal(field.activeId,null);assert.equal(field.returnDamage,0);
  assert.equal(field.replyName,null);assert.equal(field.targetHpAfter,1+Math.ceil(shelved.maxHp/2));
  function invalid(id,target){
    const old=JSON.stringify(g.state),saves=r.saves(),p=g.itemForecast(id,target);assert.equal(p.available,false);
    assert.ok(p.reason);assert.equal(p.gain,0);assert.equal(p.returnDamage,0);
    assert.deepEqual(copy(p.fittingEvents),[]);assert.equal(JSON.stringify(g.state),old);
    const result=g.useItem(id,target);assert.equal(result.ok,false);assert.equal(result.message,p.reason);assert.equal(r.saves(),saves);
    assert.equal(JSON.stringify(g.state),old);
  }
  wild(g);invalid("balm","mossbell");invalid("balm","unknown");invalid("sparkseed","sprigkit");invalid("tonic","cindlet");
  member(g,"cindlet").hp=0;invalid("balm","cindlet");
  g.state.bag.sparkseed=0;invalid("sparkseed","cindlet");
  ok(g.flee());assert.ok(g.visitSite("warden"));ok(g.startBattle("second-bell"));
  member(g,"cindlet").hp=1;for(const id of ["tonic","balm","sparkseed"])invalid(id,"cindlet");
});
test("a previously earned Wattle Ward protects the front while medicine heals a different kin",()=>{
  const r=boot(),g=r.g;issue(g,{sprigkit:"last-stitch"});g.state.visited=[0,1,2];
  Object.assign(g.state.growth.sprigkit,{demonstrated:true,selected:"hedgekeeper"});
  member(g,"dewfin").hp=3;member(g,"sprigkit").hp=5;wild(g);
  g.state.battle.beats=2;ok(g.useSkill("wattle-ward"));assert.equal(g.state.battle.cover,1);
  assert.equal(member(g,"sprigkit").hp,3);assert.equal(fitted(g,"last-stitch"),false);
  const next=r.reload().g;const model=takeMedicine(next,"balm","dewfin");
  assert.equal(model.returnDamage,2);assert.equal(model.activeHpAfter,1);assert.equal(model.targetHpAfter,18);
  assert.deepEqual(copy(model.fittingEvents),[]);assert.equal(next.state.battle.cover,0);assert.equal(fitted(next,"last-stitch"),false);
});
test("reading Lune's Medic’s interval forecasts the shared ward after medicine for either the lead or its partner",()=>{
  for(const target of ["cindlet","sprigkit"]){
    const {g}=boot();issue(g,{sprigkit:"last-stitch"});g.state.region=g.wardens[2];g.state.crests=Array.from(g.wardens.slice(0,3));
    ok(g.meetWarden());ok(g.startBattle("warden"));g.state.battle.turn=4;
    member(g,"sprigkit").hp=5;member(g,"cindlet").hp=1;
    assert.equal(g.wardenForecast().kind,"aid");assert.equal(g.foeIntent().support,true);
    const p=takeMedicine(g,"balm",target);
    assert.equal(p.returnDamage,0);assert.equal(p.activeHpAfterHeal,target==="sprigkit"?21:5);
    assert.equal(p.activeHpAfter,p.activeHpAfterHeal+Math.ceil(p.activeMaxHp/10));
    assert.equal(p.targetHpAfter,target==="sprigkit"?p.activeHpAfter:15);
  }
});
test("a tonic can also arm a 1 HP holder's Stitch before Flint's announced lethal lantern volley",()=>{
  const {g}=boot();issue(g,{cindlet:"last-stitch"});g.state.region=g.wardens[1];g.state.crests=Array.from(g.wardens.slice(0,2));
  ok(g.setLead("cindlet"));ok(g.meetWarden());ok(g.startBattle("warden"));
  ok(g.useSkill("cinder-roll"));ok(g.useSkill("cinder-roll"));
  assert.equal(g.foeIntent().skill.name,"Loam lantern volley");member(g,"cindlet").hp=1;
  const p=takeMedicine(g,"tonic","cindlet");assert.equal(p.activeHp,1);assert.equal(p.activeHpAfterHeal,28);
  assert.equal(p.returnDamage,27);assert.equal(p.activeHpAfter,1);
  assert.match(event(p,"last-stitch").text,/50 HP hit/);assert.equal(fitted(g,"last-stitch"),true);
});
test("a stale walk adopts the latest shared career in place, dispatches one update, and preserves the winning move",()=>{
  const map=new Map(),a=boot(null,map),g=a.g;
  ok(g.setLead("cindlet"));const b=boot(null,map),original=g.state,notices=[];
  a.window.addEventListener("wilder-trail-updated",()=>notices.push(copy(g.state.positions)));
  assert.equal(b.g.setPosition(7,8),true);const saved=map.get(key),writes=a.saves();
  assert.equal(g.trailSaveIsCurrent(),false);assert.equal(g.setPosition(5,3),false);
  assert.equal(g.state,original);assert.deepEqual(copy(g.state.positions),{0:{x:7,y:8}});
  assert.deepEqual(notices,[{0:{x:7,y:8}}]);assert.equal(map.get(key),saved);assert.equal(a.saves(),writes);
  assert.equal(g.trailSaveIsCurrent(),true);assert.equal(g.setPosition(8,8),true);
  assert.deepEqual(JSON.parse(map.get(key)).positions,{0:{x:8,y:8}});assert.equal(notices.length,1);
});
test("a superseded winning guard cannot award XP, Mender's Wrap, or a field note for a discarded victory",()=>{
  const map=new Map(),a=boot(null,map),g=a.g;issue(g,{sprigkit:"mender-wrap"});
  member(g,"dewfin").hp=3;wild(g);
  while(g.state.battle.enemy.hp>1)ok(g.useSkill("trail-feint"));
  const before=copy(g.state),ref=g.state,b=boot(null,map);
  const p=g.ordinaryForecast("brush-dash");assert.equal(p.finishes,true);assert.ok(event(p,"mender-wrap"));
  ok(b.g.setSound(false));const authoritative=map.get(key),notices=[];
  a.window.addEventListener("wilder-trail-updated",()=>notices.push(copy(g.state.fittingNotes)));
  const stale=g.useSkill("brush-dash");assert.equal(stale.ok,false);assert.equal(stale.kind,"error");assert.equal(stale.code,"changed");
  assert.equal(stale.fittingEvents,undefined);assert.deepEqual(notices,[{}]);assert.equal(g.state,ref);
  assert.equal(map.get(key),authoritative);assert.equal(g.state.sound,false);
  assert.equal(g.state.wins,before.wins);assert.deepEqual(copy(g.state.party),before.party);
  assert.deepEqual(copy(g.state.fittingNotes),{});assert.equal(fitted(g,"mender-wrap"),false);
  assert.equal(g.state.battle.enemy.hp,1);assert.equal(g.state.battle.turn,before.battle.turn);
  const legal=ok(g.useSkill("brush-dash"));assert.equal(legal.kind,"victory");assert.ok(event(legal,"mender-wrap"));
  assert.equal(g.state.wins,before.wins+1);assert.ok(member(g,"sprigkit").xp>before.party[0].xp);
  assert.equal(g.state.fittingNotes["mender-wrap"].text,event(legal,"mender-wrap").text);
});
test("a stale reserve balm cannot spend the front's Stitch after another tab already used a tonic",()=>{
  const map=new Map(),a=boot(null,map),g=a.g;issue(g,{sprigkit:"last-stitch"});member(g,"sprigkit").hp=3;member(g,"dewfin").hp=4;wild(g);
  const ref=g.state,other=boot(null,map).g;assert.ok(event(g.itemForecast("balm","dewfin"),"last-stitch"));
  ok(other.useItem("tonic","sprigkit"));const before=map.get(key);
  const stale=g.useItem("balm","dewfin");assert.equal(stale.ok,false);assert.equal(stale.kind,"error");assert.equal(stale.code,"changed");
  assert.equal(stale.fittingEvents,undefined);assert.equal(map.get(key),before);assert.equal(g.state,ref);
  assert.equal(g.state.bag.tonic,0);assert.equal(g.state.bag.balm,3);assert.deepEqual(copy(g.state.fittingNotes),{});
  assert.equal(member(g,"dewfin").hp,4);assert.equal(member(g,"sprigkit").hp,27);
  const p=takeMedicine(g,"balm","dewfin");assert.equal(p.activeHpAfter,22);assert.deepEqual(copy(p.fittingEvents),[]);
});
test("corrupt external writes preserve the last known career, deletion adopts a fresh one, and reset requires a current view",()=>{
  const map=new Map(),a=boot(null,map),g=a.g;
  assert.ok(g.visitSite("camp"));ok(g.claimFittings("camp"));ok(g.equipFitting("sprigkit","last-stitch"));ok(g.setLead("cindlet"));
  const valid=copy(g.state),ref=g.state,writes=a.saves(),updates=[];
  a.window.addEventListener("wilder-trail-updated",()=>updates.push(g.state.lead));
  for(const text of ["{","not json"]){
    map.set(key,text);const result=g.setSound(false);
    assert.equal(result.code,"changed");assert.equal(map.get(key),text);assert.equal(a.saves(),writes);
    assert.equal(g.state,ref);assert.deepEqual(copy(g.state),valid);
  }
  ok(g.setSound(false));assert.equal(map.get(key),"not json");assert.equal(g.saveRecovery,"recovered");
  ok(g.resumeSaving());assert.equal(g.damagedSave(),"not json");assert.equal(JSON.parse(map.get(key)).lead,"cindlet");
  const b=boot(null,map).g;ok(b.setLead("dewfin"));const foreign=map.get(key);
  assert.equal(g.reset().code,"changed");assert.equal(map.get(key),foreign);assert.equal(g.state.lead,"dewfin");
  assert.equal(g.state,ref);ok(g.reset());assert.equal(g.state,ref);assert.deepEqual(copy(g.state),copy(boot().g.state));
  ok(g.setLead("cindlet"));map.delete(key);
  assert.equal(g.setPosition(3,3),false);assert.equal(map.has(key),false);assert.equal(g.state,ref);
  assert.deepEqual(copy(g.state),copy(boot().g.state));assert.deepEqual(updates,["cindlet","cindlet","dewfin","sprigkit"]);
  assert.equal(g.setPosition(3,3),true);assert.deepEqual(JSON.parse(map.get(key)).positions,{0:{x:3,y:3}});
});
