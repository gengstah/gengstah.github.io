const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const writes=[],window={localStorage:{getItem:()=>null,setItem:k=>writes.push(k),removeItem:k=>writes.push(k)}};
const ctx=vm.createContext({window});
for(const id of ["atlas","bestiary","activities","campaign","story","duets","sparring-gear","sparring-signatures","sparring-battle","engine","twin-battle"]){
  const file=path.join(__dirname,"../games/wilderkin",id+".js");vm.runInContext(fs.readFileSync(file,"utf8"),ctx,{filename:file});
}
const g=window.WilderGame,sim=window.WilderTwinBattle.create({game:g}),species=g.species;
const plain=x=>JSON.parse(JSON.stringify(x));
const card=(ids,gear={})=>({name:"Field four",ids,gear});
const lIds=["dewfin","thicketowl","kilnclaw","cairnwatch"],rIds=["cindlet","sprigkit","coalmoth","glimmeray"];
const start=(l=lIds,r=rIds,lg={},rg={})=>sim.start(card(l,lg),card(r,rg));
const holder=(p,s,id)=>p.sides[s].team.find(k=>k.id===id);
const lane=(p,s,i)=>p.sides[s].team[p.sides[s].active[i]]||null;
const call=["call:0","call:1"];
function options(p,s,l,draft){return sim.options(p,s,l,draft);}
function hit(p,s,l,t){return options(p,s,l).find(m=>m.kind==="attack"&&m.target===t).id;}
function round(p,a,b,settings){
  const before=JSON.stringify(p),r=sim.resolve(p,a,b,settings);
  assert.ok(r,JSON.stringify([a,b]));assert.equal(JSON.stringify(p),before);return r;
}
const order=(p,s,l,id,draft)=>options(p,s,l,draft).find(m=>m.id===id);
const attacks=r=>r.events.filter(e=>e.kind==="attack");
const gearEvents=r=>r.events.filter(e=>e.kind==="gear");
const active=s=>s.active.map(i=>s.team[i]?.id||null);
const normal=(p,actor,foe,skillId)=>Math.max(1,Math.round((species[actor].skills.find(s=>s.id===skillId).power+7.05)*window.WilderKinDex.effectiveness(species[actor].skills.find(s=>s.id===skillId).type,species[foe].types)));

test("four ordered rentals field two standing kin, reserve two, and commit only compatible orders from opening beats",()=>{
  const p=start(lIds,rIds,{dewfin:"opening-pennant"},{sprigkit:"opening-pennant"});
  assert.equal(p.phase,"plan");assert.equal(p.round,1);assert.equal(p.winner,null);
  assert.deepEqual(plain(p.sides.map(active)),[lIds.slice(0,2),rIds.slice(0,2)]);
  for(const side of p.sides)for(const kin of side.team)assert.equal(kin.hp,species[kin.id].baseHp+45);
  assert.equal(p.sides[0].beats,1);assert.equal(p.sides[1].beats,0);
  assert.equal(holder(p,0,"dewfin").spent,true);assert.equal(holder(p,1,"sprigkit").spent,false);
  const before=JSON.stringify(p);
  for(const a of [["swap:kilnclaw","swap:kilnclaw"],["duet:0","call:0"],[hit(p,0,0,0),"duet:0"],["cover:2","call:0"],
    ["swap:thicketowl","cover:1"],[null,"cover:1"],["attack:no-such-skill:0","call:0"],["cover:0"]])assert.equal(sim.resolve(p,a,call),null);
  assert.equal(JSON.stringify(p),before);
  const funded=round(p,call,call).pos;
  assert.equal(funded.sides[0].beats,3);
  assert.equal(order(funded,0,0,"duet:0",[null,"swap:kilnclaw"]).available,false);
  assert.equal(order(funded,0,1,"swap:kilnclaw",["duet:0",null]).available,false);
  assert.equal(order(funded,0,1,"swap:kilnclaw",["swap:kilnclaw",null]).available,false);
  assert.equal(sim.resolve(funded,["duet:0","swap:kilnclaw"],call),null);
  for(const ids of [lIds.slice(0,3),[...lIds,"gustlance"],["dewfin","dewfin","sprigkit","gustlance"],["stillwake",...lIds.slice(1)]])
    assert.equal(start(ids),null);
  assert.equal(start(lIds,rIds,{dewfin:"invented"}),null);
  assert.equal(start(lIds,rIds,{dewfin:"prism-lens",thicketowl:"prism-lens"}),null);
});

