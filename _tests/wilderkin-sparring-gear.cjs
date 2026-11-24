const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const ctx=vm.createContext({window:{localStorage:{getItem:()=>null,setItem(){throw new Error("Gear changed campaign storage");}}}});
for(const name of ["atlas","bestiary","activities","campaign","story","duets","engine","sparring-gear","sparring-battle"]) {
  const file=path.join(__dirname,"../games/wilderkin",name+".js");
  vm.runInContext(fs.readFileSync(file,"utf8"),ctx,{filename:file});
}
const {WilderGame:game,WilderSparringGear:gear,WilderSparringBattle:battle}=ctx.window;
const sim=battle.create({game}),copy=x=>JSON.parse(JSON.stringify(x));
const left=["sprigkit","cindlet","dewfin"],right=["mossbell","coalmoth","glimmeray"];
const starter=(l,r,pack,first=0)=>{const p=sim.start(l,r,first,pack);assert.ok(p);return p;};
const take=(p,id)=>{const before=JSON.stringify(p),q=sim.apply(p,id);assert.ok(q,"Illegal: "+id);assert.equal(JSON.stringify(p),before);return q;};
const held=(p,side,id)=>p.sides[side].team.find(k=>k.id===id);
const gearEvent=(p,m,id)=>sim.forecast(p,m).gearEvents?.find(e=>e.gearId===id);
const campaign=JSON.stringify(game.state);

test("six free fittings have unique roles and accept only singleton pieces on members of that side",()=>{
  assert.equal(gear.items.length,6);assert.equal(new Set(gear.items.map(k=>k.role)).size,6);
  for(const k of gear.items){assert.equal(gear.byId(k.id),k);assert.ok(k.cost&&k.trigger&&k.effect&&k.name);}
  assert.equal(gear.byId("__proto__"),null);
  assert.deepEqual(copy(gear.validate(undefined,left,right)),{left:{},right:{}});
  assert.deepEqual(copy(gear.validate({left:{sprigkit:"relay-bell"},right:{mossbell:"relay-bell"}},left,right)),
    {left:{sprigkit:"relay-bell"},right:{mossbell:"relay-bell"}});
  for(const bad of [null,[],{unknown:{}},{left:null},{left:["relay-bell"]},{right:{sprigkit:"prism-lens"}},
    {left:{sprigkit:"prism-lens",dewfin:"prism-lens"}},{right:{glimmeray:"made-up"}},{left:JSON.parse('{"__proto__":"last-stitch"}')}]){
    assert.equal(gear.validate(bad,left,right),null);assert.equal(sim.start(left,right,0,bad),null);
  }
  const dirty={left:{dewfin:"relay-bell",sprigkit:"relay-bell",coalmoth:"prism-lens",cindlet:"?"}};
  assert.deepEqual(copy(gear.normalize(dirty,left,right)),{left:{sprigkit:"relay-bell"},right:{}});
  const empty=sim.start(left,right);assert.deepEqual(copy(sim.start(left,right,0,{left:{},right:{}})),copy(empty));
  assert.ok(empty.sides.every(s=>s.team.every(k=>!Object.hasOwn(k,"gear")&&!Object.hasOwn(k,"spent"))));
});

test("an opening pennant spends only from the lead and the teams have identical rules in either starting seat",()=>{
  const pack={left:{sprigkit:"opening-pennant"},right:{glimmeray:"opening-pennant"}};
  let p=starter(left,right,pack,1);
  assert.equal(p.sides[0].beats,1);assert.equal(p.sides[1].beats,0);
  assert.equal(held(p,0,"sprigkit").spent,true);assert.equal(held(p,1,"glimmeray").spent,false);
  assert.ok(p.log[0].includes("Opening Pennant"));p=take(p,"swap:glimmeray");
  assert.equal(p.sides[1].beats,1);assert.equal(held(p,1,"glimmeray").spent,false);
  const mirrored=starter(right,left,{left:pack.right,right:pack.left},0);
  assert.deepEqual(copy(mirrored.sides[1]),copy(starter(left,right,pack,1).sides[0]));
  assert.equal(starter(left,right,{left:{sprigkit:"opening-pennant"},right:{mossbell:"opening-pennant"}}).log.length,2);
  const forged=copy(p);held(forged,1,"glimmeray").spent=true;assert.equal(sim.restore(forged),null);
});

