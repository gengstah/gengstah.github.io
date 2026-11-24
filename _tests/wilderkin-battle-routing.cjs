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
  const w={localStorage,location:{hash},Event,setTimeout,dispatchEvent:event=>listeners[event.type]?.(event),
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
    click(id,value){const rows=model.sections.flatMap(s=>s.rows||[]);const found=rows.find(r=>r.id===id&&(value===undefined||value===r.value));
      assert.ok(found&&!found.disabled,id+" / "+value+" on "+model.title);input.action(found.id,found.value);},
    walk(){for(let i=0;frames.length&&i<300;i++){time+=130;frames.shift()(time);}assert.equal(frames.length,0);}
  };
}
const ok=result=>assert.ok(result.ok,result.message);
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