test("equal-priority strikes interleave West then East with alternating first side; switches, cover and calls precede them",()=>{
  const p=start();
  for(const [i,pos] of [[0,p],[1,round(p,call,call).pos]]){
    const a=round(pos,[hit(pos,0,0,0),hit(pos,0,1,1)],[hit(pos,1,0,0),hit(pos,1,1,1)]);
    assert.deepEqual(plain(attacks(a).map(e=>[e.side,e.lane])),[[i,0],[1-i,0],[i,1],[1-i,1]]);
  }
  const changed=round(p,[hit(p,0,0,0),"call:0"],["swap:glimmeray","cover:0"]);
  assert.deepEqual(plain(changed.events.map(e=>e.kind)),["swap","cover","call","attack"]);
  const contact=attacks(changed)[0];
  assert.equal(contact.targetId,"glimmeray");assert.equal(contact.exposed,true);
  assert.equal(contact.damage,Math.round(normal(p,"dewfin","glimmeray","bubble-jet")*1.5));
  assert.equal(holder(changed.pos,1,"cindlet").hp,holder(p,1,"cindlet").maxHp);
});

test("cover halves all incoming hits to its lane; matching a partner's Call pierces it for that strike and expires this round",()=>{
  const p=start(),a=hit(p,0,0,0),b=hit(p,0,1,0);
  const bare=round(p,[a,b],call),covered=round(p,[a,b],["cover:0","cover:0"]);
  assert.deepEqual(plain(attacks(covered).map(e=>e.damage)),plain(attacks(bare).map(e=>Math.round(e.damage*.5))));
  const correct=round(p,[a,"call:0"],["cover:0","cover:0"]);
  const wrong=round(p,[a,"call:1"],["cover:0","cover:0"]);
  assert.equal(attacks(correct)[0].damage,Math.round(attacks(bare)[0].damage*1.5));
  assert.equal(attacks(correct)[0].exposed,true);assert.equal(attacks(wrong)[0].exposed,false);
  assert.equal(attacks(wrong)[0].damage,attacks(covered)[0].damage);
  const unused=round(p,["call:0","cover:1"],call),later=round(unused.pos,[a,b],["cover:0","cover:0"]);
  assert.ok(attacks(later).every(e=>e.exposed===false));assert.equal(holder(unused.pos,1,"cindlet").exposed,undefined);
  assert.equal(order(p,0,0,a,[null,"call:0"]).damage,attacks(correct)[0].damage);
});

