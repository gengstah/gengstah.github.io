const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const copy=x=>JSON.parse(JSON.stringify(x));
function boot(enabled){
  const w={window:{localStorage:{getItem:()=>null,setItem(){throw new Error("Wrote campaign storage");}}}};
  const files=["atlas","bestiary","activities","campaign","story","duets","engine","sparring-gear",...(enabled?["sparring-signatures"]:[]),"sparring-battle"];
  for(const id of files){
    const file=path.join(__dirname,"../games/wilderkin",id+".js");vm.runInNewContext(fs.readFileSync(file,"utf8"),w,{filename:file});
  }
  return {sim:w.window.WilderSparringBattle.create({game:w.window.WilderGame}),book:w.window.WilderSparringSignatures};
}
const {sim,book}=boot(true),legacy=boot(false).sim;
const left=["mossbell","coalmoth","glimmeray"],right=["cindlet","dewfin","sprigkit"];
const thorn=["fernprickle","pincoil","cindlet"];
const take=(p,id)=>{const q=sim.apply(p,id);assert.ok(q,"Illegal command "+id);return q;};
const fighter=(p,side,id)=>p.sides[side].team.find(m=>m.id===id);
const lead=(p,i)=>p.sides[i].team[p.sides[i].active];
const many=(p,ids)=>ids.reduce(take,p);
const signatures=p=>sim.options(p).filter(m=>m.kind==="signature");

test("only Mossbell and Fernprickle can offer the two public techniques; all original tapes still settle identically",()=>{
  assert.equal(book.byId("mossbell"),book.byId("shelter-call"));assert.equal(book.byId("fernprickle"),book.byId("thorn-read"));
  assert.equal(book.byId("sprigkit"),null);assert.equal(book.byId("mossbell").cost,1);assert.equal(book.byId("fernprickle").uses,1);
  const original=legacy.start(left,right),newer=sim.start(left,right);
  assert.equal(signatures(newer).length,2);assert.ok(signatures(newer).every(m=>!m.available&&m.reason.includes("beat")));
  assert.ok(!sim.apply(newer,"stance:thorn-read"));assert.ok(!sim.apply(newer,"shelter:mossbell"));
  assert.equal(signatures(sim.start(right,left)).length,0);
  assert.equal(signatures(sim.start(thorn,right)).length,1);
  let a=original,b=newer,steps=0;
  while(a.phase!=="done"){
    assert.deepEqual(copy(legacy.options(a)),copy(sim.options(b).filter(m=>m.kind!=="signature")));
    const m=legacy.recommend(a);
    a=legacy.apply(a,m.id);b=take(b,m.id);steps++;
    assert.deepEqual(copy(b),copy(a));assert.deepEqual(copy(sim.restore(copy(a))),copy(a));
  }
  assert.ok(steps>20);
});

test("Shelter Call hands off under quarter cover at a real cost, stays independent of a switch bell and spends once",()=>{
  const pack={left:{mossbell:"opening-pennant",coalmoth:"relay-bell"}};
  const p=sim.start(left,right,0,pack),m=sim.forecast(p,"shelter:coalmoth");
  assert.ok(m.available);assert.equal(m.beatsAfter,0);assert.equal(m.cost,1);assert.equal(m.targetId,"coalmoth");
  const q=take(p,m.id),ordinary=take(p,"swap:coalmoth");
  assert.equal(q.ply,1);assert.equal(q.turn,1);assert.equal(lead(q,0).id,"coalmoth");assert.equal(q.sides[0].beats,0);
  assert.equal(q.sides[0].cover,.25);assert.equal(fighter(q,0,"coalmoth").spent,false);assert.equal(ordinary.sides[0].beats,3);
  const reply=sim.forecast(q,"skill:ember-pop"),plain=sim.forecast(ordinary,reply.id);assert.equal(reply.damage,Math.round(plain.damage/4));
  const then=take(q,reply.id);assert.equal(lead(then,0).hp,lead(q,0).hp-reply.damage);assert.equal(then.sides[0].cover,1);
  const back=many(then,["swap:mossbell","skill:ember-pop"]);assert.ok(!sim.forecast(back,m.id).available);
  assert.ok(fighter(back,0,"mossbell").signatureSpent);assert.equal(sim.apply(back,m.id),null);
});

