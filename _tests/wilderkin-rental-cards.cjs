const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),{webcrypto}=require("node:crypto");
const scripts=["atlas","bestiary","activities","story","campaign","duets","sparring-gear","sparring-signatures","sparring-battle",
  "sparring-teams","scout-practice","engine","bellpost-rules","scout-rules","rental-cards"].map(name=>{
  const file=path.join(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(fs.readFileSync(file,"utf8"),{filename:file});
});
const plain=x=>JSON.parse(JSON.stringify(x));
function origin(map=new Map()){
  return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),
    key:i=>[...map.keys()][i]??null,get length(){return map.size;}};
}
function boot(storage=origin()){
  const window={localStorage:storage,crypto:{subtle:webcrypto.subtle,getRandomValues(a){
    if(a.length===1){a[0]=1;return a;}return webcrypto.getRandomValues(a);
  }}};
  const ctx=vm.createContext({window});scripts.forEach(s=>s.runInContext(ctx));
  const game=window.WilderGame,desk=window.WilderRentalCards.create({game,storage});
  return {window,game,desk,storage};
}
const starter={name:"Rain & Fire",ids:["dewfin","thicketowl","cindlet","sprigkit"],gear:{dewfin:"opening-pennant",thicketowl:"last-stitch",cindlet:"prism-lens"}};
function saved(res){assert.ok(res.ok,res.message);assert.ok(typeof res.id==="string"&&res.id);return res.id;}

test("the portable card preserves all four ordered kin and equipment while names count normalized Unicode characters",()=>{
  const {desk,game,window,storage}=boot(),other=boot().desk,career=JSON.stringify(game.state);
  const title="  Cafe\u0301\u2003\u2003/ #&+%?. 🐦  ",normalized="Café / #&+%?. 🐦";
  const card={...starter,name:title},old=JSON.stringify(card),hash=desk.encode(card);
  assert.ok(hash?.startsWith("#rental-v1="));assert.ok(hash.length<=640);
  const pieces=hash.slice("#rental-v1=".length).split(".");
  assert.equal(pieces.length,2);assert.equal(decodeURIComponent(pieces[0]),normalized);
  const bell=window.WilderBellpostRules.create({game,storage:null});
  assert.equal(pieces[1],bell.filmCodec.team(starter,4));
  assert.equal(new URL(hash,"https://example.org/games/wilderkin/").hash,hash);
  const decoded=other.decode(hash);assert.deepEqual(plain(decoded),{...starter,name:normalized});
  assert.equal(desk.encode(decoded),hash);assert.equal(JSON.stringify(card),old);
  assert.ok(desk.encode({...card,name:"🐦".repeat(36)}));assert.equal(desk.encode({...card,name:"🐦".repeat(37)}),null);
  assert.equal(desk.encode({...card,name:"e\u0301".repeat(36)}),desk.encode({...card,name:"é".repeat(36)}));
  assert.deepEqual(plain(desk.decode(desk.encode({name:"No fittings",ids:starter.ids})).gear),{});
  assert.equal(storage.length,0);assert.equal(JSON.stringify(game.state),career);
});

