const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const files=["atlas","bestiary","activities","campaign","story","duets","stillwake","sparring-gear","sparring-battle","sparring-teams","partner-search","sparring","engine"].map(id=>{
  const file=path.join(__dirname,"../games/wilderkin",id+".js");
  return new vm.Script(fs.readFileSync(file,"utf8"),{filename:file});
});
const copy=v=>JSON.parse(JSON.stringify(v));
function room() {
  const win={location:{origin:"https://example.org",pathname:"/games/wilderkin/",search:"?game=1"}},ctx=vm.createContext({window:win});
  files.forEach(s=>s.runInContext(ctx));
  const game=win.WilderGame,ui={view:null,ready:0,notices:[]},module=win.WilderSparringTeams;
  let saved=module.restore(null,{species:game.species});
  const b=module.create({game,row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),
    image:(id,owned)=>{assert.equal(owned,false);return "original:"+id;},go:(name,value)=>{assert.equal(name,"sparring");ui.view=value;},
    render:()=>{},notify:t=>ui.notices.push(t),onStart:()=>ui.ready++,openFinder:context=>{ui.finder=context;},
    read:()=>saved,write:p=>{saved={...saved,...p};}});
  return {b,game,ui,win,read:()=>saved};
}
function controls(page) {return page.sections.flatMap(s=>[...(s.rows||[]),...(s.grid?.cells||[])]);}
test("Hall partner selection changes the intended slot, keeps the opponent and surviving equipment, and supports both sides",()=>{
  const {b,game,ui,read}=room(),campaign=JSON.stringify(game.state);
  b.act("spar-team-equip","left:0:last-stitch");b.act("spar-team-equip","left:2:mender-wrap");
  b.act("spar-team-equip","right:0:opening-pennant");b.act("spar-team-equip","right:1:relay-bell");
  const before=copy(read()),home=b.partnerContext("left",0,{anchor:"dewfin"});
  assert.equal(home.anchor,"dewfin");assert.equal(home.slot,0);
  assert.deepEqual(copy(home.team),before.left);assert.deepEqual(copy(home.foes),before.right);
  assert.deepEqual(copy(home.gear),before.gear.left);assert.deepEqual(copy(home.foeGear),before.gear.right);
  for(const illegal of ["dewfin","stillwake","missing",null])assert.equal(home.apply(illegal),false);
  assert.deepEqual(copy(read()),before);
  assert.equal(b.partnerContext("left",0).apply("sprigkit"),true);assert.deepEqual(copy(read()),before);
  assert.equal(home.apply("marshcurl"),true);assert.equal(ui.view,"edit:left:team");
  assert.deepEqual(copy(read()),{...before,left:["marshcurl","cindlet","dewfin"],gear:{...before.gear,left:{dewfin:"mender-wrap"}}});
  const display=controls(b.page("edit:right:member:1")).find(r=>r.id==="spar-team-finder");
  b.act(display.id,display.value);const guest=ui.finder;
  assert.equal(guest.anchor,"mossbell");assert.equal(guest.slot,1);assert.deepEqual(copy(guest.foes),copy(read().left));
  guest.back();assert.equal(ui.view,"edit:right:member:1");
  b.act(display.id,display.value);assert.equal(ui.finder.apply("coalmoth"),true);assert.equal(read().rival,"bell-keepers");
  b.act(display.id,display.value);assert.equal(ui.finder.apply("dewfin"),true);assert.equal(ui.view,"edit:right:team");
  assert.equal(read().rival,"custom");assert.deepEqual(copy(read().right),["mossbell","dewfin","glimmeray"]);
  assert.deepEqual(copy(read().gear),{left:{dewfin:"mender-wrap"},right:{mossbell:"opening-pennant"}});
  assert.equal(JSON.stringify(game.state),campaign);
});
test("stale Hall slot and gear forecasts do not overwrite later edits, and starting a real match locks an open Finder",()=>{
  const {b,win,game,read}=room();
  let choice=b.partnerContext("left",0);b.act("spar-team-swap","left:2:1");
  let changed=copy(read());assert.equal(choice.apply("marshcurl"),false);assert.deepEqual(copy(read()),changed);
  choice=b.partnerContext("left",0);b.act("spar-team-equip","left:1:last-stitch");changed=copy(read());
  assert.equal(choice.apply("marshcurl"),false);assert.deepEqual(copy(read()),changed);
  choice=b.partnerContext("left",0);b.act("spar-team-rival","red-foundry");changed=copy(read());
  assert.equal(choice.apply("marshcurl"),false);assert.deepEqual(copy(read()),changed);
  choice=b.partnerContext("left",0);b.act("spar-team-equip","right:0:prism-lens");changed=copy(read());
  assert.equal(choice.apply("marshcurl"),false);assert.deepEqual(copy(read()),changed);
  let context;
  const hall=win.WilderSparring.create({game,row:(id,label,value)=>({id,label,value}),image:id=>id,go:()=>{},render:()=>{},notify:()=>{},
    openFinder:value=>{context=value;}});
  const fresh=hall.defaultPartners();
  assert.equal(fresh.foe,"pincoil");assert.deepEqual(copy(fresh.foes),["mossbell","coalmoth","glimmeray"]);
  hall.act("spar-team-rival","red-foundry");
  const configured=hall.defaultPartners();
  assert.deepEqual(copy(configured.foes),["smelteroll","boltbur","kilnclaw"]);
  assert.equal(configured.foe??configured.foes[0],"smelteroll");
  const enter=controls(hall.model("edit:left:member:1")).find(r=>r.id==="spar-team-finder");
  assert.ok(hall.act(enter.id,enter.value));assert.equal(context.slot,1);
  hall.act("spar-start");assert.ok(game.state.sparring.match);
  const live=JSON.stringify(game.state);
  assert.equal(context.apply("marshcurl"),false);assert.equal(JSON.stringify(game.state),live);
});
test("Hall catalog finds ordinary moves and transfers typed move, role and duet searches to the same partner slot",()=>{
  const {b,game,ui,read}=room(),route="edit:right:search:2",starting=copy(read());
  function search(query){
    b.act("spar-team-key","right:clear");
    for(const key of query)assert.ok(b.key({key},route));
    assert.ok(b.key({key:"Enter"},route));assert.equal(ui.view,"edit:right:pick:2");return b.page(ui.view);
  }
  const ordinary="Fault Stamp",hits=Object.values(game.species).filter(k=>!k.bonus&&k.skills.some(s=>!s.trained&&s.name===ordinary));
  assert.ok(hits.some(k=>k.id==="marshcurl"));
  for(const [text,role,query,count] of [[ordinary,"","fault stamp",hits.length],["heal","mend","",0],["Rain Garden","mend","Rain Garden",0],["","","",500]]){
    const page=search(text);assert.ok(page.sections.some(s=>s.title===count+" matching kin"));
    const find=controls(page).find(r=>r.id==="spar-team-finder");
    assert.ok(b.act(find.id,find.value));const selection=ui.finder;
    assert.deepEqual([selection.role,selection.query,selection.anchor,selection.slot],[role,query,"mossbell",2]);
    assert.deepEqual(copy(selection.team),starting.right);assert.deepEqual(copy(selection.foes),starting.left);
    selection.back();assert.equal(ui.view,"edit:right:pick:2");assert.ok(b.page(ui.view).sections.some(s=>s.title===count+" matching kin"));
  }
  assert.deepEqual(copy(read()),starting);
});
test("comparing a private third kin lists only its new pairings with the exact costs and effects from the Hall",()=>{
  const {b,game,win}=room(),front=["cindlet","dewfin"],third="sprigkit",other="charquill";
  const scout=(ids,candidate)=>copy(win.WilderSparringTeams.scoutDuets(game.species,ids,candidate));
  assert.deepEqual(scout([]),[]);assert.deepEqual(scout([front[0]]),[]);
  const ours=scout(front,third),alternative=scout(front,other);
  assert.deepEqual(ours.map(d=>d.label),["Firebreak · 2 beats","Rain Garden · 2 beats"]);
  assert.match(ours[1].detail,/Dewfin \+ Sprigkit.*quarter of their maximum HP/);
  assert.deepEqual(alternative.map(d=>d.label),["Cinder Chorus · 3 beats","Steam Exchange · 2 beats"]);
  assert.match(alternative[0].detail,/Cindlet \+ Charquill.*through cover/);
  const final=[...front,third];
  assert.deepEqual(scout(final),copy(b.scout(final).duets).map(d=>({
    label:d.name+" · "+d.cost+" beats",detail:d.ids.map(id=>game.species[id].name).join(" + ")+". "+d.detail
  })));
});
test("all 500 standard loaners are reachable, pictured and choosable from an empty trail collection",()=>{
  const {b,game,ui,read,win}=room(),species=game.species,seen=new Set(),battle=win.WilderSparringBattle.create({species});
  const trail=JSON.stringify(game.state);
  assert.equal(game.state.party.length,3);
  for(let page=0;page<63;page++){
    const rows=controls(b.page("edit:left:pick:1"));
    for(const row of rows.filter(r=>r.value?.includes?.(":candidate:"))){
      const id=row.value.split(":").at(-1),details=b.page(row.value),pick=controls(details).find(r=>r.id==="spar-team-select");
      assert.equal(row.image,details.art.src);assert.ok(species[id].skills.every(k=>controls(details).some(r=>r.label===k.name)));
      assert.ok(details.subtitle.includes(battle.maxHp(id)+" HP"));
      assert.ok(b.act(pick.id,pick.value));assert.equal(ui.view,"edit:left:team");assert.equal(read().left[1],id);
      assert.equal(new Set(read().left).size,3);
      seen.add(id);
    }
    if(page<62){const next=rows.find(r=>r.label==="Next");assert.ok(!next.disabled);assert.ok(b.act(next.id,next.value));}
  }
  assert.equal(seen.size,500);
  assert.ok(!seen.has("stillwake"));
  assert.equal(JSON.stringify(game.state),trail);
});
test("search combines either affinity with names, supports touch and keyboard, and preserves a canceled edit",()=>{
  const {b,ui,read}=room(),initial=copy(read());
  assert.ok(b.act("spar-team-affinity","right:2:Tide"));
  b.act("spar-team-key","right:C");
  for(const key of "harc")assert.ok(b.key({key},"edit:right:search:2"));
  assert.ok(!b.key({key:"ArrowLeft"},"edit:right:search:2"));
  assert.ok(!b.key({key:"f",ctrlKey:true},"edit:right:search:2"));
  b.key({key:"Enter"},"edit:right:search:2");
  const rows=controls(b.page(ui.view)),entry=rows.find(r=>r.label==="Charcroak");
  assert.ok(entry);assert.match(entry.detail,/Ember \/ Tide/);assert.equal(rows.filter(r=>r.value?.includes?.(":candidate:")).length,1);
  b.act(entry.id,entry.value);
  const back=controls(b.page(ui.view)).find(r=>r.label==="Back to results");b.act(back.id,back.value);
  assert.deepEqual(copy(read()),initial);
  b.act("spar-team-select","right:2:charcroak");assert.equal(read().rival,"custom");
  b.act("spar-team-swap","right:2:0");assert.equal(read().right[0],"charcroak");
  b.act("spar-team-select","right:0:glimmeray");assert.equal(read().right[0],"glimmeray");
  assert.deepEqual(copy(read().left),initial.left);
  b.act("spar-team-key","right:clear");
  assert.ok(controls(b.page("edit:right:pick:2")).some(r=>r.label==="Next"));
});
test("scouts use real second-affinity attacks, compounded/canceled defense, precise duet partners, and matched opponents",()=>{
  const {b,game,win}=room(),ids=["smelteroll","boltbur","kilnclaw"],report=b.scout(ids),chart=win.WilderKinDex;
  assert.deepEqual([...report.attackTypes].sort(),["Alloy","Ember","Loam"]);
  assert.deepEqual([...report.holes.find(h=>h.type==="Tide").weak],ids);
  assert.equal(chart.effectiveness("Tide",game.species.smelteroll.types),2.25);
  const guarded=b.scout(["sprigkit","mossbell","dewfin"]);
  assert.ok(!guarded.holes.some(d=>d.type==="Ember"));
  assert.ok(guarded.defense.find(d=>d.type==="Ember").resists.includes("dewfin"));
  for(const r of b.rivals){
    assert.equal(r.team.length,3);assert.ok(r.plan.length>45&&r.counter.length>45);
    const strengths=b.scout(r.team);
    for(const foe of Object.keys(chart.types)){
      const direct=r.team.some(id=>game.species[id].skills.some(s=>s.kind==="attack"&&chart.effectiveness(s.type,[foe])>1));
      assert.equal(strengths.coverage.includes(foe),direct);
    }
    for(const d of strengths.duets){
      const score=win.WilderDuets.score(...d.ids.map(id=>game.species[id].type));
      assert.equal(d.name,score.name);assert.equal(d.cost,score.cost);assert.ok(d.detail);
    }
    b.act("spar-team-rival",r.id);
    const sim=win.WilderSparringBattle.create({species:game.species});
    const match=sim.start(ids,b.decode(b.encode(r.team)));
    assert.deepEqual(Array.from(match.sides[1].team,k=>k.id),Array.from(r.team));
    assert.ok(sim.options(match).some(m=>m.available));
    const left=b.page("edit:scout"),actual=left.sections.find(s=>s.title==="Against their three").rows;
    assert.deepEqual(Array.from(actual,row=>row.label),Array.from(r.team,id=>game.species[id].name));
    assert.ok(actual.every(row=>row.detail.includes("incoming up to ×")));
    assert.equal(b.page("edit:scout:right").kicker,"RIVAL TEAM   /   LEVEL 20");
  }
});
test("only versioned legal lineups round-trip, including exact order and lead from all standard species",async()=>{
  const {b,game,win,read,ui}=room(),species=Object.values(game.species).filter(k=>!k.bonus);
  for(let i=0;i<species.length;i++){
    const ids=[0,1,2].map(k=>species[(i+k*97)%species.length].id);
    assert.deepEqual([...b.decode(b.encode(ids))],ids);
  }
  const bad=["",null,{},"#spar-v2=sprigkit,cindlet,dewfin","#spar-v1=mossbell,coalmoth,stillwake",
    "#spar-v1=sprigkit,sprigkit,cindlet","#spar-v1=%73prigkit,cindlet,dewfin","#spar-v1=__proto__,cindlet,dewfin",
    "#spar-v1=sprigkit,cindlet,dewfin,coalmoth","#spar-v1=sprigkit,cindlet","#spar-v1=sprigkit,cindlet,dewfin?extra=1",
    "#spar-v1=sprigkit,cindlet,dewfin\n","#loaner-v1=sprigkit,cindlet,dewfin","xxxxxxxx".repeat(40)];
  for(const value of bad)assert.equal(b.decode(value),null,String(value));
  assert.equal(b.encode(["sprigkit",,"dewfin"]),null);
  assert.equal(b.encode(["stillwake","cindlet","dewfin"]),null);
  const defaults=copy(read()),custom={left:defaults.right,right:defaults.left,rival:"shared",mode:"local"};
  assert.deepEqual(copy(b.restore(custom)),custom);
  assert.deepEqual(copy(b.restore({left:["__proto__"],right:null,mode:1})),defaults);
  let clip;
  win.navigator={clipboard:{writeText:async s=>{clip=s;}}};
  b.act("spar-team-share","left");await Promise.resolve();
  assert.equal(clip,"https://example.org/games/wilderkin/?game=1"+b.encode(defaults.left));
  assert.equal(ui.notices.at(-1),"Team challenge link copied.");
  win.navigator={};win.prompt=(_,url)=>{clip=url;};
  b.act("spar-team-share","right");assert.deepEqual([...b.decode(clip.slice(clip.indexOf("#")))],defaults.right);
  assert.deepEqual(copy(read()),defaults);
});
