const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const files=["atlas","bestiary","activities","campaign","story","duets","growth","wardens","second-bell","call-habitats","wild-calls","engine"];
function boot(){
  const ctx=vm.createContext({window:{}});
  for(const file of files){
    const filename=path.join(__dirname,"../games/wilderkin",file+".js");
    vm.runInContext(fs.readFileSync(filename,"utf8"),ctx,{filename});
  }
  const game=ctx.window.WilderGame,events=[];
  const desk=ctx.window.WilderSecondBell.create({game,row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),image:id=>id,
    render(){},go:(...args)=>events.push(args),locate:site=>game.visitSite(site),fight:(kind,id)=>game.startBattle(kind,id)});
  return {g:game,desk,events};
}
const ok=res=>assert.ok(res.ok,res.message);
test("a newly befriended kin can open a real exhibition without changing the trail lead; manual desk choices still take precedence",()=>{
  const {g,desk,events}=boot();
  ok(g.setLead("cindlet"));g.visitSite("wild");ok(g.startBattle("wild","gustlance"));ok(g.answerWildCall("ember-pop"));ok(g.recruit());
  ok(g.setLead("gustlance"));ok(g.startBattle("wild","opalclasp"));ok(g.answerWildCall("beacon","cindlet"));ok(g.recruit());
  const before=JSON.stringify(g.state),roster=g.secondBell().roster;
  desk.act("bell-preview","opalclasp");assert.deepEqual(events,[["second-bell",0]]);
  const rows=()=>desk.model(0).sections.flatMap(s=>s.rows||[]);
  assert.ok(rows().some(r=>r.id==="bell-lead"&&r.value==="opalclasp"&&r.badge==="OPENS"));
  assert.equal(JSON.stringify(g.state),before);
  desk.act("bell-walk",0);assert.equal(g.state.landmark,"warden");
  desk.act("bell-ring",0);assert.equal(g.state.battle.activeId,"opalclasp");assert.equal(g.state.lead,"gustlance");
  assert.deepEqual(g.state.battle.secondBell.roster,roster);
  desk.act("bell-preview","cindlet");assert.equal(events.length,1);ok(g.flee());
  desk.act("bell-preview","opalclasp");desk.act("bell-lead","dewfin");desk.act("bell-ring",0);
  assert.equal(g.state.battle.activeId,"dewfin");assert.equal(g.state.lead,"gustlance");
});
test("reserve kin, closed lodges and regions without a lodge cannot issue an exhibition invitation",()=>{
  const {g,desk,events}=boot();
  g.state.party.push(g.loaner("opalclasp",4));desk.act("bell-preview","opalclasp");assert.equal(events.length,0);
  g.state.region=g.wardens[1];assert.equal(g.secondBell().eligible,false);desk.act("bell-preview","sprigkit");
  g.state.region=g.regions.findIndex((_,i)=>!g.wardens.includes(i));assert.equal(g.secondBell(),null);desk.act("bell-preview","sprigkit");
  assert.equal(events.length,0);assert.equal(g.state.battle,null);
});
