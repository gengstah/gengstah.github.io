const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {webcrypto} = require("node:crypto");
const source = fs.readFileSync(path.join(__dirname, "../games/wilderkin/bellpost-wire.js"), "utf8");
const idle = () => new Promise(resolve => setImmediate(resolve));

function setup() {
  let input = "", clipboard = "", peer;
  const notice = [], writes = [], remoteHashes = [];
  const sdp = "v=0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\na=candidate:1 1 udp 123 bird.local 44000 typ host\r\n";
  class Peer {
    constructor(config) {
      assert.equal(config.iceServers.length, 0);
      this.iceGatheringState = "complete";
      this.added = [];
      peer = this;
    }
    createDataChannel(label) {
      return this.channel = {label, readyState:"open", send:value => writes.push(JSON.parse(value)), close() {}};
    }
    createOffer() { return {type:"offer", sdp}; }
    setLocalDescription(desc) { this.localDescription = desc; this.signalingState = "have-local-offer"; }
    setRemoteDescription(desc) { this.remoteDescription = desc; this.signalingState = "stable"; }
    addIceCandidate(c) { this.added.push(c); }
    close() { this.closed = true; }
    addEventListener() {}
    removeEventListener() {}
  }
  const window = {RTCPeerConnection:Peer, crypto:webcrypto, prompt:() => input,
    navigator:{clipboard:{writeText:async value => { clipboard = value; }}}};
  const ticks = new Map();
  const setTimer = (fn, ms) => { ticks.set(ms, fn); return ms; };
  const context = vm.createContext({window, btoa, atob, Uint8Array, setTimeout:setTimer, clearTimeout:id=>ticks.delete(id)});
  vm.runInContext(source, context);
  const record = {id:"ab12", seat:0, status:"active", moves:["first"], pos:{turn:1}, hash:"#new"};
  const rules = {get:() => record, export:() => record.hash,
    inspect:hash => hash === "#wrong" ? null : {...record, hash},
    receive:hash => { remoteHashes.push(hash); return hash === "#old" ? {ok:false,code:"stale"} : {ok:true}; }};
  const wire = window.WilderBellpostWire.create({rules, row:(id,label,value)=>({id,label,value}), render(){}, notify:m=>notice.push(m)});
  return {record, rules, wire, notice, writes, remoteHashes, sdp, peer:()=>peer,
    input:value=>{input=value;}, clip:()=>clipboard, action:id=>wire.act(id, record.id, record),
    rows:()=>wire.model(record).sections[0].rows.map(r=>r.id), tick:ms=>ticks.get(ms)?.()};
}

test("pairing requires a local seat in an active match and an answer from the correct match, seat and slip", async () => {
  const s = setup();
  assert.equal(s.wire.link({...s.record,seat:null}), null);
  assert.equal(s.wire.link({...s.record,status:"invite"}), null);
  s.action("wire-new"); await idle();
  s.action("wire-copy"); await idle();
  const prefix="WILDERKIN-WIFI1.", offer=JSON.parse(atob(s.clip().slice(prefix.length)));
  const answer={...offer,type:"answer",seat:1};
  const use=value=>{s.input(prefix+btoa(JSON.stringify(value)));s.action("wire-paste");};
  for(const changes of [{seat:0},{id:"other"},{nonce:"0000"},{sdp:s.sdp+"m=audio 9 RTP/AVP 0\r\n"}]) {
    use({...answer,...changes});await idle();
    assert.equal(s.peer().remoteDescription,undefined);
  }
  use(answer);await idle();
  assert.equal(s.peer().remoteDescription.type,"answer");
  s.tick(4500);assert.ok(s.rows().includes("wire-address"));
  s.input("example.com");s.action("wire-address");assert.equal(s.peer().added.length,0);
  s.input("192.168.2.17");s.action("wire-address");await idle();
  assert.equal(s.peer().added[0].candidate,"candidate:1 1 udp 123 192.168.2.17 44000 typ host");
  s.action("wire-close");assert.ok(s.peer().closed);
});

test("a paired peer can catch up from a stale position and only complete handoffs are transmitted", async () => {
  const s=setup();s.action("wire-new");await idle();
  const channel=s.peer().channel;
  const inbound=(hash,seat=1)=>channel.onmessage({data:JSON.stringify({id:s.record.id,seat,hash})});
  await inbound("#new",0);await inbound("#wrong");assert.equal(s.remoteHashes.length,0);
  await inbound("#old");assert.ok(s.wire.connected(s.record.id));
  assert.equal(s.writes.at(-1).hash,"#new");
  const sent=s.writes.length;s.record.pos.turn=0;s.wire.send(s.record.id);assert.equal(s.writes.length,sent);
  s.record.pos.turn=1;s.wire.send(s.record.id);assert.equal(s.writes.length,sent+1);
  s.record.status="done";s.record.hash="#final";s.wire.send(s.record.id);await inbound("#final");
  s.tick(350);assert.equal(s.wire.connected(s.record.id),false);assert.ok(s.peer().closed);
});
