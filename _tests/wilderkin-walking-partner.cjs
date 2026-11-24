const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
function start(stored=new Map()) {
  const window={localStorage:{getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v)}};
  const document={createElement(){const canvas={},noop=()=>{};
    canvas.getContext=()=>({canvas,drawImage:noop,fillRect:noop,putImageData:noop,beginPath:noop,lineTo:noop,
      moveTo:noop,stroke:noop,createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)})});return canvas;}};
  const context=vm.createContext({window,document,performance:{now:()=>10000}});
  for(const name of ["atlas","bestiary","activities","campaign","story","fieldwork","walking-partner","world","engine"]) {
    const file=path.join(__dirname,"../games/wilderkin",name+".js");vm.runInContext(fs.readFileSync(file,"utf8"),context);
  }
  return {g:window.WilderGame,w:window.WilderWorld,walking:window.WilderWalkingPartner,stored};
}
const tile=p=>[p.tileX,p.tileY];
test("walking partners consume the actual path around corners, keep clear of collisions, and survive reload",()=>{
  const {g,w,stored}=start(),s=g.state,spawn=w.regions[0].spawn;
  const a=spawn,b={x:a.x+1,y:a.y},c={x:b.x,y:b.y+1};
  for(const p of [a,b,c]){assert.ok(w.walkable(0,p.x,p.y));g.setPosition(p.x,p.y);}
  assert.deepEqual(tile(g.walkerPose(10000,true)),[b.x,b.y]);
  const between=g.walkerPose(10057.5,false);
  assert.equal(between.x,(a.x+b.x)/2);assert.equal(between.y,a.y);
  assert.deepEqual(tile(start(stored).g.walkerPose(20000,true)),[b.x,b.y]);
  assert.equal(g.walkerInfo().id,s.lead);
  assert.ok(g.setWalker("cindlet").ok);assert.equal(g.walkerInfo().id,"cindlet");assert.equal(s.lead,"sprigkit");
  assert.ok(g.setLead("dewfin").ok);assert.equal(g.walkerInfo().id,"cindlet");
  assert.ok(g.setWalker("lead").ok);assert.equal(g.walkerInfo().id,"dewfin");
  assert.ok(g.setWalker("hidden").ok);assert.equal(g.walkerPose(20000,true),null);
  assert.equal(start(stored).g.walkerInfo().mode,"hidden");
  assert.ok(!g.setWalker("unowned").ok);assert.equal(g.walkerInfo().mode,"hidden");
});
test("a real field milestone creates a memory for the companion that was actually present",()=>{
  const {g,stored}=start(),s=g.state,id=g.sightings()[0].species,site=g.sightings()[0];
  g.setWalker("cindlet");const team=s.team.slice(),leader=s.lead;
  g.setPosition(site.x,site.y);
  assert.ok(g.observe(id,"read-sound").ok);assert.ok(!g.walkerInfo().memory);
  assert.ok(g.observe(id,"try-"+g.study(id).variant).ok);
  const memory=g.walkerInfo().memory;
  assert.match(memory,/Cindlet/);assert.ok(memory.includes(g.species[id].name));
  g.setWalker("dewfin");assert.equal(g.walkerInfo().memory,"");
  g.setWalker("cindlet");assert.equal(g.walkerInfo().memory,memory);
  const after=start(stored).g;
  assert.equal(after.walkerInfo().id,"cindlet");assert.equal(after.walkerInfo().memory,memory);
  assert.deepEqual(s.team,team);assert.equal(s.lead,leader);
  s.party.find(p=>p.id==="cindlet").hp=1;assert.match(g.walkerInfo().moment,/camp/);
});
test("trail sense finds reachable open wildlife then routes to the local campaign objective",()=>{
  const {g,w}=start(),s=g.state;
  for(let i=0;i<g.regions.length;i++) {
    s.region=i;const spots=g.sightings(),spawn=w.regions[i].spawn;s.positions[i]=spawn;
    const sensed=g.walkerSense();assert.ok(sensed.species);assert.ok(sensed.steps>=0);assert.equal(sensed.screen,"study");
    const d={north:[0,-1],south:[0,1],east:[1,0],west:[-1,0]};
    if(sensed.steps){const [dx,dy]=d[sensed.direction];assert.ok(w.walkable(i,spawn.x+dx,spawn.y+dy));}
    for(const site of spots)s.fieldwork[site.species]={complete:true,clues:["trace"],tried:[]};
    const next=g.walkerSense();assert.ok(!next.species);assert.equal(next.kind,g.expedition().targetSite);
  }
});
test("a walking partner remembers the first Warden crest it witnesses, even when another kin fights",()=>{
  const {g,stored}=start(),s=g.state;
  g.setLead("cindlet");g.setWalker("dewfin");
  // Start from a commission-complete checkpoint and play the actual chapter and trial actions.
  s.surveys[0]=g.expedition().total;
  for(let i=0;i<18 && !s.story.records["chapter-1"]?.done;i++) {
    const r=g.storyStep("chapter-1");
    if(!r.ok)assert.ok(g.storyStep("chapter-1","a").ok);
  }
  assert.ok(g.meetWarden().ok);assert.ok(g.startBattle("warden").ok);
  assert.ok(!g.setWalker("hidden").ok);
  while(s.battle)assert.ok(g.useSkill("ember-pop").ok);
  assert.deepEqual(Array.from(s.crests),[0]);assert.match(g.walkerInfo().memory,/Leaf Crest/);
  assert.ok(g.walkerInfo().memory.includes("Dewfin"));
  g.setWalker("cindlet");assert.equal(g.walkerInfo().memory,"");
  g.setWalker("dewfin");assert.equal(start(stored).g.walkerInfo().memory,g.walkerInfo().memory);
});
