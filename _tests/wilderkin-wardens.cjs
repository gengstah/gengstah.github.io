const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const files=["atlas","bestiary","activities","campaign","story","duets","growth","wardens","engine"].map(name=>{
  const file=path.join(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(fs.readFileSync(file,"utf8"),{filename:file});
});
function load(raw) {
  const store=new Map(raw?[["wilderkin.trail.v3",raw]]:[]);
  const window={localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)}};
  const ctx=vm.createContext({window});files.forEach(f=>f.runInContext(ctx));
  return {g:window.WilderGame,story:window.WilderStory,dex:window.WilderKinDex,save:()=>store.get("wilderkin.trail.v3")};
}
const ok=r=>assert.ok(r.ok,r.message);
function lodge(ordinal,loaded=load()) {
  const {g,story}=loaded,s=g.state,i=g.wardens[ordinal],r=g.regions[i];
  s.region=i;s.visited=Array.from({length:i+1},(_,x)=>x);s.crests=g.wardens.slice(0,ordinal);s.met=s.crests.slice();
  for(let a=0;a<=i;a++)s.surveys[a]=g.expedition(a).total;
  for(const p of s.party) {
    p.level=r.wardenLevel;p.xp=0;p.hp=p.maxHp=g.species[p.id].baseHp+(p.level-5)*3;
  }
  s.bag.tonic=12;s.bag.sparkseed=4;
  const id="chapter-"+(ordinal+1);
  while(!story.chapterDone(s,ordinal))ok(g.storyStep(id,story.scene(s,id).choices[0]?.id));
  ok(g.meetWarden());ok(g.startBattle("warden"));
  return loaded;
}
function soloStep({g,dex},answer=true) {
  const s=g.state,b=s.battle,f=g.wardenForecast(),target=g.species[b.enemy.id],p=g.team().find(p=>p.id===b.activeId),kin=g.species[p.id];
  const guard=()=>g.useSkill(kin.skills.find(x=>x.kind==="guard").id);
  const attack=()=>g.useSkill(kin.skills.find(x=>x.kind==="attack").id);
  const score=q=>dex.effectiveness(g.species[q.id].type,target.types)+q.hp/q.maxHp*.2;
  const reserve=g.team().filter(q=>q.hp>0&&q.id!==p.id).sort((a,b)=>score(b)-score(a))[0];
  if(answer&&f.active) {
    if(["screen","shunt","colors"].includes(f.kind))return guard();
    if(["relay","tangle"].includes(f.kind) && reserve)return g.swap(reserve.id);
    if(f.kind==="cadence")return b.coach.last==="guard"?attack():guard();
    if(f.kind==="aid") {
      if(p.hp<p.maxHp)return g.useSkill(kin.skills.find(x=>x.kind==="heal").id);
      const hurt=g.team().find(q=>q.hp>0&&q.hp<q.maxHp);
      if(hurt && s.bag.tonic)return g.useItem("tonic",hurt.id);
    }
  }
  if(p.hp<p.maxHp*.45 && s.bag.tonic)return g.useItem("tonic",p.id);
  if(reserve && score(reserve)>score(p)+.4)return g.swap(reserve.id);
  return attack();
}
test("every Warden's coaching seal and first crest can be earned with the original three and ordinary moves",()=>{
  const lessons=new Set(),drills=new Set();
  for(let n=0;n<30;n++) {
    const l=lodge(n),g=l.g,s=g.state,name=g.regions[s.region].warden,forecast=g.wardenLesson();
    assert.equal(forecast.coach,name);assert.ok(!forecast.mastered);
    assert.ok(!lessons.has(forecast.title));lessons.add(forecast.title);
    let turns=0;
    while(s.battle&&turns++<180) {
      const f=g.wardenForecast();assert.ok(f.title&&f.description&&f.counter);
      if(f.active)drills.add(f.kind);
      ok(soloStep(l));
    }
    assert.ok(!s.battle,name+" stalled");
    assert.ok(s.crests.includes(s.region),name+" trial lost");
    assert.ok(g.wardenLesson().mastered,name+" lesson incomplete");
    assert.equal(s.wardenLessons.length,1);
  }
  assert.equal(lessons.size,30);assert.equal(drills.size,7);
});
test("a missed coaching seal leaves the crest attainable and pays its supplies only once on a rematch",()=>{
  const l=lodge(0),{g}=l,s=g.state;
  while(s.battle)ok(soloStep(l,false));
  assert.ok(s.crests.includes(0));assert.ok(!g.wardenLesson().mastered);assert.equal(s.wardenLessons.length,0);
  const reward=s.bag.kinweave;
  for(let i=0;i<2;i++) {
    ok(g.heal());ok(g.startBattle("warden"));
    while(s.battle)ok(soloStep(l));
    assert.equal(s.bag.kinweave,reward+2);assert.equal(s.crests.length,1);assert.equal(s.wardenLessons.length,1);
  }
  assert.ok(load(l.save()).g.wardenLesson().mastered);
});
test("reserve relay preserves actual injury, resumes in the same order, and foretells a zero-damage maneuver",()=>{
  const l=lodge(2),{g}=l,s=g.state,b=s.battle,old=b.enemy.id,next=b.remaining[0],oldMax=b.enemy.maxHp;
  assert.equal(g.wardenForecast().kind,"relay");assert.ok(g.foeIntent().support);
  assert.ok(g.duets().options.every(o=>o.returnDamage===0));
  const lead=g.team()[0],hp=lead.hp;
  const r=g.useSkill("leaf-flurry");ok(r);assert.ok(r.foeShifted&&r.skipCounterFx);
  assert.equal(r.impacts.ally.foe.id,old);assert.ok(r.impacts.ally.foe.change<0);
  assert.equal(r.impacts.foe.foe.id,next);assert.equal(r.impacts.foe.foe.change,0);
  assert.equal(r.impacts.foe.foe.changedFront,true);
  assert.equal(lead.hp,hp);assert.equal(b.enemy.id,next);assert.equal(b.remaining.at(-1),old);
  assert.ok(b.reserveHp.at(-1)<oldMax && b.reserveHp.at(-1)>0);
  const fixed=load(l.save()).g;
  assert.deepEqual(JSON.parse(JSON.stringify(fixed.state.battle)),JSON.parse(JSON.stringify(b)));
  assert.deepEqual(JSON.parse(JSON.stringify(fixed.wardenForecast())),JSON.parse(JSON.stringify(g.wardenForecast())));
});
test("shelter and crosswind alter the two field formations, and the cord removes only unprotected beats",()=>{
  const fern=lodge(0).g,b=fern.state.battle;
  b.cover=2;ok(fern.useSkill("leaf-flurry"));
  assert.equal(b.coach.screen,2);assert.ok(fern.foeIntent().guarding);assert.equal(b.cover,2);
  ok(fern.useSkill("brush-dash"));assert.equal(b.coach.screen,1);assert.equal(b.cover,1);
  for(const guard of [false,true]) {
    const marl=lodge(3).g,gate=marl.state.battle;
    assert.equal(marl.wardenForecast().kind,"shunt");
    const hp=marl.team()[0].hp;
    ok(marl.useSkill(guard?"brush-dash":"leaf-flurry"));
    assert.equal(gate.activeId,guard?"sprigkit":"cindlet");
    assert.equal(marl.team()[0].hp,hp);
    assert.equal(gate.coach.heard.includes("shunt"),guard);
    const kestrel=lodge(4).g,cord=kestrel.state.battle;
    assert.equal(kestrel.wardenForecast().kind,"tangle");
    cord.beats=2;
    if(guard)ok(kestrel.swap("dewfin"));else ok(kestrel.useSkill("leaf-flurry"));
    assert.equal(cord.beats,guard?3:1);
    assert.equal(cord.coach.heard.includes("tangle"),guard);
  }
});
test("medical intervals, alternating affinities and repeating an action produce the promised next state",()=>{
  for(const cares of [false,true]) {
    const aster=lodge(9).g,b=aster.state.battle,p=aster.team()[0];
    b.turn=2;b.enemy.hp=Math.floor(b.enemy.maxHp/2);p.hp=1;
    assert.equal(aster.wardenForecast().kind,"aid");
    const enemyHp=b.enemy.hp,ownHp=p.hp;
    // Both actions avoid outgoing damage. Care on the injured front shares the ward.
    if(cares)ok(aster.useSkill("sun-nap"));else ok(aster.swap("cindlet"));
    assert.equal(b.enemy.hp,enemyHp+Math.ceil(b.enemy.maxHp*(cares ? .1 : .2)));
    assert.equal(b.coach.heard.includes("aid"),cares);
    if(cares)assert.equal(p.hp,ownHp+Math.ceil(p.maxHp/3)+Math.ceil(p.maxHp*.1));
  }
  const safa=lodge(6).g,signal=safa.state.battle;
  for(const [turn,element] of [[1,"Loam"],[7,"Vane"],[13,"Loam"]]) {
    signal.turn=turn;
    assert.ok(safa.wardenForecast().description.includes(element));
    assert.equal(safa.foeIntent().skill.type,element);
    assert.ok(!safa.foeIntent().support);
  }
  for(const repeat of [true,false]) {
    const flint=lodge(1).g,b=flint.state.battle;
    ok(flint.useSkill("brush-dash"));assert.equal(b.coach.last,"guard");
    assert.equal(flint.wardenForecast().kind,"cadence");assert.ok(flint.wardenForecast().active);
    const ownHp=flint.team()[0].hp;
    ok(flint.useSkill(repeat?"brush-dash":"leaf-flurry"));assert.equal(flint.team()[0].hp,ownHp);
    assert.equal(b.coach.charge,repeat);assert.equal(b.opening,!repeat);
    assert.equal(b.coach.heard.includes("cadence"),!repeat);
    if(repeat)assert.equal(flint.foeIntent().skill.type,flint.species[b.enemy.id].type);
  }
});
