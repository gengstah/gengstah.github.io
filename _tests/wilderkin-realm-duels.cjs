const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),{webcrypto}=require("node:crypto");
const files=["atlas","bestiary","activities","campaign","story","duets","sparring-gear","sparring-signatures","sparring-battle","bellpost-rules","bellpost-arena","engine","realm-duels"];
const scripts=files.map(id=>{const filename=path.join(__dirname,"../games/wilderkin",id+".js");return new vm.Script(fs.readFileSync(filename,"utf8"),{filename});});
const copy=x=>JSON.parse(JSON.stringify(x));
function memory(){
  const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k),data};
}
function world(){
  let now=200000;const queue=[],log=[],clients={},sessions={},permissions={},disks={};
  function endpoint(id){
    const storage=sessions[id]??=memory(),disk=disks[id]??=memory();
    const w={crypto:webcrypto,sessionStorage:storage,localStorage:disk},ctx=vm.createContext({window:w});
    for(const file of scripts)file.runInContext(ctx);
    const game=w.WilderGame,d=w.WilderRealmDuels.create({game,now:()=>now,image:x=>x+".png",
      canInvite:(peer,dir)=>permissions[id]?.(peer,dir)??true,
      send(to,msg){const frame={from:id,to,msg:copy(msg)};queue.push(frame);log.push(frame);}});
    clients[id]={id,d,game,sim:w.WilderSparringBattle.create({game}),codec:w.WilderBellpostRules.create({game,storage:null}).filmCodec};
    d.resume(id);return clients[id];
  }
  const deliver=p=>clients[p.to].d.receive(p.from,copy(p.msg));
  async function flush(){
    for(let i=0;i<4;i++){
      await new Promise(r=>setTimeout(r,3));
      let cap=0;while(queue.length){assert.ok(cap++<150,"message loop");deliver(queue.shift());}
    }
  }
  const a=endpoint("ranger-a"),b=endpoint("ranger-b");
  async function duel(){
    assert.ok(a.d.invite(b.id).ok);await flush();assert.equal(b.d.read().phase,"incoming");
    assert.ok(b.d.accept(["dewfin","sprigkit","cindlet"]).ok);await flush();
    assert.equal(a.d.read().phase,"active");assert.equal(b.d.read().phase,"active");
  }
  const time=ms=>{now+=ms;for(const c of Object.values(clients))c.d.tick();};
  const acting=()=>Object.values(clients).find(c=>c.d.read().record?.seat===c.d.read().record?.pos.turn);
  return {a,b,queue,log,flush,deliver,duel,time,acting,clients,endpoint,sessions,permissions,disks};
}
const allRows=m=>m.sections.flatMap(s=>s.rows||[]);
test("both players consent and lock their own three kin before the opposing trio is revealed",async()=>{
  const h=world(),{a,b}=h;
  assert.equal(a.d.invite(b.id,["sprigkit","dewfin","opalclasp"]).ok,false);
  assert.equal(a.d.invite(b.id,["sprigkit","sprigkit","cindlet"]).ok,false);
  assert.ok(a.d.invite(b.id,["cindlet","sprigkit","dewfin"]).ok);
  await h.flush();
  const offer=h.log.find(p=>p.msg.op==="offer");assert.equal(offer.msg.seal.length,64);
  assert.ok(!JSON.stringify(offer).includes("cindlet"));assert.deepEqual(copy(b.d.read().remoteTeam),[]);
  assert.equal(b.d.read().record,null);assert.ok(!b.d.move("skill:bubble-jet").ok);
  assert.ok(b.d.accept().ok);await h.flush();
  const r=a.d.read().record;assert.equal(r.pos.first,b.d.read().record.pos.first);assert.equal(r.teams[0].ids[0],"cindlet");
  assert.ok(r.pos.sides.every(s=>s.team.every(k=>k.level===20&&k.hp===k.maxHp)));
  assert.deepEqual(copy(r.pos),copy(b.d.read().record.pos));
  assert.deepEqual(copy(b.d.model().lineups.left.team.map(k=>k.id)),copy(b.d.team()));
  const active=h.acting(),next=active.id===a.id?b:a;
  assert.ok(!next.d.move("skill:leaf-flurry").ok);
  const before=copy(active.d.read().record.pos);
  assert.ok(active.d.act("realm-duel-panel","partners"));
  const swap=allRows(active.d.model()).find(o=>o.value?.startsWith("swap:")&&!o.disabled);assert.ok(swap);
  active.d.act(swap.id,swap.value);await h.flush();assert.equal(active.d.read().record.moves[0],swap.value);
  assert.ok(active.d.read().record.pos.sides[before.turn].active!==before.sides[before.turn].active);
  assert.deepEqual(copy(a.d.read().record.pos),copy(b.d.read().record.pos));
  assert.equal(a.game.state.battle,null);assert.equal(b.game.state.battle,null);
});
test("a full level-20 duel, alternating guards, switches, duets and free replacement resolves identically without affecting campaign HP, items or progress",async()=>{
  const h=world(),{a,b}=h;const baseline=[a,b].map(c=>JSON.stringify(c.game.state));
  await h.duel();let swapped=false,duet=false,guard=false,replaced=false;
  for(let i=0;i<68&&a.d.read().phase==="active";i++){
    const c=h.acting(),r=c.d.read().record;
    let action;const legal=c.sim.options(r.pos).filter(o=>o.available);
    if(r.pos.phase==="replace"){action=legal[0];replaced=true;}
    else if(!guard){action=legal.find(o=>o.kind==="guard");guard=!!action;}
    else if(!swapped){action=legal.find(o=>o.kind==="swap");swapped=!!action;}
    else if(!duet){action=legal.find(o=>o.kind==="duet");duet=!!action;}
    action??=c.sim.recommend(r.pos);
    assert.ok(c.d.move(action.id).ok);await h.flush();
    assert.deepEqual(copy(a.d.read().record.pos),copy(b.d.read().record.pos));
  }
  assert.equal(a.d.read().phase,"done");assert.ok(swapped&&guard&&duet&&replaced);
  assert.ok(["win","loss","draw"].includes(a.d.read().result));assert.notEqual(a.d.read().result,b.d.read().result);
  assert.ok(allRows(a.d.model()).find(r=>r.id==="realm-duel-dismiss"));
  assert.ok(a.d.act("realm-duel-film",a.d.read().record.moves.length-1));assert.equal(a.d.model().title,"Battle film");
  assert.deepEqual([a,b].map(c=>JSON.stringify(c.game.state)),baseline);
  assert.ok(!Object.keys(Object.fromEntries(h.disks[a.id].data)).some(k=>k.includes("bellpost")));
});
test("loss and reorder recover from whole legal tapes; fake seats, illegal codes and wrong identities cannot advance the match",async()=>{
  const h=world(),{a,b}=h;await h.duel();
  const c=h.acting(),them=c===a?b:a,r=c.d.read().record;
  const move=c.sim.options(r.pos).find(o=>o.available&&o.kind==="attack");
  assert.ok(c.d.move(move.id).ok);
  const real=h.queue.shift(),after=c.d.read().record.pos;
  const reply=c.sim.options(after).find(o=>o.available&&o.kind==="attack");
  const extra=c.codec.command(after,reply.id,3);
  assert.equal(them.d.receive(c.id,{...real.msg,tape:real.msg.tape+extra}),false);
  assert.equal(them.d.read().record.moves.length,0);
  assert.equal(them.d.receive("different-traveler",real.msg),false);
  assert.equal(them.d.receive(c.id,{...real.msg,tape:"@!",hp:0}),false);
  h.time(5000);await h.flush();assert.equal(them.d.read().record.moves.length,1);
  h.deliver(real);h.deliver(real);await h.flush();
  assert.deepEqual(copy(c.d.read().record.pos),copy(them.d.read().record.pos));
});
test("a reloaded tab rebuilds its seat from valid decisions and rejoins; an unrelated tab or corrupt tape cannot take the seat",async()=>{
  const h=world(),{a,b}=h;await h.duel();
  const first=h.acting(),id=first.sim.options(first.d.read().record.pos).find(o=>o.available).id;
  assert.ok(first.d.move(id).ok);await h.flush();
  const wanted=copy(a.d.read().record.pos),raw=h.sessions[a.id].getItem("wilderkin.realm-duel.v1");
  assert.ok(raw&&!raw.includes('"hp"'));b.d.peerLeft(a.id);
  const a2=h.endpoint(a.id);assert.equal(a2.d.read().online,false);
  a2.d.peerJoined(b.id);b.d.peerJoined(a.id);await h.flush();
  assert.deepEqual(copy(a2.d.read().record.pos),wanted);
  assert.equal(a2.d.read().online,true);
  const copySession=memory();copySession.setItem("wilderkin.realm-duel.v1",raw);
  h.sessions["another-tab"]=copySession;assert.equal(h.endpoint("another-tab").d.read().phase,"idle");
  const corrupted=JSON.parse(raw);corrupted.tape="WWWWWWWW";
  h.sessions[a.id].setItem("wilderkin.realm-duel.v1",JSON.stringify(corrupted));
  assert.equal(h.endpoint(a.id).d.read().phase,"idle");
});
test("blocked incoming offers, expiry, decline cooldown, cancellation, crossing offers, and disconnect grace respect both travelers",async()=>{
  const h=world(),{a,b}=h;h.permissions[b.id]=()=>false;
  a.d.invite(b.id);await h.flush();assert.equal(b.d.read().phase,"idle");assert.equal(a.d.read().phase,"idle");
  h.time(31000);h.permissions[b.id]=()=>true;
  a.d.invite(b.id);await h.flush();assert.ok(b.d.decline().ok);await h.flush();
  h.time(31000);a.d.invite(b.id);await h.flush();assert.equal(b.d.read().phase,"idle");
  h.time(61000);
  a.d.invite(b.id);b.d.invite(a.id);await h.flush();
  const inc=[a,b].find(x=>x.d.read().phase==="incoming"),out=[a,b].find(x=>x.d.read().phase==="outgoing");
  assert.ok(inc&&out);assert.equal(inc.d.read().id,out.d.read().id);inc.d.accept();await h.flush();
  a.d.peerLeft(b.id);h.time(44000);assert.equal(a.d.read().phase,"active");assert.equal(a.d.read().online,false);
  a.d.peerJoined(b.id);await h.flush();assert.equal(a.d.read().online,true);
  a.d.peerLeft(b.id);h.time(45100);assert.equal(a.d.read().result,"no-contest");
  assert.equal(a.d.model().title,"Duel ended");
});
test("either seat can concede between turns; received result survives premature dismissal and a lost final packet",async()=>{
  const h=world(),{a,b}=h;await h.duel();
  const winner=h.acting(),loser=winner===a?b:a;
  assert.ok(loser.d.act("realm-duel-confirm"));assert.ok(loser.d.act("realm-duel-concede"));assert.equal(loser.d.read().result,"loss");
  h.queue.splice(0);const result=loser.d.dismiss();assert.equal(result.result,"loss");
  winner.d.peerLeft(loser.id);h.time(1500);winner.d.peerJoined(loser.id);await h.flush();
  assert.equal(winner.d.read().result,"win");assert.match(winner.d.model().title,/won/);
});
test("concealed roster mismatch and a fabricated reveal before acceptance cannot start a guest battle",async()=>{
  const h=world(),{a,b}=h;
  a.d.invite(b.id);await h.flush();const id=b.d.read().id;
  const bad={kind:"duel",v:1,op:"turn",id,guest:null,open:"a".repeat(24),team:["cindlet","dewfin","sprigkit"],tape:"",yielded:false};
  assert.equal(b.d.receive(a.id,bad),false);assert.equal(b.d.read().phase,"incoming");
  b.d.accept();h.deliver(h.queue.shift());const reveal=h.queue.shift();
  assert.ok(b.d.receive(a.id,{...reveal.msg,team:reveal.msg.team.slice().reverse()}));await h.flush();
  assert.equal(b.d.read().phase,"idle");assert.match(b.d.read().message,/revealed trio/);
});

