const test=require("node:test"),assert=require("node:assert/strict");
const {webcrypto,createHash}=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const scripts=["atlas","bestiary","activities","campaign","story","duets","engine","sparring-gear","sparring-signatures","sparring-battle","sparring-teams","bellpost-rules","bellpost-arena","scout-rules","bellpost"].map(name=>{
  const filename=path.join(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(fs.readFileSync(filename,"utf8"),{filename});
});
function device(seed,store=new Map()){
  let counter=0,report;
  const localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k),
    key:i=>[...store.keys()][i],get length(){return store.size;}};
  const crypto={subtle:webcrypto.subtle,getRandomValues:bytes=>{
    const block=createHash("sha256").update(seed+":"+(++counter)).digest();bytes.set(block.subarray(0,bytes.length));return bytes;
  }};
  const w={crypto,localStorage,location:{},history:{replaceState:(_,__,hash)=>{w.location.hash=hash;}}};
  const ctx=vm.createContext({window:w,TextEncoder});scripts.forEach(s=>s.runInContext(ctx));
  const game=w.WilderGame,scout=w.WilderScoutRules.create({game}),rules=w.WilderBellpostRules.create({game});
  const row=(id,label,value,detail,extra)=>({id,label,value,detail,...extra});
  const post=w.WilderBellpost.create({game,row,scoutRules:scout,image:k=>k,go:()=>{},render:()=>{},notify:()=>{},openScoutReport:hash=>{report=hash;}});
  return {scout,rules,post,store,w,report:()=>report,rows:route=>post.model(route).sections.flatMap(s=>s.rows)};
}
const home={ids:["sprigkit","dewfin","cindlet","mossbell"],gear:{sprigkit:"opening-pennant"}};
const guest={ids:["charquill","dewfin","kilnbeak","mossbell"],gear:{kilnbeak:"prism-lens"}};
async function ok(promise){const res=await promise;assert.ok(res.ok,res.message);return res.record;}
async function prepare(seed){
  const h=device("host"+seed),g=device("guest"+seed),invite=await ok(h.scout.invite(home));
  const joined=await ok(g.scout.join(invite.hash,guest));await ok(h.scout.receive(joined.hash));
  const offered=await ok(h.scout.lock(invite.id,home.ids.slice(0,3)));await ok(g.scout.receive(offered.hash));
  const locked=await ok(g.scout.lock(invite.id,["kilnbeak","charquill","dewfin"]));
  const ready=await ok(h.scout.receive(locked.hash));return {h,g,ready};
}
const current=()=>true;

test("a scouted battle link verifies the charter, assigns the original seats, and preserves turns across report, film and reload",async()=>{
  const openings=new Set();
  for(let n=0;n<16&&openings.size<2;n++){
    const {h,g,ready}=await prepare(n),{id,battle}=ready;
    if(openings.has(battle.first))continue;
    openings.add(battle.first);
    const route="game|"+id,players=[h,g],first=players[battle.first],second=players[1-battle.first];
    assert.equal(h.post.loadScouted(ready),route);
    const initial=h.w.location.hash;assert.match(initial,/^#scout-bout1=.+!x!x$/);
    assert.equal(g.scout.get(id).stage,3);
    if(battle.first===1)assert.equal(await g.post.loadScoutBout(initial,current),route);
    const move=first.rows(route).find(r=>r.id==="post-move"&&!r.disabled);
    assert.ok(move);first.post.act(move.id,move.value,route);
    const handoff=first.w.location.hash;
    assert.match(handoff,/![A-Z2]!x$/);
    assert.equal(await second.post.loadScoutBout(handoff+"%E2%80%9D",current),route);
    assert.equal(second.rules.get(id).seat,1-battle.first);
    assert.equal(second.scout.get(id).stage,4);
    const reply=second.rows(route).find(r=>r.id==="post-move"&&!r.disabled);
    second.post.act(reply.id,reply.value,route);
    const latest=second.w.location.hash;
    const refreshed=device("reload",first.store);
    assert.equal(await refreshed.post.loadScoutBout(latest,current),route);
    assert.equal(refreshed.rules.get(id).moves.length,2);
    assert.equal(await refreshed.post.loadScoutBout(initial,current),route);
    assert.equal(refreshed.w.location.hash,latest);
    const spectator=device("watch"),publicTable=await spectator.scout.inspect(ready.hash);
    assert.equal(await spectator.post.loadScoutBout(latest,current),route);
    const controls=spectator.rows(route);
    assert.ok(controls.some(r=>r.id==="post-scout-report"));
    assert.ok(!controls.some(r=>r.id==="post-move"));
    spectator.post.act("post-scout-report",id,route);assert.equal(spectator.report(),ready.hash);
    assert.equal(spectator.post.loadScouted(publicTable),route);
    assert.equal(spectator.w.location.hash,latest);
    assert.equal(spectator.rules.get(id),null);assert.equal(spectator.scout.get(id),null);
    const forged=latest.replace(/![A-Z2]+!x$/,"!222222!x");
    assert.equal(await refreshed.post.loadScoutBout(forged,current),"error");
    assert.equal(await refreshed.post.loadScoutBout(latest,()=>false),null);
    assert.equal(refreshed.rules.get(id).moves.length,2);
    const changedDraw={...battle,first:1-battle.first};
    assert.equal(refreshed.rules.seatScouted(changedDraw,battle.first).code,"fork");
    const other=refreshed.rules.scoutedHash(changedDraw);
    assert.equal(refreshed.rules.receive(other).code,"fork");
    assert.ok(!device("stranger").rules.inspect(other.slice(0,-2)));
  }
  assert.deepEqual([...openings].sort(),[0,1]);
});
