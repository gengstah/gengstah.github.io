const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const scripts=["atlas","bestiary","activities","campaign","story","duets","growth","wardens","sparring-gear","trail-fittings","fitting-notes","wild-calls",
  "fieldwork","world","first-battle","engine","rehearsal-core","first-trail-partners"].map(id=>{
  const filename=path.join(__dirname,"../games/wilderkin",id+".js");return new vm.Script(fs.readFileSync(filename,"utf8"),{filename});
});
const plain=v=>JSON.parse(JSON.stringify(v));
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
function device(disk=storage(),session=storage()){
  const noop=()=>{},document={createElement(){const canvas={};canvas.getContext=()=>({canvas,drawImage:noop,fillRect:noop,putImageData:noop,
    beginPath:noop,lineTo:noop,moveTo:noop,stroke:noop,createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)})});return canvas;}};
  const window={localStorage:disk,sessionStorage:session},ctx=vm.createContext({window,document});scripts.forEach(s=>s.runInContext(ctx));
  const game=window.WilderGame,practice=window.WilderRehearsal.create({game});let view=null,field=null,review=null,walk=null,previews=0;
  const desk=window.WilderFirstTrailPartners.create({game,practice:{...practice,preview:(...args)=>{previews++;return practice.preview(...args);}},image:id=>id+".png",
    row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),go:(name,v)=>{view=name==="first-trail-partners"?v:name;},notify(){},
    openTrail:s=>{review=plain(s);},openField:s=>{field=plain(s);},locate:(...dest)=>{walk=dest;}});
  const model=()=>desk.model(view),rows=()=>model().sections.flatMap(s=>s.rows||[]);
  function tap(id,value){const r=rows().find(r=>r.id==="trailmate-"+id&&(value===undefined||r.value===value));
    assert.ok(r&&!r.disabled,[view,id,value,JSON.stringify(rows())].join(" / "));assert.ok(desk.act(r.id,r.value,view));}
  const landmark=window.WilderWorld.regions[0].sites.find(site=>(site.kind||site.id)==="wild");
  function first(lead,outcome="recruited"){
    assert.ok(game.firstBattle.choose(lead).ok);assert.ok(game.setPosition(landmark.x,landmark.y));assert.ok(game.visitSite("wild"));
    assert.ok(game.startBattle("first-battle").ok);
    if(outcome==="escaped")return game.flee();
    if(outcome==="recruited"){
      while(!game.captureStatus().available)assert.ok(game.useSkill("trail-feint").ok);
      return game.recruit();
    }
    while(game.state.battle){
      const b=game.state.battle,r=game.replacements();
      if(r){assert.ok(game.replaceFainted(r.defaultId).ok);continue;}
      const move=game.kin(b.activeId,{owned:true}).skills.filter(k=>k.kind!=="heal").map(k=>game.ordinaryForecast(k.id))
        .sort((a,z)=>z.damage-a.damage)[0];
      assert.ok(game.useSkill(move.skill.id).ok);
    }
  }
  function grant(id){game.state.party.push(game.loaner(id,5));}
  return {window,game,practice,desk,disk,session,model,rows,tap,first,grant,previews:()=>previews,field:()=>field,review:()=>review,walk:()=>walk};
}
test("trail-health forecasts keep the proposed team's exact HP, including reserves, without changing the campaign or full-health rehearsal",()=>{
  const h=device(),g=h.game;h.first("cindlet");h.grant("gustlance");
  g.state.party.find(p=>p.id==="gustlance").hp=1;g.state.party.find(p=>p.id==="dewfin").hp=0;
  assert.ok(!g.state.team.includes("gustlance"));assert.ok(g.setLead("cindlet").ok);
  const before=JSON.stringify(g.state),disk=h.disk.getItem("wilderkin.trail.v3");
  const setup={kind:"wild",region:0,foe:"charquill",lead:"gustlance",team:["cindlet","gustlance","dewfin"]};
  const fresh=h.practice.preview(setup),field=h.practice.preview(setup,true);
  assert.ok(fresh.team().every(p=>p.hp===p.maxHp));
  assert.deepEqual(plain(field.team().map(p=>p.hp)),setup.team.map(id=>g.state.party.find(p=>p.id===id).hp));
  assert.equal(field.state.battle.activeId,"gustlance");
  const heal=field.kin("gustlance",{owned:true}).skills.find(s=>s.kind==="heal");
  assert.ok(field.ordinaryForecast(heal.id).available);assert.equal(fresh.ordinaryForecast(heal.id).available,false);
  assert.ok(field.useSkill(heal.id).ok);assert.equal(JSON.stringify(g.state),before);
  assert.equal(h.disk.getItem("wilderkin.trail.v3"),disk);assert.equal(h.practice.read(),null);
  assert.equal(h.practice.preview({...setup,team:["unknown"]},true),null);
});
test("only the recorded first wild victory or recruitment leads to a native second outing",()=>{
  const h=device(),g=h.game;
  assert.equal(h.desk.entry(),null);g.startBattle("wild","opalclasp");g.flee();assert.equal(h.desk.entry(),null);
  assert.equal(h.first("sprigkit","escaped").kind,"escaped");assert.equal(h.desk.entry(),null);
  h.first("sprigkit","victory");assert.equal(h.desk.entry().value,"first-trail-partners");
  assert.equal(h.previews(),0);h.desk.open();assert.equal(h.model().formationStrip.slots[0].name,"Sprigkit");
  assert.match(h.rows().find(r=>r.id==="trailmate-follow").label,/Gustlance/);assert.ok(h.model().sections.find(s=>s.title==="Opening against Gustlance").rows.some(r=>["Leaf Flurry","Brush Dash","Sun Nap"].includes(r.label)));
  h.tap("leads");assert.match(h.rows().find(r=>r.value==="dewfin").detail,/Charquill.*Bubble Jet deals 14/);
  assert.match(h.rows().find(r=>r.value==="cindlet").detail,/Leafshuttle.*Ember Pop deals 15/);
  h.tap("lead","dewfin");assert.deepEqual(plain(g.state.team),["sprigkit","cindlet","dewfin"]);assert.equal(g.state.lead,"sprigkit");
  h.tap("mossbell");assert.equal(h.walk()[0],"sighting:mossbell");h.tap("fern");assert.deepEqual(h.walk(),["warden","warden"]);
});
test("a genuinely caught Opalclasp leads a second ordinary encounter, chosen teammate and damage forecasts survive reload",()=>{
  let h=device();h.first("cindlet");const firstHP=h.game.state.party.find(p=>p.id==="cindlet").hp;
  assert.ok(firstHP<28);const before=JSON.stringify(h.game.state);
  h.desk.open();let model=h.model();assert.deepEqual(plain(model.formationStrip.slots.map(k=>k.id)),["opalclasp","cindlet"]);
  assert.match(h.rows().find(r=>r.label==="Tuning Fork").detail,/deals 14 to Mossbell/);assert.ok(h.rows().some(r=>r.label==="Signal Flare"));
  h.tap("partners");h.tap("partner","dewfin");assert.ok(h.rows().some(r=>r.label==="Sounding Line"));
  assert.equal(JSON.stringify(h.game.state),before);h.tap("follow","mossbell");const card=h.field();assert.equal(card.lead,"opalclasp");
  assert.equal(h.game.state.party.find(p=>p.id==="cindlet").hp,firstHP);assert.ok(h.game.startBattle("wild","mossbell").ok);h.desk.bind(card);
  h=device(h.disk,h.session);const game=h.game;
  const guided=h.desk.battleSection().rows[0],native=game.ordinaryForecast(guided.value);assert.equal(guided.id,"skill");assert.equal(native.damage,14);
  assert.ok(game.useSkill(guided.value).ok);const duet=h.desk.battleSection().rows[0],pair=game.duets().options.find(o=>o.partnerId==="dewfin");
  assert.equal(duet.value,"dewfin");assert.ok(duet.label.includes("Sounding Line"));assert.ok(pair.available);
  assert.ok(duet.detail.includes(pair.damage+" damage"));const res=game.useDuet("dewfin");assert.ok(res.ok);
  assert.equal(game.state.battle.enemy.hp,4);assert.equal(h.desk.battleSection(),null);
  assert.equal(game.useTrio("cindlet","ember-pop").kind,"victory");assert.equal(game.state.battle,null);
  assert.equal(h.desk.entry(),null);assert.equal(game.state.wins,1);assert.equal(game.state.team.length,4);
  assert.equal(device(h.disk,h.session).desk.entry(),null);
});
test("a different field-card fight drops queued notes, and blocked browser storage still permits a complete in-page pairing",()=>{
  const throws={getItem(){throw Error("unavailable");},setItem(){throw Error("unavailable");},removeItem(){throw Error("unavailable");}};
  const h=device(storage(),throws);h.first("sprigkit");h.desk.open();h.tap("follow","mossbell");const plan=h.field();
  assert.ok(h.game.startBattle("wild","charquill").ok);h.desk.bind({...plan,foe:"charquill"});assert.equal(h.desk.battleSection(),null);h.game.flee();
  h.desk.open();h.tap("follow","mossbell");assert.ok(h.game.startBattle("wild","mossbell").ok);h.desk.bind(plan);assert.equal(h.desk.battleSection().rows[0].value,"tuning-fork");
  h.desk.clear();assert.equal(h.desk.battleSection(),null);
});
test("a benched specialist in a full lineup gets an explicit seat and promotion review; choosing it cannot heal or displace a traveler",()=>{
  const h=device(),g=h.game;h.first("sprigkit");for(const id of ["gustlance","pincoil","leafshuttle"])h.grant(id);
  g.state.team.push("gustlance","pincoil");g.state.party.find(p=>p.id==="leafshuttle").hp=4;
  const old=JSON.stringify(g.state);h.desk.open();h.tap("partners");h.window.prompt=()=>"leafshuttle";h.tap("search");
  h.tap("partner","leafshuttle");assert.equal(h.rows().filter(r=>r.id==="trailmate-seat").length,5);assert.ok(!h.rows().some(r=>r.value==="opalclasp"));
  h.tap("seat","pincoil");h.tap("follow","mossbell");
  assert.deepEqual(h.review().team,["sprigkit","cindlet","dewfin","opalclasp","gustlance","leafshuttle"]);assert.equal(h.field(),null);assert.equal(JSON.stringify(g.state),old);
});
test("a seriously injured personal favorite can open by healing and sees the actual post-reply HP at the tracks",()=>{
  const h=device(),g=h.game;h.first("cindlet","victory");const c=g.state.party.find(p=>p.id==="cindlet");c.hp=1;
  h.desk.open();const note=h.rows().find(r=>r.label==="Rekindle");assert.ok(note&&note.detail.includes("restores 10 HP"));
  h.tap("follow","leafshuttle");assert.ok(g.startBattle("wild","leafshuttle").ok);h.desk.bind(h.field());
  const guided=h.desk.battleSection().rows[0],before=g.ordinaryForecast("rekindle");
  assert.equal(guided.value,"rekindle");assert.ok(guided.detail.includes("Recover "+before.healing));
  assert.ok(g.useSkill(guided.value).ok);assert.ok(note.detail.includes("ends at "+c.hp+"/"+c.maxHp+" HP."));assert.ok(h.desk.battleSection());
});

test("Befriend keeps a real quarry alive and offers a capture beside the knockout after reloading",()=>{
  let h=device();h.first("cindlet");h.desk.open();
  h.tap("befriend","mossbell");const plan=h.field();
  assert.ok(h.game.startBattle("wild","mossbell").ok);h.desk.bind(plan);
  for(let i=0;i<8&&!h.game.captureStatus().available;i++){
    const safe=h.desk.battleSection().rows[0];
    assert.equal(safe.value,"trail-feint");assert.ok(h.game.useSkill(safe.value).ok);
    assert.ok(h.game.state.battle.enemy.hp>0);
  }
  h=device(h.disk,h.session);const choices=h.desk.battleSection().rows;
  assert.equal(choices[0].id,"capture");assert.ok(h.game.captureStatus().available);
  if(choices.length>1)assert.ok(h.game.ordinaryForecast(choices[1].value).finishes);
  assert.ok(h.game.recruit().ok);assert.ok(h.game.state.party.some(k=>k.id==="mossbell"));
});
