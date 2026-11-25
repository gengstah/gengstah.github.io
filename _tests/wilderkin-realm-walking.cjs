const {test}=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs"),path=require("node:path");
const sources=["atlas","bestiary","call-habitats","wild-calls","activities","campaign","story","duets","fieldwork","walking-partner","opening","growth","wardens","first-battle","engine","world"]
  .map(id=>new vm.Script(fs.readFileSync(path.resolve(__dirname,"../games/wilderkin",id+".js"),"utf8"),{filename:id+".js"}));
const trail="wilderkin.trail.v3",footsteps="wilderkin.realm.footsteps.v1",idA="ab".repeat(12),idB="cd".repeat(12);
const plain=p=>JSON.parse(JSON.stringify(p));
function store(){const records=new Map();let count=0;return {
  getItem:k=>records.get(k)??null,setItem(k,v){records.set(k,v);count++;},removeItem:k=>records.delete(k),writes:()=>count};}
function open(disk=store(),tab=store()){
  const noop=()=>{},document={createElement(){const canvas={};canvas.getContext=()=>({canvas,drawImage:noop,fillRect:noop,putImageData:noop,
    beginPath:noop,lineTo:noop,moveTo:noop,stroke:noop,createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)})});return canvas;}};
  const events=[],window={localStorage:disk,sessionStorage:tab,Event,dispatchEvent:e=>events.push(e.type)};
  const context=vm.createContext({window,document});for(const s of sources)s.runInContext(context);
  return {g:window.WilderGame,map:window.WilderWorld.regions[0],disk,tab,events};
}
function point(g){return plain(g.state.positions[g.state.region]);}
test("two tabs walk, visit different landmarks and reload their own footsteps without rewriting the shared career",()=>{
  const a=open();assert.ok(a.g.setPosition(11,7));const b=open(a.disk),base=a.disk.getItem(trail),writes=a.disk.writes();
  assert.ok(a.g.realmWalking("join",idA));assert.ok(b.g.realmWalking("join",idB));
  for(let x=12;x<=21;x++)assert.ok(a.g.setPosition(x,7));
  assert.ok(a.g.visitSite("wild"));assert.equal(a.g.visitSite("warden"),false);
  assert.ok(b.g.setPosition(4,6));assert.ok(b.g.visitSite("camp"));
  assert.deepEqual(point(a.g),{x:21,y:7});assert.deepEqual(point(b.g),{x:4,y:6});
  assert.equal(a.disk.writes(),writes);assert.equal(a.disk.getItem(trail),base);
  assert.ok(a.g.realmWalking("suspend"));assert.equal(a.disk.writes(),writes);
  const restored=open(a.disk,a.tab);assert.ok(restored.g.realmWalking("join",idA));
  assert.deepEqual(point(restored.g),{x:21,y:7});assert.equal(restored.g.state.landmark,"wild");
  assert.deepEqual(plain(restored.g.state.walking.last),{region:0,x:20,y:7});
  // Native battle rules see the tab's actual position and use ordinary campaign saving.
  assert.ok(restored.g.firstBattle.choose("dewfin").ok);assert.ok(restored.g.startBattle("first-battle").ok);
  const durable=JSON.parse(a.disk.getItem(trail));assert.equal(durable.battle.activeId,"dewfin");
  assert.equal(durable.landmark,"wild");assert.deepEqual(durable.positions[0],{x:21,y:7});
  const mid=open(a.disk,b.tab);mid.g.realmWalking("join",idB);assert.equal(mid.g.state.landmark,"wild");assert.deepEqual(point(mid.g),{x:21,y:7});
  assert.equal(mid.g.state.battle.enemy.id,"opalclasp");assert.equal(mid.g.setPosition(4,6),false);
});
test("first region visits are durable and revisiting unlocked regions preserves each tab's own regional trail",()=>{
  const seed=open();seed.g.setPosition(11,7);
  const ledger=JSON.parse(seed.disk.getItem(trail));ledger.crests=[0];ledger.surveys={0:99};seed.disk.setItem(trail,JSON.stringify(ledger));
  const a=open(seed.disk);assert.ok(a.g.access(1).open);a.g.realmWalking("join",idA);const before=a.disk.writes();
  assert.ok(a.g.travel(1).ok);assert.equal(a.disk.writes(),before+1);assert.ok(JSON.parse(a.disk.getItem(trail)).visited.includes(1));
  const b=open(a.disk),spawn=point(b.g);assert.ok(b.g.setPosition(spawn.x,spawn.y));assert.equal(a.disk.writes(),before+1);
  b.g.realmWalking("join",idB);const opened=a.disk.getItem(trail);
  a.g.setPosition(3,7);a.g.visitSite("camp");b.g.setPosition(15,10);b.g.visitSite("wild");
  assert.ok(a.g.travel(0).ok);a.g.setPosition(21,7);a.g.visitSite("wild");
  assert.equal(a.disk.getItem(trail),opened);assert.equal(b.g.state.region,1);
  assert.deepEqual(point(b.g),{x:15,y:10});assert.equal(b.g.state.landmark,"wild");
  a.g.realmWalking("suspend");const r=open(a.disk,a.tab);r.g.realmWalking("join",idA);
  assert.equal(r.g.state.region,0);assert.deepEqual(point(r.g),{x:21,y:7});
  assert.ok(r.g.travel(1).ok);assert.deepEqual(point(r.g),{x:3,y:7});assert.equal(a.disk.getItem(trail),opened);
});
test("a stale durable operation adopts the real career; a stale exit never overwrites another tab's supplies or encounter",()=>{
  const a=open();a.g.setPosition(11,7);const b=open(a.disk);
  a.g.realmWalking("join",idA);b.g.realmWalking("join",idB);
  a.g.setPosition(4,6);a.g.visitSite("camp");b.g.setPosition(21,7);b.g.visitSite("wild");
  assert.ok(b.g.gather().ok);
  const supplies=a.disk.getItem(trail),writes=a.disk.writes();
  const result=a.g.gather();assert.equal(result.ok,false);assert.equal(result.code,"changed");
  assert.equal(a.disk.getItem(trail),supplies);assert.equal(a.disk.writes(),writes);
  assert.deepEqual(plain(a.g.state.bag),plain(b.g.state.bag));assert.ok(a.events.includes("wilder-trail-updated"));
  a.g.setPosition(4,6);a.g.visitSite("camp");assert.ok(b.g.startBattle("wild","opalclasp").ok);
  const fought=a.disk.getItem(trail);assert.equal(a.g.realmWalking("leave"),false);assert.equal(a.disk.getItem(trail),fought);
  assert.equal(a.g.state.battle.enemy.id,"opalclasp");assert.deepEqual(point(a.g),{x:21,y:7});
});
test("a clean solo return persists the actual online tile once, then ordinary walking saves normally",()=>{
  const a=open();a.g.setPosition(11,7);const first=a.disk.writes();
  assert.ok(a.g.realmWalking("join",idA));assert.ok(a.g.realmWalking("leave"));assert.equal(a.disk.writes(),first);
  assert.ok(a.g.realmWalking("join",idA));a.g.setPosition(4,6);a.g.visitSite("camp");
  assert.equal(a.disk.writes(),first);assert.ok(a.g.realmWalking("leave"));assert.equal(a.disk.writes(),first+1);
  assert.equal(a.tab.getItem(footsteps),null);assert.deepEqual(JSON.parse(a.disk.getItem(trail)).positions[0],{x:11,y:7});
  const resumed=open(a.disk,a.tab);assert.ok(resumed.g.realmWalking("solo"));assert.deepEqual(point(resumed.g),{x:4,y:6});assert.equal(resumed.g.state.landmark,"camp");
  resumed.g.setPosition(5,6);assert.equal(resumed.disk.writes(),first+2);
});
test("a career write landing during the solo-return bookmark wins intact",()=>{
  const disk=store();let foreign,armed=false;
  const proxy={...disk,setItem(k,v){if(armed&&k==="wilderkin.trail.return-v1"){armed=false;assert.ok(foreign.g.gather().ok);}disk.setItem(k,v);}};
  const a=open(proxy);a.g.setPosition(11,7);foreign=open(disk);a.g.realmWalking("join",idA);a.g.setPosition(4,6);armed=true;
  assert.equal(a.g.realmWalking("leave"),false);const durable=JSON.parse(disk.getItem(trail));
  assert.deepEqual(durable.bag,plain(foreign.g.state.bag));assert.equal(durable.forageReady,false);assert.deepEqual(durable.positions[0],{x:11,y:7});
  const cold=open(disk);assert.equal(cold.g.realmWalking("solo"),false);assert.deepEqual(point(cold.g),{x:11,y:7});
});
test("a different courier, changed career, invalid tile, unavailable session storage or forged landmark cannot restore an unsafe local visit",()=>{
  const a=open();a.g.setPosition(11,7);a.g.realmWalking("join",idA);a.g.setPosition(4,6);a.g.visitSite("camp");a.g.realmWalking("suspend");
  const raw=a.tab.getItem(footsteps),copyNote=change=>{const t=store();t.setItem(footsteps,JSON.stringify({...JSON.parse(raw),...change}));return t;};
  for(const [id,patch] of [[idB,{}],[idA,{x:800}],[idA,{region:999}]]){
    const n=open(a.disk,copyNote(patch));n.g.realmWalking("join",id);assert.deepEqual(point(n.g),{x:11,y:7});assert.equal(n.g.state.landmark,null);
  }
  const forged=open(a.disk,copyNote({landmark:"wild"}));forged.g.realmWalking("join",idA);assert.deepEqual(point(forged.g),{x:4,y:6});assert.equal(forged.g.state.landmark,null);
  const changed=open(a.disk);changed.g.gather();
  const newer=open(a.disk,a.tab);newer.g.realmWalking("join",idA);assert.deepEqual(point(newer.g),{x:11,y:7});assert.deepEqual(plain(newer.g.state.bag),plain(changed.g.state.bag));
  const blocked={getItem(){throw Error("unavailable")},setItem(){throw Error("unavailable")},removeItem(){throw Error("unavailable")}};
  const ephemeral=open(a.disk,blocked);assert.ok(ephemeral.g.realmWalking("join",idA));ephemeral.g.setPosition(4,6);assert.ok(ephemeral.g.realmWalking("suspend"));
  assert.ok(ephemeral.g.realmWalking("join",idA));assert.deepEqual(point(ephemeral.g),{x:4,y:6});assert.ok(ephemeral.g.realmWalking("leave"));
});
