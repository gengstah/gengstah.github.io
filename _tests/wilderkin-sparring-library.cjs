const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const files=["atlas","bestiary","activities","story","campaign","duets","sparring-gear","sparring-battle","sparring-library","sparring-teams","sparring","engine"];
const copy=x=>JSON.parse(JSON.stringify(x));
function boot(raw){
  let save=raw,view="bench";
  const jobs=[];
  const win={localStorage:{getItem:id=>id==="wilderkin.trail.v3"?save:null,setItem:(_,value)=>save=value}};
  const ctx=vm.createContext({window:win,setTimeout:fn=>jobs.push(fn),performance});
  for(const name of files)vm.runInContext(fs.readFileSync(path.join(__dirname,"../games/wilderkin",name+".js"),"utf8"),ctx);
  const g=win.WilderGame;
  const hall=win.WilderSparring.create({game:g,row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),image:id=>id,
    render(){},notify(){},go:(screen,path)=>{assert.equal(screen,"sparring");view=path;}});
  const model=()=>hall.model(view), rows=()=>model().sections.flatMap(s=>s.rows||[]);
  const press=(id,value)=>{const row=rows().find(r=>r.id===id&&r.value===value);assert.ok(row&&!row.disabled,id+"/"+value+" in "+view);hall.act(id,value);};
  const set=patch=>{const r=g.state.sparring;g.saveSparring({...r,setup:win.WilderSparringTeams.restore({...r.setup,...patch},{species:g.species})});};
  return {g,hall,model,rows,press,set,win,jobs,view:()=>view,save:()=>save};
}
test("the case copies and names a build, survives reload and recalls gear without changing the opposing team",()=>{
  const h=boot(),baseline=copy(h.g.state.sparring.setup);
  h.set({gear:{left:{sprigkit:"opening-pennant",cindlet:"relay-bell"},right:{mossbell:"last-stitch"}}});
  h.press("bench-save","0");h.press("bench-rename","0");h.hall.act("bench-letter","0|clear");
  for(const ch of "Bell crew")assert.ok(h.hall.key({key:ch},h.view()));
  h.hall.key({key:"Enter"},h.view());assert.equal(h.g.state.sparring.slots[0].name,"Bell crew");
  h.set({left:["cindlet","sprigkit","dewfin"],gear:{left:{},right:{mossbell:"last-stitch"}}});
  const fresh=boot(h.save());fresh.press("bench-open","bench:card:0");fresh.press("bench-recall","0");
  const next=fresh.g.state.sparring.setup;
  assert.deepEqual(copy(next.left),baseline.left);assert.deepEqual(copy(next.right),baseline.right);
  assert.deepEqual(copy(next.gear),{left:{sprigkit:"opening-pennant",cindlet:"relay-bell"},right:{mossbell:"last-stitch"}});
  const clean=fresh.win.WilderSparringLibrary.restore([null,{team:["stillwake","cindlet","dewfin"]},{team:["sprigkit","sprigkit","dewfin"]},fresh.g.state.sparring.slots[0]],{species:fresh.g.species});
  assert.ok(!clean[1]&&!clean[2]);assert.equal(clean[3].name,"Bell crew");
});
test("four trial matches use both first seats, expose actual opening triggers and never alter the saved match",()=>{
  const h=boot();h.press("bench-save","0");
  h.set({gear:{left:{sprigkit:"opening-pennant",dewfin:"relay-bell"},right:{mossbell:"last-stitch"}}});
  const before=JSON.stringify(h.g.state);h.press("bench-compare","0");
  while(h.jobs.length)h.jobs.shift()();
  assert.equal(h.model().title,"Practice results");
  const choices=h.rows().filter(r=>r.value?.startsWith("bench:game:"));assert.equal(choices.length,4);
  assert.match(choices[0].label,/your lead opens/);assert.match(choices[1].label,/rival opens/);
  assert.match(choices[2].label,/your lead opens/);assert.match(choices[3].label,/rival opens/);
  const sim=h.win.WilderSparringBattle.create({species:h.g.species}),s=h.g.state.sparring.setup;
  let p=sim.start(s.left,s.right,0,s.gear);while(p.phase!=="done")p=sim.apply(p,sim.recommend(p).id);
  h.press("bench-open","bench:game:2");
  assert.equal(h.model().title,(p.winner===0?"Win":p.winner===1?"Loss":"Draw")+" in "+p.ply+" actions");
  assert.ok(h.rows().some(r=>r.label.includes("Opening bell · Sprigkit · Opening Pennant")));
  assert.equal(JSON.stringify(h.g.state),before);
  h.press("bench-open","bench:trial:0");h.press("bench-open","bench:card:0");h.press("bench-rival","0");
  assert.deepEqual(copy(h.g.state.sparring.setup.right),copy(s.left));
  assert.deepEqual(copy(h.g.state.sparring.setup.gear.right),{});
});
test("replacing a saved build requires the replacement screen and a live match cannot change it",()=>{
  const h=boot();h.press("bench-save","0");h.set({left:["cindlet","dewfin","sprigkit"]});
  h.press("bench-open","bench:replace:0");h.press("bench-open","bench:card:0");
  assert.equal(h.g.state.sparring.slots[0].team[0],"sprigkit");
  h.press("bench-open","bench:replace:0");h.press("bench-replace","0");
  assert.equal(h.g.state.sparring.slots[0].team[0],"cindlet");
  h.hall.act("spar-start");h.hall.act("bench-save","1");assert.equal(h.g.state.sparring.slots[1],null);
});
test("the Earth Wire workshop changes a real coached outcome, even with an ongoing official match",()=>{
  const h=boot();h.hall.act("spar-start");
  const before=copy(h.g.state);
  h.hall.act("spar-view","bench:workshop");
  assert.equal(h.model().title,"The Earth Wire wager");
  h.press("bench-experiment","opening-pennant");
  while(h.jobs.length)h.jobs.shift()();
  const outcomes=h.rows().filter(r=>r.value?.startsWith?.("bench:game:")).map(r=>r.label.split(" · ")[0]);
  assert.deepEqual(copy(outcomes),["Loss","Loss","Win","Win"]);
  const starting=h.model().sections.find(s=>s.title==="Before the first move");
  assert.match(starting.rows[0].detail,/0\/3/);assert.match(starting.rows[1].detail,/1\/3/);
  const divergence=h.model().sections.find(s=>s.title.startsWith("First different move"));
  assert.match(divergence.rows[0].detail,/Rival Coilcrown · Spark Thread/);
  assert.match(divergence.rows[1].detail,/Rival Coilcrown · Horn Brace/);
  h.press("bench-open","bench:game:2");assert.ok(h.rows().some(r=>r.label.includes("Opening Pennant")));
  assert.ok(h.rows().some(r=>r.label==="Action 2 · Horn Brace"));
  h.press("bench-open","bench:game:2:1");assert.ok(h.rows().some(r=>r.label==="Earlier actions"));
  h.hall.act("bench-adopt");assert.deepEqual(copy(h.g.state),before);
});
test("the Bell Keepers comparison explains a changed result that only occurs when the rival opens",()=>{
  const h=boot();
  h.press("bench-save","0");
  h.set({gear:{left:{dewfin:"mender-wrap"},right:{}}});
  h.press("bench-compare","0");
  while(h.jobs.length)h.jobs.shift()();

  const outcomes=h.rows().filter(r=>r.value?.startsWith?.("bench:game:")).map(r=>r.label.split(" · ")[0]);
  assert.deepEqual(copy(outcomes),["Loss","Win","Loss","Loss"]);
  const changes=h.model().sections.filter(s=>s.title.startsWith("First different move"));
  assert.equal(changes.length,1);
  assert.match(changes[0].title,/when the rival opened$/);
  const [bare,equipped]=changes[0].rows;
  assert.match(bare.label,/action 15$/);assert.match(equipped.label,/action 15$/);
  assert.match(bare.detail,/Mossbell · Switch to Glimmeray/);
  assert.match(equipped.detail,/Mossbell · Rain Garden against Dewfin for 20 damage/);
});
