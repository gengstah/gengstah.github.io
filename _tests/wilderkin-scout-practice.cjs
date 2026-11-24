const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const scripts=["atlas","bestiary","activities","campaign","story","duets","sparring-gear","sparring-signatures","sparring-battle","sparring-teams","partner-search","scout-practice","sparring","engine"].map(name=>{
  const file=path.join(__dirname,"../games/wilderkin",name+".js");return new vm.Script(fs.readFileSync(file,"utf8"),{filename:file});
});
const plain=x=>JSON.parse(JSON.stringify(x)),settle=()=>new Promise(r=>setImmediate(r));
const route="scout-practice",key="wilderkin.scout-practice.v1";

function boot(store=new Map(),draw=0){
  let view=route,call=null,ongoing=false;const finders=[],messages=[];
  const localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
  const ctx=vm.createContext({window:{localStorage,crypto:{getRandomValues:a=>{a[0]=draw;return a;}},prompt:()=>"kilnbeak"}});
  scripts.forEach(s=>s.runInContext(ctx));
  const w=ctx.window,g=w.WilderGame,sim=w.WilderSparringBattle.create({game:g});
  const row=(id,label,value,detail,extra)=>({id,label,value,detail,...extra});
  const controls={game:g,sim,row,openFinder:context=>finders.push(context),notify:m=>messages.push(m),image:id=>"portrait/"+id,live:()=>ongoing,show:v=>{view=v;},
    readSetup:()=>g.state.sparring.setup,playFromPractice:(raw,moves,expected,first)=>{call={raw,moves,expected,first};return true;}};
  const desk=w.WilderScoutPractice.create(controls);
  const model=()=>desk.model(view),rows=()=>model().sections.flatMap(s=>s.rows||[]);
  function click(id,value){
    const button=rows().find(r=>r.id==="scout-pr-"+id&&(value===undefined||value===r.value));
    assert.ok(button&&!button.disabled,[id,value,model().title,JSON.stringify(rows().filter(r=>r.id))].join(" "));
    assert.equal(desk.act(button.id,button.value),true);
  }
  const h={g,sim,w,controls,store,desk,model,rows,click,finders,messages,call:()=>call,live:v=>{ongoing=v;},reload:()=>boot(store,draw)};
  return h;
}
function register(h,ids=["sprigkit","cindlet","dewfin"]){
  h.click("register");for(const id of ids)h.click("pick",id);
}
function revealed(h){
  return plain(h.model().sections.filter(s=>s.rows?.some(r=>r.badge==="Sits out")).map(s=>s.rows.map(r=>r.label)));
}

test("public rosters, optional gear and all sixteen actual opening reads are available before either order is revealed",()=>{
  const h=boot();
  assert.equal(h.model().title,"Scout Table practice");h.click("register");
  assert.equal(h.model().title,"Pick your three");
  assert.equal(h.rows().find(r=>r.id==="scout-pr-lock").disabled,true);
  assert.ok(h.model().sections.at(-2).rows.every(r=>!r.badge));
  h.click("view",route+":scout");
  const card=h.model(),rivals=card.sections[1].rows;
  assert.equal(rivals.length,4);assert.equal(card.sections[2].rows.length,6);
  assert.ok(rivals.every(r=>/deals \d+/.test(r.detail)&&r.label.includes(" · ")&&r.image));
  for(const rival of rivals){
    h.click("view",rival.value);const chances=h.model().sections[0].rows;
    assert.equal(chances.length,4);assert.ok(chances.every(r=>/deals \d+.+deals \d+/.test(r.detail)));
    h.click("view",route+":scout");
  }
  h.click("view",route);const picks=h.model().sections.find(s=>s.title==="Choose in battle order").rows;
  assert.equal(picks.length,4);assert.ok(picks.every(r=>/for \d+/.test(r.detail)));
  h.click("pick","cindlet");h.click("pick","dewfin");h.click("pick","cindlet");h.click("pick","sprigkit");
  assert.deepEqual(JSON.parse(h.store.get(key)).picks,["dewfin","sprigkit"]);
  const k=h.reload();assert.equal(k.model().title,"Pick your three");
  k.click("pick","gustlance");k.click("lock");assert.equal(k.model().title,"Both trios revealed");
  assert.deepEqual(revealed(k)[0],["Dewfin","Sprigkit","Gustlance","Cindlet"]);
  const again=k.reload();assert.deepEqual(revealed(again),revealed(k));assert.equal(again.model().subtitle,k.model().subtitle);
});

