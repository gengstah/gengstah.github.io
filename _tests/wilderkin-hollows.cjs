const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const ctx=vm.createContext({window:{}});
for(const name of ["atlas","hollows"])vm.runInContext(fs.readFileSync(path.join(__dirname,"../games/wilderkin/"+name+".js"),"utf8"),ctx);
const w=ctx.window,regions=w.WilderAtlas.regions;
const abilities=Object.keys(w.WilderAtlas.abilities);
const species=Object.fromEntries(abilities.map(a=>[a,{name:"Test "+a,ability:a}]));
const items=Object.fromEntries(["kinweave","balm","tonic","sparkseed","ore","sap"].map(id=>[id,{name:id}]));
const copy=obj=>JSON.parse(JSON.stringify(obj));
function setup(saved){
  const state=saved?copy(saved):{region:0,landmark:"travel",licenses:abilities.slice(),party:abilities.map(id=>({id})),hollows:{},bag:{}};
  state.hollows=w.WilderHollows.restore(state.hollows);
  const api=w.WilderHollows.create({state:()=>state,regions,species,items,commit:(kind,message)=>({ok:true,kind,message})});
  return {state,api};
}
const steps={
  "first-post":"E E S S S N E E N N E E",
  "rill-mail":"E K S S W E E K S E E N N E E N",
  "sail-shelf":"E K E K S K W W W E E K E K N K E",
  "twin-pins":"S K E K E W W S K E K E S E E E E",
  "cradle-choir":"S S E E K E E N N E E E K S S W S S E",
  "inward-lens":"N E E E E K S S S K E E E N N",
  "resting-islands":"E K E E E E K S S S K W W W W W E E E E K E E E E E N N"
};
const commands={N:"north",S:"south",E:"east",W:"west",K:"skill"};
function play(api,id,seq){
  for(const k of seq.trim().split(/\s+/)){
    const res=api.input(id,commands[k]||k);
    assert.ok(res.ok,id+" "+k+" "+res.message);
  }
}

test("the walking post is available in Mossbrook and each licensed route has its own local entrance",()=>{
  const {api,state}=setup(),all=api.list();
  assert.equal(all.length,7);assert.deepEqual(new Set(all.map(e=>e.ability)),new Set([null,...abilities]));
  assert.equal(api.at(0).id,"first-post");
  for(const e of all){
    assert.deepEqual(api.at(e.region),api.list().find(x=>x.id===e.id));
    if(!e.ability)continue;
    assert.equal(regions[e.region].routeAbility,e.ability);
    state.region=e.region;
    state.landmark=null;
    assert.ok(!api.input(e.id,"east").ok);state.landmark="travel";
    state.licenses=abilities.filter(a=>a!==e.ability);assert.ok(!api.input(e.id,"east").ok);
    state.licenses=abilities.slice();state.party=state.party.filter(p=>p.id!==e.ability);assert.ok(!api.input(e.id,"east").ok);
    state.party.push({id:e.ability});assert.ok(api.at(e.region).open);
    state.battle={turn:1};assert.ok(!api.input(e.id,"east").ok);state.battle=null;
    state.region=0;assert.ok(!api.input(e.id,"east").ok);
  }
  assert.equal(api.board("toString"),null);assert.ok(!api.input("unknown","restart").ok);
});

for(const [id,sequence] of Object.entries(steps))test(id+" can be solved, left, resumed, undone and replayed without duplicate rewards",()=>{
  let {api,state}=setup();let entry=api.list().find(e=>e.id===id);state.region=entry.region;
  const initial=copy(api.board(id).now),path=sequence.split(" "),mid=Math.floor(path.length/2);
  assert.ok(api.board(id).room.layout.every(line=>line.length===api.board(id).room.w));
  play(api,id,path.slice(0,mid).join(" "));
  const checkpoint=copy(api.board(id).now);
  state.region=100;assert.ok(!api.board(id).entry.open);
  ({api,state}=setup(state));
  state.region=entry.region;
  assert.deepEqual(copy(api.board(id).now),checkpoint);
  play(api,id,path.slice(mid).join(" "));
  const finished=api.board(id);assert.equal(finished.now.p,finished.room.exit);assert.ok(finished.entry.complete);
  assert.deepEqual(state.bag,copy(finished.room.reward));
  assert.ok(api.input(id,"undo").ok);assert.notEqual(api.board(id).now.p,finished.room.exit);
  ({api,state}=setup(state));play(api,id,path.at(-1));assert.deepEqual(state.bag,copy(finished.room.reward));
  assert.ok(api.input(id,"restart").ok);assert.deepEqual(copy(api.board(id).now),initial);
  play(api,id,sequence);assert.deepEqual(state.bag,copy(finished.room.reward));
});