test("deliberately switching to a bell holder charges a duet, while a relay or an already-full meter preserves the bell",()=>{
  const pack={left:{cindlet:"relay-bell"}};
  let p=starter(left,right,pack);
  const option=sim.forecast(p,"swap:cindlet");
  assert.equal(option.beatsAfter,2);assert.equal(option.gearEvents[0].holderId,"cindlet");
  p=take(p,option.id);assert.equal(p.sides[0].beats,2);assert.ok(held(p,0,"cindlet").spent);
  p=take(p,"skill:briar-bloom");p=take(p,"duet:dewfin");assert.equal(p.sides[0].active,2);
  p=take(p,"swap:coalmoth");assert.equal(sim.forecast(p,"swap:cindlet").beatsAfter,1);
  let full=starter(left,right,{left:{sprigkit:"opening-pennant",cindlet:"relay-bell"}});
  full=take(full,"skill:leaf-flurry");full=take(full,"skill:briar-bloom");full=take(full,"swap:cindlet");
  assert.equal(full.sides[0].beats,3);assert.ok(!held(full,0,"cindlet").spent);
  let relay=starter(["dewfin","cindlet","sprigkit"],right,pack);
  for(const id of ["skill:bubble-jet","skill:briar-bloom","skill:slick-slide","skill:shell-bump","duet:cindlet"])relay=take(relay,id);
  assert.equal(relay.sides[0].active,1);assert.ok(!held(relay,0,"cindlet").spent);
});

test("a lethal strike spends the target’s stitch, projects the surviving HP and permits the holder’s real reply",()=>{
  const team=["cindlet","sprigkit","dewfin"],pack={right:{mossbell:"last-stitch"}};
  let p=starter(team,right,pack),no=sim.start(team,right),n=0;
  while(!gearEvent(p,"skill:ember-pop","last-stitch")&&n++<8){
    p=take(p,"skill:ember-pop");no=take(no,"skill:ember-pop");
    p=take(p,"skill:briar-bloom");no=take(no,"skill:briar-bloom");
  }
  const f=sim.forecast(p,"skill:ember-pop"),foe=held(p,1,"mossbell");
  assert.ok(foe.hp>1);assert.equal(f.damage,foe.hp-1);assert.equal(f.gearEvents[0].side,1);
  p=take(p,f.id);no=take(no,f.id);assert.equal(p.phase,"move");assert.equal(no.phase,"replace");
  assert.equal(held(p,1,"mossbell").hp,1);assert.equal(held(p,1,"mossbell").spent,true);
  p=take(p,"skill:briar-bloom");p=take(p,f.id);assert.equal(p.phase,"replace");
});

test("seam hook cashes in real exposure and drains the rival’s bank before the reply, which a switch can avoid",()=>{
  const roster=["sprigkit","pincoil","cindlet"],pack={left:{sprigkit:"seam-hook"}};
  let p=starter(roster,right,pack);
  for(const id of ["skill:leaf-flurry","skill:briar-bloom","skill:brush-dash","skill:shell-bump","duet:pincoil"])p=take(p,id);
  assert.ok(held(p,1,"mossbell").exposed);
  const avoid=take(p,"swap:coalmoth");assert.ok(!gearEvent(avoid,"skill:leaf-flurry","seam-hook"));
  p=take(p,"skill:shell-bump");
  const f=sim.forecast(p,"skill:leaf-flurry");
  assert.equal(f.gearEvents[0].side,0);assert.equal(f.rivalBeatsAfter,0);
  p=take(p,f.id);assert.equal(p.sides[1].beats,0);assert.ok(!held(p,1,"mossbell").exposed);
  assert.ok(held(p,0,"sprigkit").spent);assert.ok(sim.options(p).filter(m=>m.kind==="duet").every(m=>!m.available));
});