test("an invite expires without starting either seat; entering a campaign battle during acceptance closes the pending duel",async()=>{
  const h=world(),{a,b}=h;
  a.d.invite(b.id);await h.flush();h.time(46000);await h.flush();
  assert.equal(a.d.read().phase,"idle");assert.equal(b.d.read().phase,"idle");
  a.d.invite(b.id);await h.flush();assert.ok(a.d.cancel().ok);await h.flush();assert.equal(b.d.read().phase,"idle");
  h.time(31000);a.d.invite(b.id);await h.flush();h.permissions[a.id]=(_p,dir)=>dir!=="accept";
  assert.ok(b.d.accept().ok);await h.flush();assert.equal(a.d.read().phase,"idle");assert.equal(b.d.read().phase,"idle");
});
test("a live map avatar cannot keep an unresponsive duel seat open forever",async()=>{
  const h=world(),{a,b}=h;await h.duel();
  h.time(31000);a.d.peerJoined(b.id);h.queue.splice(0);
  assert.equal(a.d.read().online,false);
  h.time(45500);assert.equal(a.d.read().result,"no-contest");
});
async function waitConnected(h,seconds){
  for(let i=0;i<seconds;i+=10){h.time(10000);await h.flush();}
}
test("a connected idle turn allows one nudge then a mutually delivered no-result exit, even when its first receipt is lost",async()=>{
  const h=world();await h.duel();const actor=h.acting(),waiter=h.a===actor?h.b:h.a;
  await waitConnected(h,50);
  const controls=()=>allRows(waiter.d.model());
  assert.ok(controls().some(r=>r.id==="realm-duel-nudge"));assert.ok(!controls().some(r=>r.id==="realm-duel-idle-end"));
  waiter.d.act("realm-duel-nudge");waiter.d.act("realm-duel-nudge");await h.flush();
  assert.match(actor.d.model().subtitle,/opponent is ready/);
  assert.equal(h.log.filter(f=>f.msg.op==="nudge").length,1);
  await waitConnected(h,40);assert.ok(controls().some(r=>r.id==="realm-duel-idle-end"));
  waiter.d.act("realm-duel-idle-end");h.deliver(h.queue.shift());
  assert.equal(actor.d.read().result,"no-contest");
  h.queue.length=0;actor.d.dismiss();assert.equal(waiter.d.read().result,null);
  h.time(16000);await h.flush();assert.equal(waiter.d.read().result,"no-contest");
});
test("an idle request arriving after the actor has moved cannot end the new turn",async()=>{
  const h=world();await h.duel();const actor=h.acting(),waiter=h.a===actor?h.b:h.a;
  await waitConnected(h,90);waiter.d.act("realm-duel-idle-end");const old=h.queue.shift();
  const move=actor.sim.options(actor.d.read().record.pos).find(m=>m.available&&m.kind==="attack");
  assert.ok(actor.d.move(move.id).ok);assert.equal(h.deliver(old),false);await h.flush();
  assert.ok([waiter,actor].every(c=>c.d.read().phase==="active"&&c.d.read().record.moves.length===1));
  assert.ok(!allRows(waiter.d.model()).some(r=>r.id==="realm-duel-idle-end"));
});
test("arena keycaps select the same live actions as buttons and held keys never spend two turns",async()=>{
  const h=world();await h.duel();const c=h.acting(),d=c.d;
  assert.ok(d.key({key:"D"}));assert.equal(d.model().title,"Team moves");
  assert.ok(d.key({key:"Escape"}));assert.equal(d.model().title,"Your turn");
  const v=allRows(d.model()).find(r=>r.key==="1").value;
  assert.ok(d.key({key:"1",repeat:true}));assert.equal(d.read().record.moves.length,0);
  assert.ok(d.key({key:"1"}));await h.flush();assert.deepEqual(copy(d.read().record.moves),[v]);
});
