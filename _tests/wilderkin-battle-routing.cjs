const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.join(__dirname,"../games/wilderkin");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const files=Array.from(html.matchAll(/<script src="([^"?]+)(?:\?[^"]*)?"/g),m=>m[1]);
const scripts=files.filter(f=>!["canvas-shell.js","kin-art.js","score.js"].includes(f)).map(f=>{
  const filename=path.join(root,f);return [f,new vm.Script(fs.readFileSync(filename,"utf8"),{filename})];
});
const clone=v=>JSON.parse(JSON.stringify(v)),tick=()=>new Promise(resolve=>setImmediate(resolve));
function boot(hash,save=null,prepare){
  let model,input,time=0;const frames=[],listeners={};
  const localStorage={getItem:k=>k==="wilderkin.trail.v3"?save:null,setItem:(_,v)=>{save=v;}};
  const w={localStorage,location:{hash,pathname:"/games/wilderkin/",search:""},Event,setTimeout,dispatchEvent:event=>listeners[event.type]?.(event),
    history:{replaceState:(_,__,address)=>{w.location.hash=address.includes("#")?address.slice(address.indexOf("#")):"";}},
    addEventListener:(event,fn)=>{listeners[event]=fn;},
    WilderKinArt:{sprite:id=>"sprite:"+id},WilderScore:{create:()=>({scene(){},answer(){}})},
    WilderCanvas:{create:(_,handlers)=>{input=handlers;return {show:m=>{model=m;},animate:()=>Promise.resolve(),toast(){},invalidate(){}};}}};
  function canvas(){
    const node={toDataURL:()=>"image:test"},noop=()=>{};
    node.getContext=()=>({canvas:node,drawImage:noop,fillRect:noop,putImageData:noop,beginPath:noop,lineTo:noop,moveTo:noop,
      stroke:noop,createImageData:(width,height)=>({data:new Uint8ClampedArray(width*height*4)})});
    return node;
  }
  const ctx=vm.createContext({window:w,document:{getElementById:canvas,createElement:canvas,hidden:false},performance:{now:()=>time},
    matchMedia:()=>({matches:true}),requestAnimationFrame:cb=>frames.push(cb)});
  for(const [file,script] of scripts){if(file==="game.js")prepare?.(w.WilderGame);script.runInContext(ctx);}
  return {g:w.WilderGame,model:()=>model,save:()=>save,externalSave:raw=>{save=raw;},key:key=>input.key({key}),hash:value=>{w.location.hash=value;listeners.hashchange();},
    click(id,value){const rows=[...(model.objective?.routes||[model.objective]).filter(Boolean),...model.sections.flatMap(s=>s.rows||[])];const found=rows.find(r=>r.id===id&&(value===undefined||value===r.value));
      assert.ok(found&&!found.disabled,id+" / "+value+" on "+model.title);input.action(found.id,found.value);},
    walk(){for(let i=0;frames.length&&i<300;i++){time+=130;frames.shift()(time);}assert.equal(frames.length,0);}
  };
}
const ok=result=>assert.ok(result.ok,result.message);
test("the ordinary map offers a battle or a nest, and a saved walk leads to a real encounter and a second owned-team hunt",async()=>{
  const start=boot("");
  assert.deepEqual(Array.from(start.model().objective.routes,r=>r.value),["first-battle","first-outing"]);
  start.click("nav","first-battle");start.click("first-battle-lead","cindlet");
  assert.equal(start.g.state.firstBattle.stage,"walk");
  const path=boot("",start.save());
  path.click("first-battle-resume");path.walk();
  assert.equal(path.model().ally.species,"cindlet");assert.equal(path.model().foe.species,"opalclasp");
  assert.equal(path.g.state.region,0);assert.equal(path.g.state.landmark,"wild");
  const opening=path.model().sections[0].rows.find(r=>r.id==="skill");
  assert.ok(opening);assert.equal(path.model().sections.flatMap(s=>s.rows||[]).filter(r=>r.id==="skill"&&r.value===opening.value).length,1);
  path.click("skill","trail-feint");await tick();
  const returning=boot("#first-battle",path.save());
  assert.equal(returning.model().id,"battle:");assert.ok(returning.model().log[0].includes("24 HP"));
  returning.click("skill","trail-feint");await tick();returning.click("capture");await tick();
  assert.equal(returning.model().sections[0].rows[0].value,"first-trail-partners");
  const second=boot("#first-trail/partners",returning.save());
  second.click("trailmate-partners");second.click("trailmate-partner","dewfin");
  second.click("trailmate-follow","mossbell");second.click("card-battle");
  assert.equal(second.g.state.battle.activeId,"opalclasp");assert.equal(second.g.state.battle.enemy.id,"mossbell");
  second.click("skill","tuning-fork");await tick();assert.equal(second.model().sections[0].rows[0].value,"dewfin");
  second.click("duet","dewfin");await tick();assert.equal(second.g.state.battle.enemy.hp,4);
  second.click("nav","trios");second.click("trio","cindlet|ember-pop");await tick();
  assert.equal(second.g.state.battle,null);assert.equal(second.g.state.wins,1);
});
test("the real controller prioritizes a saved knockout over a deep link and ordinary attack keys",()=>{
  const a=boot("#second-bell",null,g=>{
    ok(g.setLead("dewfin"));
    for(let n=0;n<10&&!g.replacements();n++){
      ok(g.startBattle("wild","mossbell"));
      while(!g.replacements()&&g.ordinaryForecast("trail-feint").available)ok(g.useSkill("trail-feint"));
      if(!g.replacements())ok(g.flee());
    }
  });
  assert.equal(a.model().id,"replacement:");
  assert.equal(a.model().ally.hp,0);assert.equal(a.model().ally.species,"dewfin");
  const before=clone(a.g.state.battle),pick=a.g.replacements(),target=pick.options.find(p=>p.id!==pick.defaultId);
  const slot=pick.options.indexOf(target),row=a.model().sections[0].rows[slot];
  assert.equal(row.value,target.id);assert.ok(row.detail.includes(target.attackName+" · deal "+target.attackDamage));
  for(const key of ["1","2","3","4","r","Escape"])assert.ok(a.key(key));
  a.hash("#lantern-cup");assert.equal(a.model().id,"replacement:");assert.deepEqual(clone(a.g.state.battle),before);
  const b=boot("#guard-school",a.save());assert.equal(b.model().id,"replacement:");assert.ok(b.key(row.key));
  assert.equal(b.model().id,"battle:");assert.equal(b.g.state.battle.activeId,target.id);
  assert.equal(b.g.state.battle.turn,before.turn);assert.equal(b.g.state.battle.beats,before.beats);
  assert.equal(b.g.state.battle.enemy.hp,before.enemy.hp);assert.equal(b.g.replacements(),null);
});
test("a fresh player can walk to Fern, choose an opener, see the visiting kin, and withdraw to the same desk after reload",async()=>{
  const a=boot("#second-bell"),g=a.g,offer=g.secondBell(0);
  assert.equal(a.model().title,"The Second Bell");assert.ok(offer.eligible&&!offer.atLodge);
  assert.ok(!g.pools[0].includes(offer.guest));
  assert.ok(a.model().sections.flatMap(s=>s.rows||[]).some(r=>r.badge==="GUEST"&&r.label===g.species[offer.guest].name));
  const hp=g.team().map(k=>k.hp);
  a.click("bell-lead","cindlet");a.click("bell-walk",0);a.walk();
  assert.equal(g.state.landmark,"warden");a.click("bell-ring",0);
  assert.equal(a.model().title,"Second Bell · Warden Fern");assert.equal(g.state.battle.activeId,"cindlet");
  assert.ok(a.model().sections.find(s=>s.title.startsWith("Published formation")).text.includes(g.species[offer.guest].name));
  assert.ok(!a.model().sections.flatMap(s=>s.rows||[]).some(r=>r.value==="bag"));
  const b=boot("#second-bell",a.save());assert.equal(b.model().id,"battle:");assert.ok(b.key("b"));assert.equal(b.model().id,"battle:");
  b.click("retreat");await tick();assert.equal(b.model().title,"Exhibition withdrawn");assert.equal(b.g.state.battle,null);
  b.click("view","second-bell|0");assert.equal(b.model().title,"The Second Bell");assert.deepEqual(Array.from(b.g.team(),k=>k.hp),Array.from(hp));
  assert.equal(b.g.state.crests.length,0);assert.equal(b.g.state.landmark,"warden");
});