test("a real lure pins Mossbell and prevents Shelter Call until the next turn, without spending it",()=>{
  const rival=["sprigkit","frostmull","cindlet"];
  let p=sim.start(left,rival);
  p=many(p,["skill:briar-bloom","skill:leaf-flurry","skill:shell-bump","skill:brush-dash","skill:shell-bump","duet:frostmull"]);
  assert.ok(p.sides[0].pinned);assert.ok(p.sides[0].beats);
  assert.match(sim.forecast(p,"shelter:coalmoth").reason,/lure/);assert.equal(sim.apply(p,"shelter:coalmoth"),null);
  assert.ok(!fighter(p,0,"mossbell").signatureSpent);p=many(p,["skill:root-rest","swap:cindlet"]);
  assert.ok(sim.forecast(p,"shelter:coalmoth").available);
  const injured=copy(p);fighter(injured,0,"coalmoth").hp=0;
  assert.ok(sim.restore(injured));assert.equal(sim.forecast(injured,"shelter:coalmoth"),null);
});

test("Thorn Read predicts contact or evasion exactly; only the damaging line grants a beat and exposure",()=>{
  const p=many(sim.start(thorn,right),["skill:briar-net","skill:ember-pop"]);
  const q=take(p,"stance:thorn-read"),before=q.sides[0].beats;
  assert.ok(q.sides[0].thornRead);assert.equal(lead(q,0).signatureSpent,true);assert.equal(q.sides[0].cover,.25);assert.equal(before,p.sides[0].beats);
  assert.deepEqual(copy(sim.restore(copy(q))),copy(q));
  for(const id of ["skill:rekindle","swap:dewfin"]){
    const m=sim.forecast(q,id);assert.ok(m.available);assert.equal(m.thornResponse,undefined);assert.match(m.detail,/without contact/);
    const e=take(q,id);assert.equal(e.sides[0].thornRead,undefined);assert.equal(e.sides[0].cover,1);
    assert.equal(e.sides[0].beats,before);assert.ok(!fighter(e,1,"cindlet").exposed);
    assert.equal(sim.apply(e,"stance:thorn-read"),null);
  }
  for(const id of ["skill:ember-pop","skill:cinder-roll"]){
    const m=sim.forecast(q,id),e=take(q,id);
    assert.ok(m.damage>0&&m.damage<10);
    assert.deepEqual(copy(m.thornResponse),{attackerId:"cindlet",holderId:"fernprickle",beatsAfter:Math.min(3,before+1)});
    assert.equal(m.rivalBeatsAfter,e.sides[0].beats);assert.equal(e.sides[0].thornRead,undefined);
    assert.ok(lead(e,1).exposed);assert.equal(lead(e,0).hp,lead(q,0).hp-m.damage);
    const punish=sim.forecast(e,"skill:briar-net");assert.ok(punish.consumeMark);assert.match(punish.detail,/uses exposure/);
    const next=take(e,punish.id);assert.ok(!lead(next,1).exposed);
  }
});

test("a contact relay marks its outgoing attacker and an ordinary switch still clears the read without marking a reserve",()=>{
  const p=many(sim.start(thorn,right),["skill:briar-net","skill:ember-pop","skill:quill-brace","skill:cinder-roll","stance:thorn-read"]);
  const f=sim.forecast(p,"duet:dewfin");assert.ok(f.available);assert.equal(f.thornResponse.attackerId,"cindlet");
  const next=take(p,f.id);assert.equal(lead(next,1).id,"dewfin");assert.ok(fighter(next,1,"cindlet").exposed);assert.ok(!lead(next,1).exposed);
  assert.equal(next.sides[0].beats,3);
});