test("private picks and their lead order never influence the coach, while public roster and coach do",()=>{
  function choose(ids,coach,custom){
    const h=boot();if(coach)h.click("coach",coach);
    if(custom)for(const [i,id] of ["frostmull","iceribbon","icereeve","glazepip"].entries())h.desk.act("scout-pr-choose",i+"|"+id);
    register(h,ids);h.click("lock");h.click("play");
    return plain(h.call().raw);
  }
  const a=choose(["sprigkit","dewfin","gustlance"]),b=choose(["cindlet","gustlance","dewfin"]);
  assert.deepEqual(a.right,b.right);assert.notDeepEqual(a.left,b.left);
  const c=choose(["sprigkit","dewfin","gustlance"],"pike");
  assert.notDeepEqual(c.right,a.right);
  const d=choose(["frostmull","iceribbon","icereeve"],null,true);assert.notDeepEqual(d.right,a.right);
  for(const setup of [a,b,c,d]){
    assert.equal(new Set(setup.right).size,3);assert.equal(new Set(setup.left).size,3);
    for(const side of ["left","right"])assert.ok(Object.keys(setup.gear[side]).every(k=>setup[side].includes(k)));
  }
});

test("the die is rolled once after locking, both seats occur and an occupied Hall survives registration",()=>{
  for(let die=1;die<=6;die++){
    const h=boot(new Map(),die-1);register(h);
    assert.equal(JSON.parse(h.store.get(key)).die,undefined);
    h.click("lock");assert.match(h.model().subtitle,new RegExp("showed "+die+"\\."));
    h.live(true);assert.ok(h.rows().some(r=>r.id==="spar-view"&&r.value==="match"));
    h.desk.act("scout-pr-play");assert.equal(h.call(),null);
    h.live(false);h.click("play");assert.equal(h.call().first,die%2);
    assert.equal(h.call().expected,0);assert.deepEqual(plain(h.call().moves),[]);
    const before=JSON.stringify(h.call());
    h.desk.act("scout-pr-play");assert.equal(JSON.stringify(h.call()),before);
    h.click("restart");assert.equal(h.model().title,"Scout Table practice");
    assert.equal(JSON.parse(h.store.get(key)).die,undefined);
  }
});

test("the 500-loaner catalog, carried Hall equipment, registration slots and traveled kin stay independent",()=>{
  const h=boot(),s=h.g.state.sparring.setup;
  s.left=["kilnbeak","gustlance","pincoil"];s.gear={left:{kilnbeak:"prism-lens",gustlance:"relay-bell"}};
  const old=JSON.stringify(h.g.state);
  h.click("borrow","hall");
  let draft=JSON.parse(h.store.get(key));assert.deepEqual(draft.ids,[...s.left,"sprigkit"]);
  assert.deepEqual(draft.gear,s.gear.left);
  h.click("view",route+":member:0");h.click("view",route+":gear:0");
  assert.equal(h.rows().find(r=>r.label==="Relay Bell").disabled,true);
  h.desk.act("scout-pr-equip","0|relay-bell");assert.equal(JSON.parse(h.store.get(key)).gear.kilnbeak,"prism-lens");
  h.click("view",route+":catalog:0:0");assert.ok(h.model().sections.some(s=>s.title==="500 loaners"));
  h.click("search",0);assert.ok(h.model().sections.some(s=>s.title==="1 loaner"));
  h.click("clear",0);h.desk.act("scout-pr-choose","0|arcbill");draft=JSON.parse(h.store.get(key));
  assert.deepEqual(draft.ids,["arcbill","gustlance","pincoil","sprigkit"]);assert.equal(draft.gear.kilnbeak,undefined);
  h.click("borrow","trail");assert.deepEqual(JSON.parse(h.store.get(key)).ids,["sprigkit","cindlet","dewfin","arcbill"]);
  assert.equal(JSON.stringify(h.g.state),old);
  h.store.set(key,JSON.stringify({v:1,ids:["sprigkit","cindlet","dewfin","alien"],gear:{},coach:"pike",phase:"played"}));
  assert.equal(h.reload().model().title,"Scout Table practice");
});