test("spatial verbs change position or terrain according to the selected licensed kin",()=>{
  const {api,state}=setup();
  function start(id){state.region=api.list().find(r=>r.id===id).region;return ()=>api.board(id).now;}
  let now=start("sail-shelf");play(api,"sail-shelf","E");const ledge=now().p;
  assert.ok(!api.input("sail-shelf","east").ok);play(api,"sail-shelf","K E");
  assert.equal(now().p-ledge,4);assert.ok(!now().ready);
  now=start("rill-mail");play(api,"rill-mail","E");assert.ok(!api.input("rill-mail","east").ok);
  play(api,"rill-mail","K E");const water=now().p;play(api,"rill-mail","E");assert.equal(now().p-water,2);
  now=start("twin-pins");play(api,"twin-pins","S");const stones=copy(now().rocks);
  assert.ok(!api.input("twin-pins","east").ok);play(api,"twin-pins","K E");
  assert.equal(now().rocks[0],stones[0]+1);
  now=start("cradle-choir");play(api,"cradle-choir","S S E E K");assert.equal(now().mask,1);
  play(api,"cradle-choir","K");assert.equal(now().mask,0);
  now=start("inward-lens");play(api,"inward-lens","N E E E E K");assert.equal(now().mask,1);
  play(api,"inward-lens","S S S K");assert.equal(now().mask,3);
  now=start("resting-islands");play(api,"resting-islands","E K E");const ice=copy(now().ice);assert.equal(ice.length,2);
  play(api,"resting-islands","E E E K S");assert.equal(now().ice.length,1);assert.ok(!now().ice.includes(ice[0]));
});

test("a requested hint follows the current position and all boards finish through the canvas action contract",()=>{
  const {api,state}=setup(),messages=[],walks=[];
  const planner=w.WilderHollows.pages({game:{hollows:api,state,regions,species,items},row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),
    go(){},render(){},notify:m=>messages.push(m),locate:(...args)=>walks.push(args)});
  for(const e of api.list()){
    state.region=e.region;state.landmark="camp";
    assert.ok(planner.model("hollow",e.id).sections.some(s=>s.rows?.some(r=>r.id==="hollow-walk")));
    planner.act("hollow-walk",e.id);assert.deepEqual(walks.at(-1),["travel","hollow"]);state.landmark="travel";
    let count=0;
    while(!api.at(e.region).complete&&count++<60){
      planner.act("hollow-hint",e.id);
      const message=messages.at(-1),next=message.startsWith("Go ")?message.split(" ")[1]:message.endsWith(" here.")?"skill":null;
      assert.ok(next,e.id+" "+message);
      const view=planner.model("hollow",null),diagram=view.sections.find(s=>s.draw);
      assert.ok(diagram.hotspots(10,20,350,223).some(s=>s.value===e.id+"|"+next),e.id+" selectable "+next);
      if(next==="skill")assert.ok(planner.key({key:"e"},null));
      else planner.act("hollow-input",e.id+"|"+next);
    }
    assert.ok(api.at(e.region).complete);
  }
});

test("corrupt room snapshots recover without reopening an already claimed parcel",()=>{
  const {api,state}=setup();play(api,"first-post",steps["first-post"]);
  const prize=copy(state.bag);
  state.hollows["first-post"].now.p=6e6;
  state.hollows["first-post"].undo=[null,{},undefined];state.hollows.other=true;
  const reload=setup(state);
  assert.equal(reload.api.board("first-post").entry.complete,true);
  assert.equal(reload.api.board("first-post").canUndo,false);
  play(reload.api,"first-post",steps["first-post"]);
  assert.deepEqual(reload.state.bag,prize);assert.ok(!("other" in reload.state.hollows));
});