test("a fresh player can follow Opalclasp's missing Beacon Pass to Gustlance and still choose an ordinary encounter",()=>{
  const a=boot("#wild-calls");
  a.click("walk-kind","wild|tracks");a.walk();a.click("view","wild-scout|opalclasp");
  const rows=a.model().sections[0].rows;
  assert.ok(rows.some(r=>r.id==="track"&&r.value==="opalclasp"&&!r.disabled));
  assert.ok(rows.some(r=>r.value==="wild-scout|gustlance"&&r.detail.includes("Beacon Pass")));
  a.click("view","wild-scout|gustlance");
  assert.equal(a.model().sections[0].rows.length,1);
  assert.equal(a.model().sections[0].rows[0].value,"gustlance");
});

test("a wild call can be scouted on foot, answered at full health and resumed as an explicit invitation",async()=>{
  const a=boot("#wild-calls"),g=a.g;
  assert.equal(a.model().id,"wild-calls:");
  a.click("walk-kind","wild|tracks");a.walk();assert.equal(g.state.landmark,"wild");
  a.click("view","wild-scout|mossbell");a.click("wild-lead","dewfin");
  const scout=g.wildCall("mossbell"),move=scout.options.find(o=>o.actor==="dewfin");
  assert.ok(a.model().sections.some(s=>s.text?.includes(scout.warning.name)));
  a.click("track","mossbell");assert.equal(g.state.battle.activeId,"dewfin");
  assert.ok(a.model().sections.flatMap(s=>s.rows||[]).some(r=>r.id==="skill"&&r.value===move.skill));
  a.click("nav","bag");a.click("view","item|kinweave");
  assert.equal(a.model().sections[0].rows.find(r=>r.id==="capture").disabled,true);
  a.key("e");assert.equal(a.model().id,"battle:");
  const before=clone(g.state.battle.enemy),hp=g.team().find(p=>p.id==="dewfin").hp,packed=g.state.bag.kinweave;
  a.click("answer-call",move.skill);await tick();
  assert.equal(a.model().id,"wild-offer:");
  assert.deepEqual(clone(a.model().sections[0].rows.map(r=>r.id)),["capture","release-call"]);
  assert.equal(g.state.battle.enemy.hp,before.hp);assert.equal(g.team().find(p=>p.id==="dewfin").hp,hp);
  const snapshot=clone(g.state.battle);
  for(const key of ["1","2","b","r","Escape"])assert.ok(a.key(key));
  a.hash("#lantern-cup");assert.equal(a.model().id,"wild-offer:");assert.deepEqual(clone(g.state.battle),snapshot);
  const b=boot("#second-bell",a.save());assert.equal(b.model().id,"wild-offer:");
  b.click("release-call");await tick();assert.equal(b.g.state.bag.kinweave,packed);
  assert.ok(!b.g.state.party.some(p=>p.id==="mossbell"));assert.equal(b.g.state.battle,null);
  assert.ok(a.key("c"));await tick();assert.match(a.model().title,/Mossbell/);
  assert.equal(g.state.bag.kinweave,packed-1);
  a.click("lead","mossbell");assert.equal(g.state.lead,"mossbell");
  a.click("open-kin","mossbell");assert.ok(a.model().sections.some(s=>s.title==="Skills"));
});

