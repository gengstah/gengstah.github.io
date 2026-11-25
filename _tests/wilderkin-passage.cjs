const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const files=["atlas","bestiary","campaign","activities","story","fieldwork","duets","wardens","engine"].map(name=>{
  const file=path.join(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(fs.readFileSync(file,"utf8"),{filename:file});
});
const copy=v=>JSON.parse(JSON.stringify(v));
const ok=r=>assert.ok(r.ok,r.message);
function load(record){
  const records=new Map(record?[["wilderkin.trail.v"+record.version,JSON.stringify(record)]]:[]);
  const storage={getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)};
  // The map geometry has its own full-atlas tests. An explicit map with separate
  // observation spots and trailpost isolates the engine's physical-presence gates.
  const window={localStorage:storage};
  const ctx=vm.createContext({window});
  for(const file of files)file.runInContext(ctx);
  const sites=["travel","camp","wild","activities","warden"].map((id,i)=>({id,x:2+i*3,y:1}));
  window.WilderWorld={regions:window.WilderAtlas.regions.map(()=>({sites,spawn:{x:0,y:0}})),
    sightingTiles:(_,count)=>Array.from({length:count},(_,i)=>({x:2+i*3,y:7}))};
  const g=window.WilderGame;
  function visit(kind){
    const site=sites.find(p=>p.id===kind);assert.ok(g.setPosition(site.x,site.y));assert.ok(g.visitSite(kind));
  }
  return {g,story:window.WilderStory,records,visit,save:()=>JSON.parse(records.get("wilderkin.trail.v3"))};
}
function deltaCheckpoint(){
  const fresh=load().g,s=copy(fresh.state);
  s.region=3;s.visited=[0,1,2,3];s.crests=[0,1,2];s.met=[0,1,2];
  // Two earned commission legs predate the first observation; two new notes earn
  // two more, one short of Reedline's five-leg filing threshold.
  s.surveys={0:3,1:4,2:5,3:2};
  return s;
}
function observe(g,id){
  const spot=g.sightings().find(p=>p.species===id);
  assert.ok(g.setPosition(spot.x,spot.y));
  ok(g.observe(id,"read-trace"));ok(g.observe(id,"try-"+g.study(id).variant));
}
test("local studies, a local friend, field legs and the trailpost are independent filing requirements",()=>{
  const checkpoint=deltaCheckpoint(),veteran=checkpoint.party[0];
  veteran.level=42;veteran.hp=veteran.maxHp=32+(veteran.level-5)*3;
  const flow=load(checkpoint),g=flow.g;
  assert.equal(g.passageReport(0),null);assert.equal(g.passageReport(2),null);
  assert.equal(g.passageReport(150),null);
  assert.equal(g.access(4).questId,"four-corners");assert.equal(g.trialAccess(8).target,3);
  flow.visit("travel");
  assert.deepEqual(copy(g.passageReport().requirements.map(r=>r.done)),[false,false,false]);
  assert.ok(!g.filePassage().ok);
  ok(g.travel(2));observe(g,g.pools[2][0]);ok(g.travel(3));
  const [first,second,third]=g.pools[3];
  observe(g,first);observe(g,second);
  // A partly read file and a complete observation from a neighboring route are
  // insufficient. The origin receives no credit for either one.
  const thirdSpot=g.sightings().find(p=>p.species===third);
  g.setPosition(thirdSpot.x,thirdSpot.y);ok(g.observe(third,"read-trace"));
  assert.equal(g.passageReport().requirements[0].done,false);
  ok(g.observe(third,"try-"+g.study(third).variant));assert.equal(g.passageReport().requirements[0].done,true);
  assert.equal(g.passageReport().requirements[1].done,false);
  ok(g.inviteField(third));
  assert.deepEqual(copy(g.passageReport().requirements.map(r=>r.done)),[true,true,false]);
  flow.visit("travel");assert.ok(!g.filePassage().ok);
  const job=g.expedition(),choice=job.choices.filter(c=>c.available).sort((a,b)=>a.foes-b.foes)[0];
  flow.visit(job.targetSite);ok(g.expeditionAction(choice.id));
  for(let turn=0;g.state.battle && turn<80;turn++){
    const leader=g.state.battle.activeId;
    ok(g.useSkill(g.species[leader].skills.find(move=>move.kind==="attack").id));
  }
  assert.equal(g.state.battle,null);assert.equal(g.state.surveys[3],5);
  assert.ok(g.passageReport().requirements.every(r=>r.done));assert.ok(!g.expedition().done);
  flow.visit("camp");assert.equal(g.passageReport().atDesk,false);assert.ok(!g.filePassage().ok);
  assert.ok(!g.visitSite("travel"));
  flow.visit("travel");ok(g.startBattle("wild",first));assert.ok(!g.filePassage().ok);ok(g.flee());
  flow.visit("travel");
  const before=copy(g.team());ok(g.filePassage());
  assert.equal(g.state.surveys[3],5);assert.equal(g.expedition().done,false);
  assert.equal(g.access(4).open,false);assert.equal(g.trialAccess(8).target,4);
  for(const p of before){
    const after=g.state.party.find(k=>k.id===p.id);
    assert.equal(after.level,p.level+(p.level<g.wildLevel(3)?1:0));assert.equal(after.xp,p.xp);
  }
  ok(g.questAction("four-corners"));ok(g.questAction("four-corners"));assert.ok(g.access(4).open);
  const paid=flow.save();assert.ok(!g.filePassage().ok);assert.deepEqual(flow.save(),paid);
  const restored=load(paid);assert.ok(restored.g.passageReport().filed);ok(restored.g.travel(4));
  assert.ok(!restored.g.filePassage().ok);assert.ok(restored.g.access(5).open);
});
test("filed wildlife reports and chapters earn Warden admission while exploration stays open",()=>{
  const s=deltaCheckpoint();s.region=8;s.visited=[0,1,2,3,4,5,6,7,8];s.reports=[3,4,5,6,7];s.surveys[8]=11;
  const flow=load(s),g=flow.g;
  assert.ok(!g.trialAccess(8).open);assert.match(g.trialAccess(8).reason,/chapter 4/);
  const draft="chapter-4";
  while(!flow.story.chapterDone(g.state,3))ok(g.storyStep(draft,flow.story.scene(g.state,draft).choices[0]?.id));
  assert.ok(g.trialAccess(8).open);
  const next=load({...s,region:4,visited:[0,1,2,3,4],reports:[3,4]});
  assert.ok(next.g.access(5).open);assert.equal(next.g.access(5).carrier,undefined);
  ok(next.g.travel(5));assert.ok(!next.g.state.licenses.includes("Raftwake"));
});
test("Trailpot broth consumes its recipe once, heals each injured conscious traveler up to one third and leaves reserves alone",()=>{
  const s=copy(load().g.state);
  s.party[0].hp=1;s.party[1].hp=s.party[1].maxHp-1;s.party[2].hp=0;
  s.party.push({id:"mossbell",level:5,maxHp:35,hp:3,xp:4});
  const flow=load(s),g=flow.g,original=copy(g.state.bag),party=copy(g.state.party);
  assert.ok(!g.useItem("broth").ok);ok(g.craft("broth"));
  assert.equal(g.state.bag.reed,original.reed-2);assert.equal(g.state.bag.sap,original.sap-2);
  assert.equal(g.state.bag.balm,original.balm-1);assert.equal(g.state.crafted.broth,1);
  assert.equal(flow.save().bag.broth,1);
  const carried=load(flow.save());ok(carried.g.useItem("broth"));
  assert.equal(carried.g.state.party[0].hp,1+Math.ceil(party[0].maxHp/3));
  assert.equal(carried.g.state.party[1].hp,party[1].maxHp);assert.equal(carried.g.state.party[2].hp,0);
  assert.equal(carried.g.state.party[3].hp,3);assert.equal(carried.g.state.bag.broth,0);
  assert.deepEqual(copy(carried.g.state.party.map(p=>p.xp)),party.map(p=>p.xp));
  assert.ok(!carried.g.useItem("broth").ok);assert.equal(load(carried.save()).g.state.crafted.broth,1);
});
test("a full party, missing ingredients and an interrupted battle cannot consume a meal or a combat turn",()=>{
  const flow=load(),g=flow.g;
  ok(g.craft("broth"));assert.ok(!g.useItem("broth").ok);assert.equal(g.state.bag.broth,1);
  ok(g.startBattle("wild","mossbell"));ok(g.useSkill("brush-dash"));
  const resumed=load(flow.save()),before=copy(resumed.g.state);
  assert.ok(!resumed.g.craft("broth").ok);assert.ok(!resumed.g.useItem("broth").ok);
  assert.deepEqual(copy(resumed.g.state),before);
  ok(resumed.g.flee());ok(resumed.g.useItem("broth"));
  const poor=resumed.save();poor.bag.reed=1;
  const limited=load(poor),bag=copy(limited.g.state.bag);
  assert.ok(!limited.g.craft("broth").ok);assert.deepEqual(copy(limited.g.state.bag),bag);
});
test("v1, v2 and pre-feature v3 saves preserve their campaign and start with empty meal and report records",()=>{
  const template=deltaCheckpoint();delete template.reports;delete template.bag.broth;
  template.wins=9;template.party[1].hp=14;
  for(const version of [1,2,3]){
    const source={...copy(template),version};const flow=load(source),g=flow.g;
    assert.equal(g.state.region,3);assert.equal(g.state.wins,9);assert.equal(g.state.party[1].hp,14);
    assert.deepEqual(copy(g.state.reports),[]);assert.equal(g.state.bag.broth,0);
    ok(g.craft("broth"));assert.equal(load(flow.save()).g.state.bag.broth,1);
    if(version<3)assert.deepEqual(JSON.parse(flow.records.get("wilderkin.trail.v"+version)),source);
  }
  const noisy=copy(template);noisy.reports=[-1,0,1,2,3,3,"4",150,null];noisy.bag.broth=-2;
  const repaired=load(noisy);assert.deepEqual(copy(repaired.g.state.reports),[3]);assert.equal(repaired.g.state.bag.broth,0);
});