test("guarding with a wrap heals the most injured eligible reserve by its exact forecasted amount, only once",()=>{
  const rival=["glimmeray","mossbell","coalmoth"];
  let p=starter(left,rival,{left:{sprigkit:"mender-wrap"}});
  assert.ok(!gearEvent(p,"skill:brush-dash","mender-wrap"));
  for(const id of ["swap:cindlet","skill:lunar-surge","swap:dewfin","skill:lunar-surge","swap:sprigkit","skill:lunar-surge"])p=take(p,id);
  const patient=held(p,0,"cindlet"),bystander=held(p,0,"dewfin"),f=sim.forecast(p,"skill:brush-dash");
  assert.ok(patient.hp/patient.maxHp<bystander.hp/bystander.maxHp);
  assert.deepEqual(copy(f.reserveHeal),{id:patient.id,amount:Math.ceil(patient.maxHp/5)});
  p=take(p,f.id);assert.equal(held(p,0,patient.id).hp,patient.hp+f.heal);assert.equal(held(p,0,bystander.id).hp,bystander.hp);
  p=take(p,"skill:mirror-glide");assert.ok(!gearEvent(p,f.id,"mender-wrap"));
});

test("a lens neutralizes resistance on an actual ordinary strike while retaining cover, then normal affinity returns",()=>{
  const rival=["coalmoth","mossbell","glimmeray"],pack={left:{sprigkit:"prism-lens"}};
  let p=starter(left,rival,pack,1),plain=sim.start(left,rival,1);
  assert.ok(!gearEvent(p,"skill:ash-veil","prism-lens"));
  p=take(p,"skill:ash-veil");plain=take(plain,"skill:ash-veil");
  const f=sim.forecast(p,"skill:leaf-flurry"),weaker=sim.forecast(plain,f.id);
  assert.ok(f.damage>weaker.damage);assert.equal(f.damage,8);assert.match(f.detail,/into cover/);assert.match(f.detail,/Prism Lens/);
  p=take(p,f.id);plain=take(plain,f.id);p=take(p,"skill:flare-wing");plain=take(plain,"skill:flare-wing");
  assert.equal(sim.forecast(p,f.id).damage,sim.forecast(plain,f.id).damage);
  assert.ok(held(p,0,"sprigkit").spent);
});

test("replays and save snapshots preserve per-holder charges and cannot introduce unknown or duplicate gear",()=>{
  const pack={left:{sprigkit:"opening-pennant",dewfin:"relay-bell",cindlet:"prism-lens"},right:{mossbell:"last-stitch",glimmeray:"mender-wrap"}};
  let p=starter(left,right,pack),same=sim.start(left,right,0,pack),actions=[];
  while(p.phase!=="done"){
    const m=sim.recommend(p);assert.ok(m.available);actions.push(m.id);
    p=take(p,m.id);assert.deepEqual(copy(sim.restore(copy(p))),copy(p));
    assert.ok(p.log.every(line=>line.length<=400));
  }
  for(const id of actions)same=take(same,id);assert.deepEqual(copy(same),copy(p));assert.equal(JSON.stringify(game.state),campaign);
  const wrong=copy(p);wrong.sides[0].team[1].gear=wrong.sides[0].team[0].gear;assert.equal(sim.restore(wrong),null);
  wrong.sides[0].team[1].gear="invented";assert.equal(sim.restore(wrong),null);
  const missing=copy(p);delete missing.sides[0].team[1].spent;assert.equal(sim.restore(missing),null);
});

test("a lens and the opposing stitch can trigger on the same hit; both forecasts settle in a single play",()=>{
  let p=starter(["coalmoth","sprigkit","dewfin"],["cindlet","mossbell","glimmeray"],
    {left:{sprigkit:"prism-lens"},right:{cindlet:"last-stitch"}});
  for(let i=0;i<4;i++){p=take(p,"skill:flare-wing");p=take(p,"skill:ember-pop");}
  p=take(p,"swap:sprigkit");p=take(p,"skill:cinder-roll");
  const f=sim.forecast(p,"skill:leaf-flurry");
  assert.deepEqual(copy(f.gearEvents.map(e=>[e.side,e.gearId])),[[0,"prism-lens"],[1,"last-stitch"]]);
  assert.ok(f.detail.includes(f.damage+" damage"));assert.equal(f.damage,held(p,1,"cindlet").hp-1);
  p=take(p,f.id);assert.equal(p.phase,"move");assert.ok(held(p,0,"sprigkit").spent&&held(p,1,"cindlet").spent);
  assert.equal(held(p,1,"cindlet").hp,1);assert.ok(p.log.at(-1).includes("Lifeline Stitch"));
  assert.ok(sim.forecast(p,"skill:rekindle").available);
});

