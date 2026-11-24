const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const scripts=["atlas","bestiary","activities","campaign","story","duets","growth","wardens","engine","guard-school"].map(name=>{
  const filename=path.join(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(fs.readFileSync(filename,"utf8"),{filename});
});
const ok=result=>assert.ok(result.ok,result.message);
function boot(saved){
  const key="wilderkin.trail.v3",storage=new Map(saved?[[key,saved]]:[]),calls=[];
  const ctx=vm.createContext({window:{localStorage:{getItem:id=>storage.get(id)||null,setItem:(id,v)=>storage.set(id,v)}}});
  scripts.forEach(s=>s.runInContext(ctx));
  const {WilderGame:g,WilderStory:story,WilderGuardLessons}=ctx.window;
  const go=(name,value)=>calls.push(["go",name,value]);
  const ui=WilderGuardLessons.create({game:g,image:id=>"kin/"+id,
    row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),notify:s=>calls.push(["notice",s]),render(){},go,
    locate:(kind,view)=>{calls.push(["locate",kind,JSON.parse(JSON.stringify(view))]);assert.ok(g.visitSite(kind));
      if(typeof view==="string")go(view);else go(view.name,view.value);},
    fight:(kind,id)=>{calls.push(["fight",kind,id]);ok(g.startBattle(kind,id));go("battle");},travel:i=>{calls.push(["travel",i]);ok(g.travel(i));}});
  const rows=(id,value)=>ui.model(value).sections.find(x=>x.title.startsWith(g.species[id].name+" ·")).rows;
  function step(id,key){
    const offered=rows(id,id).find(r=>r.id==="guard-lesson-step"&&r.value===id+"|"+key);
    assert.ok(offered,id+" "+key+" not offered: "+rows(id,id).map(r=>r.value));
    assert.equal(ui.act(offered.id,offered.value),true);
  }
  return {g,ui,step,rows,calls,story,dex:ctx.window.WilderKinDex,reload:()=>boot(storage.get(key))};
}
function catchActive(g){
  while(g.state.battle.enemy.hp*2>g.state.battle.enemy.maxHp)ok(g.useSkill("trail-feint"));
  ok(g.recruit());
}
function heal(g){assert.ok(g.visitSite("camp"));ok(g.heal());}
function fightOut(run){
  const {g,dex}=run;
  for(let i=0;i<100&&g.state.battle;i++){
    const b=g.state.battle,kin=g.kin(b.activeId,{owned:true}),target=g.species[b.enemy.id];
    const value=m=>m.power*dex.effectiveness(m.type,target.types)*(m.kind==="guard"?1.12:1);
    const attack=kin.skills.filter(m=>m.power).sort((a,b)=>value(b)-value(a))[0];
    const duet=g.duets().options.filter(m=>m.available&&m.damage>value(attack)).sort((a,b)=>b.damage-a.damage)[0];
    ok(duet?g.useDuet(duet.partnerId):g.useSkill(attack.id));
  }
  assert.equal(g.state.battle,null);
}

test("fresh Neri link walks to native Opalclasp, captures it, and teaches the owned level-4 crab during its third real reply",()=>{
  let run=boot(),{g}=run;
  const card=run.ui.model().sections[0];
  assert.match(card.title,/Opalclasp · Pincer Hold/);assert.match(card.rows[0].detail,/Hold back/);
  assert.equal(run.ui.model().art.src,"art/story/neri-pike.png");
  run.step("opalclasp","walk");assert.deepEqual(run.calls[0],["locate","wild",{name:"guard-school",value:"opalclasp"}]);
  run.step("opalclasp","catch");assert.equal(g.state.battle.enemy.id,"opalclasp");
  const oldBag=g.state.bag.kinweave;catchActive(g);assert.equal(g.state.bag.kinweave,oldBag-1);
  run=run.reload();g=run.g;const p=g.team().find(p=>p.id==="opalclasp");assert.equal(p.level,4);
  run.step("opalclasp","lead");assert.equal(g.state.lead,p.id);
  assert.match(run.rows(p.id)[0].detail,/Guard on turns one and two/);
  run.step(p.id,"practice");assert.equal(g.state.battle.enemy.id,"mossbell");assert.equal(g.state.battle.activeId,p.id);
  assert.deepEqual(Array.from(g.state.trainedGuards),[]);
  for(let turn=1;turn<=3;turn++){
    assert.equal(g.foeIntent().charged,turn===3);ok(g.useSkill("pincer-block"));
    assert.equal(g.guardTraining(p.id).learned,turn===3);
  }
  assert.ok(g.team().find(k=>k.id===p.id).hp>0);assert.equal(g.state.battle.enemy.pincerOpening,true);
  run=run.reload();assert.equal(run.g.guardTraining(p.id).learned,true);
  ok(run.g.flee());const learned=run.rows(p.id);
  assert.equal(learned[0].id,"open-kin");assert.match(learned[0].badge,/TRAINED/);
  assert.match(learned.find(r=>r.value==="opalclasp|practice").detail,/Tuning Fork/);
});