test("strict card readers reject illegal kin, fittings, control text and damaged or oversized public links",()=>{
  const {desk,storage}=boot(),base=desk.encode({...starter,name:"Sample"});
  for(const name of ["","  ",42,null,"<Nell>","Nell\u0000","Nell\u001f","\u200fScout","A\u202eB","A\u2066B","Nell\ud800","a".repeat(37)]){
    assert.equal(desk.encode({...starter,name}),null,JSON.stringify(name));
  }
  for(const change of [{ids:starter.ids.slice(0,3)},{ids:[...starter.ids,"mossbell"]},{ids:["dewfin","dewfin","cindlet","sprigkit"]},
    {ids:["zzz","thicketowl","cindlet","sprigkit"]},{ids:["stillwake","thicketowl","cindlet","sprigkit"]},
    {gear:{dewfin:"relay-bell",cindlet:"relay-bell"}},{gear:{dewfin:"invented"}},{gear:{mossbell:"last-stitch"}},{gear:null}]){
    const bad={...starter,...change};assert.equal(desk.encode(bad),null);assert.equal(desk.save(bad).ok,false);
  }
  for(const wire of [null,42,"",base.replace("v1=","v2="),base+".extra",base.replace("Sample","%FF"),
    base.replace("Sample","%0Aunsafe"),base.replace("Sample","%3Cbad%3E"),base.replace("Sample","%E2%80%AEsecret"),base.replace("Sample","a".repeat(641)),
    base.replace("dewfin~5","__proto__"),base.replace("dewfin~5","dewfin~6"),base.replace("dewfin~5","dewfin%7E5"),
    base.replace("sprigkit","stillwake"),base.replace("sprigkit","cindlet"),base.replace("thicketowl~1","thicketowl~5"),
    base.replace(",sprigkit",""),base+",mossbell"]){
    assert.equal(desk.decode(wire),null,String(wire));
  }
  assert.equal(storage.length,0);
});

test("cross-tab shelves preserve all independent variations, deduplicate exact cards and leave foreign storage untouched",()=>{
  const map=new Map([["wilderkin.trail.v3","existing career"],["unrelated.key","keep"]]),st=origin(map);
  const a=boot(st).desk,b=boot(st).desk;
  assert.ok(a.persistent);const first=saved(a.save(starter));
  const variants=[{...starter,name:"Rain & Ash"},{...starter,ids:[...starter.ids].reverse()},{...starter,gear:{...starter.gear,cindlet:"seam-hook"}}];
  const next=variants.map((card,i)=>saved((i%2?a:b).save(card)));assert.equal(new Set([first,...next]).size,4);
  assert.equal(saved(b.save({...starter,name:"  Rain   & Fire "})),first);
  assert.deepEqual(plain(a.list().map(x=>x.id).sort()),[first,...next].sort());
  const slot=a.list().find(x=>x.id===first);assert.deepEqual(plain(slot.card),starter);
  const result=b.remove(first);assert.equal(result.ok,true);assert.equal(result.persistent,true);
  assert.deepEqual(plain(boot(st).desk.list().map(x=>x.id).sort()),next.slice().sort());
  assert.equal(map.get("wilderkin.trail.v3"),"existing career");assert.equal(map.get("unrelated.key"),"keep");
  const valid=[...map.keys()].find(key=>key!=="wilderkin.trail.v3"&&key!=="unrelated.key");
  map.set(valid+"!bad","broken");assert.equal(a.list().length,3);
  for(const id of next)assert.ok(a.remove(id).ok);
  assert.deepEqual(plain(b.list()),[]);assert.equal(map.get("unrelated.key"),"keep");
});

test("missing or blocked browser storage is honestly reported, and an existing durable card survives a failed remove or quota hit",()=>{
  const denied=()=>{throw Object.assign(Error("blocked by browser"),{name:"SecurityError"});};
  for(const blocked of [null,{get length(){return denied();},key:denied,getItem:denied,setItem:denied,removeItem:denied}]){
    const {desk}=boot(blocked),r=desk.save(starter);assert.ok(r.ok,r.message);
    assert.equal(r.persistent,false);assert.equal(desk.persistent,false);
    assert.deepEqual(plain(desk.list().map(x=>x.card)),[starter]);assert.equal(desk.remove(r.id).ok,true);
    assert.equal(desk.list().length,0);
  }
  const st=origin(),{desk}=boot(st),durable=desk.save(starter);assert.ok(durable.ok);assert.ok(durable.persistent);
  const readOnly={getItem:st.getItem,key:st.key,get length(){return st.length;},
    setItem(){throw Object.assign(Error("full"),{name:"QuotaExceededError"});},removeItem(){throw Error("failed remove");}};
  const full=boot(readOnly).desk,alt={...starter,name:"Space at the inn"},res=full.save(alt);
  assert.equal(res.ok,false);assert.ok(res.message);
  const attempted=boot(readOnly).desk.remove(durable.id);
  assert.equal(attempted.ok,false);assert.ok(attempted.message);
  assert.deepEqual(plain(boot(st).desk.list().map(x=>x.card)),[starter]);
});