test("each fitting can change the coach’s recommendation from an otherwise identical public match",()=>{
  const wind=["gustlance","arcbill","icereeve"],foundry=["smelteroll","boltbur","kilnclaw"],wire=["coilcrown","slateweaver","cairnwatch"];
  const trio=["sprigkit","pincoil","cindlet"],cases=[
    ["relay-bell",trio,"pincoil",wind,0,[],"swap:pincoil"],
    ["last-stitch",trio,"sprigkit",wind,1,["skill:crosswind-cut","skill:brush-dash","swap:arcbill","skill:leaf-flurry","skill:forked-flash"],"swap:pincoil"],
    ["seam-hook",trio,"sprigkit",wire,0,["skill:leaf-flurry","skill:spark-thread","skill:sun-nap","skill:horn-brace"],"duet:pincoil"],
    ["mender-wrap",trio,"sprigkit",foundry,0,["skill:brush-dash","skill:roll-brace","swap:pincoil","skill:hearth-rush","skill:nest-down","swap:kilnclaw","duet:cindlet","duet:boltbur"],"swap:sprigkit"],
    ["prism-lens",trio,"sprigkit",foundry,0,[],"skill:leaf-flurry"],
    ["opening-pennant",["cindlet","dewfin","sprigkit"],"cindlet",foundry,0,[],"skill:ember-pop"]
  ];
  for(const [item,team,holder,rival,first,tape,expected] of cases){
    let plain=sim.start(team,rival,first),worn=starter(team,rival,{left:{[holder]:item}},first);
    for(const id of tape){plain=take(plain,id);worn=take(worn,id);}
    assert.equal(plain.turn,0);assert.notEqual(sim.recommend(plain).id,expected,item);
    assert.equal(sim.recommend(worn).id,expected,item);assert.ok(sim.forecast(worn,expected).available);
  }
});

test("a complete loan match recorded before equipment existed retains its legal turns, winner and final HP",()=>{
  // Sprigkit, Cindlet and Dewfin against the Bell Keepers in the original unarmed ruleset.
  const tape=[
    "skill:leaf-flurry","skill:shell-bump","skill:sun-nap","skill:briar-bloom","skill:leaf-flurry","duet:coalmoth",
    "duet:dewfin","skill:briar-bloom","skill:leaf-flurry","skill:shell-bump","skill:brush-dash","skill:root-rest",
    "duet:cindlet","duet:glimmeray","skill:leaf-flurry","skill:briar-bloom","skill:leaf-flurry","replace:glimmeray",
    "skill:lunar-surge","replace:dewfin","skill:bubble-jet","skill:lunar-surge","skill:dew-bath","skill:lunar-surge",
    "skill:bubble-jet","skill:lunar-surge","skill:bubble-jet","skill:lunar-surge","skill:bubble-jet","skill:stillwater",
    "skill:slick-slide","skill:mirror-glide","skill:slick-slide","duet:coalmoth","replace:cindlet","skill:ember-pop",
    "skill:flare-wing","skill:rekindle","skill:flare-wing","skill:ember-pop","skill:coal-glow","skill:ember-pop",
    "skill:flare-wing","skill:ember-pop","duet:glimmeray","skill:ember-pop","replace:coalmoth","skill:flare-wing"
  ];
  let p=sim.start(left,right);
  for(const id of tape)p=take(p,id);
  assert.equal(p.phase,"done");assert.equal(p.winner,1);assert.equal(p.ply,44);
  assert.deepEqual(copy(p.sides.map(s=>s.team.map(k=>k.hp))),[[0,0,0],[0,39,0]]);
});