test("peaceful invitations open the same companion controls, and a full party offers the real enlist screen",async()=>{
  const field=boot("#updates");field.click("nav","first-outing");field.click("outing-choose","sprigkit");field.walk();
  const study=field.g.study("mossbell");
  field.click("field-observe","mossbell|"+study.clues[0].id);
  field.click("field-observe","mossbell|try-"+study.variant);field.click("field-invite","mossbell");
  assert.equal(field.model().id,"outcome:");field.click("lead","mossbell");
  assert.equal(field.g.state.lead,"mossbell");assert.equal(field.g.study("mossbell").complete,true);

  const a=boot("#wild-calls",null,g=>{
    for(const id of g.pools[0].filter(id=>id!=="mossbell").slice(0,3)){
      ok(g.startBattle("wild",id));while(!g.captureStatus().available)ok(g.useSkill("trail-feint"));ok(g.recruit());
      g.visitSite("camp");ok(g.heal());
    }
  });
  assert.equal(a.g.state.team.length,6);
  a.click("walk-kind","wild|tracks");a.walk();a.click("view","wild-scout|mossbell");a.click("wild-lead","dewfin");
  a.click("track","mossbell");a.click("answer-call","bubble-jet");await tick();a.click("capture");await tick();
  assert.ok(!a.g.state.team.includes("mossbell"));a.click("view","enlist|mossbell");
  assert.equal(a.model().sections[0].rows.length,6);a.click("assign","mossbell|dewfin");
  assert.ok(a.g.state.team.includes("mossbell"));assert.ok(!a.g.state.team.includes("dewfin"));
});


