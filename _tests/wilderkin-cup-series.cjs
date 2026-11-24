const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const files=["atlas","bestiary","activities","story","campaign","duets","sparring-gear","sparring-signatures","sparring-battle",
  "sparring-teams","sparring-grove","sparring-library","sparring-review","cup-rules","cup-notebook","cup-desk","cup-series","sparring","engine"];
const scripts=files.map(name=>{
  const file=path.join(__dirname,"../games/wilderkin",name+".js");return new vm.Script(fs.readFileSync(file,"utf8"),{filename:file});
});
const clone=v=>JSON.parse(JSON.stringify(v)),tick=()=>new Promise(r=>setImmediate(r));
const reserves=["sprigkit","dewfin","pincoil"];
function boot(raw,animate){
  let saved=raw,view="lobby";
  const w={localStorage:{getItem:k=>k==="wilderkin.trail.v3"?saved:null,setItem:(_,s)=>{saved=s;}}},ctx=vm.createContext({window:w});
  scripts.forEach(s=>s.runInContext(ctx));
  const g=w.WilderGame,sim=w.WilderSparringBattle.create({game:g}),rules=w.WilderCupRules.create({game:g,sim});
  const row=(id,label,value,detail,extra)=>({id,label,value,detail,...extra});
  const hall=w.WilderSparring.create({game:g,row,image:id=>id,go:(_,v)=>{view=v;},render(){},notify(){},animate});
  const model=()=>hall.model(view),rows=()=>model().sections.flatMap(s=>s.rows||[]);
  const entry=()=>g.state.sparring.cup.entry;
  function press(id,value){
    const r=rows().find(x=>x.id===id&&(value===undefined||x.value===value));
    assert.ok(r&&!r.disabled,"Missing "+id+" "+value+" on "+view);assert.equal(hall.act(id,r.value),true);
  }
  function open(v){view=v;return model();}
  function pos(){
    const m=entry().match,s=m.setup;let p=sim.start(s.left,s.right,m.first,s.gear);
    for(const cmd of m.moves)p=sim.apply(p,cmd);
    return p;
  }
  return {w,g,sim,rules,hall,model,rows,open,press,entry,pos,save:()=>saved,reload:()=>boot(saved)};
}
function outsideCup(g){const state=clone(g.state);delete state.sparring.cup;return state;}
async function finish(h){
  for(let i=0;i<90&&h.entry().match;i++){
    const p=h.pos();
    if(p.turn===1)h.press("spar-cpu");
    else{
      const move=h.sim.recommend(p);
      if(["swap","duet","signature"].includes(move.kind))h.press("spar-view","cmd:"+move.kind);
      h.press("spar-move",move.id);
    }
    await tick();
  }
  assert.equal(h.entry().match,null);
}
function pick(h,ids){
  h.press("cup-desk-open","cup:pick");
  for(const id of ids)h.press("cup-desk-add",id);
  h.press("cup-desk-start");
}
function filmBranch(h,num){
  h.press("spar-view","cup:replay:"+num);assert.equal(h.model().title,"Match review");
  const turn=h.rows().find(r=>r.value?.startsWith("t")&&r.detail.startsWith("Your"));
  assert.ok(turn);h.press("spar-review-open",turn.value);
  const alt=h.rows().find(r=>/^a\d+\//.test(r.value));
  assert.ok(alt);h.press("spar-review-open",alt.value);assert.equal(h.model().title,"Try another move");
  h.press("spar-review-open",turn.value);
  h.press("spar-review-leave");
}
test("Orin's sealed lineups, 0–1 comeback, all three replays and winning cabinet survive actual combat, new registration and reload; ordinary Hall and campaign stay intact",async()=>{
  let h=boot();
  h.press("spar-mode","local");h.press("spar-start");h.press("spar-move");await tick();
  const outside=outsideCup(h.g);
  h.open("lobby");h.press("spar-view","cup");h.press("cup-desk-quick");
  assert.equal(h.model().background,"ui/lantern-cup.png");assert.equal(h.entry().match.first,0);
  await finish(h);assert.equal(h.entry().rounds[0].winner,1);assert.equal(h.entry().rounds[0].conceded,false);
  const first=clone(h.entry().rounds[0].right),second=clone(h.entry().sealed);
  assert.equal(second[0],first[0]);assert.equal(second.filter(id=>first.includes(id)).length,2);
  h.press("cup-desk-open","cup:pick");h.press("cup-desk-add",reserves[0]);h.press("cup-desk-add",reserves[1]);
  h=h.reload();h.open("cup:pick");assert.deepEqual(clone(h.entry().picks),reserves.slice(0,2));
  h.press("cup-desk-add",reserves[2]);assert.deepEqual(clone(h.entry().sealed),second);
  h.press("cup-desk-start");await tick();assert.equal(h.entry().match.first,1);assert.ok(h.entry().match.moves.length>0);
  assert.deepEqual(clone(h.entry().match.setup.right),second);await finish(h);
  assert.deepEqual(clone(h.entry().rounds.map(t=>t.winner)),[1,0]);assert.notEqual(h.entry().sealed[0],second[0]);
  pick(h,reserves);await finish(h);
  const rounds=clone(h.entry().rounds),roster=clone(h.entry().roster);
  assert.deepEqual(rounds.map(t=>t.winner),[1,0,0]);assert.deepEqual(rounds.map(t=>t.first),[0,1,0]);assert.equal(h.model().title,"Lantern Cup won");
  h=h.reload();h.open("cup");const official=JSON.stringify(h.entry());
  for(let i=0;i<3;i++)filmBranch(h,i);
  assert.equal(JSON.stringify(h.entry()),official);assert.deepEqual(outsideCup(h.g),outside);
  h.press("cup-desk-new");h=h.reload();assert.equal(h.entry().locked,false);assert.deepEqual(clone(h.entry().rounds),[]);
  const trophy=h.g.state.sparring.cup.cabinet.orin;assert.deepEqual(clone(trophy.roster),roster);
  assert.deepEqual(clone(trophy.rounds),rounds);h.open("cup:cabinet");h.press("cup-series-open","cup:archive:orin:2");
  h.press("spar-review-open","t0");h.press("spar-review-leave");assert.equal(h.model().title,"Cup cabinet");
  assert.deepEqual(outsideCup(h.g),outside);
});
test("a browser closed on the CPU turn restores the tape, injured lead and legal action; a forged opponent or gear cannot resume",async()=>{
  let release;const h=boot(undefined,()=>new Promise(r=>{release=r;}));
  h.open("cup");h.press("cup-desk-quick");const attack=h.rows().find(r=>r.id==="spar-move");
  h.press("spar-move",attack.value);assert.equal(h.pos().turn,1);
  const moves=clone(h.entry().match.moves),state=clone(h.pos());const n=h.reload();n.open("cup");
  n.press("spar-view","cup:match");assert.deepEqual(clone(n.pos()),state);assert.deepEqual(clone(n.entry().match.moves),moves);
  n.press("spar-cpu");await tick();assert.equal(n.pos().turn,0);assert.ok(n.entry().match.moves.length>moves.length);
  const held=JSON.parse(n.save());
  for(const change of [
    e=>e.match.setup.right.reverse(),
    e=>{e.match.setup.gear.right={};},
    e=>{e.match.moves.push("skill:invented-move");},
    e=>{e.match.first=1;},
    e=>{e.match.setup.left[1]=e.match.setup.left[0];},
  ]){
    const bad=clone(held);change(bad.sparring.cup.entry);const repaired=boot(JSON.stringify(bad));
    assert.equal(repaired.entry().match,null);assert.equal(repaired.entry().roster.length,6);
    assert.deepEqual(clone(repaired.entry().rounds),[]);
  }
  h.open("lobby");release();await tick();
});
test("concessions award only the current bout once, skip film, and a corrupt completed tail preserves the preceding score",async()=>{
  const h=boot();h.open("cup");h.press("cup-desk-quick");h.press("spar-view","retire");
  const cancel=h.rows().find(r=>r.id==="cup-series-concede");
  h.press("cup-series-open","cup:match");assert.equal(h.entry().rounds.length,0);
  h.press("spar-view","retire");h.press("cup-series-concede");
  assert.equal(h.entry().rounds.length,1);assert.equal(h.entry().rounds[0].conceded,true);
  assert.deepEqual(clone(h.entry().rounds[0].moves),[]);assert.ok(!h.rows().some(r=>r.value==="cup:replay:0"));
  h.hall.act(cancel.id,cancel.value);assert.equal(h.entry().rounds.length,1);
  pick(h,reserves);await tick();h.hall.act(cancel.id,cancel.value);assert.ok(h.entry().match);
  h.press("spar-view","retire");h.press("cup-series-concede");assert.equal(h.model().title,"Series complete");
  assert.deepEqual(clone(h.entry().rounds.map(t=>[t.winner,t.conceded])),[[1,true],[1,true]]);
  assert.deepEqual(clone(h.g.state.sparring.cup.cabinet),{});
  const raw=JSON.parse(h.save());raw.sparring.cup.entry.rounds[1].right.reverse();
  raw.sparring.cup.cabinet.orin={roster:h.entry().roster,gear:{}};
  const repaired=boot(JSON.stringify(raw));assert.equal(repaired.entry().rounds.length,1);
  assert.deepEqual(clone(repaired.g.state.sparring.cup.cabinet),{});
  assert.deepEqual(clone(repaired.entry().sealed),clone(h.entry().rounds[1].right));
  delete raw.sparring.cup;const ordinary=boot(JSON.stringify(raw));assert.equal(ordinary.entry(),null);
});
