const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {webcrypto}=require("node:crypto");
const files=["atlas","bestiary","activities","story","campaign","duets","sparring-gear","sparring-signatures","sparring-battle","sparring-teams",
  "bellpost-rules","rental-cards","twin-battle","twin-match","engine"].map(n=>new vm.Script(fs.readFileSync(path.join(__dirname,"../games/wilderkin",n+".js"),"utf8"),{filename:n}));
const copy=v=>JSON.parse(JSON.stringify(v));
function device(map=new Map(),sessionOnly=false){
  const disk={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),key:i=>[...map.keys()][i]??null,get length(){return map.size;}};
  const w={localStorage:disk,crypto:webcrypto},ctx=vm.createContext({window:w});for(const f of files)f.runInContext(ctx);
  const game=w.WilderGame,sim=w.WilderTwinBattle.create({game}),library=w.WilderRentalCards.create({game,storage:disk});
  const match=w.WilderTwinMatch.create({game,sim,library,storage:sessionOnly?null:disk});
  return {w,game,sim,library,match,map};
}
function strength(p){
  const tally=s=>s.team.reduce((n,k)=>n+k.hp/k.maxHp+(k.hp?1:0),0);
  return tally(p.sides[0])-tally(p.sides[1]);
}
function best(sim,p,away){
  const moves=(lane,draft)=>p.sides[0].active[lane]==null?[null]:sim.options(p,0,lane,draft).filter(o=>o.available).map(o=>o.id);
  let rank=-Infinity,order=null;
  for(const a of moves(0,[null,null]))for(const b of moves(1,[a,null])){
    const choice=[a,b],r=sim.resolve(p,choice,away);if(!r)continue;
    const value=strength(r.pos)+(r.pos.sides[0].beats-r.pos.sides[1].beats)*.012+(r.pos.winner===0?25:0);
    if(value>rank){rank=value;order=choice;}
  }
  return order;
}
function finish(h){
  let r=h.match.read();while(r.pos.phase!=="done"){
    assert.ok(r.history.length<120);
    const picks=best(h.sim,r.pos,r.rivalOrders);assert.ok(picks);
    for(let i=0;i<2;i++)if(picks[i]!==null)assert.equal(h.match.commit("pick",i,picks[i]).ok,true);
    assert.equal(h.match.commit("round").ok,true);r=h.match.read();
  }return r;
}
test("ringing both orders once, recovering a half-plan and observing another tab preserve a real bout",()=>{
  const h=device(),career=copy(h.game.state),m=h.match;assert.equal(m.start().ok,true);
  const r=m.read(),actions=h.sim.coach(r.pos,0);assert.equal(m.commit("round").ok,false);
  assert.equal(m.commit("pick",0,actions[0]).ok,true);
  const other=device(h.map).match;
  assert.deepEqual(copy(other.read().draft),[actions[0],null]);assert.deepEqual(copy(other.read().rivalOrders),copy(r.rivalOrders));
  assert.equal(other.commit("pick",1,actions[1]).ok,true);
  assert.equal(m.commit("clear",0).code,"changed");assert.deepEqual(copy(m.read().draft),copy(actions));
  assert.equal(m.commit("round").ok,true);assert.equal(m.commit("round").ok,false);
  const next=device(h.map).match.read(),expected=h.sim.resolve(r.pos,actions,r.rivalOrders);
  assert.deepEqual(copy(next.pos),copy(expected.pos));assert.deepEqual(copy(next.lastEvents),copy(expected.events));
  assert.equal(m.start().code,"active");assert.equal(m.read().history.length,1);
  assert.deepEqual(copy(h.game.state),career);assert.deepEqual([...h.map.keys()],[h.w.WilderTwinMatch.storageKey]);
});
test("beating the three keepers earns a lasting bell cord, and an identically named visiting team earns no bell",()=>{
  const h=device(),library=h.library,original=copy(h.game.state);
  for(const keeper of h.w.WilderTwinMatch.wardens){
    assert.equal(h.match.choose(keeper.id,true).ok,true);assert.equal(h.match.start().ok,true);
    const bout=finish(h);
    assert.equal(bout.pos.winner,0,keeper.id+" should have a playable win from the featured four");
    assert.equal(bout.keeper,keeper.id);const mark=h.match.desk().marks[keeper.id];
    assert.equal(mark.rounds,bout.history.length);assert.deepEqual(copy(mark.team),copy(bout.left));
  }
  const next=device(h.map),marks=copy(h.match.desk().marks);
  assert.deepEqual(copy(next.match.desk().marks),marks);
  const remote=device(),card=h.w.WilderTwinMatch.wardenCard("willow");
  assert.equal(remote.match.choose(library.decode(library.encode(card)),true).ok,true);
  assert.equal(remote.match.start().ok,true);assert.equal(finish(remote).pos.winner,0);
  assert.deepEqual(copy(remote.match.desk().marks),{});
  assert.equal(remote.match.rematch().ok,true);assert.equal(remote.match.read().keeper,null);
  assert.deepEqual(copy(h.game.state),original);
});
test("editing the next crew leaves its ongoing bout intact, and corrupt orders cannot synthesize a position",()=>{
  const h=device(),match=h.match;
  assert.equal(match.start().ok,true);const r=copy(match.read()),alt=h.library.featured()[1].card;
  assert.equal(match.choose(alt).ok,true);assert.deepEqual(copy(match.read().left),r.left);
  assert.equal(match.choose({...alt,ids:[alt.ids[0],alt.ids[0],...alt.ids.slice(2)]}).ok,false);
  assert.equal(match.start().code,"active");assert.equal(match.start(true).ok,true);
  assert.deepEqual(copy(match.read().left),copy(alt));assert.notEqual(match.read().id,r.id);
  const k=h.w.WilderTwinMatch.storageKey,raw=JSON.parse(h.map.get(k));
  raw.run.history=[[["not-a-move",null],["not-a-move",null]]];h.map.set(k,JSON.stringify(raw));
  const next=device(h.map);assert.equal(next.match.read(),null);assert.deepEqual(copy(next.match.desk().crew),copy(alt));
  const local=device(new Map(),true);assert.equal(local.match.desk().persistent,false);
  assert.equal(local.match.start().ok,true);assert.equal(local.match.read().pos.round,1);assert.equal(local.map.size,0);
});
