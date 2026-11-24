const {test}=require("node:test");
const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const path=require("node:path"),vm=require("node:vm");
const scripts=["atlas","bestiary","activities","story","campaign","duets","sparring-gear","sparring-signatures",
  "sparring-battle","sparring-grove","sparring-library","sparring-teams","sparring","engine"].map(id=>
  new vm.Script(readFileSync(path.join(__dirname,"../games/wilderkin",id+".js"),"utf8"),{filename:id+".js"}));
const copy=value=>JSON.parse(JSON.stringify(value));
function open(){
  const jobs=[],window={localStorage:{getItem:()=>null,setItem(){}}},ctx=vm.createContext({window,performance,setTimeout:f=>jobs.push(f)});
  scripts.forEach(s=>s.runInContext(ctx));
  const game=window.WilderGame,sim=window.WilderSparringBattle.create({game});
  let view="bench:grove";
  const hall=window.WilderSparring.create({game,row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),
    image:id=>id,go:(_,v)=>view=v,render(){},notify(){}});
  const model=()=>hall.model(view);
  const press=(id,value)=>{
    const rows=model().sections.flatMap(s=>s.rows||[]);
    assert.ok(rows.some(r=>r.id===id&&r.value===value&&!r.disabled),id+" / "+value+" in "+view);
    hall.act(id,value);
  };
  return {game,sim,hall,model,press,view:()=>view,finish:()=>{while(jobs.length)jobs.shift()();}};
}
test("Mossbell's crossing compares a protected handoff with the real ordinary switch and resumes that exact turn",()=>{
  const h=open(),before=copy(h.game.state);
  h.press("grove-open","bench:grove:mossbell");h.press("grove-open","bench:grove:mossbell:signature");
  h.press("grove-open","bench:grove:mossbell:signature:strike");
  assert.match(h.model().subtitle,/saved [1-9]\d* HP/);
  assert.deepEqual(copy(h.game.state),before);
  h.press("grove-play","bench:grove:mossbell:signature:strike");
  const m=h.game.state.sparring.match;
  assert.equal(h.view(),"match");assert.deepEqual(copy(m.moves),["shelter:dewfin","skill:ember-pop"]);
  let p=h.sim.start(m.setup.left,m.setup.right,m.first,m.setup.gear);
  for(const id of m.moves)p=h.sim.apply(p,id);
  assert.equal(p.sides[0].team[p.sides[0].active].id,"dewfin");assert.equal(p.ply,2);
  h.hall.act("spar-view","bench:grove");h.press("grove-open","bench:grove:mossbell");
  h.press("grove-open","bench:grove:mossbell:ordinary");h.press("grove-open","bench:grove:mossbell:ordinary:strike");
  assert.match(h.model().subtitle,/more HP than Shelter Call/);
  const ongoing=copy(m);h.hall.act("grove-play","bench:grove:mossbell:ordinary:strike");
  assert.deepEqual(copy(h.game.state.sparring.match),ongoing);
});
test("the rival can attack into Fernprickle's trap or switch to deny its payoff",()=>{
  const h=open(),before=copy(h.game.state);
  h.press("grove-open","bench:grove:fernprickle");h.press("grove-open","bench:grove:fernprickle:signature");
  h.press("grove-open","bench:grove:fernprickle:signature:strike");
  assert.match(h.model().subtitle,/exposed/);assert.match(h.model().sections[0].rows[0].detail,/2\/3 beats/);
  h.press("grove-open","bench:grove:fernprickle:signature");h.press("grove-open","bench:grove:fernprickle:signature:switch");
  assert.match(h.model().subtitle,/switched/);assert.match(h.model().sections[0].rows[0].detail,/1\/3 beats/);
  assert.deepEqual(copy(h.game.state),before);h.press("grove-play","bench:grove:fernprickle:signature:switch");
  assert.deepEqual(copy(h.game.state.sparring.match.moves),["stance:thorn-read","swap:sprigkit"]);
});
test("each Grove lead wins a matchup that the other loses and either lineup can enter the Hall",()=>{
  const h=open(),before=copy(h.game.state);
  for(const [crew,seat,lead] of [["grove-bells",0,0],["grove-ice",1,1]]){
    h.press("bench-grove-trial",crew);h.finish();
    const scores=h.model().sections.slice(0,2).map(s=>s.rows[seat].label.split(" · ")[0]);
    assert.equal(scores[lead],"Win");assert.equal(scores[1-lead],"Loss");
    assert.deepEqual(copy(h.game.state),before);
    if(lead===0)h.press("bench-open","bench:grove");
    else h.press("bench-take-lead","1");
  }
  assert.deepEqual(copy(h.game.state.sparring.setup.left),["fernprickle","coalmoth","glimmeray"]);
  assert.equal(h.game.state.sparring.setup.rival,"ice-harbor");
  assert.equal(h.view(),"preview");
});
