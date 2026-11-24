const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const scripts=["atlas","bestiary","activities","campaign","story","duets","sparring-gear","sparring-signatures","sparring-battle","sparring-teams","engine","bellpost-rules","rental-cards","twin-battle","twin-match","twin-ring"].map(n=>{
  const file=path.join(__dirname,"../games/wilderkin",n+".js");return new vm.Script(fs.readFileSync(file,"utf8"),{filename:file});
});
const plain=x=>JSON.parse(JSON.stringify(x));
function start(store=new Map(),motion){
  const timers=new Map();let nextTimer=0,away=false;
  const w=motion===undefined?{}:{matchMedia:()=>({matches:motion==="reduce"}),setTimeout:(fn,delay)=>{timers.set(++nextTimer,{fn,delay});return nextTimer;},clearTimeout:id=>timers.delete(id)};
  const ctx=vm.createContext({window:w});scripts.forEach(s=>s.runInContext(ctx));
  const game=w.WilderGame,library=w.WilderRentalCards.create({game,storage:null}),sim=w.WilderTwinBattle.create({game});
  const storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
  const desk=w.WilderTwinMatch.create({game,library,sim,storage});if(!desk.read())desk.start();
  const alerts=[];let view="ring",atSetup=false;
  const room=w.WilderTwinRing.create({game,...(motion!==undefined?{active:v=>!away&&view===v}:{}),read:desk.read,commit:desk.commit,image:id=>"portrait/"+id,row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),
    go:(route,n)=>{assert.equal(route,"twinbell");view=n;},notify:m=>alerts.push(m),onSetup:()=>{atSetup=true;},onRematch:()=>{assert.ok(desk.rematch().ok);view="ring";}});
  const model=()=>room.model(view),rows=()=>model().sections.flatMap(s=>s.rows||[]);
  const find=(id,value)=>rows().find(r=>r.id==="twin-"+id&&(value===undefined||r.value===value));
  const click=(id,value)=>{const r=find(id,value);assert.ok(r&&!r.disabled,[id,value,view,JSON.stringify(rows())].join(" / "));assert.equal(room.act(r.id,r.value,view),true);};
  const key=k=>{model();assert.ok(room.key({key:k},view),k+" in "+view);};
  return {w,game,library,sim,desk,room,model,rows,find,click,key,alerts,view:()=>view,atSetup:()=>atSetup,store,timers,away:()=>{away=true;},
    tick:()=>{const [id,t]=timers.entries().next().value;timers.delete(id);t.fn();}};
}
function choose(h,lane,id){
  if(h.view()!=="moves:"+lane)h.click("lane",lane);
  if(!id.startsWith("attack:"))h.click("tactic",lane+"|"+id.split(":")[0]);h.click("pick",lane+"|"+id);
}

test("both opposing names, targets and portraits are declared before ordering; keyboard can amend both sides of a coordinated call",()=>{
  const h=start(),r=h.desk.read(),first=h.model();assert.ok(/Round 1/.test(first.title));assert.ok(h.find("round").disabled);
  assert.deepEqual(plain(first.twinField.left.map(k=>[k.name,k.hp,k.maxHp,k.action.value])),[["Dewfin",75,75,0],["Thicketowl",77,77,1]]);
  assert.deepEqual(plain(first.twinField.right.map(k=>k.name)),["Pincoil","Coalmoth"]);
  assert.deepEqual(plain(first.sections[0].rows.map(r=>r.detail)),["Coil Snap → West · Dewfin · 26 projected","Flare Wing → East · Thicketowl · 26 projected"]);
  h.key("1");assert.match(h.model().subtitle,/Pincoil.+Coil Snap.+this lane/);
  assert.ok(h.find("tactic","0|duet").disabled);assert.match(h.find("pick","0|attack:bubble-jet:1").detail,/24 damage.+74 HP now/);
  h.key("2");assert.equal(h.view(),"moves:1");h.key("C");assert.equal(h.view(),"target:1:cover");
  const ally=h.model().twinField.left[0].action;assert.equal(ally.id,"twin-pick");h.room.act(ally.id,ally.value,h.view());
  assert.equal(h.view(),"ring");assert.deepEqual(plain(h.desk.read().pos),plain(r.pos));assert.deepEqual(plain(h.desk.read().rivalOrders),plain(r.rivalOrders));
  h.key("2");h.key("X");assert.ok(h.find("round").disabled);h.key("2");h.key("L");h.key("2");
  assert.match(h.find("lane",0).detail,/36 projected/);assert.match(h.find("lane",1).detail,/Coalmoth/);
  h.key("R");assert.equal(h.desk.read().pos.round,2);
  h.click("log",1);assert.match(h.model().sections.find(s=>s.title==="In order").rows[1].label,/Bubble Jet.+36 HP through the opening/);
});

test("invalid concurrent reserves and unpaired duets remain disabled; damaged reserves, gear and round reports survive a reload",()=>{
  const h=start();choose(h,0,"swap:cairnwatch");h.click("tactic","1|swap");
  assert.ok(h.find("pick","1|swap:cairnwatch").disabled);h.click("pick","1|swap:kilnclaw");h.click("round");
  assert.equal(h.desk.read().pos.sides[0].beats,3);h.click("team");
  const held=h.rows().find(r=>r.label==="Cairnwatch");assert.match(held.detail,/Relay Bell.+used/);assert.equal(held.badge,"West lane");h.click("ring");
  const j=start(h.store);assert.equal(j.model().title,"Round 2");
  assert.deepEqual(plain(j.desk.read().pos),plain(h.desk.read().pos));
  choose(j,0,"duet:0");assert.ok(j.find("tactic","1|swap").disabled);assert.match(j.find("tactic","1|swap").detail,/duet partners must stay/);
  const l=start(j.store);assert.match(l.find("lane",0).detail,/→ West/);assert.ok(l.find("round").disabled);
  l.click("lane",0);l.click("clear",0);assert.deepEqual(plain(l.desk.read().draft),[null,null]);
});

