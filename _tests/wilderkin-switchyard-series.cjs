const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path"),{webcrypto}=require("node:crypto");
const scripts=["atlas","bestiary","activities","campaign","story","duets","sparring-gear","sparring-signatures",
  "sparring-battle","sparring-teams","bellpost-rules","rental-cards","twin-battle","twin-match","engine","switchyard-series"].map(name=>{
  const filename=path.join(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(fs.readFileSync(filename,"utf8"),{filename});
});
const plain=x=>JSON.parse(JSON.stringify(x));
function storage(map=new Map()){
  return {map,getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key),
    key:i=>[...map.keys()][i]??null,get length(){return map.size;}};
}
function device(map=new Map(),peaceful=false){
  const store=storage(map),window={localStorage:store,crypto:webcrypto},ctx=vm.createContext({window});
  scripts.forEach(s=>s.runInContext(ctx));
  const game=window.WilderGame,sim=window.WilderTwinBattle.create({game}),library=window.WilderRentalCards.create({game,storage:store});
  // A draw fixture drives normal legal Cover orders through the real 24-round judging and promotion code.
  const rules=peaceful?{...sim,coach(pos,seat){
    return pos.sides[seat].active.map((index,i)=>index===null?null:"cover:"+i);
  }}:sim;
  const series=window.WilderSwitchyardSeries.create({game,sim:rules,library,storage:store});
  return {window,game,sim,series,library,map};
}
function evaluate(pos){
  const strength=s=>s.team.reduce((n,kin)=>n+kin.hp/kin.maxHp+(kin.hp>0?1:0),0);
  return strength(pos.sides[0])-strength(pos.sides[1])+(pos.sides[0].beats-pos.sides[1].beats)*.012+
    (pos.winner===0?100:pos.winner===1?-100:0);
}
function bestChoice(sim,pos,rival){
  const legal=(lane,draft)=>pos.sides[0].active[lane]===null?[null]:
    sim.options(pos,0,lane,draft).filter(m=>m.available).map(m=>m.id);
  let best=null,score=-Infinity;
  for(const a of legal(0,[null,null]))for(const b of legal(1,[a,null])){
    const attempt=[a,b],next=sim.resolve(pos,attempt,rival);if(!next)continue;
    const value=evaluate(next.pos);if(value>score){best=attempt;score=value;}
  }
  assert.ok(best);return best;
}
function deflect(pos){
  return pos.sides[0].active.map((index,i)=>index===null?null:"cover:"+i);
}
const roster={name:"River carriage",ids:["dewfin","thicketowl","kilnclaw","cairnwatch","gustlance","pincoil"],
  gear:{dewfin:"opening-pennant",thicketowl:"mender-wrap",kilnclaw:"last-stitch",cairnwatch:"relay-bell",gustlance:"seam-hook",pincoil:"prism-lens"}};