test("a stale Kinweave throw returns to the newer trail after the other tab released the waiting kin",async()=>{
  const first=boot("#wild-calls",null,g=>{
    ok(g.setLead("dewfin"));ok(g.startBattle("wild","mossbell"));ok(g.answerWildCall("bubble-jet"));
  });
  assert.equal(first.model().id,"wild-offer:");
  const second=boot("#wild-calls",first.save());
  second.click("release-call");await tick();assert.equal(second.g.state.battle,null);
  const saved=second.save();first.externalSave(saved);
  first.click("capture");await tick();
  assert.equal(first.model().id,"world:");
  assert.equal(first.save(),saved);assert.equal(first.g.state.battle,null);
  assert.ok(!first.g.state.party.some(k=>k.id==="mossbell"));
  assert.equal(first.g.state.bag.kinweave,second.g.state.bag.kinweave);
});

test("Fern's practice invitation works before the crest trial and survives a cold reload without keeping the practice fight",async()=>{
  const a=boot("#chalkyard");
  assert.equal(a.model().title,"The Chalkyard");
  a.click("walk-kind","warden|warden");a.walk();
  assert.equal(a.model().title,"Warden Fern");assert.equal(a.g.trialAccess().open,false);
  a.click("yard-invite");
  const key="0/warden/mossbell",url="#chalkyard/"+key;
  assert.equal(a.model().id,"practice-yard:"+key);
  assert.ok(a.g.state.met.includes(0));assert.equal(a.g.trialAccess().open,false);
  const save=a.save();a.click("yard-play",key);
  a.click("rehearse-move","useSkill|leaf-flurry");await tick();
  a.click("rehearse-rewind");a.click("rehearse-view","switches");a.click("rehearse-move","swap|cindlet");await tick();
  const revise=a.model().sections.find(s=>s.title?.includes("Same decision")).rows;
  assert.match(revise[0].detail,/38 → 29/);assert.match(revise[1].detail,/Cindlet/);
  assert.equal(a.save(),save);assert.equal(a.g.state.battle,null);
  const cold=boot(url,save);assert.equal(cold.model().id,"practice-yard:"+key);
  assert.equal(cold.g.state.battle,null);assert.deepEqual(clone(cold.g.state.crests),[]);
});

