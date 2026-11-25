const {test}=require("node:test");
const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

function load(raw) {
  const records=new Map(raw?[["wilderkin.trail.v3",raw]]:[]);
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
  for(const name of ["atlas","bestiary","activities","campaign","story","duets","fieldwork","world","wild-trails","call-habitats","wild-calls","engine"]) {
    const filename=path.join(__dirname,"../games/wilderkin",name+".js");
    vm.runInContext(readFileSync(filename,"utf8"),ctx,{filename});
  }
  const game=window.WilderGame;
  return {game,world:window.WilderWorld,trails:window.WilderWildTrails.create(game,window.WilderWorld),
    field:window.WilderFieldwork.create(game),reload:()=>load(records.get("wilderkin.trail.v3"))};
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
  let total=0;
  for(let i=0;i<game.regions.length;i++) {
    const spots=field.sightings(i),connected=reachable(world,i);
    assert.equal(spots,field.sightings(i));
    assert.equal(spots.length,game.pools[i].length);
    total+=spots.length;
    for(const p of spots) {
      assert.ok(game.homes[p.species].includes(i));
      if(species.has(p.species))assert.ok(["charquill","kilnbeak"].includes(p.species));
      species.add(p.species);
      assert.ok(connected.has(p.x+","+p.y),i+"/"+p.species);
      assert.ok(world.regions[i].sites.every(l=>distance(l,p)>=2));
      assert.ok(spots.every(q=>p===q||distance(q,p)>=2));
      assert.equal(world.sightingAt(spots,p.x,p.y),p);
      const study=field.study(game.state,p.species);
      motions.add(study.motion);variants.add(study.variant);
    }
  }
  assert.equal(species.size,500);assert.equal(total,502);assert.equal(motions.size,8);assert.equal(variants.size,16);
});
test("all 150 maps have reachable two-way walking trails and a visible local wild kin away from camps and peaceful studies",()=>{
  const {game,world,trails}=load();
  const quarry=game.regions.findIndex(r=>r.name==="Fossil Steps");
  assert.ok(trails.layout(0).signs.some(s=>s.to===quarry&&s.level>game.team()[0].level+10));
  for(let i=0;i<game.regions.length;i++){
    const area=trails.layout(i),connected=reachable(world,i);
    assert.ok(area.signs.length>=1);
    assert.ok(area.roamer&&area.roamer.stops.length===2,"patrol in "+i);
    assert.ok(game.pools[i].includes(area.roamer.species));
    for(const sign of area.signs){
      assert.ok(trails.layout(sign.to).signs.some(s=>s.to===i),"return trail from "+sign.to+" to "+i);
      assert.equal(sign.level,game.wildLevel(sign.to));
    }
    for(const tile of [...area.signs,...area.roamer.stops]){
      assert.ok(connected.has(tile.x+","+tile.y),"unreachable marker in "+i);
      assert.ok([...world.regions[i].sites,...game.sightings(i),world.regions[i].spawn].every(p=>distance(p,tile)>1));
    }
    const first=trails.markers(i,0).at(-1),next=trails.markers(i,2600).at(-1);
    assert.equal(first.level,game.wildLevel(i));assert.equal(distance(first,next),1);
  }
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
      if(study.complete){
        assert.ok(["charquill","kilnbeak"].includes(p.species));assert.ok(study.canRecordHabitat);
        const before=JSON.stringify(s.bag);
        assert.equal(field.observe(s,p.species,"record-habitat").kind,"field-habitat");
        assert.equal(JSON.stringify(s.bag),before);assert.ok(!field.study(s,p.species).canRecordHabitat);
        continue;
      }
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
const migrantHomes=[["charquill",116,0],["kilnbeak",113,1]];
const ok=result=>assert.ok(result.ok,result.message);
function arriveAtBird(g,id,region){
  g.state.region=region;
  if(!g.state.visited.includes(region))g.state.visited.push(region);
  const marker=g.sightings().find(p=>p.species===id);assert.ok(marker);
  assert.ok(g.setPosition(marker.x,marker.y));
  assert.equal(g.study(id).region,region);assert.ok(g.study(id).atSite);
}
test("both roosts and native habitats have local wild levels and preview their peaceful recruits before a weave is spent",()=>{
  for(const [id,native,roost] of migrantHomes)for(const region of [roost,native]){
    const run=load(),g=run.game,world=run.world;
    assert.deepEqual(Array.from(g.homes[id]),[native,roost]);assert.equal(g.pools[roost].at(-1),id);
    const four=world.sightingTiles(roost,4);
    assert.deepEqual(Array.from(g.sightings(roost).slice(0,4),s=>[s.x,s.y]),Array.from(four,p=>[p.x,p.y]));
    g.state.region=2;assert.equal(g.study(id).region,native);
    arriveAtBird(g,id,region);
    const card=g.wildCall(id),opening=card.strike;
    ok(g.startBattle("wild",id));
    const strike=g.species.sprigkit.skills.find(s=>s.name===opening.name);
    assert.equal(g.ordinaryForecast(strike.id).damage,opening.damage);
    assert.equal(g.ordinaryForecast(strike.id).returnDamage,card.warning.damage);
    assert.equal(g.state.battle.enemy.level,g.wildLevel(region));
    const expected=region===native?8:g.wildLevel(region);
    assert.equal(card.offer.level,expected);
    if(region===native)assert.match(card.offer.preview,/young .*Lv\. 8.*adult/i);
    ok(g.answerWildCall("leaf-flurry"));
    const accepting=run.reload().game,offer=accepting.captureStatus().offer;
    assert.equal(offer.level,expected);assert.equal(accepting.state.bag.kinweave,4);
    const reply=accepting.recruit();ok(reply);
    assert.ok(reply.message.includes("Lv. "+expected+")"));assert.equal(accepting.state.bag.kinweave,3);
    assert.equal(accepting.state.party.find(k=>k.id===id).level,expected);
  }
});
test("one behavior can register two distinct sites in either order; only the first study awards loot and each station counts its own sighting",()=>{
  for(const [id,native,roost] of migrantHomes)for(const [first,other] of [[roost,native],[native,roost]]){
    const run=load(),g=run.game;
    g.state.crests=Array.from(g.wardens);g.state.party.push(g.loaner("cragroll",7));
    arriveAtBird(g,id,first);
    ok(g.observe(id,"read-trace"));ok(g.observe(id,"try-"+g.study(id).variant));
    assert.deepEqual(Array.from(g.state.fieldwork[id].habitats),[first]);
    assert.equal(g.state.surveys[first],1);assert.equal(g.state.surveys[other],undefined);
    const second=run.reload(),restored=second.game;
    assert.deepEqual(Array.from(restored.state.fieldwork[id].habitats),[first]);
    assert.match(restored.passageReport(native).requirements[0].label,first===native?/\(1\/3\)/:/\(0\/3\)/);
    arriveAtBird(restored,id,other);
    assert.ok(restored.study(id).canRecordHabitat);assert.ok(!restored.study(id).habitatRecorded);
    assert.equal(restored.notebook().length,1);
    const bag=JSON.stringify(restored.state.bag);
    assert.equal(restored.observe(id,"record-habitat").kind,"field-habitat");
    assert.equal(JSON.stringify(restored.state.bag),bag);
    assert.deepEqual(Array.from(second.reload().game.state.fieldwork[id].habitats),[first,other]);
    assert.equal(restored.state.surveys[other],1);assert.ok(restored.study(id).habitatRecorded);
    assert.equal(restored.observe(id,"record-habitat").ok,false);assert.equal(restored.state.surveys[other],1);
    const expected=other===native?8:restored.wildLevel(other);
    const offer=restored.canInvite(id).offer;assert.equal(offer.level,expected);
    if(other===native)assert.match(offer.preview,/young .*Lv\. 8.*adult/i);
    const reply=restored.inviteField(id);ok(reply);assert.ok(reply.message.includes("Lv. "+expected+")"));
    assert.equal(restored.state.party.find(k=>k.id===id).level,expected);
    arriveAtBird(restored,id,first);assert.equal(restored.inviteField(id).ok,false);
    assert.equal(restored.notebook().length,1);
  }
});
test("old completed bird notes credit their native site; restoration drops foreign, duplicate, and incomplete habitat claims",()=>{
  const {game:g,field}=load();
  for(const [id,native,roost] of migrantHomes){
    const old={clues:["trace"],tried:[],complete:true};
    assert.deepEqual(Array.from(field.restore({[id]:old})[id].habitats),[native]);
    assert.deepEqual(Array.from(field.restore({[id]:{...old,habitats:[999,native,roost,roost,String(roost)]}})[id].habitats),[native,roost]);
    assert.equal(field.restore({[id]:{...old,complete:false,habitats:[native]}})[id].habitats,undefined);
    g.state.fieldwork=field.restore({[id]:old});arriveAtBird(g,id,roost);
    assert.ok(g.study(id).canRecordHabitat);
  }
});
