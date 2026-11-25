const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto").webcrypto;
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.join(__dirname,"../games/wilderkin"),html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const skip=new Set(["canvas-shell.js","realm-transport.js","score.js","kin-art.js"]);
const scripts=Array.from(html.matchAll(/<script src="([^"?]+)(?:\?[^"]*)?"/g),m=>m[1]).filter(p=>!skip.has(p)).map(p=>{
  const filename=path.join(root,p);return new vm.Script(fs.readFileSync(filename,"utf8"),{filename});
});
function storage(){
  const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
}
function lobby(){
  let next=0;const seats=new Map(),messages=[];
  function connect(options){
    const id=options.id||String(++next).padStart(24,"0");
    const others=()=>Array.from(seats).filter(([key,p])=>key!==id&&p.room===options.room);
    const send=(to,v)=>{const other=seats.get(to);if(!other||other.room!==options.room)return false;
      messages.push(()=>{if(seats.get(to)===other)other.onMessage(id,JSON.parse(JSON.stringify(v)));});return true;};
    seats.set(id,options);
    messages.push(()=>{options.onStatus("online");for(const [key,peer] of others()){peer.onPeer(id);options.onPeer(key);}});
    return {id,send,broadcast(v){others().forEach(([key])=>send(key,v));return true;},
      close(){if(seats.get(id)!==options)return;seats.delete(id);for(const [,p] of others())p.onLeave(id);}};
  }
  const flush=()=>{for(let count=0;messages.length;count++){assert.ok(count<1000);messages.shift()();}};
  return {connect,flush};
}
function boot(net,hash="",disk=storage(),session=storage(),nav="navigate"){
  let model,input;const listeners={},frames=[],timeouts=[],intervals=new Set();
  const w={localStorage:disk,sessionStorage:session,crypto,location:{href:"https://example.test/games/wilderkin/"+hash,hash,pathname:"/games/wilderkin/",search:""},
    history:{replaceState(a,b,v){w.location.hash=v.includes("#")?v.slice(v.indexOf("#")):"";}},
    performance:{getEntriesByType:()=>[{type:nav}]},WilderRealmTransport:net,
    addEventListener:(id,f)=>{(listeners[id]??=[]).push(f);},setTimeout:f=>{timeouts.push(f);},
    setInterval:f=>{intervals.add(f);return f;},clearInterval:f=>intervals.delete(f),
    WilderKinArt:{sprite:id=>"art/"+id},WilderScore:{create:()=>({scene(){},answer(){}})},
    WilderCanvas:{create:(_,handlers)=>{input=handlers;return {show:m=>model=m,animate:()=>Promise.resolve(),toast(){},invalidate(){}};}}};
  function canvas(){const n={toDataURL:()=>""},noop=()=>{};n.getContext=()=>({canvas:n,drawImage:noop,fillRect:noop,putImageData:noop,beginPath:noop,lineTo:noop,moveTo:noop,
    stroke:noop,createImageData:(x,y)=>({data:new Uint8ClampedArray(x*y*4)})});return n;}
  const ctx=vm.createContext({window:w,document:{getElementById:canvas,createElement:canvas,hidden:false},performance:{now:()=>Date.now()},
    matchMedia:()=>({matches:true}),requestAnimationFrame:f=>frames.push(f),TextEncoder,TextDecoder,URL,crypto});
  scripts.forEach(s=>s.runInContext(ctx));
  const rows=()=>[model.realm,...(model.objective?.routes||[]),...model.sections.flatMap(s=>s.rows||[])].filter(Boolean);
  return {model:()=>model,rows,key:k=>input.key({key:k}),tile:(x,y)=>input.tile(x,y),game:w.WilderGame,session,disk,
    pulse:()=>{for(const f of intervals)f();},paint:()=>{while(timeouts.length)timeouts.shift()();},
    click:(id,v)=>{const r=rows().find(r=>r.id===id&&(v===undefined||v===r.value)&&!r.disabled);assert.ok(r,id+" / "+v+" on "+model.title);input.action(r.id,r.value);},
    dispatch:(type,obj={})=>listeners[type]?.forEach(f=>f(obj))};
}
async function settle(net,...clients){
  for(let i=0;i<5;i++){
    net.flush();clients.forEach(c=>c.paint());await new Promise(r=>setTimeout(r,3));
  }
}
test("from the regular map, two travelers meet, cooperate, consent to a queued duel and return to their own campaigns",async()=>{
  const net=lobby(),a=boot(net),b=boot(net,"#online");
  assert.equal(a.model().kind,"world");a.click("nav","online");
  a.click("realm-join");b.click("realm-join");await settle(net,a,b);
  const other=a.rows().find(r=>r.id==="realm-person");assert.ok(other);assert.match(other.detail,/Exploring/);
  a.click("realm-person",other.value);assert.ok(a.rows().some(r=>r.id==="realm-challenge"&&r.disabled));
  a.click("realm-home");a.click("realm-map");b.click("realm-map");
  assert.equal(a.model().objective.belowMap,true);assert.ok(a.rows().some(r=>r.id==="realm-event"));
  assert.equal(a.model().player().realm.people.length,1);assert.equal(b.model().player().realm.people.length,1);
  const p=a.model().player().realm.people[0];a.tile(Math.round(p.drawX),Math.round(p.drawY));assert.equal(a.model().title,p.name);
  a.click("realm-home");b.click("nav","online");
  a.click("realm-emote","wave");await settle(net,a,b);assert.match(b.rows().find(r=>r.id==="realm-person").detail,/Waving/);
  a.click("realm-event");assert.equal(a.rows().filter(r=>r.id==="realm-lantern").length,3);a.click("realm-home");
  a.click("realm-queue");b.click("realm-queue");await settle(net,a,b);a.pulse();b.pulse();await settle(net,a,b);
  const guest=a.rows().some(r=>r.id==="realm-accept")?a:b,host=guest===a?b:a;
  assert.ok(host.rows().some(r=>r.id==="realm-cancel"));guest.click("realm-accept");await settle(net,a,b);
  assert.equal(a.model().kind,"battle");assert.equal(b.model().kind,"battle");
  assert.equal(a.game.state.battle,null);assert.equal(b.game.state.battle,null);
  const turn=a.rows().some(r=>r.id==="realm-duel-move"&&!r.disabled)?a:b;
  turn.click("realm-duel-move");await settle(net,a,b);const foe=turn===a?b:a;
  assert.ok(foe.rows().some(r=>r.id==="realm-duel-move"&&!r.disabled));
  foe.click("realm-duel-confirm");foe.click("realm-duel-concede");await settle(net,a,b);
  assert.ok(turn.rows().some(r=>r.id==="realm-duel-dismiss"));turn.click("realm-duel-dismiss");turn.click("realm-leave");
  assert.equal(turn.model().kind,"world");assert.equal(turn.model().player().realm,undefined);
  assert.ok([a,b].every(c=>!c.game.state.wins&&c.game.state.team.length===3));
});
test("private realm links and an intentional exit isolate presence from the automatic public gathering",async()=>{
  const n=lobby(),a=boot(n,"#online"),b=boot(n,"#online/friends-abcdef012390");
  a.click("realm-join");b.click("realm-join");await settle(n,a,b);
  assert.ok([a,b].every(c=>!c.rows().some(r=>r.id==="realm-person")));
  a.click("realm-leave");const old=b.session.getItem("wilderkin.realm.session.v1");b.dispatch("pagehide");
  const restored=boot(n,"#online/friends-abcdef012390",b.disk,b.session,"reload");
  await settle(n,restored);assert.ok(restored.rows().some(r=>r.id==="realm-map"));assert.equal(b.session.getItem("wilderkin.realm.session.v1"),old);
  restored.click("realm-leave");assert.equal(b.session.getItem("wilderkin.realm.session.v1"),null);
});
test("couriers on different public worlds can use the world selector to meet without a private link",async()=>{
  const n=lobby(),a=boot(n,"#online"),b=boot(n,"#online/commons-2");
  a.click("realm-join");b.click("realm-join");await settle(n,a,b);
  assert.ok(!a.rows().some(r=>r.id==="realm-person"));
  a.click("realm-worlds");a.click("realm-world","commons-2");a.click("realm-join");await settle(n,a,b);
  for(const c of [a,b])assert.equal(c.rows().filter(r=>r.id==="realm-person").length,1);
  assert.equal(a.model().title,"Lantern Commons 2");
});
