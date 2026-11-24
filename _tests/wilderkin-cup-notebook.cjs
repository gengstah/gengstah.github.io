const {test}=require("node:test"),assert=require("node:assert/strict");
const vm=require("node:vm"),fs=require("node:fs"),path=require("node:path");
function setup() {
  const window={},env=vm.createContext({window});
  for(const id of ["atlas","bestiary","activities","campaign","story","duets","sparring-gear","sparring-signatures","sparring-battle","cup-notebook","engine"]){
    const file=path.join(__dirname,"../games/wilderkin",id+".js");vm.runInContext(fs.readFileSync(file,"utf8"),env,{filename:file});
  }
  const species=window.WilderGame.species;
  return {species,sim:window.WilderSparringBattle.create({species}),book:window.WilderCupNotebook};
}
test("the Cup notebook compares the hit actually observed with each registered bench option in the same opening",()=>{
  const {species,sim,book}=setup(),six=["sprigkit","coalmoth","mossbell","glimmeray","dewfin","fernprickle"];
  const tape={left:six.slice(0,3),right:["cindlet","arcbill","glimmeray"],first:1,moves:["skill:ember-pop","skill:brush-dash","skill:ember-pop"]};
  const snapshot=JSON.stringify({tape,six});
  const notes=book.notesFor(tape,six,species,sim,2);
  assert.equal(notes[0].title,"From bout 2");assert.match(notes[0].text,/action 1, Cindlet hit Sprigkit with Ember Pop/);
  const rows=Array.from(notes.at(-1).rows);
  assert.deepEqual(rows.map(r=>r.label),["Sprigkit","Glimmeray","Dewfin","Fernprickle"]);
  for(const [n,id] of ["sprigkit","glimmeray","dewfin","fernprickle"].entries()){
    const left=[id,...tape.left.filter(k=>k!==id)].slice(0,3);
    const p=sim.start(left,tape.right,1);
    const hit=sim.forecast(p,"skill:ember-pop");assert.equal(Number(rows[n].detail.split(" ")[0]),hit.damage);
  }
  assert.equal(snapshot,JSON.stringify({tape,six}));
  assert.deepEqual(Array.from(book.notesFor({...tape,moves:[]},six,species,sim,1)),[]);
  assert.deepEqual(Array.from(book.notesFor({...tape,moves:[...tape.moves,"not-legal"]},six,species,sim,1)),[]);
});
test("the scout reads only the previous tape and models the unused reserve's registered item",()=>{
  const {species,sim,book}=setup(),roster=["sprigkit","coalmoth","mossbell","dewfin","glimmeray","fernprickle"];
  const left=roster.slice(0,3),right=["cindlet","arcbill","glimmeray"];
  const tape={left,right,first:1,gear:{left:{},right:{cindlet:"prism-lens"}},moves:["skill:ember-pop"]};
  const series={roster,gear:{dewfin:"opening-pennant"},rounds:[tape]};
  const actual=book.sections(series,species,sim).at(-1).rows.find(row=>row.label==="Dewfin");
  const p=sim.start(["dewfin","sprigkit","coalmoth"],right,1,{left:series.gear,right:tape.gear.right});
  const withLens=sim.forecast(p,"skill:ember-pop").damage;
  const without=sim.forecast(sim.start(["dewfin","sprigkit","coalmoth"],right,1),"skill:ember-pop").damage;
  assert.ok(withLens>without);assert.match(actual.detail,new RegExp("^"+withLens+" HP taken"));
  assert.deepEqual(Array.from(book.sections({...series,rounds:[]},species,sim)),[]);
});
