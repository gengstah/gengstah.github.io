const {test}=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm"),fs=require("node:fs"),path=require("node:path");
const scripts=["atlas","bestiary","activities","campaign","story","duets","stillwake","sparring-gear","sparring-signatures","sparring-battle","cup-rules","cup-notebook","cup-desk","engine"].map(id=>{
  const file=path.join(__dirname,"../games/wilderkin",id+".js");return new vm.Script(fs.readFileSync(file,"utf8"),{filename:file});
});
const clone=a=>JSON.parse(JSON.stringify(a));
function room(){
  const win={},cx=vm.createContext({window:win});scripts.forEach(s=>s.runInContext(cx));
  const game=win.WilderGame,sim=win.WilderSparringBattle.create({species:game.species}),rules=win.WilderCupRules.create({game,sim});
  const ui={view:"cup:desk",starts:[]},record={series:null,cabinet:{}};
  const desk=win.WilderCupDesk.create({species:game.species,sim,rules,row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),
    image:(id,owned)=>{assert.equal(owned,false);return "base:"+id;},read:()=>record,write:s=>{record.series=s;},
    show:v=>{ui.view=v;},render:()=>{},notify:()=>{},start:ids=>{ui.starts.push(Array.from(ids));}});
  return {win,game,sim,rules,ui,record,desk};
}
const rows=p=>p.sections.flatMap(s=>s.rows||[]);
test("a guest can field the preset in one action, or intentionally lock six before picking a fresh ordered three",()=>{
  const {desk:d,record,ui,rules}=room();
  assert.equal(d.model("cup:desk").art.src,"ui/lantern-cup.png");
  const rulesText=d.model("cup:desk").sections.find(s=>s.title==="Series rules").text;
  assert.match(rulesText,/first and third/);assert.match(rulesText,/half a point/);assert.match(rulesText,/after the third bout/);
  assert.deepEqual(rows(d.model("cup:captains")).map(c=>c.image),rules.captains.map(c=>"ui/cup-"+c.id+".png"));
  d.model("cup:register");assert.equal(record.series,null);
  d.act("cup-desk-captain","nessa");d.act("cup-desk-lock");
  assert.equal(record.series.locked,true);assert.deepEqual(clone(record.series.picks),[]);
  assert.equal(ui.view,"cup:pick");assert.equal(d.model(ui.view).sections.some(s=>s.title?.startsWith("Committed for")),false);
  const committed=clone(d.model("cup:scout").sections[0]);
  for(const id of ["cindlet","dewfin","sprigkit"])d.act("cup-desk-add",id);
  d.act("cup-desk-add","cindlet");d.act("cup-desk-add","pincoil");d.act("cup-desk-lead","sprigkit");
  assert.deepEqual(clone(record.series.picks),["sprigkit","cindlet","dewfin"]);
  assert.deepEqual(clone(d.model("cup:scout").sections[0]),committed);
  d.act("cup-desk-start");assert.deepEqual(ui.starts[0],["sprigkit","cindlet","dewfin"]);
  const snapshot=clone(record.series);d.act("cup-desk-captain","ilda");d.act("cup-desk-choose","1:charcroak");d.act("cup-desk-gear","1:last-stitch");
  assert.deepEqual(clone(record.series),snapshot);
  const quick=room();quick.desk.act("cup-desk-quick");assert.equal(quick.record.series.locked,true);
  assert.deepEqual(quick.ui.starts[0],Array.from(quick.rules.defaultRoster.slice(0,3)));
});
test("all 500 eligible species can be found in a slot, previewed, and registered without touching the campaign",()=>{
  const {desk:d,record,rules,game}=room(),initial=JSON.stringify(game.state),seen=new Set();
  for(let p=0;p<63;p++){
    const picks=rows(d.model("cup:roster:4")).filter(r=>String(r.value).startsWith("cup:candidate:"));
    for(const pick of picks){
      const id=pick.value.split(":").at(-1),page=d.model(pick.value);assert.equal(page.art.src,"base:"+id);
      const choose=rows(page).find(r=>r.id==="cup-desk-choose");d.act(choose.id,choose.value);
      assert.equal(record.series.roster[4],id);assert.ok(rules.register(record.series.roster,record.series.gear));
      seen.add(id);
    }
    d.act("cup-desk-page",1);
  }
  assert.equal(seen.size,500);assert.ok(!seen.has("stillwake"));assert.equal(JSON.stringify(game.state),initial);
  d.act("cup-desk-filter","1:Tide");
  for(const key of "charcroak")assert.ok(d.key({key},"cup:search:1"));
  const candidates=rows(d.model("cup:roster:1")).filter(r=>String(r.value).startsWith("cup:candidate:"));
  assert.equal(candidates.length,1);assert.equal(candidates[0].label,"Charcroak");
  d.act("cup-desk-choose","1:charcroak");d.act("cup-desk-gear","1:prism-lens");
  const leader=record.series.roster[0];
  d.act("cup-desk-gear","0:prism-lens");assert.equal(Object.keys(record.series.gear).length,1);assert.equal(record.series.gear[leader],"prism-lens");
  d.act("cup-desk-choose","0:stillwake");assert.equal(record.series.roster[0],leader);
});
test("between bouts the six stay locked while choices reset, prior teams remain visible, and the notebook comes from the real tape",()=>{
  const {desk:d,record,sim,rules,ui}=room();d.act("cup-desk-lock");const e=record.series;
  const expected=rules.commit(e.captain,e.roster,[],e.gear),left=e.roster.slice(0,3),right=expected.team,gear={left:{},right:expected.gear};
  let pos=sim.start(left,right,0,gear),moves=[];
  while(pos.phase!=="done"&&moves.length<66){const m=sim.recommend(pos);moves.push(m.id);pos=sim.apply(pos,m.id);}
  e.rounds=[{left,right,first:0,gear,moves,winner:pos.winner,conceded:false}];e.picks=[];
  assert.ok(d.model("cup:pick").sections.find(s=>s.title==="What the captain saw").text.includes("Sprigkit"));
  assert.ok(rows(d.model("cup:desk")).some(r=>r.value==="cup:notes"));assert.ok(d.model("cup:notes").sections.length>1);
  assert.ok(d.model("cup:scout").sections.some(s=>s.title==="Prior opposing trios"));
  d.act("cup-desk-repeat");assert.deepEqual(clone(record.series.picks),clone(left));
  d.act("cup-desk-remove",left[2]);d.act("cup-desk-add",e.roster[4]);d.act("cup-desk-start");
  assert.deepEqual(ui.starts.at(-1),[left[0],left[1],e.roster[4]]);
  record.series.match={setup:{left:ui.starts.at(-1)}};assert.ok(rows(d.model("cup")).some(r=>r.value==="cup:match"));
  record.series.match=null;record.series.rounds[0].conceded=true;
  const result=rows(d.model("cup:desk")).find(r=>r.label.includes("Bout 1"));
  assert.equal(result.id,undefined);assert.match(result.detail,/Conceded/);
});
test("explicitly importing the Hall trio preserves its order and equipment, fills six and respects the registration lock",()=>{
  const {desk:d,record}=room();
  d.act("cup-desk-captain","ilda");
  d.act("cup-desk-gear","0:relay-bell");d.act("cup-desk-gear","3:last-stitch");d.act("cup-desk-gear","4:mender-wrap");
  record.hallSetup={left:["charcroak","dewfin","cindlet"],right:["mossbell","glimmeray","coalmoth"],gear:{left:{charcroak:"last-stitch",cindlet:"opening-pennant"}}};
  const hall=clone(record.hallSetup),before=clone(record.series);
  assert.ok(rows(d.model("cup:register")).some(r=>r.label==="Bring my Hall trio"));
  assert.deepEqual(clone(record.series),before);d.act("cup-desk-hall");
  assert.deepEqual(clone(record.series.roster),["charcroak","dewfin","cindlet","sprigkit","mossbell","fernprickle"]);
  assert.deepEqual(clone(record.series.gear),{charcroak:"last-stitch",cindlet:"opening-pennant",sprigkit:"relay-bell",fernprickle:"mender-wrap"});
  assert.deepEqual(clone(record.hallSetup),hall);
  d.act("cup-desk-lock");const locked=clone(record.series);record.hallSetup.left.reverse();d.act("cup-desk-hall");assert.deepEqual(clone(record.series),locked);
});