test("all six active duets spend only opening beats, keep the other kin's order and produce their real positional effect",()=>{
  const roles=["ward","mend","relay","lure","mark","rush"];
  for(const role of roles){
    const mate=Object.values(species).find(k=>!k.bonus&&k.id!=="dewfin"&&!["sprigkit","cindlet"].includes(k.id)&&window.WilderDuets.score("Tide",k.type).role===role);
    const left=["dewfin",mate.id,"sprigkit","cindlet"],right=["mossbell","pincoil","coalmoth","glimmeray"];
    const open=start(left,right,{dewfin:"opening-pennant"}),p=round(open,["cover:0","cover:1"],[hit(open,1,0,0),hit(open,1,1,1)]).pos;
    const rival=["cover:0",hit(p,1,1,0)],east=hit(p,0,1,1);
    const result=round(p,["duet:0",east],rival),move=result.events.find(e=>e.kind==="duet");
    assert.equal(move.role,role);assert.equal(result.pos.sides[0].beats,3-window.WilderDuets.score("Tide",mate.type).cost);
    assert.ok(result.events.some(e=>e.kind==="attack"&&e.actor===mate.id&&e.side===0));
    const reply=attacks(result).find(e=>e.side===1);
    const pair=window.WilderDuets.score("Tide",mate.type);
    if(["ward","relay","lure"].includes(role)){
      const subject=role==="relay"?mate.id:"dewfin";
      const ability=rival[1].split(":")[1];assert.equal(reply.targetId,subject);
      assert.equal(reply.damage,Math.max(1,Math.round(normal(p,"pincoil",subject,ability)*pair.counter)));
    }
    if(role==="relay")assert.deepEqual(plain(active(result.pos.sides[0])),[mate.id,"dewfin"]);
    if(role==="mend"){
      const healed=result.events.filter(e=>e.kind==="heal");
      assert.equal(healed.length,2);
      for(const h of healed){const kin=holder(p,h.side,h.targetId);assert.equal(h.heal,Math.min(kin.maxHp-kin.hp,Math.ceil(kin.maxHp/4)));}
    }
    if(role==="lure"){
      assert.ok(holder(result.pos,1,"mossbell").hp>0);
      assert.ok(options(result.pos,1,0).filter(m=>m.kind==="swap").every(m=>!m.available));
      const later=round(result.pos,call,call).pos;
      assert.ok(options(later,1,0).some(m=>m.kind==="swap"&&m.available));
    }
    if(role==="mark"){
      assert.equal(holder(result.pos,1,"mossbell").exposed,true);
      const off=round(result.pos,call,["swap:coalmoth","cover:1"]).pos;
      assert.equal(holder(off,1,"mossbell").exposed,true);
      const back=round(off,call,["swap:mossbell","cover:1"]).pos;
      const once=round(back,[hit(back,0,0,0),hit(back,0,1,0)],["cover:0","cover:1"]);
      assert.deepEqual(plain(attacks(once).filter(e=>e.side===0).map(e=>e.exposed)),[true,false]);
      assert.equal(holder(once.pos,1,"mossbell").exposed,undefined);
    }
    if(role==="rush"){
      const unguarded=round(p,["duet:0",east],["call:1",rival[1]]);
      assert.equal(move.damage,unguarded.events.find(e=>e.kind==="duet").damage);
    }
  }
});

test("held fittings trigger once on the appropriate hit, call, incoming switch or reserve care",()=>{
  const right=["pincoil","glimmeray","cindlet","mossbell"],left=["glimmeray","dewfin","cindlet","thicketowl"];
  const lens=start(left,right,{glimmeray:"prism-lens"});
  const rushed=round(lens,[hit(lens,0,0,0),"cover:1"],call);
  const neutral=Math.round(species.glimmeray.skills.find(s=>s.id==="lunar-surge").power+7.05);
  assert.equal(attacks(rushed)[0].damage,neutral);
  assert.deepEqual(plain(gearEvents(rushed).map(e=>e.gearId)),["prism-lens"]);
  const later=round(rushed.pos,[hit(rushed.pos,0,0,0),"cover:1"],call);
  assert.ok(attacks(later)[0].damage<neutral);assert.equal(gearEvents(later).length,0);

  const hook=start(lIds,rIds,{dewfin:"seam-hook"},{cindlet:"opening-pennant"});
  const hooked=round(hook,[hit(hook,0,0,0),"call:0"],["cover:0",hit(hook,1,1,1)]);
  assert.equal(hooked.pos.sides[1].beats,0);assert.ok(attacks(hooked).find(e=>e.side===0).exposed);
  assert.ok(gearEvents(hooked).some(e=>e.gearId==="seam-hook"&&e.actor==="dewfin"));
  const unopened=round(hook,[hit(hook,0,0,0),"call:1"],["cover:0",hit(hook,1,1,1)]);
  assert.equal(unopened.pos.sides[1].beats,2);assert.equal(holder(unopened.pos,0,"dewfin").spent,false);

  const medicine=["dewfin","cindlet","thicketowl","cairnwatch"];
  const fitted=start(medicine,right,{thicketowl:"mender-wrap",cairnwatch:"relay-bell"});
  const ring=round(fitted,["swap:cairnwatch",hit(fitted,0,1,0)],call);
  assert.equal(ring.pos.sides[0].beats,2);assert.equal(holder(ring.pos,0,"cairnwatch").spent,true);
  const injured=round(fitted,call,[hit(fitted,1,0,0),hit(fitted,1,1,1)]).pos;
  const retired=round(injured,["swap:thicketowl","swap:cairnwatch"],call).pos;
  assert.equal(retired.sides[0].beats,3);assert.equal(holder(retired,0,"cairnwatch").spent,false,"full meter preserves the bell");
  const bench=retired.sides[0].team.filter(x=>["dewfin","cindlet"].includes(x.id)).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp);
  assert.ok(bench.every(k=>k.hp<k.maxHp));
  const recovery=round(retired,["cover:1",hit(retired,0,1,0)],call);
  const heal=recovery.events.find(e=>e.kind==="heal");
  assert.equal(heal.targetId,bench[0].id);assert.equal(heal.heal,Math.min(bench[0].maxHp-bench[0].hp,Math.ceil(bench[0].maxHp/5)));
  assert.ok(gearEvents(recovery).some(e=>e.gearId==="mender-wrap"));
  assert.equal(holder(recovery.pos,0,bench[1].id).hp,bench[1].hp);
});