test("a first campaign earns the Leaf Crest, visits Cinderfall, recruits Cragroll and actually protects a teammate",()=>{
  const run=boot(),{g,story}=run;
  run.step("cragroll","crest");assert.equal(run.calls.at(-1)[1],"expedition");assert.equal(g.state.region,0);
  while(!g.expedition().done){
    heal(g);assert.ok(g.visitSite(g.expedition().targetSite));
    const route=g.expedition().choices.filter(c=>c.available).sort((a,b)=>a.foes-b.foes)[0];
    ok(g.expeditionAction(route.id));fightOut(run);
  }
  run.step("cragroll","crest");assert.deepEqual(run.calls.at(-1),["go","scene","chapter-1"]);
  while(!story.chapterDone(g.state,0))ok(g.storyStep("chapter-1",story.scene(g.state,"chapter-1").choices[0]?.id));
  run.step("cragroll","crest");assert.equal(run.calls.at(-1)[1],"warden");
  heal(g);assert.ok(g.visitSite("warden"));ok(g.meetWarden());ok(g.startBattle("warden"));fightOut(run);
  assert.deepEqual(Array.from(g.state.crests),[0]);
  run.step("cragroll","travel");assert.equal(g.state.region,1);
  run.step("cragroll","walk");run.step("cragroll","catch");catchActive(g);
  run.step("cragroll","lead");run.step("cragroll","practice");
  assert.equal(g.state.battle.kind,"wild");assert.equal(g.state.battle.enemy.id,"coalmoth");
  for(let i=1;i<=3;i++){assert.equal(g.foeIntent().charged,i===3);ok(g.useSkill("roll-brace"));}
  assert.ok(g.guardTraining("cragroll").learned);assert.ok(g.switchForecast("dewfin").protected);
  const hp=g.team().find(p=>p.id==="dewfin").hp,expected=g.switchForecast("dewfin").damage;
  ok(g.swap("dewfin"));assert.equal(g.team().find(p=>p.id==="dewfin").hp,hp-expected);
  assert.equal(run.reload().g.guardTraining("cragroll").learned,true);
});

test("a full campaign party keeps all captures and lets the player choose which reserve slot to exchange",()=>{
  const run=boot(),{g,ui}=run;
  for(const id of ["mossbell","gustlance","leafshuttle"]){
    heal(g);assert.ok(g.visitSite("wild"));ok(g.startBattle("wild",id));catchActive(g);
  }
  heal(g);assert.equal(g.team().length,6);
  run.step("opalclasp","walk");run.step("opalclasp","catch");catchActive(g);
  assert.ok(!g.team().some(p=>p.id==="opalclasp"));run.step("opalclasp","enlist");
  const replace=ui.model("enlist:opalclasp").sections[0].rows;assert.equal(replace.length,6);
  const before=JSON.stringify(g.state);ui.act("guard-lesson-replace","opalclasp|invalid");assert.equal(JSON.stringify(g.state),before);
  const choice=replace.find(r=>r.value==="opalclasp|gustlance");ui.act(choice.id,choice.value);
  assert.equal(g.state.team.length,6);assert.ok(g.state.team.includes("opalclasp"));assert.ok(!g.state.team.includes("gustlance"));
  assert.ok(g.state.party.some(p=>p.id==="gustlance"));run.step("opalclasp","lead");
  const last=JSON.stringify(g.state);ui.act("guard-lesson-step","opalclasp|catch");ui.act("guard-lesson-step","toString|lead");
  assert.equal(JSON.stringify(g.state),last);assert.equal(ui.act("unrelated",null),false);
});

function returningGuard(level){
  const {g}=boot(),save=JSON.parse(JSON.stringify(g.state));
  for(const id of ["mossbell","gustlance","leafshuttle","smelteroll"])save.party.push(g.loaner(id,id==="smelteroll"?level:5));
  save.team=save.party.slice(0,6).map(p=>p.id);
  return boot(JSON.stringify(save));
}
test("a field guide link trains the selected owned cousin, including the full-party exchange and walk back to the same pupil",()=>{
  const run=returningGuard(4),{ui,g}=run;
  assert.match(ui.model("galepincer").sections[0].title,/Opalclasp/); // Unowned cousin.
  assert.match(ui.model("__proto__").sections[0].title,/Opalclasp/);
  assert.deepEqual(Array.from(ui.model("smelteroll").sections,s=>s.title),["Smelteroll · Shell Escort","Opalclasp · Pincer Hold"]);
  run.step("smelteroll","enlist");
  assert.deepEqual(run.calls.at(-1),["go","guard-school","enlist:smelteroll"]);
  const change=ui.model("enlist:smelteroll").sections[0].rows.find(r=>r.value==="smelteroll|gustlance");
  ui.act(change.id,change.value);run.step("smelteroll","lead");run.step("smelteroll","walk");
  assert.deepEqual(run.calls.at(-1),["go","guard-school","smelteroll"]);
  run.step("smelteroll","practice");
  assert.equal(g.state.battle.activeId,"smelteroll");
  for(let n=0;n<3;n++)ok(g.useSkill("roll-brace"));
  assert.equal(g.guardTraining("smelteroll").learned,true);assert.equal(g.guardTraining("cragroll").learned,false);
  assert.equal(run.reload().g.guardTraining("smelteroll").learned,true);
});
test("veterans receive a charge-timing adjustment, or a new destination when their guard would one-shot every familiar target",()=>{
  for(const level of [22,65]){
    const run=returningGuard(level);
    run.step("smelteroll","enlist");
    run.ui.act("guard-lesson-replace","smelteroll|gustlance");run.step("smelteroll","lead");
    if(level===22){
      run.step("smelteroll","walk");
      const next=run.rows("smelteroll","smelteroll")[0];assert.match(next.detail,/Switch out on turn one/);
      run.step("smelteroll","practice");
      ok(run.g.swap("dewfin"));ok(run.g.swap("smelteroll"));ok(run.g.useSkill("roll-brace"));
      assert.ok(run.g.guardTraining("smelteroll").learned);
    }else{
      assert.match(run.rows("smelteroll","smelteroll")[0].detail,/stronger Warden/);
      run.step("smelteroll","stronger");assert.equal(run.calls.at(-1)[1],"atlas");
      assert.equal(run.g.state.battle,null);
    }
  }
});