test("the real Hall can play a coach-first Scout Table fight through human reserve selection, reload, matching film and a fresh registration",async()=>{
  const h=boot(),g=h.g;
  let view=route;
  const hall=h.w.WilderSparring.create({game:g,row:h.controls.row,image:h.controls.image,go:(_,v)=>{view=v;},render(){},notify(){},animate:()=>Promise.resolve()});
  const rows=()=>hall.model(view).sections.flatMap(s=>s.rows||[]);
  function click(id,value){
    const r=rows().find(b=>b.id===id&&(value===undefined||b.value===value));
    assert.ok(r&&!r.disabled,id+" in "+hall.model(view).title);hall.act(r.id,r.value);
  }
  click("scout-pr-register");for(const id of ["cindlet","dewfin","gustlance"])click("scout-pr-pick",id);
  click("scout-pr-lock");click("scout-pr-play");await settle();
  assert.equal(view,"match");assert.equal(g.state.sparring.match.first,1);assert.equal(g.state.sparring.match.moves.length,1);
  assert.match(hall.model(view).subtitle,/Nell Weir/);
  const active=h.reload(),saved=plain(active.g.state.sparring);
  const checkHall=active.w.WilderSparring.create({...active.controls,go(){},render(){},notify(){}});
  assert.match(checkHall.model("match").subtitle,/Nell Weir/);
  assert.ok(checkHall.model("log:0").sections[0].rows.some(r=>r.detail.includes("Nell Weir")));
  for(const [kind,mutate] of [
    ["Visiting crew",r=>{delete r.match.scout;}],
    ["Guest crew",r=>{r.match.setup.rival="shared";}],
    ["Visiting crew",r=>{r.match.scout.coach="pike";}],
    ["Visiting crew",r=>{r.match.scout.die=2;}],
    ["Visiting crew",r=>{r.match.scout.gear.cindlet="last-stitch";}],
    ["Visiting crew",r=>{r.match.scout.picks.reverse();}]
  ]){
    const raw=plain(saved);mutate(raw);
    active.g.state.sparring=active.w.WilderSparring.restore(raw,{species:active.g.species});
    assert.equal(active.g.state.sparring.match.scout,undefined);
    assert.ok(checkHall.model("match").subtitle.includes(kind));
  }
  function tape(){
    const m=g.state.sparring.match;let p=h.sim.start(m.setup.left,m.setup.right,m.first,m.setup.gear);
    for(const id of m.moves)p=h.sim.apply(p,id);return p;
  }
  let fought=0,p=tape(),humanReplace=false;
  while(p.phase!=="done" && fought++<70){
    const best=h.sim.recommend(p);
    if(best.kind==="replace")humanReplace=true;
    if(["duet","swap","signature"].includes(best.kind))click("spar-view","cmd:"+best.kind);
    if(best.kind==="ember-art"&&best.emberArtId==="banked-warmth")click("spar-view","cmd:ember");
    click("spar-move",best.id);await settle();p=tape();
  }
  assert.equal(p.phase,"done");assert.ok(humanReplace);
  const review=plain(hall.reviewRecord());assert.deepEqual(review.moves,plain(g.state.sparring.match.moves));assert.deepEqual(review.gear,plain(g.state.sparring.match.setup.gear));
  assert.equal(review.scout.coach,"weir");
  assert.deepEqual(plain(h.reload().g.state.sparring.lastReview),review);
  assert.ok(hall.model("result").sections.some(s=>s.rows?.some(r=>r.label==="Nell Weir")));
  view=route;assert.ok(rows().some(r=>r.id==="spar-view"&&r.value==="result"));
  click("scout-pr-restart");assert.equal(hall.model(view).title,"Scout Table practice");
  assert.deepEqual(plain(hall.reviewRecord()),review);
});

