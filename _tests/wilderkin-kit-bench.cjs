const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const scripts=["atlas","bestiary","activities","story","campaign","duets","sparring-gear","trail-fittings","engine","kit-bench"].map(id=>{
  const file=path.join(__dirname,"../games/wilderkin",id+".js");
  return new vm.Script(fs.readFileSync(file,"utf8"),{filename:file});
});
function boot(disk=new Map()){
  const window={localStorage:{getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,v)}};
  const context=vm.createContext({window});scripts.forEach(script=>script.runInContext(context));
  const game=window.WilderGame,notes=[];
  let view=null;
  const bench=window.WilderKitBench.create({game,image:id=>"art/"+id+".png",
    row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),
    go:(screen,value)=>{assert.equal(screen,"kit-bench");view=value;},notify:n=>notes.push(n),render:()=>{}});
  const model=()=>bench.model(view),rows=()=>model().sections.flatMap(s=>s.rows||[]);
  const act=(id,value)=>bench.act(id,value,view);
  function press(id,value){
    const r=rows().find(r=>r.id===id&&(value===undefined||r.value===value));
    assert.ok(r&&!r.disabled,JSON.stringify([view,id,value,rows().map(r=>[r.id,r.value])]));return act(id,r.value);
  }
  return {window,game,bench,notes,model,rows,act,press,go:v=>{view=v;},view:()=>view};
}
const labels=h=>h.rows().map(r=>r.label);
const sections=h=>h.model().sections.map(s=>[s.title,s.text].join(" ")).join(" ");
const equip=(h,piece,id)=>{h.go("kin:"+id);h.press("kit-try",piece+"|"+id);h.press("kit-apply");};
function camp(h,crest=false){
  h.game.visitSite("camp");
  h.go(null);h.press("kit-claim","camp");
  if(crest){h.game.state.crests.push(0);h.press("kit-claim","crest");}
}
test("a fresh camp supplies three real pieces on request and the other three wait for the first crest",()=>{
  const h=boot();
  assert.ok(labels(h).includes("Walk to camp"));assert.ok(labels(h).includes("Fitting notebook"));
  h.press("kit-view","item:prism-lens");assert.match(sections(h),/Earn your first Warden crest/);
  camp(h);assert.equal(h.game.trailFittings().items.filter(i=>i.claimed).length,3);
  assert.ok(h.rows().filter(r=>r.image?.includes("art/gear/")).length===6);
  h.game.state.crests.push(0);h.press("kit-claim","crest");assert.ok(h.game.trailFittings().items.every(i=>i.claimed));
  assert.deepEqual(Object.keys(h.game.trailFittings().gear),[]);
});

test("moving an item identifies the old holder and both displaced pieces before real persistent equip or removal",()=>{
  const disk=new Map(),h=boot(disk);camp(h);
  equip(h,"opening-pennant","sprigkit");equip(h,"last-stitch","cindlet");
  h.go("kin:cindlet");h.press("kit-try","opening-pennant|cindlet");
  const changes=h.model().sections[0].rows;
  assert.deepEqual(Array.from(changes,r=>[r.label,r.detail]),[
    ["Cindlet","Lifeline Stitch → Opening Pennant"],["Sprigkit","Opening Pennant → No fitting"],["Lifeline Stitch","Returns to your case."]]);
  h.press("kit-view","kin:cindlet");assert.equal(h.game.trailFittings().gear.cindlet,"last-stitch");
  h.press("kit-try","opening-pennant|cindlet");h.press("kit-apply");
  const fresh=boot(disk);fresh.go("item:opening-pennant");assert.match(fresh.model().kicker,/CINDLET/);
  assert.deepEqual({...fresh.game.trailFittings().gear},{cindlet:"opening-pennant"});
  fresh.press("kit-remove","cindlet");assert.equal(fresh.model().sections[0].rows[0].detail,"Opening Pennant → No fitting");
  fresh.press("kit-apply");assert.deepEqual(Object.keys(fresh.game.trailFittings().gear),[]);
});