test("a planned duet can be carried into the ring, played manually and recovered after choosing an alternate opening",async()=>{
  const a=boot("#chalkyard/duets",null,g=>{ok(g.setLead("sprigkit"));});
  const before=a.save();assert.equal(a.model().title,"Plan a duet");
  a.click("yard-duet-choose","cindlet");assert.equal(a.model().title,"Firebreak");
  a.click("yard-duet-play","cindlet");
  let guide=a.model().sections[0];assert.match(guide.title,/Firebreak · step 1 of 2/);
  const first=guide.rows[0].value,other=first==="useSkill|leaf-flurry"?"useSkill|brush-dash":"useSkill|leaf-flurry";
  a.click("rehearse-move",other);await tick();assert.match(a.model().sections[0].title,/alternate line/);
  a.click("rehearse-rewind");assert.equal(a.model().sections[0].rows[0].value,first);
  a.click("rehearse-move",first);await tick();
  guide=a.model().sections[0];assert.match(guide.title,/step 2 of 2/);assert.equal(guide.rows[0].value,"useDuet|cindlet");
  a.click("rehearse-move","useDuet|cindlet");await tick();assert.match(a.model().sections[0].title,/Firebreak landed/);
  assert.equal(a.g.state.battle,null);assert.equal(a.save(),before);
});

test("a revised opening reaches the real wild battle through party review and the field guide records the paid move",async()=>{
  const target="0/wild/mossbell",a=boot("#chalkyard/"+target,null,g=>ok(g.setLead("cindlet")));
  const career=a.save();a.click("yard-play",target);
  a.click("rehearse-move","useSkill|ember-pop");await tick();
  a.click("rehearse-rewind");a.click("rehearse-move","useSkill|cinder-roll");await tick();
  const revision=a.model().sections.find(s=>s.title?.includes("Same decision"));
  assert.match(revision.rows[0].label,/Ember Pop/);assert.match(revision.rows[1].label,/Cinder Roll/);
  for(let n=0;n<8&&a.model().title!=="Practice won";n++){
    a.click("rehearse-move","useSkill|ember-pop");await tick();
  }
  assert.equal(a.model().title,"Practice won");assert.equal(a.save(),career);
  a.click("rehearse-trail");assert.equal(a.model().title,"Bring this party to the trail");
  a.click("roster-field");
  const opening=a.model().sections.find(s=>s.title==="Opening from your rehearsal").rows;
  assert.equal(opening[0].label,"Turn 1 · Cinder Roll");
  assert.equal(opening[1].label,"Turn 2 · Ember Pop");
  assert.equal(opening.filter(r=>r.label.startsWith("Turn 1")).length,1);

  a.click("card-walk");a.walk();
  assert.equal(a.model().id,"field-card:");assert.equal(a.g.state.landmark,"wild");
  a.click("card-battle");assert.equal(a.model().id,"battle:");
  const guide=a.model().sections.find(s=>s.title==="Chalkyard · turn 1");
  assert.equal(guide.rows[0].id,"skill");assert.equal(guide.rows[0].value,"cinder-roll");
  assert.ok(guide.text.includes(opening[0].detail));
  const forecast=a.g.ordinaryForecast("cinder-roll"),foeHp=a.g.state.battle.enemy.hp,lead=a.g.team().find(p=>p.id==="cindlet"),before=lead.hp;
  a.click(guide.rows[0].id,guide.rows[0].value);await tick();
  assert.equal(a.g.state.battle.enemy.hp,foeHp-forecast.damage);assert.equal(lead.hp,before-forecast.returnDamage);
  assert.equal(a.model().sections.find(s=>s.title==="Chalkyard · turn 2").rows[0].value,"ember-pop");
  for(let n=0;a.g.state.battle&&n<8;n++){a.click("skill","ember-pop");await tick();}
  assert.equal(a.g.state.wins,1);
  const recap=a.model().sections.find(s=>s.title==="Field card · Mossbell");
  assert.equal(recap.rows[0].label,"Turn 1 · Cinder Roll");assert.ok(recap.rows[0].detail.includes(opening[0].detail));
});

test("a field card at Fern's real lodge presents her ordinary campaign gate before the Leaf Crest",()=>{
  const meeting=boot("#chalkyard");meeting.click("walk-kind","warden|warden");meeting.walk();
  meeting.click("yard-invite");assert.ok(meeting.g.state.met.includes(0));assert.equal(meeting.g.state.landmark,"warden");
  const a=boot("#chalkyard/field/0/warden/mossbell/sprigkit/sprigkit+cindlet+dewfin",meeting.save());
  assert.equal(a.model().id,"field-card:");const gate=a.g.trialAccess();assert.equal(gate.open,false);
  const rows=a.model().sections.flatMap(s=>s.rows||[]);
  assert.ok(rows.some(r=>r.id==="nav"&&r.value==="warden"&&r.detail===gate.reason));
  assert.ok(!rows.some(r=>r.id==="card-battle"));
  a.click("nav","warden");assert.equal(a.model().title,"Warden Fern");
  assert.ok(a.model().sections.flatMap(s=>s.rows||[]).find(r=>r.id==="accept-trial").disabled);
  assert.equal(a.g.startBattle("warden").ok,false);assert.equal(a.g.state.battle,null);assert.equal(a.g.state.crests.length,0);
});

