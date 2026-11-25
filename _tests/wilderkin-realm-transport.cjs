const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {webcrypto}=require("node:crypto");
const dir=path.resolve(__dirname,"../games/wilderkin");
const code=new vm.Script(fs.readFileSync(path.join(dir,"realm-transport.js"),"utf8"));
function village(){
  let time=500000,seq=0;
  const channels=new Map(),timers=new Map(),messages=[];
  const schedule=(fn,delay,every=0)=>{const id=++seq;timers.set(id,{fn,at:time+delay,every});return id;};
  class Channel{
    constructor(name){this.name=name;this.members=channels.get(name)||new Set();channels.set(name,this.members);this.members.add(this);}
    postMessage(f){for(const c of this.members)if(c!==this)messages.push(()=>c.onmessage?.({data:structuredClone(f)}));}
    close(){this.members.delete(this);this.onmessage=null;}
  }
  function tick(delta=0){
    const stop=time+delta;
    for(let n=0;n<2000;n++){
      if(messages.length){messages.shift()();continue;}
      const next=Array.from(timers).sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>stop)break;
      const [id,t]=next;time=t.at;if(t.every)t.at+=t.every;else timers.delete(id);t.fn();
    }
    time=stop;
  }
  function start(room,id){
    const timeline=[],present=[],gone=[],data=[];
    const window={BroadcastChannel:Channel,crypto:webcrypto,setInterval:(f,d)=>schedule(f,d,d),setTimeout:(f,d)=>schedule(f,d),
      clearInterval:i=>timers.delete(i),clearTimeout:i=>timers.delete(i)};
    const ctx=vm.createContext({window,Date:{now:()=>time},Uint8Array});code.runInContext(ctx);
    const link=window.WilderRealmTransport.connect({room,id,onStatus:s=>timeline.push(s),onPeer:p=>present.push(p),
      onLeave:p=>gone.push(p),onMessage:(p,b)=>data.push([p,b])});
    return {link,timeline,present,gone,data};
  }
  return {start,tick,channels};
}
test("two tabs see only real peers in their room and a private invitation reaches one courier",()=>{
  const v=village(),a=v.start("valley"),b=v.start("valley"),c=v.start("valley"),other=v.start("private");
  assert.deepEqual(a.present,[]);v.tick();
  assert.deepEqual([...a.present].sort(),[b.link.id,c.link.id].sort());assert.deepEqual(other.present,[]);
  assert.deepEqual(a.timeline,["connecting","local"]);assert.ok(a.link.send(b.link.id,{kind:"duel"}));
  b.link.broadcast({t:"presence",x:6});v.tick();
  assert.deepEqual(b.data,[[a.link.id,{kind:"duel"}]]);assert.deepEqual(c.data,[[b.link.id,{t:"presence",x:6}]]);assert.deepEqual(other.data,[]);
  assert.equal(a.link.send(other.link.id,{kind:"duel"}),false);assert.equal(a.link.broadcast({x:"x".repeat(25000)}),false);
  a.link.close();v.tick();assert.deepEqual(b.gone,[a.link.id]);assert.deepEqual(c.gone,[a.link.id]);assert.deepEqual(a.timeline.at(-1),"closed");
});
test("late arrivals, resume with same captain id, expired neighbors and duplicate local packets",()=>{
  const v=village(),a=v.start("trail"),b=v.start("trail");v.tick();
  const channel=Array.from(v.channels.get("wilderkin.realm.v1.trail"))[0];
  const ghost="ffeeddccbbaa998877665544",frame={v:1,id:ghost,e:"0011223344556677",to:"",n:1,op:"hi",body:null};
  for(const f of [frame,frame,{...frame,n:2,op:"data",body:{x:1}},{...frame,n:2,op:"data",body:{x:1}}])channel.onmessage({data:f});
  assert.equal(a.present.filter(x=>x===ghost).length,1);assert.equal(a.data.length,1);
  v.tick(72001);assert.ok(a.gone.includes(ghost));
  b.link.close();v.tick();const resumed=v.start("trail",b.link.id);v.tick();assert.equal(resumed.link.id,b.link.id);assert.deepEqual(resumed.present,[a.link.id]);
  assert.equal(a.present.filter(x=>x===b.link.id).length,2);
});