test("search and paging include real reserve companions and previews never enlist them",()=>{
  const h=boot();camp(h);
  for(const id of ["pincoil","thicketowl","cairnwatch","gustlance","mossbell","opalclasp","kilnclaw","coalmoth"])h.game.state.party.push(h.game.loaner(id,8));
  const party=h.game.state.team.join(","),hp=h.game.state.party.map(k=>k.hp).join(",");
  h.go("item:relay-bell");h.press("kit-view","item:relay-bell:1");assert.ok(labels(h).includes("Mossbell"));
  h.window.prompt=()=>"opal";h.bench.key({key:"/"},h.view());assert.equal(h.rows().filter(r=>r.id==="kit-try").length,1);
  h.press("kit-try","relay-bell|opalclasp");assert.match(sections(h),/Opalclasp is in camp reserve/);
  h.press("kit-apply");assert.equal(h.game.trailFittings().gear.opalclasp,"relay-bell");
  assert.equal(h.game.state.team.join(","),party);assert.equal(h.game.state.party.map(k=>k.hp).join(","),hp);
  h.go("item:relay-bell");h.window.prompt=()=>"missing name";h.press("kit-search","relay-bell");
  assert.match(sections(h),/No owned companions match/);h.press("kit-clear","relay-bell");assert.equal(h.rows().filter(r=>r.id==="kit-try").length,6);
});

test("a live fight, newer holder or another tab's campaign prevents a stale preview from moving a piece",()=>{
  const disk=new Map(),h=boot(disk);camp(h);equip(h,"opening-pennant","cindlet");h.go("kin:dewfin");
  h.press("kit-try","opening-pennant|dewfin");
  assert.ok(h.game.equipFitting("sprigkit","opening-pennant","cindlet").ok);
  assert.match(h.model().title,/changed/);h.act("kit-apply");assert.equal(h.game.trailFittings().gear.sprigkit,"opening-pennant");
  h.go("kin:dewfin");h.press("kit-try","opening-pennant|dewfin");
  const other=boot(disk);equip(other,"relay-bell","dewfin");
  h.act("kit-apply");assert.match(h.notes.at(-1),/save changed/);assert.ok(labels(h).includes("Load the latest trail save"));
  let reloaded=false;h.window.location={reload:()=>{reloaded=true;}};h.press("kit-reload");assert.equal(reloaded,true);
  const latest=boot(disk);assert.deepEqual({...latest.game.trailFittings().gear},{sprigkit:"opening-pennant",dewfin:"relay-bell"});
  latest.go("kin:dewfin");latest.press("kit-try","opening-pennant|dewfin");
  latest.game.visitSite("wild");assert.ok(latest.game.startBattle("wild","mossbell").ok);
  assert.ok(!latest.rows().some(r=>r.id==="kit-apply"));latest.act("kit-apply");
  assert.equal(latest.game.trailFittings().gear.dewfin,"relay-bell");
});

test("tactics calculate a real guard's most injured healthy reserve and show engine forecasts when selecting local rivals",()=>{
  const h=boot();camp(h,true);
  const sprig=h.game.state.party.find(k=>k.id==="sprigkit"),dew=h.game.state.party.find(k=>k.id==="dewfin");
  sprig.hp=0;dew.hp-=4;
  h.go("kin:cindlet");h.press("kit-try","mender-wrap|cindlet");assert.match(sections(h),/restore 4 HP to Dewfin/);
  h.go("kin:cindlet");h.press("kit-try","prism-lens|cindlet");
  const before=JSON.stringify(h.game.state);
  for(const foe of h.game.pools[h.game.state.region]){
    h.act("kit-foe",foe);const expected=h.game.trailFittingPreview("cindlet","prism-lens",foe);
    if(expected)assert.ok(sections(h).includes(expected.before+" → "+expected.after+" damage"));
    else assert.match(sections(h),/No ordinary strike.*gains damage/);
    assert.ok(sections(h).includes(h.game.species[foe].name));
  }
  assert.equal(JSON.stringify(h.game.state),before);
});