test("two private picks reveal the two remaining candidates’ real duet options, and the final three can review every pair before locking",()=>{
  const h=boot();
  h.click("register");h.click("pick","cindlet");
  assert.ok(!h.rows().some(r=>r.value===route+":duets"));
  assert.equal(h.desk.model(route+":duets").title,"Pick your three");
  h.click("pick","dewfin");h.click("view",route+":duets");
  const compare=h.model(),sections=compare.sections.filter(s=>s.title.endsWith(" as third"));
  assert.equal(sections.length,2);
  for(const [section,id] of sections.map((s,i)=>[s,["sprigkit","gustlance"][i]])){
    const real=h.sim.options(h.sim.start(["cindlet","dewfin",id],["mossbell","coalmoth","pincoil"],0))
      .find(m=>m.kind==="duet"&&m.targetId===id);
    assert.equal(section.rows.length,3);
    assert.equal(section.rows[0].label,real.label+" · "+real.cost+" beats");
    assert.ok(section.rows[0].detail.includes(h.g.species[id].name));
    assert.equal(section.rows[2].value,id);
    assert.equal(section.rows[1].label,h.w.WilderDuets.score("Tide",h.g.species[id].type).name+" · "+h.w.WilderDuets.score("Tide",h.g.species[id].type).cost+" beats");
  }
  assert.equal(compare.sections.find(s=>s.title==="Your existing pair").rows.length,1);
  h.click("pick","gustlance");
  assert.equal(h.model().title,"Pick your three");assert.ok(!h.rows().find(r=>r.id==="scout-pr-lock").disabled);
  h.click("view",route+":duets");
  const trios=h.model().sections[0].rows;
  assert.equal(trios.length,3);
  assert.ok(trios.every(r=>!r.detail.includes("Sprigkit")&&!r.detail.includes("Mossbell")));
  h.click("view",route);h.click("lock");assert.equal(h.model().title,"Both trios revealed");
  assert.equal(h.desk.model(route+":duets").title,"Both trios revealed");
});

test("solo registration passes only the published coach four and legal gear to Finder, routes searches, and rejects stale and locked drafts",()=>{
  const h=boot();h.click("view",route+":member:1");h.click("finder",1);
  let f=h.finders.at(-1);assert.deepEqual(plain(f.foes),["mossbell","coalmoth","glimmeray","pincoil"]);
  assert.equal(f.foeGear.pincoil,"relay-bell");assert.equal(f.anchor,"sprigkit");assert.equal(f.slot,1);
  assert.equal(f.apply("dewfin"),false);assert.equal(f.apply("cindlet"),true);
  h.click("view",route+":catalog:1:0");h.w.prompt=()=>"Rain Garden";h.click("search",1);
  assert.ok(h.model().sections.find(s=>s.title==="0 loaners").rows.some(r=>r.id==="scout-pr-find-catalog"));
  h.click("find-catalog","1|0");f=h.finders.at(-1);assert.deepEqual([f.role,f.query],["mend","Rain Garden"]);
  f.back();assert.equal(h.model().title,"Choose a registered kin");h.w.prompt=()=>"Coil Snap";h.click("search",1);
  const hits=h.rows().filter(r=>r.id==="scout-pr-choose");assert.ok(hits.length&&hits.every(r=>h.g.species[r.value.split("|")[1]].skills.some(s=>s.name==="Coil Snap")));h.w.prompt=()=>"heal";h.click("search",1);h.click("find-catalog","1|0");
  f=h.finders.at(-1);assert.deepEqual([f.role,f.query],["mend",""]);assert.equal(f.apply("thicketowl"),true);
  let saved=JSON.parse(h.store.get(key));assert.deepEqual(saved.ids,["sprigkit","thicketowl","dewfin","gustlance"]);assert.deepEqual(saved.gear,{gustlance:"opening-pennant"});
  h.click("view",route);h.click("view",route+":member:3");h.click("finder",3);f=h.finders.at(-1);assert.equal(f.apply("gustlance"),true);
  assert.ok(JSON.parse(h.store.get(key)).gear.gustlance);h.click("finder",3);assert.equal(h.finders.at(-1).apply("marshcurl"),true);
  assert.deepEqual(JSON.parse(h.store.get(key)).gear,{});
  h.click("finder",3);const stale=h.finders.at(-1),other=h.reload();other.click("coach","pike");
  assert.equal(stale.apply("kilnbeak"),false);stale.back();h.click("finder",3);
  f=h.finders.at(-1);assert.deepEqual(plain(f.foes),["gustlance","arcbill","icereeve","kilnbeak"]);
  const second=h.reload();second.click("register");assert.equal(f.apply("kilnbeak"),false);f.back();assert.equal(h.model().title,"Pick your three");
});