test("optional animation frames preserve the historical event, HP and lane order through a stitch, fall, and free promotion",()=>{
  const left=["dewfin","glimmeray","mossbell","pincoil"],right=["cindlet","sprigkit","coalmoth","gustlance"];
  let p=start(left,right,{},{cindlet:"last-stitch"}),sawGear=false,sawFall=false;
  for(let i=0;i<5&&!sawFall;i++){
    const ours=[hit(p,0,0,0),hit(p,0,1,0)],theirs=["cover:1","cover:1"];
    const normal=round(p,ours,theirs),animated=round(p,ours,theirs,{frames:true});
    assert.equal(normal.frames,undefined);
    assert.deepEqual(plain(animated.pos),plain(normal.pos));assert.deepEqual(plain(animated.events),plain(normal.events));
    assert.deepEqual(plain(animated.frames.map(f=>f.event)),plain(normal.events));
    assert.deepEqual(plain(animated.frames.at(-1).pos),plain(normal.pos));
    for(const frame of animated.frames){
      assert.notEqual(frame.pos.sides,normal.pos.sides);assert.notEqual(frame.pos.sides[1].team,normal.pos.sides[1].team);
      if(frame.event.kind==="gear"&&frame.event.gearId==="last-stitch")sawGear=true;
      if(frame.event.kind==="attack"&&frame.event.targetId==="cindlet"){
        if(sawGear&&!sawFall&&holder(frame.pos,1,"cindlet").hp===1)assert.ok(holder(frame.pos,1,"cindlet").spent);
      }
    }
    const gone=animated.frames.findIndex(f=>f.event.kind==="fall"&&f.event.targetId==="cindlet");
    if(gone>=0){
      sawFall=true;const first=animated.frames.find(f=>f.event.kind==="attack"&&holder(f.pos,1,"cindlet").hp===1);
      assert.ok(first,"stitch holds at one HP for the first hit");
      assert.equal(lane(first.pos,1,0).id,"cindlet");assert.equal(holder(animated.frames[gone].pos,1,"cindlet").hp,0);
      const replacement=animated.frames.find(f=>f.event.kind==="promote");
      assert.equal(replacement.event.targetId,"coalmoth");assert.equal(lane(replacement.pos,1,0).id,"coalmoth");
      assert.equal(holder(replacement.pos,1,"coalmoth").hp,holder(replacement.pos,1,"coalmoth").maxHp);
      assert.ok(gone<animated.frames.indexOf(replacement));
      replacement.pos.sides[1].team[0].hp=24;replacement.pos.sides[1].active.reverse();
      assert.equal(holder(first.pos,1,"cindlet").hp,1);assert.equal(lane(first.pos,1,0).id,"cindlet");
      assert.equal(holder(animated.pos,1,"cindlet").hp,0);assert.equal(lane(animated.pos,1,0).id,"coalmoth");
    }
    p=normal.pos;
  }
  assert.ok(sawGear&&sawFall);
});

