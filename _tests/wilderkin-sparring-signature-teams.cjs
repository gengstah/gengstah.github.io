const {test}=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm"),fs=require("node:fs"),path=require("node:path");
const scripts=["atlas","bestiary","activities","campaign","story","duets","stillwake","sparring-gear","sparring-signatures","sparring-battle","sparring-teams","engine"].map(name=>{
  const file=path.join(__dirname,"../games/wilderkin",name+".js");return new vm.Script(fs.readFileSync(file,"utf8"),{filename:file});
});
function room() {
  const win={},ctx=vm.createContext({window:win});scripts.forEach(s=>s.runInContext(ctx));
  const g=win.WilderGame,teams=win.WilderSparringTeams,ui={};
  let saved=teams.restore(null,{species:g.species});
  const b=teams.create({game:g,row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),image:(id,owned)=>{assert.equal(owned,false);return "base:"+id;},
    read:()=>saved,write:patch=>{saved=b.restore({...saved,...patch});},go:(_,p)=>{ui.page=p;},render:()=>{},notify:()=>{},onStart:()=>{}});
  return {win,g,b,ui,read:()=>saved};
}
const rows=p=>p.sections.flatMap(s=>s.rows||[]);
const clone=x=>JSON.parse(JSON.stringify(x));
test("both Grove signatures are discoverable from the team and loaner catalog; comparing preserves the build",()=>{
  const {b,win,read}=room(),signatures=win.WilderSparringSignatures,start=clone(read());
  for(const side of ["left","right"])for(const slot of [0,1,2]) {
    const prefix="edit:"+side+":",link=prefix+"grove:"+slot;
    assert.ok(rows(b.page(prefix+"pick:"+slot)).some(r=>r.value===link&&r.label==="Compare Grove signatures"));
    assert.ok(rows(b.page(prefix+"team")).some(r=>r.value===prefix+"grove:0"));
    const compare=b.page(link);
    assert.match(compare.subtitle,/80 HP/);
    for (const id of ["mossbell","fernprickle"]) {
      const sig=signatures.byId(id),route=prefix+"candidate:"+slot+":"+id,entry=rows(compare).find(r=>r.value===route);
      assert.ok(entry.label.includes(sig.name));assert.equal(entry.image,"base:"+id);
      assert.match(entry.badge,new RegExp("^"+sig.cost+" beat"));assert.ok(entry.detail.includes(sig.effect)&&entry.detail.includes(sig.counter));
      const detail=b.page(route),rule=detail.sections.find(s=>s.title?.startsWith(sig.name));
      assert.ok(rule.text.includes(sig.effect)&&rule.text.includes(sig.tradeoff)&&rule.text.includes(sig.counter));
      assert.ok(rows(detail).find(r=>r.value===link));
      assert.ok(rows(detail).find(r=>r.id==="spar-team-select"));
    }
    assert.deepEqual(clone(read()),start);
  }
});
test("choosing the actual loaner updates its team card, both scout perspectives and the ordered challenge lineup",()=>{
  const {b,win,g,read}=room(),module=win.WilderSparringSignatures,before=JSON.stringify(g.state);
  b.act("spar-team-select","left:2:fernprickle");
  assert.ok(rows(b.page("edit:left:team")).find(r=>r.label==="Fernprickle").detail.includes("Thorn Read"));
  assert.ok(b.page("edit:left:member:2").sections.some(s=>s.text?.includes(module.byId("fernprickle").counter)));
  b.act("spar-team-swap","left:2:0");
  for(const page of ["edit:scout","edit:scout:right"]){
    const found=b.page(page).sections.find(s=>s.title==="Signature moves").rows;
    assert.equal(found.length,2);
    for(const [id,owner] of [["fernprickle","Your team"],["mossbell","Rival team"]]){
      const sig=module.byId(id),row=found.find(r=>r.label.includes(sig.name));
      assert.ok(row.badge.includes(owner));assert.ok(row.detail.includes(sig.effect)&&row.detail.includes(sig.counter));
    }
  }
  assert.equal(b.scout(read().left).signatures[0].id,module.byId("fernprickle").id);
  assert.deepEqual([...b.decode(b.encode(read().left))],["fernprickle","cindlet","sprigkit"]);
  b.act("spar-team-select","left:0:dewfin");assert.equal(b.scout(read().left).signatures.length,0);
  assert.ok(!b.page("edit:left:member:0").sections.some(s=>s.title?.includes("once per match")));
  assert.equal(JSON.stringify(g.state),before);
});
test("each profile's cost and role match its legal opening commands in the full battle simulator",()=>{
  const {b,g,win,read}=room(),sim=win.WilderSparringBattle.create({species:g.species});
  for(const id of ["mossbell","fernprickle"]){
    b.act("spar-team-select","left:0:"+id);
    const set=read(),item=win.WilderSparringSignatures.byId(id);
    const pos=sim.start(set.left,set.right,0),options=sim.options(pos);
    const match=options.find(m=>m.id===(id==="mossbell"?"shelter:cindlet":"stance:thorn-read"));
    assert.ok(match);assert.equal(match.available,item.cost===0);
    const funded=sim.start(set.left,set.right,0,{left:{[id]:"opening-pennant"},right:{}});
    const next=sim.forecast(funded,match.id);assert.ok(next.available);
    assert.ok(sim.apply(funded,match.id));
  }
});
test("traveling companions lead the unfiltered loaner picker and use the ordinary confirmation without changing trail state",()=>{
  const {g,b,read,ui,win}=room(),state=g.state;
  const kin=(id,hp)=>({id,hp,maxHp:82,level:37,xp:11});
  state.party.push(kin("mossbell",4),kin("fernprickle",0),kin("coalmoth",29),kin("stillwake",82));
  state.team=["sprigkit","mossbell","stillwake","dewfin","cindlet","fernprickle"];
  state.lead="mossbell";
  const campaign=JSON.stringify(state),initial=clone(read());
  for(const side of ["left","right"]){
    const entries=b.page("edit:"+side+":pick:1").sections.find(s=>s.title==="Traveling party").rows;
    assert.deepEqual(Array.from(entries,r=>r.label),["Mossbell","Sprigkit","Dewfin","Cindlet","Fernprickle"]);
    assert.equal(entries[0].badge,"Trail lead");assert.ok(entries.every(r=>r.detail.includes("Level 20 loaner")));
    const member=entries.at(-1);assert.equal(member.value,"edit:"+side+":candidate:1:fernprickle");
    b.act(member.id,member.value);assert.equal(ui.page,member.value);
    assert.match(b.page(ui.page).subtitle,/80 HP/);
    b.act("spar-team-open","edit:"+side+":pick:1");assert.deepEqual(clone(read()),initial);
  }
  b.act("spar-team-select","left:1:fernprickle");assert.equal(read().left[1],"fernprickle");
  assert.equal(JSON.stringify(state),campaign);
  const partial=game=>win.WilderSparringTeams.create({game:{species:g.species,...game},read:()=>read(),image:id=>id,row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra})});
  const names=builder=>Array.from(builder.page("edit:left:pick:0").sections.find(s=>s.title==="Traveling party")?.rows||[],r=>r.label);
  assert.deepEqual(names(partial({})),[]);
  assert.deepEqual(names(partial({team:()=>[null,{id:"mossbell"},"bad-id","sprigkit","mossbell"]})),["Mossbell","Sprigkit"]);
  assert.deepEqual(names(partial({state:{party:[null,{id:"stillwake"},{id:"cindlet"},"dewfin"],lead:"dewfin"}})),["Dewfin","Cindlet"]);
});
