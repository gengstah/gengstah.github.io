// Transport lives only for the current online outing. A tab and an Internet
// connection to the same courier share a single presence and message stream.
(() => {
  "use strict";
  const idPattern=/^[a-f0-9]{24}$/,epochPattern=/^[a-f0-9]{16}$/;
  const lifetime=65000,interval=18000,limit=128;
  const randomHex=n=>Array.from(window.crypto.getRandomValues(new Uint8Array(n)),b=>b.toString(16).padStart(2,"0")).join("");
  const usableBody=value=>{
    if(!value||typeof value!=="object"||Array.isArray(value))return false;
    try{return JSON.stringify(value).length<=24576;}catch{return false;}
  };
  function connect({room,id,onStatus=()=>{},onPeer=()=>{},onLeave=()=>{},onMessage=()=>{}}){
    if(typeof room!=="string"||!room.length||room.length>120)throw Error("Invalid Wilderkin room.");
    if(!idPattern.test(id))id=randomHex(12);
    const epoch=randomHex(8),peers=new Map(),retired=new Map(),signers=new Map();
    let local=null,net=null,closed=false,internet=false,seq=0,status="",retry=0;
    const packet=(op,to="",body=null)=>({v:1,id,e:epoch,n:++seq,op,to,body});
    const fresh=(time,now=Date.now())=>time>0&&now-time<lifetime;
    function setStatus(value){
      if(value!==status){status=value;onStatus(value);}
    }
    function update(){
      if(!closed)setStatus(internet?"online":local?"local":"offline");
    }
    function postLocal(frame){
      if(!local)return false;
      try{local.postMessage(frame);return true;}catch{return false;}
    }
    function deliver(frame){
      const p=frame.to&&peers.get(frame.to);
      if(frame.to&&!p)return false;
      const localOnly=p&&fresh(p.local);
      const sentLocal=(!frame.to||localOnly)&&postLocal(frame);
      const remote=p?(localOnly?[]:[p.id]):Array.from(peers.values()).filter(p=>fresh(p.remote)&&!fresh(p.local)).map(p=>p.id);
      const sentRemote=net?.send(frame,remote)||false;
      return !!(sentLocal||sentRemote);
    }
    function forget(p,remember=true){
      peers.delete(p.id);net?.forget(p.id);
      if(remember){
        if(retired.size>=limit)retired.delete(retired.keys().next().value);
        retired.set(p.id+"."+p.e,Date.now());
      }
      onLeave(p.id);
    }
    function receive(frame,path,pub){
      if(closed||!frame||frame.v!==1||frame.id===id||!idPattern.test(frame.id)||
        !epochPattern.test(frame.e)||!Number.isSafeInteger(frame.n)||frame.n<1||
        (frame.to!==""&&frame.to!==id)||!["hi","here","bye","data","rtc"].includes(frame.op))return;
      if(frame.op==="data"&&!usableBody(frame.body))return;
      const now=Date.now(),remote=path==="remote";
      if(retired.has(frame.id+"."+frame.e))return;
      if(remote){
        // Keep the first verified signer through short departures so a
        // reconnecting duel opponent retains the same identity in this room.
        const key=signers.get(frame.id);
        if(key&&pub!==key)return;
        if(!key){
          if(signers.size>=limit*2)signers.delete(signers.keys().next().value);
          signers.set(frame.id,pub);
        }
      }
      let p=peers.get(frame.id),joined=false;
      if(p&&remote&&p.key&&pub!==p.key)return;
      if(p&&p.e!==frame.e){
        if(frame.op!=="hi"&&frame.op!=="here")return;
        if(!p.key&&remote&&fresh(p.local))return;
        forget(p);p=null;
      }
      if(frame.op==="bye"){
        if(p)forget(p);
        return;
      }
      if(!p){
        if(peers.size>=limit||frame.op==="rtc")return;
        p={id:frame.id,e:frame.e,local:0,remote:0,key:"",seen:new Set()};
        peers.set(p.id,p);joined=true;
      }
      p[path]=now;
      if(remote){p.key=pub;net?.know(p.id,pub,fresh(p.local));}
      if(p.seen.has(frame.n))return;
      p.seen.add(frame.n);
      if(p.seen.size>256)p.seen.delete(p.seen.values().next().value);
      if(joined){
        if(frame.op!=="here")deliver(packet("here",p.id));
        onPeer(p.id);
      }
      if(frame.op==="data")onMessage(p.id,frame.body);
      else if(frame.op==="rtc"&&remote)net?.signal(p.id,frame.body);
    }
    function beat(){
      if(closed)return;
      const now=Date.now();
      for(const p of peers.values())if(!fresh(p.local,now)&&!fresh(p.remote,now))forget(p,false);
      for(const [key,at] of retired)if(now-at>=lifetime)retired.delete(key);
      deliver(packet("hi"));
    }
    try{
      local=new window.BroadcastChannel("wilderkin.realm.v1."+room);
      local.onmessage=e=>receive(e.data,"local");
    }catch{local=null;}
    function startNetwork(){
      if(closed)return;
      if(typeof window.WebSocket!=="function"||!window.crypto?.subtle){update();return;}
      import("./realm-relay.mjs?v=123fa468fb").then(async module=>{
        if(closed)return;
        const next=await module.createRelay({room,id,receive,hello:()=>packet("hi"),signal:(to,body)=>packet("rtc",to,body),
          ready:state=>{if(!closed){internet=state;update();}}});
        if(closed){next.close();return;}
        net=next;net.start();
      }).catch(()=>{if(!closed){update();retry=window.setTimeout(startNetwork,30000);}});
    }
    const timer=window.setInterval(beat,interval);
    const initial=window.setTimeout(()=>{if(!closed){setStatus("connecting");beat();startNetwork();}},0);
    const timeout=window.setTimeout(update,5000);
    return {id,
      broadcast(body){return !closed&&usableBody(body)&&deliver(packet("data","",body));},
      send(to,body){return !closed&&idPattern.test(to)&&usableBody(body)&&deliver(packet("data",to,body));},
      close(){
        if(closed)return;
        deliver(packet("bye"));closed=true;
        window.clearInterval(timer);[initial,timeout,retry].forEach(t=>window.clearTimeout(t));
        local?.close();net?.close();peers.clear();retired.clear();signers.clear();
        window.setTimeout(()=>setStatus("closed"),0);
      }};
  }
  window.WilderRealmTransport={connect};
})();