test("featured rental teams travel unchanged through a two-browser scout registration and fit a usable published plan",async()=>{
  const {desk,game,window}=boot(),editions=desk.featured();
  assert.equal(editions.length,3);
  const [garden,mark,foundry]=editions;
  assert.equal(garden.card.name,"Rain Garden Relay");
  assert.deepEqual(plain(garden.card.ids),["dewfin","thicketowl","kilnclaw","cairnwatch"]);
  assert.deepEqual(plain(garden.card.gear),{dewfin:"opening-pennant",thicketowl:"mender-wrap",kilnclaw:"last-stitch",cairnwatch:"relay-bell"});
  assert.equal(garden.lead,"dewfin");assert.match(garden.plan,/Rain Garden/i);
  assert.ok(mark.card.ids.includes("gustlance")&&mark.card.ids.includes("kilnbeak"));assert.match(mark.plan,/Beacon Pass/i);
  assert.ok(Object.values(mark.card.gear).includes("seam-hook"));
  assert.ok(foundry.card.ids.includes("smelteroll")&&foundry.card.ids.includes("ironblink"));assert.match(foundry.plan,/Bell Foundry/i);
  assert.ok(Object.values(foundry.card.gear).includes("relay-bell"));
  for(const sample of editions){
    const exported=desk.encode(sample.card),fresh=boot(),received=fresh.desk.decode(exported);
    assert.deepEqual(plain(received),plain(sample.card));assert.ok(received.ids.includes(sample.lead));
    const host=window.WilderScoutRules.create({game,storage:null}),guest=fresh.window.WilderScoutRules.create({game:fresh.game,storage:null});
    const invitation=await host.invite(starter);assert.ok(invitation.ok);
    const accepted=await guest.join(invitation.record.hash,received);assert.ok(accepted.ok,accepted.message);
    const opened=await host.receive(accepted.record.hash);assert.ok(opened.ok);
    assert.deepEqual(plain(opened.record.rosters[1].ids),Array.from(received.ids).sort());
    assert.deepEqual(plain(opened.record.rosters[1].gear),plain(sample.card.gear));
    assert.equal(fresh.desk.list().length,0);
  }
});