test("the final bell judges standing count before HP proportions and reports an exact draw when they are equal",()=>{
  const share=s=>s.team.reduce((a,k)=>a+k.hp/k.maxHp,0);
  function wait(p){while(p.round<24)p=round(p,call,call).pos;return p;}
  const capped=wait(start());
  const draw=round(capped,call,call,{frames:true});assert.equal(draw.pos.phase,"done");assert.equal(draw.pos.round,24);
  assert.equal(draw.pos.winner,"draw");assert.equal(draw.frames.at(-1).pos.winner,"draw");
  assert.equal(sim.resolve(draw.pos,call,call),null);assert.deepEqual(plain(sim.coach(draw.pos,0)),[null,null]);
  const hp=round(capped,[hit(capped,0,0,0),"cover:0"],call).pos;
  assert.equal(hp.winner,0);assert.ok(hp.sides.every(s=>s.team.every(k=>k.hp>0)));

  let p=start(["dewfin","glimmeray","mossbell","pincoil"],["cindlet","coalmoth","sprigkit","thicketowl"]);
  while(holder(p,1,"cindlet").hp)p=round(p,[hit(p,0,0,0),hit(p,0,1,0)],call).pos;
  while(share(p.sides[0])>=share(p.sides[1])){
    let best=null;
    for(const a of options(p,1,0).filter(m=>m.available&&m.kind==="attack"))
      for(const b of options(p,1,1).filter(m=>m.available&&(m.kind==="attack"||m.kind==="cover"))){
        const q=sim.resolve(p,call,[a.id,b.id]).pos;
        if(q.sides[0].team.some(k=>!k.hp)||share(q.sides[0])>=share(p.sides[0]))continue;
        if(!best||share(q.sides[0])<share(best.sides[0]))best=q;
      }
    assert.ok(best,"obtain a real four-standing side with lower total health");p=best;
  }
  const score=round(wait(p),call,call).pos;
  assert.deepEqual(plain(score.sides.map(s=>s.team.filter(k=>k.hp>0).length)),[4,3]);
  assert.ok(share(score.sides[0])<share(score.sides[1]));assert.equal(score.winner,0);
});

test("both coaches can complete matches without a player draft, including a single surviving lane",()=>{
  const players=[lIds,["gustlance","kilnbeak","arcbill","iceribbon"],["smelteroll","ironblink","brookpeep","sprigkit"],["mossbell","pincoil","cindlet","dewfin"]];
  const original=JSON.stringify(g.state);let n=0;
  for(const a of players)for(const b of players){
    let p=start(a,b,{[a[0]]:"opening-pennant",[a[2]]:"relay-bell"},{[b[1]]:"prism-lens",[b[0]]:"last-stitch"});
    const book=[];
    while(p.phase==="plan"){
      const both=[sim.coach(p,0),sim.coach(p,1)];
      assert.deepEqual(plain(sim.coach(p,1)),plain(both[1]));
      for(const [seat,orders] of both.entries())for(const [i,id] of orders.entries()){
        if(p.sides[seat].active[i]===null){assert.equal(id,null);n++;}
        else assert.ok(order(p,seat,i,id,orders)?.available);
      }
      p=round(p,...both).pos;book.push(both);assert.ok(book.length<=24);
    }
    assert.ok([0,1,"draw"].includes(p.winner));
    if(p.round<24)assert.ok(p.sides.some(s=>s.team.every(k=>!k.hp)));
  }
  assert.ok(n>0);assert.equal(JSON.stringify(g.state),original);assert.deepEqual(writes,[]);
});