test("cover piercing and non-damaging restraints keep their existing effects against a read",()=>{
  const rushTeam=["cindlet","coalmoth","glimmeray"];
  let p=sim.start(thorn,rushTeam,1,{right:{cindlet:"opening-pennant"}});
  p=many(p,["skill:cinder-roll","skill:briar-net","skill:ember-pop"]);
  const read=take(p,"stance:thorn-read"),strike=take(p,"skill:quill-brace");
  const rush=sim.forecast(read,"duet:coalmoth");assert.ok(rush.available&&rush.thornResponse);
  assert.equal(rush.damage,sim.forecast(strike,"duet:coalmoth").damage);assert.ok(take(read,rush.id).sides[1].team[0].exposed);

  let status=sim.start(thorn,["sprigkit","frostmull","cindlet"],1,{left:{fernprickle:"last-stitch"}}),swings=0;
  while(!fighter(status,0,"fernprickle").spent){
    assert.ok(status.ply<50);
    const choices=sim.options(status).filter(m=>m.available);
    if(status.turn===1)status=take(status,++swings%2?"skill:leaf-flurry":"skill:brush-dash");
    else if(status.phase==="replace")status=take(status,"replace:fernprickle");
    else{
      const swap=lead(status,0).id==="fernprickle"?choices.find(m=>m.kind==="swap"):choices.find(m=>m.id==="swap:fernprickle");
      status=take(status,(swap||choices.find(m=>m.kind==="attack")).id);
    }
  }
  assert.equal(lead(status,0).hp,1);const oldBeats=status.sides[0].beats;
  const near=take(status,"stance:thorn-read"),lure=sim.forecast(near,"duet:frostmull");
  assert.equal(lure.damage,0);assert.equal(lure.thornResponse,undefined);
  const survived=take(near,lure.id);assert.equal(lead(survived,0).hp,1);assert.equal(survived.sides[0].beats,oldBeats);assert.ok(!lead(survived,1).exposed);
});

test("signatures mirror by seat, reload from the sparse state, and cannot be fabricated by migration",()=>{
  let a=sim.start(thorn,right,0),b=sim.start(right,thorn,1);
  for(const id of ["stance:thorn-read","skill:ember-pop","skill:briar-net"]){
    a=take(a,id);b=take(b,id);
    assert.deepEqual(copy(a.sides[0]),copy(b.sides[1]));assert.deepEqual(copy(a.sides[1]),copy(b.sides[0]));
    assert.deepEqual(copy(sim.restore(copy(a))),copy(a));assert.equal(legacy.restore(copy(a)),null);
  }
  const blank=sim.start(thorn,right);
  const tamper=(p,change)=>{const bad=copy(p);change(bad);assert.equal(sim.restore(bad),null);};
  tamper(blank,p=>p.sides[0].team[0].signatureSpent=true);
  tamper(a,p=>p.sides[0].team[1].signatureSpent=true);
  const read=take(blank,"stance:thorn-read");
  tamper(read,p=>p.sides[0].team[0].signatureSpent=false);tamper(read,p=>p.sides[0].cover=.5);
  tamper(read,p=>p.sides[1].thornRead=true);tamper(read,p=>p.sides[0].thornRead=false);
  let last=sim.start(thorn,right,1);
  while(last.ply<59){
    const swap=last.ply===3?"swap:cindlet":sim.options(last).find(m=>m.kind==="swap"&&m.available).id;
    last=take(last,swap);
  }
  assert.equal(lead(last,0).id,"fernprickle");
  last=take(last,"stance:thorn-read");assert.equal(last.phase,"done");assert.equal(last.sides[0].thornRead,undefined);
  assert.deepEqual(copy(sim.restore(copy(last))),copy(last));
});

test("otherwise identical Grove leads win different coached matchups, with the recorded move IDs proving their signatures mattered",()=>{
  const examples=[
    {winner:"mossbell",bench:["coalmoth","arcbill"],rival:left,first:0,used:"shelter:coalmoth"},
    {winner:"fernprickle",bench:["coalmoth","glimmeray"],rival:["brookpeep","frostmull","creekroll"],first:1,used:"stance:thorn-read"}
  ];
  for(const {winner,bench,rival,first,used} of examples)for(const species of ["mossbell","fernprickle"]){
    let p=sim.start([species,...bench],rival,first),replay=sim.start([species,...bench],rival,first);const tape=[];
    const own=[];
    while(p.phase!=="done"){
      const best=sim.recommend(p);assert.ok(best.available);if(p.turn===0)own.push(best.id);
      tape.push(best.id);p=take(p,best.id);
    }
    assert.equal(p.winner,species===winner?0:1);
    if(species===winner)assert.ok(own.includes(used),species);
    replay=many(replay,tape);assert.deepEqual(copy(replay),copy(p));
  }
});
