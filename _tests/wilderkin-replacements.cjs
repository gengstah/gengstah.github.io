const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const scripts=["atlas","bestiary","activities","campaign","story","duets","growth","wardens","engine"].map(name=>{
  const filename=path.join(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(fs.readFileSync(filename,"utf8"),{filename});
});
function boot(record=null){
  const localStorage={getItem:k=>k==="wilderkin.trail.v3"?record:null,setItem:(_,data)=>{record=data;}};
  const ctx=vm.createContext({window:{localStorage}});
  scripts.forEach(script=>script.runInContext(ctx));
  return {g:ctx.window.WilderGame,story:ctx.window.WilderStory,reload:()=>boot(record)};
}
const ok=r=>assert.ok(r.ok,r.message);
const member=(g,id)=>g.team().find(p=>p.id===id);
const copy=value=>JSON.parse(JSON.stringify(value));
function wild(){
  const run=boot(),g=run.g;
  ok(g.setLead("cindlet"));ok(g.startBattle("wild","mossbell"));
  member(g,"cindlet").hp=1;
  return run;
}
function opening(){
  const run=wild();
  ok(run.g.useSkill("trail-feint"));
  assert.equal(run.g.state.battle.activeId,"sprigkit");
  return run;
}

test("a knockout offers exactly the conscious travelers and confirms either one for free",()=>{
  const run=opening();
  for(const id of ["sprigkit","dewfin"]){
    const resumed=run.reload(),g=resumed.g,choice=g.replacements(),before=copy(g.state);
    assert.equal(choice.fallen,"cindlet");assert.equal(choice.defaultId,"sprigkit");
    assert.deepEqual(Array.from(choice.options,p=>p.id),["sprigkit","dewfin"]);
    assert.deepEqual(copy(choice),copy(run.g.replacements()));
    for(const bad of ["cindlet","not-a-kin",null])assert.equal(g.replaceFainted(bad).ok,false);
    assert.deepEqual(copy(g.state),before);
    const option=choice.options.find(p=>p.id===id),res=g.replaceFainted(id);ok(res);
    assert.equal(res.kind,"replacement");assert.match(res.message,new RegExp(option.name+".+Cindlet"));
    let expected=before;expected.battle.activeId=id;delete expected.battle.pendingFallen;
    expected.battle.log.push(res.message);
    assert.deepEqual(copy(g.state),expected);
    assert.equal(g.replacements(),null);
    assert.deepEqual(copy(resumed.reload().g.state),expected);
    const attack=g.kin(id).skills.find(s=>s.name===option.attackName);
    const plan=g.ordinaryForecast(attack.id);
    assert.equal(plan.damage,option.attackDamage);assert.equal(plan.finishes,option.attackFinishes);
    assert.equal(plan.returnDamage,option.attackReplyDamage);
  }
});

test("the provisional lead acts as before; invalid moves preserve the choice, real counters and knockouts clear it",()=>{
  const {g}=opening();
  assert.equal(g.useSkill("sun-nap").ok,false);
  assert.equal(g.swap("cindlet").ok,false);
  assert.equal(g.useItem("sparkseed","dewfin").ok,false);
  assert.equal(g.useDuet("sprigkit").ok,false);
  ok(g.setSound(false));
  assert.equal(g.replacements().fallen,"cindlet");
  const next=g.state.battle.turn;
  ok(g.useSkill("leaf-flurry"));
  assert.equal(g.replacements(),null);assert.equal(g.state.battle.turn,next+1);

  const another=opening().g,b=another.state.battle;
  b.kind="expedition";b.remaining=["mossbell"];b.enemy.hp=1;
  const option=another.replacements().options[0];
  assert.equal(option.attackFinishes,true);assert.equal(option.attackReplyDamage,0);
  ok(another.useSkill("leaf-flurry"));
  assert.ok(another.state.battle);assert.equal(another.replacements(),null);
  assert.equal(another.replaceFainted("dewfin").ok,false);
});

test("swaps, handoff duets, family passes, healing and items all identify the fighter actually knocked out",()=>{
  for(const move of ["switch","duet","pass","heal","item"]){
    const {g}=wild(),b=g.state.battle;
    b.enemy=g.loaner("mossbell",45);
    b.turn=3;b.beats=3;
    let expected;
    if(move==="switch" || move==="duet"){
      member(g,"cindlet").hp=15;member(g,"dewfin").hp=1;expected="dewfin";
      ok(move==="switch"?g.swap("dewfin"):g.useDuet("dewfin"));
    }
    if(move==="pass"){
      ok(g.flee());const recruit=g.loaner("gustlance",5);
      g.state.party.push(recruit);ok(g.enlist(recruit.id));ok(g.setLead(recruit.id));
      ok(g.startBattle("wild","mossbell"));expected="cindlet";
      ok(g.useFamilyTechnique("cindlet"));
    }
    if(move==="heal"){expected="cindlet";ok(g.useSkill("rekindle"));}
    if(move==="item"){expected="cindlet";member(g,"dewfin").hp=3;ok(g.useItem("balm","dewfin"));}
    assert.equal(g.replacements().fallen,expected,move);
    assert.equal(member(g,expected).hp,0);
  }
});

test("a single survivor auto-advances; defeat, forced Warden shifts and loaner bouts never open a choice",()=>{
  const {g}=wild();
  member(g,"sprigkit").hp=0;
  ok(g.useSkill("trail-feint"));
  assert.equal(g.state.battle.activeId,"dewfin");assert.equal(g.replacements(),null);
  member(g,"dewfin").hp=1;
  const defeat=g.useSkill("trail-feint");assert.equal(defeat.kind,"defeat");assert.equal(g.replacements(),null);
  assert.ok(g.team().every(p=>p.hp===p.maxHp));
  const i=g.wardens[3];g.state.region=i;g.state.crests=Array.from(g.wardens.slice(0,4));
  ok(g.meetWarden());ok(g.startBattle("warden"));assert.equal(g.wardenForecast().kind,"shunt");
  ok(g.useSkill("ember-pop"));assert.notEqual(g.state.battle.activeId,"cindlet");assert.equal(g.replacements(),null);
  const before=copy(g.state);
  const ids=["sprigkit","cindlet","dewfin"],guest={region:0,lead:"cindlet",team:ids,party:ids.map(id=>g.loaner(id,18)),battle:null};
  g.withLoaners(guest,start=>{
    ok(start(["mossbell"],18,"School"));member(g,"cindlet").hp=1;
    ok(g.useSkill("ember-pop"));assert.equal(g.state.battle.activeId,"sprigkit");
    assert.equal(g.replacements(),null);assert.equal(g.replaceFainted("dewfin").ok,false);
  });
  assert.deepEqual(copy(g.state),before);
});

test("malformed and older saves keep the legacy fallback without inventing a replacement decision",()=>{
  const {g}=opening(),base=copy(g.state);
  for(const bad of ["sprigkit","unowned",null,false,{}]){
    const raw=copy(base);raw.battle.pendingFallen=bad;
    const restored=boot(JSON.stringify(raw)).g;assert.equal(restored.replacements(),null);
    assert.equal(restored.state.battle.activeId,base.battle.activeId);
  }
  const old=copy(base);delete old.battle.pendingFallen;
  const restored=boot(JSON.stringify(old)).g;
  assert.equal(restored.replacements(),null);ok(restored.useSkill("leaf-flurry"));
  base.party.find(p=>p.id==="dewfin").hp=0;
  assert.equal(boot(JSON.stringify(base)).g.replacements(),null);
});

test("Flint's second lantern wick makes the replacement choice consequential in a fresh Cindlet career",()=>{
  const {g,story}=boot();
  ok(g.setLead("cindlet"));
  const rest=()=>{assert.ok(g.visitSite("camp"));ok(g.heal());};
  const attack=game=>{const k=game.kin(game.state.battle.activeId);ok(game.useSkill(k.skills[0].id));};
  const finish=game=>{for(let n=0;game.state.battle&&n<80;n++)attack(game);assert.equal(game.state.battle,null);};
  for(let region=0;region<=1;region++){
    while(!g.expedition().done){
      rest();const job=g.expedition();assert.ok(g.visitSite(job.targetSite));
      const choice=job.choices.filter(c=>c.available).sort((a,b)=>a.foes-b.foes)[0];
      ok(g.expeditionAction(choice.id));if(g.state.battle)finish(g);
    }
    const chapter="chapter-"+(region+1);
    while(!story.chapterDone(g.state,region))ok(g.storyStep(chapter,story.scene(g.state,chapter).choices[0]?.id));
    rest();assert.ok(g.visitSite("warden"));ok(g.meetWarden());ok(g.startBattle("warden"));
    if(region===0){finish(g);ok(g.travel(1));}
  }
  while(g.state.battle&&!g.replacements())attack(g);
  const choice=g.replacements(),turn=g.state.battle.turn;
  assert.equal(choice.fallen,"cindlet");
  assert.equal(g.foeIntent().skill.type,"Loam");assert.equal(g.state.battle.coach.lantern.left,1);
  const sprig=choice.options.find(p=>p.id==="sprigkit"),dew=choice.options.find(p=>p.id==="dewfin");
  assert.ok(sprig.replyDamage<sprig.hp);assert.equal(dew.replyDamage,dew.hp);
  const alternate=boot(JSON.stringify(g.state)).g;
  ok(g.replaceFainted("sprigkit"));ok(alternate.replaceFainted("dewfin"));
  assert.equal(g.state.battle.turn,turn);assert.equal(alternate.state.battle.turn,turn);
  attack(g);attack(alternate);
  assert.ok(member(g,"sprigkit").hp>0);assert.equal(member(alternate,"dewfin").hp,0);
  finish(g);finish(alternate);
  assert.ok(g.state.crests.includes(1));assert.ok(!alternate.state.crests.includes(1));
});
