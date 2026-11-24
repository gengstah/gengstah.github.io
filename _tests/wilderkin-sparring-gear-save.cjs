const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const scripts=["atlas","bestiary","activities","story","campaign","duets","sparring-gear","sparring-battle","sparring-teams",
  "sparring","sparring-review","engine"].map(name=>{
  const file=path.join(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(fs.readFileSync(file,"utf8"),{filename:file});
});
const copy=x=>JSON.parse(JSON.stringify(x)),tick=()=>new Promise(resolve=>setImmediate(resolve));
const LEFT={sprigkit:"opening-pennant",cindlet:"relay-bell",dewfin:"last-stitch"};
const BELL={mossbell:"opening-pennant",coalmoth:"prism-lens",glimmeray:"mender-wrap"};
function boot(raw,animate){
  let stored=raw,target=null;
  const w={localStorage:{getItem:k=>k==="wilderkin.trail.v3"?stored:null,setItem:(_,v)=>{stored=v;}}};
  const ctx=vm.createContext({window:w});for(const s of scripts)s.runInContext(ctx);
  const g=w.WilderGame,sim=w.WilderSparringBattle.create({game:g});
  const row=(id,label,value,detail,extras)=>({id,label,value,detail,...extras});
  const hall=w.WilderSparring.create({game:g,row,image:id=>id,go:(name,view)=>{target=view;},render(){},notify(){},animate});
  const record=()=>g.state.sparring,review=w.WilderSparringReview.create({game:g,row,read:()=>hall.reviewRecord()});
  const model=v=>hall.model(v??target),rows=v=>model(v).sections.flatMap(x=>x.rows||[]);
  function click(id,value){
    const opt=rows().find(x=>x.id===id&&(value===undefined||value===x.value));
    assert.ok(opt&&!opt.disabled,id+"/"+value+" offered on "+model().title);assert.ok(hall.act(opt.id,opt.value));
  }
  function pos(){
    const m=record().match,s=m.setup;
    let p=sim.start(s.left,s.right,m.first,s.gear);
    for(const id of m.moves)p=sim.apply(p,id);return p;
  }
  return {g,sim,hall,review,record,model,rows,click,pos,stored:()=>stored,reload:()=>boot(stored),
    restore:s=>w.WilderSparring.restore(s,{species:g.species})};
}
function equip(h){
  for(const [slot,id] of Object.values(LEFT).entries())h.hall.act("spar-team-equip","left:"+slot+":"+id);
  assert.deepEqual(copy(h.record().setup.gear.left),LEFT);
}
async function finish(h){
  for(let i=0;h.pos().phase!=="done"&&i<80;i++){
    if(h.record().match.handoff)h.click("spar-ready");
    const p=h.pos();
    if(h.record().match.setup.mode==="cpu"&&p.turn===1){h.click("spar-cpu");await tick();continue;}
    const opt=h.sim.recommend(p);
    if(["swap","duet"].includes(opt.kind))h.click("spar-view","cmd:"+opt.kind);
    h.click("spar-move",opt.id);await tick();
  }
  assert.equal(h.pos().phase,"done");
}
function bareCampaign(h){const s=copy(h.g.state);delete s.sparring;return s;}
test("four rival equipment packs are opt-in, previewed by wearer, removable, and never overwrite the player’s equipment",()=>{
  const h=boot();assert.equal(h.record().setup.gear,undefined);equip(h);
  for(const rival of ["bell-keepers","wind-post","night-orchard","red-foundry"]){
    h.hall.act("spar-team-rival",rival);assert.deepEqual(copy(h.record().setup.gear.right),{});
    h.click("spar-crew-kit","equip");
    const s=h.record().setup;
    assert.deepEqual(copy(s.gear.left),LEFT);
    assert.deepEqual(Object.keys(s.gear.right).sort(),Array.from(s.right).sort());
    assert.ok(h.sim.start(s.left,s.right,0,s.gear));
    if(rival==="bell-keepers")assert.deepEqual(copy(s.gear.right),BELL);
    assert.ok(h.rows().some(r=>r.id==="spar-crew-kit"&&r.value==="remove"));
    h.click("spar-crew-kit","remove");assert.deepEqual(copy(h.record().setup.gear.right),{});
    assert.deepEqual(copy(h.record().setup.gear.left),LEFT);
  }
});
test("a saved human swap and both opening pennants reconstruct exactly once, including an interrupted CPU reply and an exact alternate review",async()=>{
  let held;
  const h=boot(undefined,()=>new Promise(resolve=>{held=resolve;})),original=bareCampaign(h);
  equip(h);h.hall.act("spar-team-rival","bell-keepers");h.click("spar-crew-kit","equip");h.click("spar-start");
  let p=h.pos();
  assert.deepEqual(copy(h.model().ally.gear),{id:"opening-pennant",name:"Opening Pennant",spent:true});
  assert.deepEqual(copy(h.model().foe.gear),copy(h.model().ally.gear));assert.equal(p.sides[0].beats,1);assert.equal(p.sides[1].beats,1);
  assert.ok(JSON.stringify(h.model("coach")).includes("Opening Pennant"));
  h.click("spar-view","equipment");
  const holders=h.model().sections.flatMap(s=>s.rows||[]).filter(r=>r.badge==="USED"||r.badge==="READY");
  assert.equal(holders.length,6);assert.equal(holders.filter(r=>r.badge==="USED").length,2);
  h.click("spar-view","match");
  h.click("spar-view","cmd:swap");h.click("spar-move","swap:cindlet");
  p=h.pos();assert.equal(p.ply,1);assert.ok(p.sides[0].team[1].spent);
  const resumed=h.reload();resumed.click("spar-view","match");
  assert.deepEqual(copy(resumed.pos()),copy(p));
  assert.equal(resumed.model().ally.gear.id,"relay-bell");assert.ok(resumed.model().ally.gear.spent);
  resumed.click("spar-cpu");await tick();assert.equal(resumed.pos().turn,0);
  await finish(resumed);
  assert.deepEqual(copy(resumed.hall.reviewRecord().gear),{left:LEFT,right:BELL});
  const parts=resumed.model().sections.find(s=>s.title==="Equipment report").rows;
  assert.equal(parts.length,6);assert.ok(parts.some(x=>x.label.includes("Relay Bell")&&x.detail.includes("Action 1")));
  assert.ok(parts.some(x=>x.detail.includes("opening bell")));
  const tape=copy(resumed.hall.reviewRecord()),after=resumed.reload();
  assert.deepEqual(copy(after.hall.reviewRecord()),tape);assert.ok(after.review.valid(tape));
  const initial=after.sim.start(tape.left,tape.right,tape.first,tape.gear);
  const alt=after.sim.forecast(initial,"skill:leaf-flurry"),next=after.sim.apply(initial,alt.id),reply=after.sim.recommend(next),end=after.sim.apply(next,reply.id);
  const turn=after.review.model("t0");assert.match(JSON.stringify(turn),/Opening Pennant used/);
  const branch=after.review.model("a0/skill:leaf-flurry"),gap=branch.sections.find(s=>s.title==="Equipment after the exchange");
  assert.ok(gap.rows.some(r=>r.label.includes("Cindlet")&&r.label.includes("Relay Bell")&&r.detail.includes("Still ready in this variation")));
  assert.ok(JSON.stringify(branch).includes(end.sides[0].team[end.sides[0].active].hp+"/"+end.sides[0].team[end.sides[0].active].maxHp+" HP"));
  after.click("spar-view","result");after.click("spar-rematch");await tick();
  assert.equal(after.pos().first,1);assert.deepEqual(copy(after.record().match.setup.gear),tape.gear);
  assert.equal(after.pos().sides[0].team[1].spent,false);assert.ok(after.pos().sides[0].team[0].spent);
  assert.deepEqual(copy(after.hall.reviewRecord()),tape);assert.deepEqual(bareCampaign(after),original);held();
});
test("a guest kit is previewed and explicitly accepted without carrying over an earlier rival’s gear, and local rematches rearm",async()=>{
  const h=boot();equip(h);h.hall.act("spar-team-rival","bell-keepers");h.click("spar-crew-kit","equip");
  const before=copy(h.record().setup);
  assert.ok(h.hall.loadFragment("#spar-v2=dewfin~last-stitch,pincoil~opening-pennant,cindlet~relay-bell"));
  assert.match(JSON.stringify(h.model("guest")),/Lifeline Stitch/);
  assert.deepEqual(copy(h.record().setup),before);h.hall.act("spar-accept");
  const guest={dewfin:"last-stitch",pincoil:"opening-pennant",cindlet:"relay-bell"};
  assert.deepEqual(copy(h.record().setup.gear),{left:LEFT,right:guest});assert.equal(h.record().setup.rival,"shared");
  h.hall.act("spar-mode","local");h.click("spar-start");h.click("spar-view","cmd:swap");h.click("spar-move","swap:cindlet");await tick();
  assert.ok(h.record().match.handoff);
  const next=h.reload();next.click("spar-view","match");assert.equal(next.model().title,"Pass to Player 2");
  assert.ok(next.pos().sides[0].team[1].spent);await finish(next);assert.equal(next.hall.reviewRecord(),null);
  next.click("spar-rematch");assert.deepEqual(copy(next.record().match.setup.gear.right),guest);assert.equal(next.pos().first,1);
  assert.equal(next.pos().sides[0].team[1].spent,false);assert.equal(next.pos().sides[1].team[1].spent,false);
  next.hall.act("spar-retire");assert.ok(next.hall.loadFragment("#spar-v1=dewfin,pincoil,cindlet"));next.hall.act("spar-accept");
  assert.deepEqual(copy(next.record().setup.gear),{left:LEFT,right:{}});
});
test("legacy recordings replay bare even beside a newly equipped builder, and corrupted equipped tapes cannot silently become bare",async()=>{
  const h=boot();h.click("spar-mode","cpu");h.click("spar-start");await finish(h);
  const legacy=copy(h.record());assert.ok(!Object.hasOwn(legacy.lastReview,"gear"));
  const old=copy(legacy.match);const bare=copy(h.pos());equip(h);h.hall.act("spar-team-rival","bell-keepers");h.click("spar-crew-kit","equip");
  const reloaded=h.reload();
  assert.deepEqual(copy(reloaded.record().match),old);assert.deepEqual(copy(reloaded.pos()),bare);
  assert.ok(!Object.hasOwn(reloaded.hall.reviewRecord(),"gear"));assert.ok(!JSON.stringify(reloaded.review.model("t0")).includes("Pennant"));
  assert.deepEqual(copy(reloaded.record().setup.gear),{left:LEFT,right:BELL});
  const invalid={left:{sprigkit:"opening-pennant",cindlet:"opening-pennant"},right:{}};
  const broken=copy(legacy);
  broken.match.setup.gear=invalid;broken.lastReview.gear=invalid;
  assert.equal(h.restore(broken).match,null);assert.equal(h.restore(broken).lastReview,null);
  assert.equal(h.review.valid(broken.lastReview),false);
});
