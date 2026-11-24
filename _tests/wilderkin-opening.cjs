const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const scripts=["atlas","bestiary","activities","campaign","story","fieldwork","walking-partner","opening","engine"].map(name=>{
  const file=path.join(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(fs.readFileSync(file,"utf8"),{filename:file});
});
const copy=value=>JSON.parse(JSON.stringify(value));
function start(record){
  const saves=new Map(record?[["wilderkin.trail.v"+record.version,JSON.stringify(record)]]:[]);
  const writes=[];
  const storage={getItem:key=>saves.get(key)??null,setItem(key,value){saves.set(key,value);writes.push(JSON.parse(value));}};
  const window={localStorage:storage};
  const context=vm.createContext({window,performance:{now:()=>100}});
  for(const script of scripts)script.runInContext(context);
  const spawn={x:2,y:2};
  window.WilderWorld={regions:[{spawn,sites:[]}],walkable:()=>true,
    sightingTiles:(_,number)=>Array.from({length:number},(_,i)=>({x:8+i*2,y:2}))};
  return {g:window.WilderGame,component:window.WilderOpening,writes,spawn,
    save:()=>JSON.parse(saves.get("wilderkin.trail.v3"))};
}
test("each of the three illustrated choices leads to a real local sighting and saves the team once",()=>{
  for(const [id,walker] of [["sprigkit","lead"],["cindlet","hidden"],["dewfin","sprigkit"]]){
    const {g,component,writes,save,spawn}=start();
    g.setPosition(spawn.x,spawn.y);
    assert.equal(g.firstOuting.offer().value,"first-outing");
    assert.equal(start(save()).g.firstOuting.offer().value,"first-outing");
    assert.ok(g.setWalker(walker).ok);
    const squad=copy(g.state.party),formation=copy(g.state.team);
    const calls=[];
    const view=component.pages({game:g,row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),
      image:id=>id+".png",notify:m=>calls.push(["message",m]),go:name=>calls.push(["go",name]),locate:site=>calls.push(["walk",site])});
    assert.deepEqual(copy(view.model().sections[0].rows.map(r=>[r.value,r.image])),
      [["sprigkit","sprigkit.png"],["cindlet","cindlet.png"],["dewfin","dewfin.png"]]);
    const before=writes.length;
    assert.equal(view.act("unrelated"),false);assert.equal(view.act("outing-choose",id),true);
    assert.equal(writes.length,before+1);assert.equal(save().firstOuting,id);assert.equal(save().lead,id);
    const target=g.sightings().find(site=>site.species==="mossbell");
    assert.deepEqual(calls,[["walk",target.id]]);
    assert.equal(g.study("mossbell").atSite,false);assert.deepEqual(copy(g.state.positions[0]),spawn);
    for(let x=spawn.x+1;x<=target.x;x++)assert.ok(g.setPosition(x,spawn.y));
    assert.equal(g.study("mossbell").atSite,true);assert.ok(g.observe("mossbell","read-sound").ok);
    assert.ok(g.observe("mossbell","try-room").ok);assert.ok(g.study("mossbell").complete);
    assert.equal(g.state.surveys[0],1);
    const after=start(save()).g;
    assert.equal(after.firstOuting.offer(),null);assert.equal(after.state.firstOuting,id);
    assert.equal(after.state.lead,id);assert.equal(after.walkerInfo().mode,walker);
    assert.deepEqual(copy(after.state.team),formation);assert.deepEqual(copy(after.state.party),squad);
    assert.equal(after.firstOuting.choose("sprigkit").ok,false);
  }
});
test("skipping keeps the party and route intact, persists on reload and resets for a genuine new game",()=>{
  const {g,component,save}=start(),party=copy(g.state.party),calls=[];
  const view=component.pages({game:g,go:(...args)=>calls.push(args),locate:()=>assert.fail("unexpected walk"),
    notify:()=>assert.fail("unexpected failure")});
  assert.ok(view.act("outing-dismiss"));assert.deepEqual(calls,[["world",null,"root"]]);
  assert.deepEqual(copy(g.state.party),party);assert.deepEqual(copy(g.state.positions),{});
  assert.equal(g.state.lead,"sprigkit");assert.equal(g.firstOuting.offer(),null);
  assert.equal(g.firstOuting.dismiss().ok,false);assert.equal(start(save()).g.firstOuting.offer(),null);
  assert.ok(g.setLead("dewfin").ok);assert.equal(g.state.lead,"dewfin");
  assert.ok(g.reset().ok);assert.ok(g.firstOuting.offer());
});
test("existing v1, v2 and v3 saves do not receive onboarding, including unmarked new-looking saves",()=>{
  const base=copy(start().g.state);delete base.firstOuting;
  for(const version of [1,2,3]){
    const {g}=start({...base,version});assert.equal(g.firstOuting.offer(),null);
    assert.equal(g.state.firstOuting,"closed");
  }
  const veteran={...base,wins:20,firstOuting:"new"};
  assert.equal(start(veteran).g.firstOuting.offer(),null);
  for(const bad of [42,{},["dewfin"],"__proto__","mossbell"]){
    assert.equal(start({...base,firstOuting:bad}).g.firstOuting.offer(),null);
  }
});
test("a player can explore or battle first, and a pending or restored fight never accepts a partner change",()=>{
  const {g,writes,save}=start();
  for(const bad of ["mossbell",{},["cindlet"],null,"constructor"]){
    assert.equal(g.firstOuting.choose(bad).ok,false);assert.equal(g.state.firstOuting,"new");
  }
  assert.equal(writes.length,0);
  assert.ok(g.startBattle("wild","mossbell").ok);const snapshot=save();
  for(const active of [g,start(snapshot).g]){
    const before=copy(active.state);
    assert.equal(active.firstOuting.offer(),null);assert.equal(active.firstOuting.choose("dewfin").ok,false);
    assert.equal(active.firstOuting.dismiss().ok,false);assert.deepEqual(copy(active.state),before);
  }
  assert.ok(g.flee().ok);assert.equal(g.firstOuting.offer(),null);
  const h=start().g,spot=h.sightings().find(site=>site.species==="mossbell");
  h.setPosition(spot.x,spot.y);assert.ok(h.observe("mossbell","read-trace").ok);
  assert.equal(h.firstOuting.offer(),null);
});
