const test=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs"),path=require("node:path");
const scripts=["atlas","bestiary","activities","story","campaign","duets","growth","sparring-gear","trail-fittings","caravans","engine","trail-roster-desk"].map(s=>{
  const file=path.join(__dirname,"../games/wilderkin",s+".js");return new vm.Script(fs.readFileSync(file,"utf8"),{filename:file});
});
const copy=v=>JSON.parse(JSON.stringify(v));
function harness(store=new Map()){
  const window={localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)}},ctx=vm.createContext({window});
  scripts.forEach(s=>s.runInContext(ctx));
  const game=window.WilderGame,notes=[],fields=[],drafts=[],walks=[];
  let right=null;
  const desk=window.WilderTrailRosterDesk.create({game,image:id=>"portrait/"+id,row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),
    go:(screen,value)=>{right={screen,value};},render:()=>{},notify:msg=>notes.push(msg),onDraft:d=>drafts.push(d),
    onField:d=>fields.push(d),locate:(...args)=>walks.push(args)});
  const model=()=>desk.model(right?.value),rows=()=>model().sections.flatMap(s=>s.rows||[]);
  function press(id,value){
    const r=rows().find(r=>r.id===id&&(value===undefined||r.value===value));
    assert.ok(r&&!r.disabled,`Missing available ${id} (${value}) on ${model().title}`);return desk.act(id,r.value,right?.value);
  }
  return {game,window,desk,store,notes,fields,drafts,walks,model,rows,press,place:()=>right};
}
const setup={region:0,kind:"wild",foe:"mossbell",team:["dewfin","gustlance","sprigkit"],lead:"gustlance"};
function prepare(h){
  const g=h.game;g.visitSite("camp");assert.ok(g.claimFittings("camp").ok);
  g.state.party.push(g.loaner("gustlance",5));g.state.party.at(-1).hp=11;
  assert.ok(g.equipFitting("gustlance","relay-bell").ok);assert.ok(g.equipFitting("dewfin","last-stitch").ok);
}
test("adoption shows exact trail HP/fittings, distinguishes practice outcomes, applies once and opens the actual opponent or restores the earlier party",()=>{
  const h=harness();prepare(h);const g=h.game,original=copy(g.state),source=copy(setup);
  source.tested={result:"victory",members:setup.team.map(id=>{const p=g.state.party.find(k=>k.id===id);return {...p,hp:p.maxHp,gear:null};})};
  assert.equal(h.desk.open(source),true);source.team.reverse();assert.deepEqual(copy(h.desk.current()).team,setup.team);
  const m=h.model(),row=h.rows().find(x=>x.label==="Gustlance");
  assert.deepEqual(Array.from(m.formationStrip.slots,x=>x.id),setup.team);
  assert.ok(m.formationStrip.slots[1].lead);assert.equal(m.formationStrip.slots[1].hp,11);
  assert.match(row.detail,/11\/\d+ trail HP · Relay Bell/);assert.match(row.detail,/Finished practice with .*No fitting/);
  assert.ok(m.sections.some(s=>s.text?.includes("Gustlance joining.")&&s.text.includes("Cindlet returning to reserve.")));
  assert.deepEqual(copy(g.state),original);
  h.press("roster-apply");assert.equal(h.place().value,"applied");assert.deepEqual(copy(g.state.team),setup.team);
  assert.equal(g.state.lead,"gustlance");assert.deepEqual(copy(g.state.party),original.party);
  assert.deepEqual(copy(g.state.trailFittings),original.trailFittings);
  h.press("roster-field");assert.equal(h.fields.length,1);assert.deepEqual(copy(h.fields[0].team),setup.team);
  h.press("roster-undo");assert.deepEqual(copy(g.state.team),original.team);assert.equal(g.state.lead,original.lead);assert.deepEqual(copy(g.state.party),original.party);
  h.press("roster-draft");assert.equal(h.drafts[0].foe,"mossbell");assert.deepEqual(copy(h.drafts[0].team),setup.team);
});
test("a fainted requested lead requires a conscious substitute and a current party can follow its track directly",()=>{
  const h=harness();prepare(h);const g=h.game;g.state.party.at(-1).hp=0;
  h.desk.open(setup);assert.ok(h.rows().find(r=>r.id==="roster-apply").disabled);
  assert.ok(h.rows().some(r=>r.id==="roster-substitute"&&r.value==="dewfin"));
  h.desk.act("roster-apply",null,null);assert.equal(g.state.lead,"sprigkit");
  h.press("roster-substitute","dewfin");h.press("roster-apply");h.press("roster-field");
  assert.equal(h.fields[0].lead,"dewfin");assert.equal(g.state.party.at(-1).hp,0);
  h.desk.open({...setup,lead:"dewfin"});assert.ok(h.rows().some(r=>r.id==="roster-field"));assert.ok(!h.rows().some(r=>r.id==="roster-apply"));
  h.press("roster-field");assert.equal(h.fields.length,2);
});
test("saving a named tested lineup previews overwritten order, leader and fittings and never enlists, revives or overwrites undo",()=>{
  const h=harness();prepare(h);const g=h.game;
  assert.ok(g.caravan.saveFormation(1,{name:"Harbor Watch",fittings:true}).ok);
  const before=copy(g.state);g.state.party.at(-1).hp=0;
  const expectedRoster=copy(g.state.party);h.desk.open(setup);
  h.press("roster-pennants");assert.equal(h.rows().filter(r=>r.id==="roster-slot").length,3);
  h.press("roster-slot",1);assert.equal(h.model().title,"Review the replacement");
  const old=h.model().sections.find(s=>s.title==="Replacing Harbor Watch");assert.match(old.text,/Sprigkit · Cindlet · Dewfin/);assert.match(old.text,/Lifeline Stitch/);
  h.window.prompt=()=>"  Mossbrook   Couriers ";h.press("roster-name");
  h.press("roster-gear");assert.match(h.model().sections[0].text,/current fitting/);h.press("roster-gear");
  h.press("roster-save");assert.equal(h.model().title,"Mossbrook Couriers recorded");
  assert.deepEqual(copy(g.state.caravan.slots[1]),{team:setup.team,lead:"gustlance",name:"Mossbrook Couriers",gear:{gustlance:"relay-bell",dewfin:"last-stitch"}});
  assert.deepEqual(copy(g.state.team),before.team);assert.equal(g.state.lead,before.lead);
  assert.deepEqual(copy(g.state.party),expectedRoster);assert.deepEqual(copy(g.state.trailFittings),before.trailFittings);assert.equal(g.state.caravan.previous,before.caravan.previous);
});
test("a stale on-screen adoption or overwritten pennant cannot commit until a fresh review",()=>{
  const h=harness();prepare(h);h.desk.open(setup);h.model();h.game.state.party.at(-1).hp--;
  h.desk.act("roster-apply",null,null);assert.equal(h.game.state.lead,"sprigkit");assert.match(h.notes.at(-1),/changed/);
  h.press("roster-pennants");h.press("roster-slot",0);h.model();
  assert.ok(h.game.caravan.saveFormation(0,{name:"New from elsewhere"}).ok);
  h.desk.act("roster-save",null,"record");assert.equal(h.game.state.caravan.slots[0].name,"New from elsewhere");
  assert.match(h.model().sections.find(s=>s.title.startsWith("Replacing")).title,/New from elsewhere/);
  h.press("roster-review");assert.ok(h.desk.current());h.desk.reset();assert.equal(h.desk.current(),null);
  assert.ok(h.desk.model(null).sections[0].rows.some(r=>r.value==="trail-matchups"));
});
test("restoring a link preserves bounded turn evidence for the field and never navigates or writes the campaign",()=>{
  const h=harness();prepare(h);const g=h.game,original=copy(g.state),source=copy(setup);
  const turn={turn:1,activeId:"gustlance",foe:"mossbell",method:"useSkill",args:["gale-cut"],label:"Gale Cut",actual:"Mossbell 40 → 30 HP."};
  source.tested={result:"defeat",members:source.team.map(id=>({...g.state.party.find(p=>p.id===id),gear:null})),turns:[1,2,3,4].map(n=>({...turn,turn:n}))};
  assert.equal(h.desk.restore(source),true);assert.equal(h.place(),null);assert.deepEqual(copy(g.state),original);
  source.tested.turns[0].args[0]="edited";assert.equal(h.desk.current().tested.turns[0].args[0],"gale-cut");
  const x=h.desk.current();x.tested.turns[0].label="edited";assert.equal(h.desk.current().tested.turns[0].label,"Gale Cut");
  assert.equal(h.desk.current().tested.turns.length,3);h.press("roster-apply");h.press("roster-field");
  assert.deepEqual(copy(h.fields[0].tested.turns[0]),{...turn,args:["gale-cut"]});
  assert.ok(!Object.hasOwn(g.state,"tested"));
});
