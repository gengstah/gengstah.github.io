const {test}=require("node:test");
const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

function load() {
  const records=new Map();
  const document={createElement(){
    const canvas={};
    const noop=()=>{};
    const context={canvas,drawImage:noop,fillRect:noop,putImageData:noop,beginPath:noop,lineTo:noop,
      moveTo:noop,stroke:noop,createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)})};
    canvas.getContext=()=>context;
    return canvas;
  }};
  const window={localStorage:{getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}};
  const ctx=vm.createContext({document,window});
  for(const name of ["atlas","bestiary","activities","campaign","story","fieldwork","world","engine"]) {
    const filename=path.join(__dirname,"../games/wilderkin",name+".js");
    vm.runInContext(readFileSync(filename,"utf8"),ctx,{filename});
  }
  const game=window.WilderGame;
  return {game,world:window.WilderWorld,field:window.WilderFieldwork.create(game)};
}
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
function reachable(world,index) {
  const queue=[world.regions[index].spawn],seen=new Set([queue[0].x+","+queue[0].y]);
  for(let i=0;i<queue.length;i++) {
    const p=queue[i];
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const x=p.x+dx,y=p.y+dy,key=x+","+y;
      if(!seen.has(key)&&world.walkable(index,x,y)){seen.add(key);queue.push({x,y});}
    }
  }
  return seen;
}
test("every local kin has a distinct stable hotspot reachable from the regional trailhead",()=>{
  const {game,world,field}=load(),species=new Set(),motions=new Set(),variants=new Set();
  for(let i=0;i<game.regions.length;i++) {
    const spots=field.sightings(i),connected=reachable(world,i);
    assert.equal(spots,field.sightings(i));
    assert.equal(spots.length,game.pools[i].length);
    for(const p of spots) {
      assert.ok(!species.has(p.species));species.add(p.species);
      assert.ok(connected.has(p.x+","+p.y),i+"/"+p.species);
      assert.ok(world.regions[i].sites.every(l=>distance(l,p)>=2));
      assert.ok(spots.every(q=>p===q||distance(q,p)>=2));
      assert.equal(world.sightingAt(spots,p.x,p.y),p);
      const study=field.study(game.state,p.species);
      motions.add(study.motion);variants.add(study.variant);
    }
  }
  assert.equal(species.size,500);assert.equal(motions.size,8);assert.equal(variants.size,16);
});
test("wild observations persist through wrong approaches and award exactly once beside the animal",()=>{
  const {field,world,game}=load(),s=game.state,p=field.sightings(0)[0],id=p.species;
  assert.ok(!field.canInvite(s,id).ok);
  const arrival=s.positions[0]||world.regions[0].spawn;
  assert.ok(distance(arrival,p)>1);
  assert.ok(!field.observe(s,id,"read-sound").ok);
  s.positions[0]=p;
  const first=field.study(s,id),right=first.choices.find(c=>c.id==="try-"+first.variant).id;
  const misses=first.choices.filter(c=>c.id!==right).map(c=>c.id);
  assert.ok(!field.observe(s,id,right).ok);
  assert.ok(field.observe(s,id,"read-sound").ok);
  assert.equal(field.study(s,id).clues.filter(c=>c.text).length,1);
  assert.ok(!field.observe(s,id,"read-sound-extra").ok);
  assert.ok(field.observe(s,id,misses[0]).ok);
  assert.ok(!field.observe(s,id,right).ok);
  const record=JSON.parse(JSON.stringify(s.fieldwork));
  s.fieldwork=field.restore(record);
  assert.ok(field.study(s,id).choices.find(c=>c.id===misses[0]).tried);
  assert.ok(field.observe(s,id,"read-trace").ok);
  assert.ok(field.observe(s,id,misses[1]).ok);
  assert.ok(field.observe(s,id,"read-surroundings").ok);
  const count=()=>Object.values(s.bag).reduce((a,b)=>a+b,0),before=count();
  assert.equal(field.observe(s,id,right).kind,"field-note");assert.equal(count(),before+2);
  assert.ok(!field.observe(s,id,right).ok);assert.equal(count(),before+2);
  assert.ok(field.study(s,id).answer);assert.ok(field.canInvite(s,id).ok);
  assert.ok(field.notebook(s).some(n=>n.id===id&&n.complete));
  s.region=1;
  assert.ok(!field.canInvite(s,id).ok);assert.equal(field.study(s,id).atSite,false);
  s.region=0;s.battle={};assert.ok(!field.canInvite(s,id).ok);
  s.battle=null;s.bag.kinweave=0;assert.ok(!field.canInvite(s,id).ok);
  s.bag.kinweave=1;s.party.push({id});assert.ok(!field.canInvite(s,id).ok);
});
test("a first-time observer can solve each behavior with one clue and a single response",()=>{
  const {game,field}=load(),s=game.state;
  for(let i=0;i<game.regions.length;i++) {
    s.region=i;
    for(const p of field.sightings(i)) {
      s.positions[i]=p;
      const study=field.study(s,p.species);
      assert.equal(study.choices.length,3);
      assert.equal(study.clues.filter(c=>c.text).length,0);
      assert.ok(field.observe(s,p.species,study.clues[i%3].id).ok);
      assert.ok(field.observe(s,p.species,"try-"+study.variant).ok);
    }
  }
  const journal=field.notebook(s);
  assert.equal(journal.length,500);assert.ok(journal.every(n=>n.answer&&n.complete));
  const restored=field.restore({...s.fieldwork,badId:{complete:true}});
  assert.equal(Object.keys(restored).length,500);assert.ok(!restored.badId);
});
test("the campaign accepts two distinct field notes per region and peaceful invitations spend one Kinweave",()=>{
  const {game}=load(),s=game.state;
  const local=game.sightings();
  assert.ok(local.length>=3);
  for(let n=0;n<3;n++) {
    const target=local[n],id=target.species,entry=game.study(id);
    game.setPosition(target.x,target.y);
    assert.ok(game.observe(id,"read-trace").ok);
    assert.equal(game.observe(id,"try-"+entry.variant).kind,"field-note");
    assert.equal(s.surveys[0],Math.min(2,n+1));
    assert.ok(!game.observe(id,"try-"+entry.variant).ok);
    if(!s.party.some(kin=>kin.id===id)) {
      const weaves=s.bag.kinweave;
      assert.ok(game.inviteField(id).ok);assert.equal(s.bag.kinweave,weaves-1);
      assert.equal(s.party.find(kin=>kin.id===id).level,game.regions[0].wildLevel);
      assert.ok(!game.inviteField(id).ok);assert.equal(s.bag.kinweave,weaves-1);
    }
  }
});