test("the signed relay exchanges room events and private packets, rejects replay and edits, and coalesces moving couriers",async t=>{
  const {createRelay}=await import("../games/wilderkin/realm-relay.mjs");
  const original=globalThis.WebSocket,sockets=[],outgoing=[];
  class RelaySocket{
    constructor(url){this.url=url;this.readyState=0;this.bufferedAmount=0;sockets.push(this);setImmediate(()=>{this.readyState=1;this.onopen();});}
    message(packet){setImmediate(()=>{if(this.readyState===1)this.onmessage({data:JSON.stringify(packet)});});}
    send(raw){
      const [type,sub,filter]=JSON.parse(raw);
      if(type==="REQ"){this.lanes=filter["#x"];this.message(["EOSE",sub]);return;}
      const e=sub;outgoing.push(e);
      this.message(["OK",e.id,true,""]);
      sockets.filter(s=>s.url===this.url&&s.lanes?.includes(e.tags[0][1])).forEach(s=>s.message(["EVENT","couriers",e]));
    }
    close(){this.readyState=3;this.onclose?.();}
  }
  globalThis.WebSocket=RelaySocket;
  const devices=[];
  t.after(()=>{devices.forEach(d=>d.net.close());globalThis.WebSocket=original;});
  async function device(id,room){
    let net,seq=0;const received=[],online=[],others=new Set();
    const frame=(op,to="",body=null)=>({v:1,id,e:"1234567890abcdef",n:++seq,op,to,body});
    net=await createRelay({room,id,hello:()=>frame("hi"),ready:value=>online.push(value),signal:(to,body)=>frame("rtc",to,body),
      receive:(packet,_,key)=>{
        if(packet.op==="hi"||packet.op==="here"){
          const newcomer=!others.has(packet.id);others.add(packet.id);net.know(packet.id,key,true);
          if(newcomer&&packet.op==="hi")net.send(frame("here",packet.id),[packet.id]);
        }else received.push(packet);
      }});
    const result={id,net,frame,received,online,others};devices.push(result);net.start();return result;
  }
  async function until(fn){
    const end=Date.now()+4000;while(!fn()&&Date.now()<end)await new Promise(r=>setTimeout(r,20));assert.ok(fn());
  }
  const a=await device("011111111111111111111111","valley");
  const b=await device("022222222222222222222222","valley");
  const watcher=await device("033333333333333333333333","valley");
  const different=await device("044444444444444444444444","different-valley");
  await until(()=>devices.every(d=>d.online.includes(true))&&[a,b,watcher].every(d=>d.others.size===2));
  const start=outgoing.length,secret="a private team decision";a.net.send(a.frame("data",b.id,{kind:"duel",secret}),[b.id]);
  await until(()=>b.received.length===1);assert.equal(b.received[0].body.secret,secret);assert.equal(watcher.received.length+different.received.length,0);
  const envelope=outgoing[start];assert.equal(envelope.kind,26858);assert.ok(!JSON.stringify(envelope).includes(secret));
  const bInbox=sockets.find(s=>s.lanes?.includes(envelope.tags[0][1]));
  bInbox.message(["EVENT","couriers",envelope]);
  bInbox.message(["EVENT","couriers",{...envelope,id:"0".repeat(64),sig:"0".repeat(128)}]);
  bInbox.message(["EVENT","couriers",{...envelope,created_at:1}]);
  for(let x=0;x<8;x++)a.net.send(a.frame("data","",{t:"presence",x}),[b.id,watcher.id]);
  await until(()=>b.received.some(p=>p.body?.x===7)&&watcher.received.some(p=>p.body?.x===7));
  assert.deepEqual(b.received.filter(p=>p.body?.t==="presence").map(p=>p.body.x),[0,7]);assert.equal(b.received.filter(p=>p.body?.kind==="duel").length,1);
  assert.equal(different.received.length,0);assert.equal(different.others.size,0);
});
