const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const scripts=["atlas","bestiary","activities","campaign","story","duets","growth","wardens","second-bell","engine"].map(name=>{
  const filename=path.join(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(fs.readFileSync(filename,"utf8"),{filename});
});
function boot(raw=null){
  const localStorage={getItem:k=>k==="wilderkin.trail.v3"?raw:null,setItem:(_,s)=>{raw=s;}};
  const ctx=vm.createContext({window:{localStorage}});
  scripts.forEach(f=>f.runInContext(ctx));
  return {g:ctx.window.WilderGame,raw:()=>raw,reload:()=>boot(raw)};
}
const copy=x=>JSON.parse(JSON.stringify(x));
const ok=r=>assert.ok(r.ok,r.message);
const member=(g,id)=>g.state.party.find(p=>p.id===id);
function lodge(g,n=0){
  g.state.region=g.wardens[n];
  if(n)g.state.crests=Array.from(g.wardens.slice(0,n+1));
  assert.ok(g.visitSite("warden"));
}
function finish(g){
  let res;
  for(let i=0;g.state.battle&&i<120;i++){
    const active=g.state.battle.activeId;
    const moves=[];
    for(const s of g.kin(active,{owned:true}).skills){
      const p=g.ordinaryForecast(s.id);
      if(p?.available)moves.push({score:p.damage+.8*p.healing-.82*p.returnDamage,run:()=>g.useSkill(s.id)});
    }
    for(const d of g.duets().options.filter(o=>o.available))
      moves.push({score:d.damage+.8*(d.healLead+d.healPartner)-.82*d.returnDamage,run:()=>g.useDuet(d.partnerId)});
    res=moves.sort((a,b)=>b.score-a.score)[0].run();ok(res);
  }
  assert.equal(g.state.battle,null);
  return res;
}

test("Fern accepts a fresh traveling team only at the lodge, other Wardens require their own crest",()=>{
  const {g}=boot();
  assert.ok(g.secondBell(0).eligible);assert.equal(g.secondBell(0).atLodge,false);
  assert.equal(g.secondBell(1).eligible,false);assert.equal(g.secondBell(-1),null);
  const before=copy(g.state);assert.equal(g.startBattle("second-bell").ok,false);assert.deepEqual(copy(g.state),before);
  lodge(g);
  member(g,"dewfin").hp=0;member(g,"cindlet").hp=3;
  const waiting=copy(g.state),printed=copy(g.secondBell());
  for(const id of ["missing","mossbell",null])assert.equal(g.startBattle("second-bell",id).ok,false);
  assert.deepEqual(copy(g.state),waiting);
  ok(g.startBattle("second-bell","dewfin"));
  assert.equal(g.state.battle.kind,"warden");assert.equal(g.state.battle.activeId,"dewfin");assert.equal(g.state.lead,"sprigkit");
  assert.deepEqual(copy(g.state.battle.secondBell.roster),printed.roster);
  assert.equal(printed.level,6);assert.equal(g.state.battle.enemy.level,6);
  assert.ok(g.team().every(p=>p.hp===p.maxHp));
  for(const item of Object.keys(g.items)){const state=copy(g.state);assert.equal(g.useItem(item,"cindlet").ok,false);assert.deepEqual(copy(g.state),state);}
  assert.equal(g.startBattle("second-bell").ok,false);
  const end=g.flee();ok(end);assert.equal(end.kind,"escaped");assert.equal(end.secondBell,true);assert.equal(end.best,null);
  assert.deepEqual(copy(g.state),waiting);
  g.state.crests=[0];g.state.region=1;assert.ok(g.visitSite("warden"));assert.equal(g.secondBell().available,false);
  g.state.crests.push(1);assert.equal(g.secondBell().available,true);
});

test("a fresh three-member victory restores career state, records its actual finish, and pays no crest or coaching reward",()=>{
  const run=boot(),g=run.g; lodge(g);
  member(g,"cindlet").hp=0;member(g,"sprigkit").hp=4;
  const before=copy(g.state);
  ok(g.startBattle("second-bell","cindlet"));
  const played=finish(g);
  assert.equal(played.kind,"victory");assert.ok(played.secondBell&&played.updatedBest);
  before.bellMarks[0]={level:6,standing:3,team:["sprigkit","cindlet","dewfin"]};
  assert.deepEqual(copy(played.best),before.bellMarks[0]);assert.deepEqual(copy(g.state),before);
  const resumed=run.reload().g;assert.deepEqual(copy(resumed.state),before);
  ok(resumed.startBattle("second-bell","cindlet"));
  const rematch=finish(resumed);
  assert.equal(rematch.updatedBest,false);assert.deepEqual(copy(resumed.state),before);
});

test("even a resting team that entered with zero HP keeps that exact health after withdrawal and reload",()=>{
  const run=boot(),g=run.g;lodge(g);
  for(const p of g.team())p.hp=0;
  ok(g.startBattle("second-bell","dewfin"));assert.ok(g.team().every(p=>p.hp===p.maxHp));
  const resume=run.reload();ok(resume.g.flee());
  assert.ok(resume.reload().g.team().every(p=>p.hp===0));
});

test("a six-member exhibition keeps the reserve untouched and ranks level before surviving team size",()=>{
  const {g}=boot();lodge(g);
  for(const id of ["gustlance","opalclasp","mossbell","cragroll"])g.state.party.push(g.loaner(id,9));
  for(const id of ["gustlance","opalclasp","mossbell"])ok(g.enlist(id));
  member(g,"cragroll").hp=1;
  g.state.bellMarks[0]={level:8,standing:6,team:Array.from(g.state.team)};
  const card=g.secondBell();assert.equal(card.level,9);assert.equal(card.roster.length,6);
  const first=copy(g.state);
  ok(g.startBattle("second-bell","opalclasp"));assert.equal(member(g,"cragroll").hp,1);
  const b=g.state.battle;
  // Finish the last opponent with two still standing; the higher level beats the previous six standing.
  b.secondBell.defeated=Array.from(b.remaining);b.remaining=[];b.enemy.hp=1;
  g.team().filter(p=>!["opalclasp","cindlet"].includes(p.id)).forEach(p=>{p.hp=0;});
  const res=g.useSkill("pincer-block");ok(res);
  assert.equal(res.level,9);assert.equal(res.standing,2);assert.equal(res.updatedBest,true);
  first.bellMarks[0]={level:9,standing:2,team:Array.from(g.state.team)};
  assert.deepEqual(copy(g.state),first);
});

test("nonlocal guests, injured relay reserves and pending free replacements survive an exhibition reload",()=>{
  const run=boot(),g=run.g;lodge(g,2);
  const before=copy(g.state);
  ok(g.startBattle("second-bell","sprigkit"));
  const b=g.state.battle,opener=b.enemy.id,guest=b.remaining[0];
  assert.ok(!g.pools[g.state.region].includes(guest));
  assert.equal(g.wardenForecast().kind,"relay");assert.ok(g.foeIntent().support);
  const changed=g.useSkill("leaf-flurry");ok(changed);assert.ok(changed.foeShifted);
  assert.equal(b.enemy.id,guest);assert.equal(b.remaining.at(-1),opener);
  assert.ok(b.reserveHp.at(-1)<g.loaner(opener,b.enemy.level).maxHp);
  const resumed=run.reload(),live=resumed.g;
  assert.deepEqual(copy(live.state.battle),copy(b));
  member(live,"sprigkit").hp=1;
  ok(live.useSkill("brush-dash"));
  assert.equal(live.replacements().fallen,"sprigkit");
  const again=resumed.reload().g;
  assert.deepEqual(copy(live.replacements()),copy(again.replacements()));
  const turn=again.state.battle.turn;ok(again.replaceFainted("dewfin"));assert.equal(again.state.battle.turn,turn);
  const restore=again.flee();assert.equal(restore.secondBell,true);
  assert.deepEqual(copy(again.state.party),before.party);assert.deepEqual(copy(again.state.seen),before.seen);
  assert.deepEqual(copy(again.state.bellMarks),{});assert.deepEqual(copy(again.state.crests),before.crests);
});

test("a genuinely trained guard can advance in an exhibition; losing restores injuries at the same lodge",()=>{
  const run=boot(),g=run.g;lodge(g);
  g.state.party.push(g.loaner("cragroll",6));g.state.seen.push("cragroll");ok(g.enlist("cragroll"));
  member(g,"cragroll").hp=0;member(g,"sprigkit").hp=2;
  const before=copy(g.state);
  ok(g.startBattle("second-bell","cragroll"));
  for(let i=0;i<3;i++)ok(g.useSkill("roll-brace"));
  assert.equal(g.guardTraining("cragroll").learned,true);
  const resumed=run.reload().g;
  assert.equal(resumed.guardTraining("cragroll").learned,true);
  for(const p of resumed.team())p.hp=p.id==="cragroll"?1:0;
  const loss=resumed.useSkill("roll-brace");assert.equal(loss.kind,"defeat");assert.equal(loss.secondBell,true);assert.equal(loss.standing,0);
  before.trainedGuards.push("cragroll");
  assert.deepEqual(copy(resumed.state),before);
});

test("invalid or truncated exhibition saves never become ordinary Warden fights; bad register entries are dropped",()=>{
  const {g}=boot();lodge(g);member(g,"cindlet").hp=3;ok(g.startBattle("second-bell"));
  const raw=copy(g.state);
  for(const corrupt of [
    s=>{delete s.battle.secondBell;},s=>{s.battle.secondBell=null;},
    s=>{s.battle.secondBell.region=99;},s=>{s.battle.secondBell.level++;},
    s=>{s.battle.secondBell.entryHp.cindlet=-4;},s=>{delete s.battle.secondBell.entryHp.sprigkit;},
    s=>{s.battle.remaining.pop();},s=>{s.battle.remaining[0]=s.battle.enemy.id;},
    s=>{s.battle.secondBell.roster[0]="sprigkit";},s=>{s.battle.enemy.hp=0;},
    s=>{s.battle.reserveHp=[999];},s=>{s.battle.kind="wild";}
  ]){
    const bad=copy(raw);corrupt(bad);const restored=boot(JSON.stringify(bad)).g;
    assert.equal(restored.state.battle,null);assert.deepEqual(copy(restored.state.crests),[]);
    assert.deepEqual(copy(restored.state.bellMarks),{});assert.equal(restored.state.wins,0);
    if(bad.battle.secondBell?.entryHp?.cindlet===3)assert.equal(member(restored,"cindlet").hp,3);
  }
  for(const invalid of [{level:6,standing:1,team:["missing"]},{level:6,standing:3,team:["cindlet"]},
    {level:180,standing:1,team:["cindlet"]},{level:6,standing:1,team:["cindlet","cindlet"]}]){
    const state=copy(raw);state.bellMarks={0:invalid,1:{level:8,standing:1,team:["sprigkit"]}};
    assert.deepEqual(copy(boot(JSON.stringify(state)).g.state.bellMarks),{});
  }
  const legacy=copy(raw);delete legacy.battle;delete legacy.bellMarks;
  assert.deepEqual(copy(boot(JSON.stringify(legacy)).g.state.bellMarks),{});
});
