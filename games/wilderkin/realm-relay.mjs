// These public gaming relays carry short-lived discovery and fallback events.
// Operator documentation: https://ngengine.org/docs/network/ and
// https://ngengine.org/nostr4j/docs/relay-hints.html . No retained game saves.
import {getSharedSecret,schnorr} from "./network/noble-secp256k1-3.2.0.mjs";
const urls=["wss://relay.ngengine.org","wss://relay2.ngengine.org"];
const kind=26858,ttl=65,frameLimit=25200,maxPeers=128,maxDirect=8;
const encode=new TextEncoder(),decode=new TextDecoder();
const bytes=s=>Uint8Array.from(s.match(/../g)||[],pair=>parseInt(pair,16));
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");
const hash=async b=>new Uint8Array(await crypto.subtle.digest("SHA-256",b));
const seconds=()=>Math.floor(Date.now()/1000);
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
const un64=s=>Uint8Array.from(atob(s),v=>v.charCodeAt(0));
const keyOf=async raw=>crypto.subtle.importKey("raw",await hash(raw),"AES-GCM",false,["encrypt","decrypt"]);
const publicKey=value=>typeof value==="string"&&/^[a-f0-9]{64}$/.test(value);
function identity(id){
  const storeKey="wilderkin.realm.signer."+id;
  try{
    const saved=sessionStorage.getItem(storeKey);
    if(publicKey(saved)){
      const secretKey=bytes(saved);
      return {secretKey,publicKey:schnorr.getPublicKey(secretKey)};
    }
  }catch{ /* This outing can still sign events without saved storage. */ }
  const keys=schnorr.keygen();
  try{sessionStorage.setItem(storeKey,hex(keys.secretKey));}catch{}
  return keys;
}
function expiryTags(event,lane){
  const now=seconds();
  return Number.isSafeInteger(event.created_at)&&event.created_at>=now-ttl&&event.created_at<=now+15&&
    event.tags.length===2&&event.tags[0]?.[0]==="x"&&event.tags[0][1]===lane&&
    event.tags[1]?.[0]==="expiration"&&event.tags[1][1]===String(event.created_at+ttl);
}
const signingBytes=e=>encode.encode(JSON.stringify([0,e.pubkey,e.created_at,e.kind,e.tags,e.content]));
async function seal(key,payload,lane){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const box=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:encode.encode(lane)},key,encode.encode(JSON.stringify(payload)));
  return b64(iv)+"."+b64(box);
}
async function openBox(key,box,lane){
  const parts=box.split(".");
  if(parts.length!==2||parts[0].length!==16)return null;
  const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:un64(parts[0]),additionalData:encode.encode(lane)},key,un64(parts[1]));
  return JSON.parse(decode.decode(plain));
}
// Unknown room codes and courier keys never appear in relay subscription names.
export async function createRelay({room,id,receive,hello,signal,ready}){
  const scope="wilderkin/realm/1/"+room,topic=hex(await hash(encode.encode("rendezvous/"+scope)));
  const roomKey=await keyOf(encode.encode("room key/"+scope)),keys=identity(id),pub=hex(keys.publicKey);
  const inbox=peer=>topic+"-"+peer;
  const sockets=new Map(),peers=new Map(),pairKeys=new Map(),seen=new Map();
  let closed=false,stopping=false,finishClose=null,online=false,outbox=Promise.resolve(),pending=0,lastPoseAt=0,poseTimer=0,lastPose=null;
  function update(){
    const value=Array.from(sockets.values()).some(s=>s.ok);
    if(value!==online){online=value;ready(value);}
  }
  function pairKey(peer){
    if(!pairKeys.has(peer)){
      if(pairKeys.size>=maxPeers)pairKeys.delete(pairKeys.keys().next().value);
      // BIP340 public keys encode an x-coordinate. ECDH uses the shared
      // x-coordinate, which is the same for either sign of the public point.
      const shared=getSharedSecret(keys.secretKey,bytes("02"+peer)).slice(1);
      const input=new Uint8Array(32+encode.encode(topic).length);
      input.set(shared);input.set(encode.encode(topic),32);
      pairKeys.set(peer,keyOf(input));
    }
    return pairKeys.get(peer);
  }
  async function publish(frame,key,only){
    const recipients=only?[only]:Array.from(sockets.values()).filter(s=>s.ws?.readyState===1);
    if(!recipients.length||pending>=64||closed)return false;
    pending++;
    const write=async()=>{
      if(closed)return;
      const lane=key?inbox(key):topic,now=seconds();
      const e={pubkey:pub,created_at:now,kind,tags:[["x",lane],["expiration",String(now+ttl)]],content:await seal(key?await pairKey(key):roomKey,frame,lane)};
      const digest=await hash(signingBytes(e));
      e.id=hex(digest);e.sig=hex(await schnorr.signAsync(digest,keys.secretKey));
      const wire=JSON.stringify(["EVENT",e]);
      for(const s of recipients){
        if(s.ws?.readyState!==1||s.ws.bufferedAmount>150000)continue;
        if(frame.op==="hi"){
          if(s.probes.size>=6)s.probes.delete(s.probes.values().next().value);
          s.probes.add(e.id);
        }
        if(frame.op==="bye")s.departure=e.id;
        s.ws.send(wire);
      }
    };
    outbox=outbox.then(write).catch(()=>{}).finally(()=>{pending--;});
    return true;
  }
  async function parseEvent(e){
    if(!e||e.kind!==kind||e.pubkey===pub||!publicKey(e.pubkey)||!publicKey(e.id)||!Array.isArray(e.tags)||
      typeof e.sig!=="string"||!/^[0-9a-f]{128}$/.test(e.sig)||typeof e.content!=="string"||e.content.length>36500)return;
    const lane=e.tags[0]?.[1];
    if(lane!==topic&&lane!==inbox(pub)||!expiryTags(e,lane)||seen.has(e.id))return;
    const digest=await hash(signingBytes(e));
    if(hex(digest)!==e.id||!await schnorr.verifyAsync(bytes(e.sig),digest,bytes(e.pubkey))||closed)return;
    if(seen.has(e.id))return;
    if(seen.size>=1024)seen.delete(seen.keys().next().value);
    seen.set(e.id,true);
    const frame=await openBox(lane===topic?roomKey:await pairKey(e.pubkey),e.content,lane);
    if(closed||!frame||frame.to&&frame.to!==id||lane===topic&&frame.to!==""||lane!==topic&&frame.to!==id)return;
    receive(frame,"remote",e.pubkey);
  }
  function dial(s){
    if(closed||stopping)return;
    let ws;
    try{ws=new WebSocket(s.url);}catch{later(s);return;}
    s.ws=ws;s.ok=false;s.probes.clear();
    let reads=Promise.resolve(),reading=0,subscribed=false;
    ws.onopen=()=>{
      if(closed||stopping){ws.close();return;}
      ws.send(JSON.stringify(["REQ","couriers",{kinds:[kind],"#x":[topic,inbox(pub)],limit:0}]));
    };
    ws.onmessage=event=>{
      if(closed||s.ws!==ws||typeof event.data!=="string"||event.data.length>40700)return;
      let msg;try{msg=JSON.parse(event.data);}catch{return;}
      if(!Array.isArray(msg))return;
      if(msg[0]==="EOSE"&&msg[1]==="couriers"&&!subscribed){
        subscribed=true;void publish(hello(),null,s);
      }else if(msg[0]==="OK"&&msg[2]===true&&s.departure===msg[1]){
        finishClose?.();
      }else if(msg[0]==="OK"&&s.probes.delete(msg[1])){
        if(msg[2]===true){s.ok=true;s.backoff=2000;update();}
        else if(!s.ok){ws.close();}
      }else if(msg[0]==="CLOSED"&&msg[1]==="couriers")ws.close();
      else if(msg[0]==="EVENT"&&msg[1]==="couriers"&&reading<40){
        reading++;reads=reads.then(()=>parseEvent(msg[2])).catch(()=>{}).finally(()=>{reading--;});
      }
    };
    ws.onclose=()=>{if(s.ws!==ws)return;s.ok=false;s.ws=null;update();later(s);};
    ws.onerror=()=>{ /* The close event schedules reconnect with backoff. */ };
  }
  function later(s){
    if(stopping||closed)return;
    s.timer=setTimeout(()=>dial(s),s.backoff+Math.random()*800);
    s.backoff=Math.min(s.backoff*2,90000);
  }
  function endDirect(p){
    if(p.timer)clearTimeout(p.timer);
    p.timer=0;
    if(p.channel){p.channel.onclose=null;p.channel.close();p.channel=null;}
    if(p.pc){p.pc.onconnectionstatechange=null;p.pc.close();p.pc=null;}
  }
  function channel(p,dc){
    if(dc.label!=="wilderkin-trail"||p.channel){dc.close();return;}
    p.channel=dc;
    dc.onopen=()=>{clearTimeout(p.timer);p.timer=0;};
    dc.onclose=()=>endDirect(p);
    dc.onmessage=e=>{
      if(closed||typeof e.data!=="string"||e.data.length>frameLimit)return;
      try{const f=JSON.parse(e.data);if(f.id===p.id&&f.op==="data")receive(f,"remote",p.pub);}catch{}
    };
  }
  async function describe(p,pc,sdp){
    await pc.setLocalDescription(sdp);
    if(pc.iceGatheringState!=="complete")await new Promise(resolve=>{
      let timer;
      const done=()=>{clearTimeout(timer);pc.removeEventListener("icegatheringstatechange",change);resolve();};
      const change=()=>{if(pc.iceGatheringState==="complete")done();};
      timer=setTimeout(done,2200);pc.addEventListener("icegatheringstatechange",change);change();
    });
    if(!closed&&!stopping&&p.pc===pc)void publish(signal(p.id,pc.localDescription.toJSON()),p.pub);
  }
  function direct(p,offer){
    if(typeof RTCPeerConnection!=="function"||Array.from(peers.values()).filter(x=>x.pc).length>=maxDirect)return;
    const now=Date.now();if(p.pc||p.attempt&&now-p.attempt<90000)return;
    p.attempt=now;
    try{
      const pc=new RTCPeerConnection({iceServers:[{urls:"stun:stun.cloudflare.com:3478"}]});p.pc=pc;
      pc.onconnectionstatechange=()=>{if(pc.connectionState==="failed"||pc.connectionState==="closed")endDirect(p);};
      pc.ondatachannel=e=>channel(p,e.channel);p.timer=setTimeout(()=>endDirect(p),11000);
      if(offer){
        channel(p,pc.createDataChannel("wilderkin-trail"));
        pc.createOffer().then(sdp=>describe(p,pc,sdp)).catch(()=>endDirect(p));
      }
    }catch{endDirect(p);}
  }
  function know(idOther,remoteKey,local){
    let p=peers.get(idOther);
    if(!p){
      if(peers.size>=maxPeers||!publicKey(remoteKey))return;
      p={id:idOther,pub:remoteKey,pc:null,channel:null,timer:0,attempt:0};peers.set(idOther,p);
    }
    if(!local&&p.pub===remoteKey&&id<idOther)direct(p,true);
  }
  async function handleSignal(idOther,desc){
    const p=peers.get(idOther);
    if(!p||!["offer","answer"].includes(desc?.type)||typeof desc.sdp!=="string"||desc.sdp.length>14336)return;
    const media=desc.sdp.split(/\r?\n/).filter(line=>line.startsWith("m="));
    if(media.length!==1||!/^m=application \d+ UDP\/DTLS\/SCTP webrtc-datachannel$/.test(media[0]))return;
    if((desc.type==="offer")!==(id>idOther))return;
    if(desc.type==="offer")direct(p,false);
    const pc=p.pc;if(!pc||pc.signalingState!==(desc.type==="offer"?"stable":"have-local-offer"))return;
    try{
      await pc.setRemoteDescription({type:desc.type,sdp:desc.sdp});
      if(desc.type==="offer")await describe(p,pc,await pc.createAnswer());
    }catch{if(p.pc===pc)endDirect(p);}
  }
  function relayPose(frame){
    // Direct connections get every step; a relay forwards at most one latest
    // public position per second while there are listeners in this room.
    if(Date.now()-lastPoseAt>=1000){
      lastPoseAt=Date.now();lastPose=null;clearTimeout(poseTimer);poseTimer=0;void publish(frame);return;
    }
    lastPose=frame;
    if(!poseTimer)poseTimer=setTimeout(()=>{
      poseTimer=0;if(lastPose&&!closed&&!stopping){lastPoseAt=Date.now();void publish(lastPose);lastPose=null;}
    },1000-(Date.now()-lastPoseAt));
  }
  function send(frame,ids){
    if(stopping||closed)return false;
    if(frame.op==="hi"||frame.op==="bye"){
      void publish(frame);return online;
    }
    const fallback=[];let sent=false;
    for(const idOther of ids){
      const p=peers.get(idOther);
      if(!p)continue;
      if(frame.op==="data"&&p.channel?.readyState==="open"&&p.channel.bufferedAmount<131072){
        try{p.channel.send(JSON.stringify(frame));sent=true;continue;}catch{}
      }
      fallback.push(p);
    }
    if(!fallback.length)return sent;
    if(frame.to){void publish(frame,fallback[0].pub);}
    else if(frame.body?.t==="presence"){relayPose(frame);}
    else{void publish(frame);}
    return online||sent;
  }
  function forget(idOther){
    const p=peers.get(idOther);if(!p)return;
    endDirect(p);pairKeys.delete(p.pub);peers.delete(idOther);
  }
  function close(){
    if(stopping)return;
    stopping=true;clearTimeout(poseTimer);
    for(const s of sockets.values())clearTimeout(s.timer);
    for(const p of peers.values())endDirect(p);
    const timer=setTimeout(()=>finishClose(),2500);
    finishClose=()=>{if(closed)return;clearTimeout(timer);closed=true;peers.clear();pairKeys.clear();for(const s of sockets.values())s.ws?.close();};
    if(!Array.from(sockets.values()).some(s=>s.ws?.readyState===1))finishClose();
  }
  function start(){
    if(stopping||closed||sockets.size)return;
    for(const url of urls){const s={url,ws:null,ok:false,backoff:2000,timer:0,probes:new Set()};sockets.set(url,s);dial(s);}
  }
  return {start,send,know,signal:handleSignal,forget,close};
}