test("the Rain Garden rental recovers both selected kin against Nell's real replies and plays through the final bell",()=>{
  const {desk,window,game}=boot(),featured=desk.featured()[0],card=desk.decode(desk.encode(featured.card));
  const sim=window.WilderSparringBattle.create({game}),picks=["dewfin","thicketowl","kilnclaw"];
  let entry;
  const school=window.WilderScoutPractice.create({game,sim,row:(id,label,value)=>({id,label,value}),image:id=>id,show(){},live:()=>false,
    readSetup:()=>({left:[]}),playFromPractice:(setup,moves,offset,first,scout)=>{entry={setup,moves,offset,first,scout};return true;}});
  const act=(name,value)=>school.act("scout-pr-"+name,value);
  // Empty each starter slot before choosing the imported four, just as in the interactive roster editor.
  ["mossbell","coalmoth","rillsail","whifflewick"].forEach((id,i)=>act("choose",i+"|"+id));
  card.ids.forEach((id,i)=>act("choose",i+"|"+id));
  card.ids.forEach((id,i)=>act("equip",i+"|"+card.gear[id]));
  act("coach","weir");act("register");picks.forEach(k=>act("pick",k));act("lock");act("play");
  assert.ok(entry);assert.equal(entry.scout.coach,"weir");
  assert.deepEqual(plain(entry.scout.ids),plain(card.ids));assert.deepEqual(plain(entry.scout.gear),plain(card.gear));
  assert.ok(window.WilderScoutPractice.checkCard(entry.scout,entry.setup,entry.first,game.species,sim));
  const {setup,first}=entry;assert.equal(first,0);assert.deepEqual(plain(setup.left),picks);assert.equal(setup.right[0],"mossbell");
  const career=JSON.stringify(game.state);
  let pos=sim.start(setup.left,setup.right,first,setup.gear);
  function take(id){assert.ok(sim.forecast(pos,id)?.available,id);pos=sim.apply(pos,id);}
  function nell(){assert.equal(pos.turn,1);take(sim.recommend(pos).id);}
  assert.equal(pos.sides[0].beats,1);take("skill:bubble-jet");nell();take("swap:thicketowl");nell();
  const guard=sim.forecast(pos,"skill:talon-block");assert.equal(guard.reserveHeal.id,"dewfin");
  take(guard.id);nell();
  const rain=sim.forecast(pos,"duet:dewfin");
  assert.equal(rain.label,"Rain Garden");assert.equal(rain.healLead,14);assert.equal(rain.healPartner,9);
  take(rain.id);assert.equal(pos.sides[0].team[0].hp,75);assert.equal(pos.sides[0].team[1].hp,77);
  for(let n=0;pos.phase!=="done";n++){assert.ok(n<65);take(sim.recommend(pos).id);}
  assert.ok(pos.ply<=60);assert.ok([0,1,"draw"].includes(pos.winner));
  assert.equal(JSON.stringify(game.state),career);
});

test("the featured Beacon Pass–Backdraft handoff and Relay Bell–Bell Foundry plan use their fitted gear in a real Hall position",()=>{
  const h=boot(),[,runners,breakers]=h.desk.featured(),sim=h.window.WilderSparringBattle.create({game:h.game});
  function opening(sample){
    const card=h.desk.decode(h.desk.encode(sample.card)),left=card.ids.slice(0,3),right=["mossbell","dewfin","coalmoth"];
    return sim.start(left,right,0,{left:Object.fromEntries(left.map(id=>[id,card.gear[id]])),right:{mossbell:"opening-pennant"}});
  }
  let p=opening(runners);assert.equal(p.sides[0].beats,1);
  p=sim.apply(p,"beacon:kilnbeak");assert.equal(p.sides[0].team[p.sides[0].active].id,"kilnbeak");assert.equal(p.sides[1].team[0].exposed,true);
  p=sim.apply(p,"skill:shell-bump");assert.equal(p.sides[1].beats,2);
  const fire=sim.forecast(p,"vent:backdraft");assert.ok(fire.available&&fire.consumeMark&&fire.healLead>0);
  assert.ok(fire.gearEvents.some(e=>e.gearId==="seam-hook"&&e.holderId==="kilnbeak"));
  const landed=sim.apply(p,fire.id);assert.equal(landed.sides[1].beats,0);assert.equal(landed.sides[1].team[0].exposed,false);
  p=opening(breakers);assert.equal(p.sides[0].beats,1);
  const switchKin=sim.forecast(p,"swap:ironblink");assert.ok(switchKin.gearEvents.some(e=>e.gearId==="relay-bell"));
  p=sim.apply(p,switchKin.id);assert.equal(p.sides[0].beats,3);
  const rival=p;p=sim.apply(p,"skill:shell-bump");assert.equal(p.sides[1].braced,true);
  const foundry=sim.forecast(p,"duet:smelteroll");assert.equal(foundry.label,"Bell Foundry");assert.equal(foundry.cost,3);
  assert.ok(foundry.available);assert.equal(foundry.role,"rush");
  assert.equal(foundry.damage,sim.forecast(sim.apply(rival,"skill:briar-bloom"),foundry.id).damage);
  const ended=sim.apply(p,foundry.id);assert.equal(ended.sides[0].beats,0);
});