const leads=roster.ids.slice(0,4),alternates=["pincoil","gustlance","dewfin","kilnclaw"];
function ok(result){assert.equal(result?.ok,true,result?.message);return result;}
function open(h,ids=leads){
  ok(h.series.setPicks(ids));ok(h.series.startGame());return h.series.read();
}
function finish(h,press){
  const s=h.series;let r=s.read();
  while(r.pos.phase!=="done"){
    assert.ok(r.history.length<24,"the Cup uses Twinbell’s judging limit");
    const orders=press?bestChoice(h.sim,r.pos,r.rivalOrders):deflect(r.pos);
    const expected=h.sim.resolve(r.pos,orders,r.rivalOrders);assert.ok(expected);
    for(const [lane,id] of orders.entries())if(id!==null)ok(s.commit("pick",lane,id));
    const committed=ok(s.commit("round"));assert.ok(committed.frames.length);
    r=s.read();assert.deepEqual(plain(r.pos),plain(expected.pos));
  }
  return r;
}
function compareResult(r,game,number){
  assert.equal(game.number,number);assert.equal(game.winner,r.pos.winner);
  assert.equal(game.rounds,r.history.length);
  assert.deepEqual(plain(game.standing),Array.from(r.pos.sides,s=>s.team.filter(k=>k.hp>0).length));
  assert.deepEqual(plain(game.hp),Array.from(r.pos.sides,s=>s.team.reduce((sum,k)=>sum+k.hp,0)));
  assert.ok(game.highlight);
}
test("register six and freeze the public pools; the opposing four are independent of private selections",()=>{
  const h=device(),s=h.series,initial=plain(s.desk());
  assert.equal(initial.phase,"register");assert.equal(initial.captain.ids.length,6);
  assert.equal(s.read(),null);
  for(const card of [{...roster,ids:leads},{...roster,ids:[...leads,...leads.slice(0,2)]},
    {...roster,ids:[...roster.ids.slice(1),"stillwake"]},{...roster,gear:{dewfin:"not-gear"}},
    {...roster,gear:{dewfin:"relay-bell",pincoil:"relay-bell"}}]){
    assert.equal(s.setRoster(card).ok,false);
  }
  ok(s.setRoster(roster));ok(s.register());
  assert.equal(s.desk().phase,"pick");
  assert.deepEqual(plain(s.desk().roster),roster);
  assert.equal(s.read(),null);
  assert.equal(s.setRoster({...roster,ids:roster.ids.slice().reverse()}).ok,false);
  assert.equal(s.setPicks([leads[0],leads[0]]).ok,false);
  assert.equal(s.setPicks(["sprigkit"]).ok,false);
  ok(s.setPicks([leads[0]]));assert.equal(s.startGame().ok,false);
  const b=device(new Map(h.map)),aGame=open(h),bGame=open(b,alternates);
  assert.deepEqual(plain(aGame.right),plain(bGame.right));
  assert.deepEqual(plain(aGame.left.ids),leads);assert.deepEqual(plain(bGame.left.ids),alternates);
  assert.deepEqual(plain(aGame.left.gear),Object.fromEntries(leads.map(id=>[id,roster.gear[id]])));
  assert.deepEqual(plain(aGame.pos.sides[0].active),[0,1]);
  assert.ok(plain(aGame.right.ids).every(id=>initial.captain.ids.includes(id)));
  assert.equal(s.startGame().ok,false);assert.equal(s.next().ok,false);
  assert.equal(s.reset().ok,false);assert.equal(s.read().id,aGame.id);
  ok(s.reset(true));assert.equal(s.desk().phase,"register");assert.equal(s.read(),null);
});
test("a half-sent order survives reload; stale rounds and abandoned runs cannot overwrite another tab",()=>{
  const h=device(),s=h.series,k=h.window.WilderSwitchyardSeries.storageKey,career=plain(h.game.state);
  h.map.set("unrelated.library","retained");
  ok(s.register(roster));const first=open(h),orders=h.sim.coach(first.pos,0);
  ok(s.commit("pick",0,orders[0]));const b=device(h.map).series;
  assert.deepEqual(plain(b.read().draft),[orders[0],null]);
  assert.deepEqual(plain(b.read().rivalOrders),plain(first.rivalOrders));
  assert.equal(b.commit("round").ok,false);ok(b.commit("pick",1,orders[1]));
  assert.equal(s.commit("clear",0).code,"changed");
  assert.deepEqual(plain(s.read().draft),plain(orders));ok(s.commit("round"));
  assert.equal(b.reset(true).code,"changed");assert.equal(b.read().history.length,1);
  assert.deepEqual(plain(b.read().pos),plain(h.sim.resolve(first.pos,orders,first.rivalOrders).pos));
  assert.deepEqual(plain(h.game.state),career);
  assert.deepEqual([...h.map.keys()].sort(),[k,"unrelated.library"].sort());
});
test("a real 24-round draw holds the score and replays the same game with fresh leads",()=>{
  const h=device(new Map(),true),s=h.series;ok(s.register(roster));const start=open(h),r=finish(h,false);
  assert.equal(r.history.length,24);assert.equal(r.pos.winner,"draw");
  const d=s.desk();assert.equal(d.phase,"between");assert.deepEqual(plain(d.score),[0,0]);
  assert.equal(d.trophy,false);assert.equal(d.games.length,1);compareResult(r,d.games[0],1);
  const next=device(h.map,true),after=next.series;assert.deepEqual(plain(after.read().pos),plain(r.pos));
  ok(after.next());assert.equal(after.desk().gameNumber,1);
  const replay=open(next);assert.notEqual(replay.id,start.id);
  assert.deepEqual(plain(replay.pos.sides[0]),plain(start.pos.sides[0]));
  assert.equal(replay.pos.round,1);assert.equal(replay.pos.phase,"plan");
  for(const side of replay.pos.sides){
    assert.deepEqual(plain(side.active),[0,1]);assert.ok(side.team.every(k=>k.hp===k.maxHp));
  }
  assert.deepEqual(plain(after.desk().score),[0,0]);assert.deepEqual(plain(replay.history),[]);
});
test("a played loss and two played victories decide game three, survive cold reload and retain the Cup on reset",()=>{
  const h=device(),s=h.series,original=plain(h.game.state);
  ok(s.register(roster));open(h);const loss=finish(h,false);assert.equal(loss.pos.winner,1);
  assert.deepEqual(plain(s.desk().score),[0,1]);compareResult(loss,s.desk().games[0],1);
  assert.equal(s.desk().phase,"between");assert.equal(s.commit("round").ok,false);
  const shadow=device(new Map(h.map));ok(shadow.series.next());const alt=open(shadow,alternates);
  ok(s.next());assert.equal(s.desk().gameNumber,2);const gameTwo=open(h);
  assert.deepEqual(plain(alt.right),plain(gameTwo.right),"the rematch scout cannot see today's choices");
  const win=finish(h,true);assert.equal(win.pos.winner,0);compareResult(win,s.desk().games[1],2);
  assert.deepEqual(plain(s.desk().score),[1,1]);ok(s.next());assert.equal(s.desk().gameNumber,3);
  const final=open(h);assert.notEqual(final.id,gameTwo.id);
  assert.notDeepEqual(plain(final.right.ids.slice(0,2)),plain(gameTwo.right.ids.slice(0,2)),
    "Sela changes the opening pair after this public Game 2 loss");
  const last=finish(h,true),d=s.desk();assert.equal(last.pos.winner,0);
  compareResult(last,d.games[2],3);
  assert.deepEqual(plain(d.score),[2,1]);assert.equal(d.phase,"done");assert.equal(d.winner,0);assert.equal(d.trophy,true);
  assert.deepEqual(plain(d.best.roster),roster);assert.deepEqual(plain(d.best.score),[2,1]);
  assert.equal(d.best.rounds,d.games.reduce((n,entry)=>n+entry.rounds,0));
  const key=h.window.WilderSwitchyardSeries.storageKey,forged=JSON.parse(h.map.get(key));
  // A replay must establish both victories. A cached winner, score, or duplicate trophy is not proof.
  for(const tapes of [forged.games,forged.best.games])tapes[2].orders.push(["cover:0","cover:1"]);
  forged.trophy=true;forged.score=[2,0];forged.winner=0;
  const modified=new Map(h.map);modified.set(key,JSON.stringify(forged));
  const checked=device(modified).series.desk();
  assert.equal(checked.trophy,false);assert.equal(checked.best,null);
  assert.deepEqual(plain(checked.score),[1,1]);
  assert.deepEqual(plain(checked.games),plain(d.games.slice(0,2)));
  for(const tapes of [forged.games,forged.best.games])tapes[2].orders.splice(-2);
  modified.set(key,JSON.stringify(forged));
  const partial=device(modified).series.desk();assert.equal(partial.trophy,false);
  assert.deepEqual(plain(partial.score),[1,1]);
  const other=device(h.map),saved=plain(d.best);assert.deepEqual(plain(other.series.desk().best),saved);
  assert.deepEqual(plain(other.series.read().pos),plain(last.pos));assert.equal(other.series.next().ok,false);
  ok(other.series.reset(true));assert.equal(other.series.desk().phase,"register");
  assert.deepEqual(plain(other.series.desk().best),saved);assert.equal(other.series.desk().trophy,true);
  assert.deepEqual(plain(h.game.state),original);
});
test("replay derives sealed opposing orders and legal progress from the participating four",()=>{
  const h=device(),s=h.series,key=h.window.WilderSwitchyardSeries.storageKey;
  ok(s.register(roster));const r=open(h),orders=h.sim.coach(r.pos,0);
  for(const [i,order] of orders.entries())ok(s.commit("pick",i,order));
  ok(s.commit("round"));const current=plain(s.read()),disk=JSON.parse(h.map.get(key));
  assert.ok(disk.active.orders.length===1);
  const fabricated=plain(disk);fabricated.active.right={name:"Wrong",ids:leads,gear:{}};
  fabricated.active.rivalOrders=["cover:0","cover:1"];
  fabricated.score=[2,0];fabricated.winner=0;fabricated.best={score:[2,0],roster,games:[]};
  let copy=new Map(h.map);copy.set(key,JSON.stringify(fabricated));
  let restored=device(copy).series;
  assert.deepEqual(plain(restored.read().pos),current.pos);assert.deepEqual(plain(restored.read().right),current.right);
  assert.deepEqual(plain(restored.read().rivalOrders),current.rivalOrders);
  assert.deepEqual(plain(restored.desk().score),[0,0]);assert.equal(restored.desk().trophy,false);
  for(const corrupt of [raw=>{raw.active.orders[0]=["attack:undefined:0","cover:1"];},
      raw=>{raw.active.ids=Array(4).fill("dewfin");},raw=>{raw.active.orders=Array(25).fill(["cover:0","cover:1"]);}]){
    const raw=plain(disk);corrupt(raw);copy=new Map(h.map);copy.set(key,JSON.stringify(raw));
    restored=device(copy).series;assert.equal(restored.read(),null);
    assert.equal(restored.desk().phase,"pick");assert.deepEqual(plain(restored.desk().score),[0,0]);
  }
});
test("a two-loss Cup closes without a trophy and a failed write preserves the previous round",()=>{
  const h=device(),s=h.series,k=h.window.WilderSwitchyardSeries.storageKey;
  ok(s.register(roster));open(h);const first=finish(h,false);
  assert.equal(first.pos.winner,1);ok(s.next());open(h,alternates);
  const second=finish(h,false);assert.equal(second.pos.winner,1);
  const closed=device(h.map).series.desk();assert.equal(closed.phase,"done");
  assert.deepEqual(plain(closed.score),[0,2]);assert.equal(closed.gameNumber,2);
  assert.equal(closed.winner,1);assert.equal(closed.best,null);assert.equal(closed.trophy,false);

  const store=storage(),old=store.setItem;
  const isolated=h.window.WilderSwitchyardSeries.create({game:h.game,sim:h.sim,storage:store});
  ok(isolated.register(roster));ok(isolated.setPicks(leads));ok(isolated.startGame());
  const initial=plain(isolated.read()),moves=h.sim.coach(initial.pos,0);
  ok(isolated.commit("pick",0,moves[0]));ok(isolated.commit("pick",1,moves[1]));
  const before=store.getItem(k);store.setItem=(key,v)=>{if(key===k)throw Error("Quota exceeded");old(key,v);};
  assert.equal(isolated.commit("round").ok,false);assert.equal(store.getItem(k),before);
  assert.deepEqual(plain(isolated.read().pos),initial.pos);
  assert.deepEqual(plain(isolated.read().draft),plain(moves));
  store.setItem=old;ok(isolated.commit("round"));assert.equal(isolated.read().history.length,1);
  const session=h.window.WilderSwitchyardSeries.create({game:h.game,sim:h.sim,storage:null});
  assert.equal(session.desk().persistent,false);ok(session.register(roster));ok(session.setPicks(leads));
  ok(session.startGame());assert.equal(session.read().pos.round,1);
});

test("a new registration with the same six receives a distinct public series identifier",()=>{
  const h=device(),s=h.series;
  assert.equal(s.desk().id,null);ok(s.register(roster));
  const first=s.desk().id;assert.match(first,/^[0-9a-f]{16}$/);
  assert.equal(device(h.map).series.desk().id,first);
  ok(s.reset(true));ok(s.register(roster));assert.notEqual(s.desk().id,first);
});
