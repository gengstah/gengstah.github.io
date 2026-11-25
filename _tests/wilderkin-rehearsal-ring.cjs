const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const modules=["atlas","bestiary","call-habitats","wild-calls","activities","story","campaign","duets","growth","wardens","sparring-gear",
  "trail-fittings","fitting-notes","engine","rehearsal-core","rehearsal-ring"];
const scripts=modules.map(id=>new vm.Script(fs.readFileSync(path.join(__dirname,"../games/wilderkin",id+".js"),"utf8"),{filename:id+".js"}));
function station(){
  const disk=new Map(),window={localStorage:{getItem:k=>disk.get(k)||null,setItem:(k,v)=>disk.set(k,v)}},ctx=vm.createContext({window});
  scripts.forEach(s=>s.runInContext(ctx));
  const g=window.WilderGame,p=window.WilderRehearsal.create({game:g}),effects=[],messages=[];
  let current=null,exits=0,compared=null;
  const ring=window.WilderRehearsalRing.create({game:g,practice:p,row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),
    image:id=>"art/"+id+".png",go:(screen,v)=>{assert.equal(screen,"rehearsal-ring");current=v;},render:()=>{},notify:s=>messages.push(s),
    animate:async f=>{effects.push(f);},onExit:()=>{exits++;},onCompare:options=>{compared=options;}});
  const model=()=>ring.model(current),rows=()=>model().sections.flatMap(s=>s.rows||[]),tick=()=>new Promise(resolve=>setImmediate(resolve));
  const press=async(id,value)=>{
    const r=rows().find(r=>r.id===id&&(value===undefined||r.value===value));
    assert.ok(r&&!r.disabled,JSON.stringify({current,id,value,rows:rows().map(v=>[v.id,v.value,v.disabled])}));
    assert.ok(ring.act(r.id,r.value,current));await tick();
  };
  const start=(lead="sprigkit",foe="mossbell",team)=>assert.ok(p.start({kind:"wild",foe,region:0,lead,...(team?{team}:{})}).ok);
  return {g,p,ring,model,rows,press,start,tick,effects,messages,view:()=>current,exits:()=>exits,compared:()=>compared};
}
const cmd=(h,id)=>h.press("rehearse-move",id),open=(h,id)=>h.press("rehearse-view",id);
async function win(h){
  for(let n=0;h.p.read().phase==="battle"&&n<40;n++){
    const g=h.p.read().game,b=g.state.battle,repl=g.replacements();
    if(repl){await cmd(h,"replaceFainted|"+repl.options[0].id);continue;}
    const k=g.kin(b.activeId,{owned:true}),pick=k.skills.map(s=>[s,g.ordinaryForecast(s.id)]).filter(([,f])=>f?.available)
      .sort((a,b)=>b[1].damage-a[1].damage||a[1].returnDamage-b[1].returnDamage)[0];
    await cmd(h,"useSkill|"+pick[0].id);
  }
}
test("native ring shows the isolated party, intent, actual damage forecast, ready/used fittings and a real duet",async()=>{
  const h=station();h.g.visitSite("camp");assert.ok(h.g.claimFittings("camp").ok);
  assert.ok(h.g.equipFitting("sprigkit","opening-pennant").ok);assert.ok(h.g.equipFitting("cindlet","relay-bell").ok);
  h.g.state.party[0].hp=3;const campaign=JSON.stringify(h.g.state);
  h.start();let m=h.model();
  assert.equal(m.kind,"battle");assert.equal(m.ally.src,"art/sprigkit.png");assert.equal(m.ally.hp,m.ally.maxHp);
  assert.equal(m.foe.species,"mossbell");assert.equal(m.background,"ui/chalkyard.png");
  assert.equal(m.ally.gear.spent,true);assert.ok(m.log.includes(h.p.read().game.kin("mossbell").name+" prepares "+h.p.read().game.foeIntent().skill.name+"."));
  const guard=h.p.read().game.ordinaryForecast("brush-dash");assert.match(h.rows().find(i=>i.value==="useSkill|brush-dash").detail,new RegExp("Deal "+guard.damage+" · take "+guard.returnDamage));
  await open(h,"duets");const r=h.rows().find(r=>r.value==="useDuet|dewfin"&&!r.disabled);
  assert.ok(r);await cmd(h,r.value);assert.ok(h.effects.some(f=>f.kind==="duet"&&f.partner.includes(".png")));
  await open(h,"switches");await cmd(h,"swap|cindlet");m=h.model();
  assert.equal(m.ally.gear.spent,true);assert.ok(h.effects.some(f=>f.kind==="fitting"&&f.item==="relay-bell"));
  assert.equal(JSON.stringify(h.g.state),campaign);
});
test("replaying a turn restores real HP, displays both exchanges and keeps original skill and switch film accessible",async()=>{
  const h=station();h.start("dewfin");const original=h.model(),opts=h.p.read().game.ordinaryForecast("bubble-jet");
  await cmd(h,"useSkill|bubble-jet");
  const [hit,reply]=h.effects;
  assert.equal(hit.impact.ally.hp,original.ally.hp);assert.equal(hit.impact.foe.change,-opts.damage);
  assert.equal(reply.impact.ally.change,-opts.returnDamage);assert.equal(reply.impact.foe.hp,hit.impact.foe.hp);
  assert.equal(h.model().foe.hp,original.foe.hp-opts.damage);
  assert.equal(h.model().sections[1].rows[0].key,"Z");assert.ok(h.ring.key({key:"z"},h.view()));assert.equal(h.model().foe.hp,original.foe.hp);assert.equal(h.model().ally.hp,original.ally.hp);
  assert.ok(h.rows().some(r=>r.label==="Previous · Bubble Jet"&&r.detail.includes(String(original.foe.hp-opts.damage))));
  await open(h,"switches");await cmd(h,"swap|cindlet");
  assert.equal(h.model().ally.name,"Cindlet");assert.ok(h.rows().some(r=>r.label==="Revised · Switch to Cindlet"&&r.detail.includes("took the lead")));
  await open(h,"log");await open(h,"log:0");const film=h.model();assert.match(film.kicker,/TURN 1/);
  assert.equal(film.ally.name,"Dewfin");assert.equal(film.foe.hp,original.foe.hp);
  assert.ok(h.ring.back(h.view()));assert.equal(h.view(),"log");assert.ok(h.ring.back(h.view()));assert.equal(h.view(),"battle");
});
test("a finishing turn can be revised, results retain the frozen lineup and retry starts with fresh gear and supplies",async()=>{
  const h=station(),before=JSON.stringify(h.g.state);h.start("cindlet", "mossbell");
  await win(h);assert.equal(h.model().title,"Practice won");assert.ok(h.rows().some(r=>r.id==="rehearse-rewind"));
  await h.press("rehearse-rewind");assert.ok(h.rows().some(r=>r.label.startsWith("Previous · ")));await win(h);
  assert.equal(h.model().title,"Practice won");assert.ok(h.rows().some(r=>r.label.startsWith("Revised · ")));
  await h.press("rehearse-retry");assert.equal(h.model().ally.name,"Cindlet");assert.equal(h.p.read().game.state.battle.turn,1);
  assert.equal(h.model().ally.hp,h.model().ally.maxHp);assert.equal(h.p.read().canRewind,false);
  await win(h);await h.press("rehearse-compare");assert.equal(h.compared().lead,"cindlet");assert.equal(h.p.read(),null);assert.equal(JSON.stringify(h.g.state),before);
});
test("a forced replacement is free and medicines use the practice copy with a real reply",async()=>{
  const h=station();h.start("dewfin");
  const g=h.p.read().game,career=JSON.stringify(h.g.state);
  g.team().find(k=>k.id==="dewfin").hp=1;
  await cmd(h,"useSkill|bubble-jet");assert.equal(h.model().title,"Choose the next kin");assert.ok(h.rows().some(r=>r.id==="rehearse-rewind"));
  const b=g.state.battle,turn=b.turn;await cmd(h,"replaceFainted|cindlet");
  assert.equal(g.state.battle.turn,turn);assert.equal(h.model().ally.name,"Cindlet");
  g.team().find(k=>k.id==="cindlet").hp-=6;
  await open(h,"medicine");const plan=g.itemForecast("balm","cindlet"),stock=g.state.bag.balm;
  assert.match(h.rows().find(r=>r.value==="useItem|balm|cindlet").detail,new RegExp("Restore "+plan.gain+" HP"));
  await cmd(h,"useItem|balm|cindlet");assert.equal(g.state.bag.balm,stock-1);assert.equal(h.model().ally.hp,plan.activeHpAfter);
  await h.press("rehearse-rewind");assert.equal(g.state.bag.balm,stock);
  h.ring.back(h.view());assert.equal(h.view(),"exit");await h.press("rehearse-leave");
  assert.equal(h.exits(),1);assert.equal(h.p.read(),null);assert.equal(JSON.stringify(h.g.state),career);
});
test("a trained Cinder Handoff spends the outgoing kin’s health before the incoming kin takes the reply",async()=>{
  const h=station(),s=h.g.state;
  s.crests=[0,1];s.visited=[0,1,2];s.growth.cindlet.demonstrated=true;s.growth.cindlet.selected="kindler";
  h.start("cindlet");const g=h.p.read().game;g.state.battle.beats=1;
  const plan=g.skillPreview("cinder-handoff");assert.ok(plan.available);
  await cmd(h,"useSkill|cinder-handoff");
  const [cost,swap,reply]=h.effects;
  assert.equal(cost.impact.ally.id,"cindlet");assert.equal(cost.impact.ally.change,-plan.tax);
  assert.equal(swap.incomingKin.species,"dewfin");assert.equal(swap.impact.ally.change,0);
  assert.equal(reply.impact.ally.id,"dewfin");assert.equal(reply.impact.ally.change,-plan.returnDamage);
});
test("a known Warden brings the campaign lineup and an alternate family lead can rehearse a real handoff",async()=>{
  const h=station();h.g.state.party.push(h.g.loaner("gustlance",6));h.g.state.met.push(0);
  const campaign=JSON.stringify(h.g.state),ids=["gustlance","dewfin","cindlet"];
  assert.ok(h.p.start({kind:"warden",region:0,lead:"gustlance",team:ids}).ok);
  const m=h.model();assert.match(m.title,/Warden Fern/);assert.equal(m.ally.name,"Gustlance");
  const g=h.p.read().game,foe=g.state.battle.enemy.id;
  assert.equal(m.foe.species,foe);assert.deepEqual([foe,...g.state.battle.remaining],Array.from(h.g.wardenRoster(0)));
  await open(h,"tactics");await cmd(h,"useFamilyTechnique|dewfin");
  assert.equal(h.model().ally.name,"Dewfin");assert.equal(g.state.battle.enemy.beaconMarked,true);
  assert.equal(h.effects[0].pass,"beacon");assert.ok(h.model().log.some(s=>s.includes("exposed")));
  assert.equal(JSON.stringify(h.g.state),campaign);
});
