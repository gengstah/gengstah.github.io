const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const source=id=>fs.readFileSync(path.join(__dirname,"../games/wilderkin",id+".js"),"utf8");
const plain=p=>JSON.parse(JSON.stringify(p));
function store(){const rows=new Map();return {getItem:k=>rows.get(k)||null,setItem:(k,v)=>rows.set(k,v)};}
function map(){
  const regions=["Morning Vale","Evening Hill"].map(name=>({name,cols:17,rows:12,spawn:{x:6,y:5},sites:[{id:"camp",x:3,y:5},{id:"wild",x:14,y:8}]}));
  return {regions,walkable:(r,x,y)=>!!regions[r]&&x>=0&&x<17&&y>=0&&y<12&&!(x===4&&y===9)};
}
function api(world=map(),sightings=()=>[]){
  const window={WilderGame:{species:{sprigkit:{},dewfin:{},cindlet:{}}}};vm.runInNewContext(source("realm-world"),{window});
  let time=3001000;const citizens=new Map(),wires=[];
  function device(id,room="commons",storage=store(),session=store()){
    let paints=0;
    const field=window.WilderRealmWorld.create({world,sightings,now:()=>time,storage,session,onChange:()=>paints++,
      send:(peer,msg)=>wires.push([id,peer,plain(msg)]),broadcast:msg=>{for(const [to,p] of citizens)if(to!==id&&p.room===room)wires.push([id,to,plain(msg)]);}});
    field.join(id,room);citizens.set(id,{field,room});
    function publish(x=6,y=5,opts={}){return field.publish({region:0,x,y,lead:"sprigkit",facing:"right",...opts},true);}
    return {field,publish,id,storage,session,paints:()=>paints};
  }
  function deliver(items=wires.splice(0)){for(const [id,to,data] of items)citizens.get(to)?.field.receive(id,data);}
  return {device,deliver,wires,world,api:window.WilderRealmWorld,advance:ms=>time+=ms};
}
test("only actual couriers paint, shared tiles fan out, motion interpolates and gestures expire",()=>{
  const n=api(),a=n.device("courier-a"),b=n.device("courier-b");a.publish();assert.equal(a.field.pose(0,false).people.length,0);b.publish();n.deliver();
  const who=a.field.people()[0];assert.equal(who.id,b.id);assert.equal(who.name,b.field.self().name);assert.equal(who.duels,"quiet");
  let pose=a.field.pose(0,true);assert.notEqual(pose.people[0].drawX,6);
  assert.equal(a.field.hit(0,Math.round(pose.people[0].drawX),Math.round(pose.people[0].drawY)).id,b.id);
  assert.equal(a.field.hit(0,pose.lanterns[2].x,pose.lanterns[2].y).kind,"lantern");
  n.advance(250);b.publish(7,5,{duels:"queue",lead:"cindlet"});n.deliver();
  assert.equal(a.field.people()[0].duels,"queue");assert.equal(a.field.people()[0].lead,"cindlet");
  n.advance(115);pose=a.field.pose(0,false);assert.ok(pose.people[0].drawX>6&&pose.people[0].drawX<7);assert.equal(a.field.pose(0,true).people[0].drawX,7);
  assert.ok(b.field.wave("thanks").ok);n.deliver();assert.equal(a.field.people()[0].emote,"Thank you");assert.equal(b.field.wave("rally").ok,false);
  const seen=[];const c={canvas:{width:272},fillRect:(...g)=>seen.push(g),measureText:t=>({width:t.length*4}),save(){},restore(){},fillText:t=>seen.push(t)};
  const layers=n.api.layers(a.field.pose(0,true));assert.equal(layers.length,4);layers.forEach(l=>l.paint(c));assert.ok(seen.includes("Thank you"));assert.ok(seen.length>100);
  n.advance(4000);a.field.tick();assert.equal(a.field.people()[0].emote,null);
  b.publish(7,5,{region:1,activity:"duel"});n.deliver();assert.equal(a.field.people()[0].region,1);assert.equal(a.field.people()[0].distance,null);
  assert.equal(a.field.pose(0,true).people.length,0);n.advance(31000);a.field.tick();assert.equal(a.field.people().length,0);
});
test("a selected courier cloak survives changing accounts or rooms and is rendered on both clients",()=>{
  const n=api(),a=n.device("first-device-id"),b=n.device("spectator");a.publish();b.publish();n.deliver();
  const wardrobe=a.field.looks(),initial=a.field.self(),next=wardrobe[2];assert.equal(wardrobe.length,6);
  assert.ok(wardrobe.every(p=>/^[0-9a-f]{8}$/.test(p.id)));assert.equal(new Set(wardrobe.map(p=>p.color)).size,6);
  assert.equal(wardrobe.find(p=>p.current).id,initial.look);assert.equal(a.field.wear("arbitrary name").ok,false);
  assert.ok(a.field.wear(next.id).ok);n.deliver();const seen=b.field.people()[0],me=a.field.self();
  assert.equal(seen.name,next.name);assert.equal(seen.color,next.color);assert.equal(seen.look,next.id);assert.equal(seen.id,a.id);
  const c={canvas:{width:272},fillRect(){}};assert.ok(n.api.paintSelf(c,a.field.pose(0,true),108,90,"down"));assert.equal(n.api.paintSelf(c,null,0,0,"down"),false);
  const returning=n.device("new-transport-id","new-realm",a.storage);returning.publish();
  assert.equal(returning.field.self().name,me.name);assert.equal(returning.field.self().id,"new-transport-id");
  assert.equal(returning.field.looks().find(p=>p.current).id,next.id);
  const q=n.device("stranger");q.field.receive("legacy",{t:"presence",seq:1,region:0,x:6,y:5,look:"arbitrary"});
  assert.equal(q.field.people()[0].name,n.api.identity("legacy").name);
  const blocked={getItem(){throw Error("disabled")},setItem(){throw Error("disabled")}};
  const u=n.device("ephemeral","commons",blocked);const option=u.field.looks()[3];assert.ok(u.field.wear(option.id).ok);
  u.field.leave();u.field.join("tab-rejoin");assert.equal(u.field.self().name,option.name);
});
test("couriers filter malformed, stale and excessive remote data and immediately remove departing records",()=>{
  const n=api(),a=n.device("local");a.publish();
  const m={t:"presence",seq:2,region:0,x:7,y:6,facing:"left",lead:"is-not-a-kin",name:"custom",gesture:{},activity:"bad",duels:"bad"};
  for(const diff of [{x:7.4},{x:90},{region:"0"},{region:-1},{x:4,y:9},{seq:-1},{t:"other"}])assert.equal(a.field.receive("bad",{...m,...diff}),false);
  assert.equal(a.field.receive("local",m),false);assert.equal(a.field.receive("bad id",m),false);assert.ok(a.field.receive("good",m));
  const p=a.field.people()[0];assert.equal(p.duels,"quiet");assert.equal(p.lead,null);assert.notEqual(p.name,m.name);assert.equal(p.activity,"trail");assert.equal(p.emote,null);
  assert.equal(a.field.receive("good",{...m,seq:1,x:8}),false);assert.ok(a.field.depart("good"));
  for(let i=0;i<156;i++)a.field.receive("courier-"+i,m);
  assert.equal(a.field.people().length,128);assert.equal(a.field.pose(0,true).people.length,24);
  a.field.leave();assert.equal(a.field.self(),null);assert.equal(a.field.event(),null);assert.equal(a.field.pose(0,false),null);
});
test("crowded realms prioritize arriving local travelers and show all remaining local tiles as count markers",()=>{
  const n=api(),a=n.device("local"),f=a.field;a.publish();
  const m={t:"presence",seq:1,region:1,x:9,y:9};const id=i=>"peer-"+String(i).padStart(3,"0");
  for(let i=159;i>=0;i--)f.receive(id(i),m);
  assert.equal(f.people().length,128);assert.deepEqual(f.people().map(p=>p.id).sort().join(","),Array.from({length:128},(_,i)=>id(i)).join(","));
  assert.ok(f.receive("z-at-spawn",{...m,region:0,x:6,y:5}));
  assert.equal(f.people()[0].id,"z-at-spawn");assert.equal(f.people().length,128);
  for(let i=0;i<40;i++)f.receive(id(i),{...m,seq:2,region:0,x:i>29?15:7});
  const pose=f.pose(0,true);assert.equal(pose.people.length,24);
  assert.equal(pose.crowds.reduce((n,g)=>n+g.count,0),17);assert.ok(pose.crowds.some(g=>g.x===15&&g.count===10));
  assert.equal(f.hit(0,15,9).kind,"courier");
  n.advance(31000);assert.ok(f.receive("last-arrival",{...m,x:3}));assert.equal(f.people().length,1);
});
test("interleaved lights converge, all contributors earn credit, and late couriers can still tend a finished relay",()=>{
  const n=api(),a=n.device("a"),b=n.device("b");a.publish();b.publish();n.deliver();
  const [hearth,trail,clearing]=a.field.event().lanterns;assert.ok(hearth.near);assert.ok(a.field.light(hearth.id).ok);
  b.publish(trail.x,trail.y);assert.ok(b.field.light(trail.id).ok);
  const race=n.wires.splice(0);n.deliver(race.slice().reverse());n.deliver(race); // old positions and repeated snapshots
  assert.equal(a.field.event().lit,2);assert.equal(b.field.event().lit,2);assert.equal(a.field.event().earned,false);
  a.publish(clearing.x,clearing.y);assert.ok(a.field.light(clearing.id).ok);n.deliver();
  for(const p of [a,b]){assert.equal(p.field.event().complete,true);assert.equal(p.field.event().earned,true);assert.equal(p.field.event().badges,1);}
  assert.equal(a.field.light(clearing.id).ok,false);
  const c=n.device("late");c.publish();a.field.peer(c.id);b.field.peer(c.id);n.deliver();
  assert.equal(c.field.event().complete,true);assert.equal(c.field.event().earned,false);assert.equal(c.field.event().mine,0);
  assert.ok(c.field.light(hearth.id).ok);assert.equal(c.field.event().badges,1);assert.equal(c.field.event().earned,true);
  c.field.leave();const reload=n.device("late-reload","commons",c.storage,c.session);reload.publish();
  assert.equal(reload.field.event().earned,true);assert.equal(reload.field.event().badges,1);assert.equal(reload.field.light(hearth.id).ok,false);
  const isolated=n.device("independent","another-room",c.storage,c.session);isolated.publish();
  assert.equal(isolated.field.event().lit,0);assert.equal(isolated.field.event().mine,0);assert.equal(isolated.field.event().badges,1);
  n.advance(600001);reload.field.tick();assert.equal(reload.field.event().lit,0);assert.equal(reload.field.event().badges,1);
  const previous={t:"lanterns",region:0,epoch:5,mask:7};assert.equal(reload.field.receive("a",previous),false);
});
test("one courier can light the route on foot, a battle or remote tap cannot; empty or unavailable storage stays usable",()=>{
  const n=api(),closed={getItem(){throw Error("blocked")},setItem(){throw Error("blocked")}};
  const a=n.device("solo","a",closed,closed);a.publish();const e=a.field.event();
  assert.equal(e.total,3);assert.ok(e.remainingMs>0&&e.remainingMs<=600000);assert.ok(Number.isFinite(e.endsAt));
  assert.equal(a.field.light(e.lanterns[2].id).ok,false);
  for(const l of e.lanterns){
    a.publish(l.x,l.y,{activity:"battle"});assert.equal(a.field.light(l.id).ok,false);
    a.publish(l.x,l.y);assert.ok(a.field.light(l.id).ok);
  }
  assert.equal(a.field.event().badges,1);assert.equal(a.field.event().mine,3);assert.equal(a.field.self().badge,true);
});
test("all 150 native maps put three distinct public waylights on the trailhead's reachable component",()=>{
  const noop=()=>{},document={createElement(){const canvas={};canvas.getContext=()=>({canvas,drawImage:noop,fillRect:noop,putImageData:noop,
    beginPath:noop,lineTo:noop,moveTo:noop,stroke:noop,createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)})});return canvas;}};
  const window={},ctx=vm.createContext({window,document});
  for(const f of ["atlas","bestiary","activities","campaign","story","duets","fieldwork","world","engine"])vm.runInContext(source(f),ctx);
  const world=window.WilderWorld;assert.equal(world.regions.length,150);const n=api(world,window.WilderGame.sightings),a=n.device("scout");
  for(const [region,r] of world.regions.entries()){
    a.publish(r.spawn.x,r.spawn.y,{region});const e=a.field.event();
    const q=[r.spawn],seen=new Set([r.spawn.x+","+r.spawn.y]);
    for(let i=0;i<q.length;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const x=q[i].x+dx,y=q[i].y+dy,k=x+","+y;if(!seen.has(k)&&world.walkable(region,x,y)){seen.add(k);q.push({x,y});}
    }
    assert.equal(e.region,region);const keys=e.lanterns.map(l=>l.x+","+l.y);
    assert.ok(e.lanterns.every(l=>!world.siteAt(region,l.x,l.y)));
    assert.ok(e.lanterns.every(l=>!world.sightingAt(window.WilderGame.sightings(region),l.x,l.y)));
    assert.equal(new Set(keys).size,3);assert.ok(keys.every(k=>seen.has(k)));assert.ok(e.lanterns.every(l=>!r.sites.some(s=>s.x===l.x&&s.y===l.y)));
  }
});