test("natural paired orders play to an earned keeper bell, preserve all earlier round reports, and rematch from full health",()=>{
  const h=start(),career=JSON.stringify(h.game.state);let promoted=false,firstReport;
  while(h.desk.read().pos.phase==="plan"){
    const r=h.desk.read();assert.ok(r.history.length<24);
    const orders=r.pos.round===1?["attack:bubble-jet:1","call:1"]:h.sim.coach(r.pos,0);
    for(const [i,id] of orders.entries())if(id)choose(h,i,id);
    h.click("round");const next=h.desk.read();promoted||=next.lastEvents.some(e=>e.kind==="promote");
    if(!firstReport)firstReport=plain(next.lastEvents.map(e=>e.text));
  }
  const end=h.desk.read(),rounds=end.history.length;assert.equal(h.view(),"result");assert.equal(end.pos.winner,0);
  assert.ok(h.model().sections.some(s=>s.title==="Willow Bell"));assert.ok(promoted);assert.ok(rounds>1);
  h.click("log",rounds);while(h.find("log",Number(h.view().split(":")[1])-1))h.click("log",Number(h.view().split(":")[1])-1);
  assert.deepEqual(plain(h.model().sections.find(s=>s.title==="In order").rows.map(q=>q.label)),firstReport);h.click("ring");
  h.click("rematch");assert.equal(h.model().title,"Round 1");assert.ok(h.desk.read().pos.sides.every(s=>s.team.every(k=>k.hp===k.maxHp)));
  assert.equal(h.desk.read().marks.willow.rounds,rounds);h.click("setup");assert.ok(h.atSetup());assert.equal(JSON.stringify(h.game.state),career);
});

test("older tab cannot apply an obsolete lane order after another tab changes the draft",()=>{
  const h=start(),j=start(h.store);h.click("lane",0);const old=h.find("pick","0|attack:bubble-jet:1");
  j.click("lane",0);j.click("pick","0|attack:bubble-jet:0");
  h.room.act(old.id,old.value,h.view());assert.match(h.alerts.at(-1),/changed/);
  assert.equal(h.view(),"ring");assert.deepEqual(plain(h.desk.read().draft),["attack:bubble-jet:0",null]);
});

test("live playback advances one real event/HP change, pauses, resumes, and leaves committed orders saved only once",()=>{
  const h=start(new Map(),"normal");
  choose(h,0,"attack:bubble-jet:1");choose(h,1,"call:1");h.click("round");assert.equal(h.view(),"reveal");
  const frame1=h.model();assert.match(frame1.subtitle,/called Coalmoth/);assert.deepEqual(plain(frame1.twinField.focus),{side:"left",lane:1});
  assert.deepEqual(plain(frame1.twinField.target),{side:"right",lane:1});assert.equal(frame1.twinField.right[1].hp,74);
  assert.equal(h.timers.size,1);h.tick();const frame2=h.model();assert.match(frame2.subtitle,/36 HP/);assert.equal(frame2.twinField.right[1].hp,38);
  h.click("pause");assert.equal(h.find("pause").label,"Play automatically");assert.equal(h.timers.size,0);
  h.click("next");assert.equal(h.model().twinField.left[0].hp,49);h.click("pause");h.model();
  assert.ok(h.timers.size);h.click("skip");assert.equal(h.view(),"ring");assert.equal(h.timers.size,0);
  assert.deepEqual(plain(h.desk.read().draft),[null,null]);assert.equal(h.desk.read().history.length,1);
  assert.equal(start(h.store,"normal").model().title,"Round 2");
});

test("reduced motion goes directly to planning, lets the player step through a report, and an abandoned timer cannot reopen the ring",()=>{
  const h=start(new Map(),"reduce");choose(h,0,"attack:bubble-jet:1");choose(h,1,"call:1");h.click("round");
  assert.equal(h.view(),"ring");h.click("log",1);h.click("watch",1);assert.equal(h.view(),"reveal");
  assert.equal(h.model().twinField.right[1].hp,74);assert.equal(h.find("pause"),undefined);assert.equal(h.timers.size,0);
  for(let i=0;i<4;i++)h.click("next");assert.equal(h.view(),"log:1");assert.equal(h.desk.read().history.length,1);
  const a=start(h.store,"normal");a.click("log",1);a.click("watch",1);const first=a.model();a.away();a.tick();
  assert.equal(a.timers.size,0);assert.equal(a.view(),"reveal");assert.equal(a.model().title,"Round 2");assert.equal(first.title,"Round 1 · at the bell");
  const b=start(h.store,"normal");b.click("log",1);b.click("watch",1);b.model();
  const other=start(h.store);other.click("lane",0);other.click("pick","0|attack:bubble-jet:1");b.tick();
  assert.equal(b.timers.size,0);assert.equal(b.model().title,"Round 2");
});