test("walk from Mossbrook to Iona, rehearse an opener and take Dewfin’s guard into a campaign battle",async()=>{
  const a=boot(""),g=a.g,all=()=>a.model().sections.flatMap(s=>s.rows||[]);
  a.click("walk-kind","third-beat|third-beat");a.walk();
  assert.equal(a.model().title,"Three-Bell Landing");assert.deepEqual(clone(g.state.positions[0]),{x:17,y:8});
  const before=a.save();a.click("open-trios");a.click("trio-line","slick-slide");
  assert.match(a.model().title,/Firebreak.*Slick Slide/);
  a.click("trio-play","slick-slide");
  for(const cmd of ["useSkill|leaf-flurry","useDuet|cindlet","useTrio|dewfin|slick-slide"]){
    assert.equal(a.model().sections[0].rows[0].value,cmd);a.click("rehearse-move",cmd);await tick();
  }
  assert.equal(a.model().sections[0].title,"Trio completed");assert.equal(a.save(),before);
  for(let n=0;a.model().title!=="Practice won"&&n<6;n++){a.click("rehearse-move","useSkill|slick-slide");await tick();}
  a.click("rehearse-trail");a.click("roster-field");a.click("card-walk");a.walk();
  a.click("card-battle");a.click("skill","leaf-flurry");await tick();
  a.click("nav","duets");a.click("duet","cindlet");await tick();
  const guide=a.model().sections.find(s=>s.title==="Chalkyard · turn 3");
  assert.equal(guide.rows[0].id,"trio");assert.match(guide.rows[0].detail,/24\/30 HP/);
  a.click("trio","dewfin|slick-slide");await tick();
  assert.equal(g.state.battle.activeId,"dewfin");assert.equal(g.team().find(k=>k.id==="dewfin").hp,24);
  assert.deepEqual(Object.keys(g.state.thirdBeat).sort(),["first","guard"]);
  a.click("skill","slick-slide");await tick();
  assert.match(a.model().title,/won/);assert.ok(g.state.wins);
  assert.ok(all().some(r=>r.id==="nav"&&r.value==="third-beat"));
  const rec=a.model().sections.find(s=>s.title==="Field card · Opalclasp").rows;
  assert.match(rec[2].detail,/Dewfin 30 → 24 HP/);assert.match(rec[2].detail,/Practice/);
  const b=boot("#third-beat",a.save());
  assert.match(b.model().kicker,/2 OF 3 BELLS/);
  assert.match(b.model().sections.find(s=>s.title==="The storm bell").text,/6 damage.*24 HP/);
  assert.equal(b.g.state.thirdBeat.warden,undefined);
});

test("a saved trio URL reopens its opponent, team and final move without equipping a traveling party",()=>{
  const url="#chalkyard/trios/0/wild/opalclasp/sprigkit/dewfin+sprigkit+cindlet/cindlet/dewfin/bubble-jet";
  const a=boot(url);assert.match(a.model().title,/Firebreak.*Bubble Jet/);
  assert.deepEqual(clone(a.g.state.team),["sprigkit","cindlet","dewfin"]);assert.equal(a.g.state.battle,null);
  const b=boot(url.replace("opalclasp","unknown"));
  assert.equal(b.model().title,"Build a Trio");assert.equal(b.g.state.battle,null);
  const c=boot("#chalkyard/trios/cindlet");
  assert.equal(c.model().formationStrip.slots[0].name,"Cindlet");assert.equal(c.g.state.lead,"sprigkit");
});
