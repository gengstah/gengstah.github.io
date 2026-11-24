const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),{webcrypto}=require("node:crypto");

const scripts=["atlas","bestiary","activities","campaign","story","duets","stillwake","engine","sparring-gear","scout-rules"].map(name=>{
  const file=path.join(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(fs.readFileSync(file,"utf8"),{filename:file});
});
function runtime(crypto){
  const window={crypto},ctx=vm.createContext({window,TextEncoder});
  scripts.forEach(s=>s.runInContext(ctx));
  return window;
}
const copy=value=>JSON.parse(JSON.stringify(value));
const win=runtime(webcrypto),game=win.WilderGame;
function storage(map=new Map()){
  return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),
    key:i=>[...map.keys()][i],get length(){return map.size;}};
}
const desk=(s=storage(),w=win)=>w.WilderScoutRules.create({game:w.WilderGame,storage:s});
const home={ids:["mossbell","dewfin","sprigkit","charquill"],gear:{mossbell:"opening-pennant",sprigkit:"mender-wrap",dewfin:"last-stitch"}};
const guest={ids:["gustlance","cindlet","fernprickle","kilnbeak"],gear:{cindlet:"relay-bell",kilnbeak:"prism-lens"}};
const homeThree=["sprigkit","charquill","dewfin"],guestThree=["kilnbeak","gustlance","cindlet"];
const sorted=team=>({ids:team.ids.slice().sort(),gear:{...team.gear}});
const lineup=(team,ids)=>({ids,gear:Object.fromEntries(ids.filter(k=>Object.hasOwn(team.gear,k)).map(k=>[k,team.gear[k]]))});
async function ok(promise){
  const result=await promise;
  assert.equal(result.ok,true,result.message);
  assert.equal(result.id,result.record.id);
  return result.record;
}
async function rejects(promise,code){
  const result=await promise;
  assert.equal(result.ok,false,"Unexpected acceptance");
  assert.ok(typeof result.message==="string"&&result.message.length);
  if(code)assert.equal(result.code,code,result.message);
}
async function registered(){
  const hs=storage(),gs=storage(),h=desk(hs),g=desk(gs);
  const invite=await ok(h.invite(home)),joined=await ok(g.join(invite.hash,guest));
  await ok(h.receive(joined.hash));
  return {hs,gs,h,g,id:invite.id,invite,joined};
}
async function completed(){
  const r=await registered(),scout=await ok(r.h.lock(r.id,homeThree));
  await ok(r.g.receive(scout.hash));
  const locked=await ok(r.g.lock(r.id,guestThree)),ready=await ok(r.h.receive(locked.hash));
  await ok(r.g.receive(ready.hash));
  return {...r,scout,locked,ready};
}

test("the first two choices remain sealed until the other seat commits and both desks restore the precise charter",async()=>{
  const original=copy(game.state),reader=desk(),hs=storage(),gs=storage(),h=desk(hs),g=desk(gs);
  const t=await ok(h.invite(home)),id=t.id;
  assert.equal(t.seat,0);assert.equal(t.stage,0);assert.equal(t.status,"invite");
  assert.match(id,/^[a-f0-9]{24}$/);
  assert.deepEqual(copy(desk(hs).get(id).rosters[0]),sorted(home));
  const unopened=await h.inspect(t.hash);
  assert.deepEqual(copy(unopened.rosters),[null,null]);assert.deepEqual(copy(unopened.picks),[null,null]);
  assert.equal(unopened.seat,null);assert.equal(unopened.battle,null);
  for(const id of [...home.ids,...Object.values(home.gear)])assert.ok(!t.hash.includes(id));
  const a=await ok(g.join(t.hash,guest));
  assert.equal(a.seat,1);assert.equal(a.stage,1);assert.match(a.guestId,/^[a-f0-9]{24}$/);assert.notEqual(a.guestId,t.id);
  assert.deepEqual(copy((await reader.inspect(a.hash)).rosters),[null,sorted(guest)]);
  assert.equal(g.get(id).rosters[0],null);
  await ok(h.receive(a.hash));
  const sc=await ok(desk(hs).lock(id,homeThree)),pub=await reader.inspect(sc.hash);
  assert.equal(sc.stage,2);assert.deepEqual(copy(sc.picks),[homeThree,null]);
  assert.deepEqual(copy(pub.rosters),[sorted(home),sorted(guest)]);assert.deepEqual(copy(pub.picks),[null,null]);
  assert.equal(pub.battle,null);assert.deepEqual(copy(await h.inspect(sc.hash)),copy(pub));
  await ok(desk(gs).receive(sc.hash));
  const l=await ok(desk(gs).lock(id,guestThree));
  assert.equal(l.stage,3);assert.deepEqual(copy((await reader.inspect(l.hash)).picks),[null,guestThree]);
  assert.equal(l.battle,null);
  const done=await ok(desk(hs).receive(l.hash));
  assert.equal(done.stage,4);assert.equal(done.status,"ready");assert.equal(done.seat,0);
  assert.deepEqual(copy(done.picks),[homeThree,guestThree]);
  assert.deepEqual(copy(done.battle.teams),[lineup(home,homeThree),lineup(guest,guestThree)]);
  assert.equal(done.battle.id,id);assert.equal(done.battle.guestId,a.guestId);assert.ok([0,1].includes(done.battle.first));
  const theirs=await ok(desk(gs).receive(done.hash));assert.equal(theirs.seat,1);
  for(const s of [hs,gs]){
    assert.deepEqual(copy(desk(s).get(id).battle),copy(done.battle));
    assert.equal(desk(s).list().length,1);assert.equal(desk(s).export(id),done.hash);
  }
  const fresh=await reader.inspect(done.hash);
  assert.deepEqual(copy(fresh.battle),copy(done.battle));assert.equal(fresh.seat,null);
  for(const letter of [t,a,sc,l,done]){
    assert.match(letter.hash,/^#scout-v1=.+[0-9a-z]$/i);
    assert.ok(letter.hash.length<1500);
    assert.equal((await reader.inspect(letter.hash)).stage,letter.stage);
    await rejects(reader.receive(letter.hash),"spectator");
  }
  assert.equal(reader.get(id),null);assert.equal(reader.list().length,0);
  assert.deepEqual(copy(game.state),original);
});

test("each registration is a fresh commitment; malformed pools, equipment and ordered picks never advance a table",async()=>{
  const h=desk(),g=desk(),two=await ok(h.invite(home)),t=await ok(h.invite(home));
  assert.notEqual(t.id,two.id);assert.notEqual(t.hash.split(".")[1],two.hash.split(".")[1]);
  for(const value of [null,{ids:home.ids.slice(0,3)}, {ids:[...home.ids,"cindlet"]},
    {ids:["dewfin","dewfin","mossbell","sprigkit"]},{ids:["stillwake","mossbell","dewfin","sprigkit"]},
    {ids:["unknown","mossbell","dewfin","sprigkit"]},{ids:home.ids,gear:{cindlet:"prism-lens"}},
    {ids:home.ids,gear:{mossbell:"fake"}},{ids:home.ids,gear:{mossbell:"seam-hook",dewfin:"seam-hook"}},
    {ids:home.ids,gear:null}]){
    await rejects(h.invite(value));await rejects(g.join(t.hash,value));
  }
  assert.equal(h.list().length,2);assert.equal(g.list().length,0);
  await rejects(h.join(t.hash,guest));await rejects(h.lock(t.id,homeThree));
  const a=await ok(g.join(t.hash,guest));await ok(h.receive(a.hash));
  await rejects(g.lock(t.id,guestThree));
  for(const ids of [null,"123",[],home.ids,["dewfin","dewfin","mossbell"],
    ["cindlet","dewfin","sprigkit"],["__proto__","dewfin","sprigkit"]]){
    await rejects(h.lock(t.id,ids));assert.equal(h.export(t.id),a.hash);
  }
});

test("old and duplicate letters remain harmless; competing acceptances and conflicting same-browser locks cannot replace a choice",async()=>{
  const {h,g,hs,gs,invite,joined,id}=await registered(),other=desk(),newGuest=await ok(other.join(invite.hash,guest));
  assert.notEqual(newGuest.guestId,joined.guestId);
  await rejects(h.receive(newGuest.hash),"fork");
  assert.equal((await h.receive(joined.hash)).code,"duplicate");await rejects(h.receive(invite.hash),"stale");
  const tabs=[desk(hs),desk(hs)],locks=await Promise.all(tabs.map((tab,i)=>tab.lock(id,i?homeThree.slice().reverse():homeThree)));
  assert.equal(locks.filter(r=>r.ok).length,1);
  const committed=locks.find(r=>r.ok).record;
  assert.equal(h.export(id),committed.hash);
  for(const tab of tabs)assert.deepEqual(copy(tab.get(id).picks),copy(committed.picks));
  const fork=desk(storage(new Map(gs.map)));
  await ok(g.receive(committed.hash));await ok(fork.receive(committed.hash));
  const good=await ok(g.lock(id,guestThree)),different=await ok(fork.lock(id,guestThree.slice().reverse()));
  const result=await ok(h.receive(good.hash));
  await rejects(h.receive(different.hash),"fork");assert.equal(h.export(id),result.hash);
  await rejects(fork.receive(result.hash),"fork");assert.equal(fork.export(id),different.hash);
  assert.equal((await h.receive(result.hash)).code,"duplicate");
  await ok(g.receive(result.hash));await rejects(g.receive(joined.hash),"stale");
  assert.equal((await g.receive(result.hash)).code,"duplicate");
  const sealed=await ok(h.archive(id));assert.equal(sealed.archived,true);assert.equal(desk(hs).list().length,0);
  assert.equal(desk(hs).get(id).archived,true);
  await rejects(desk(hs).join(invite.hash,guest));assert.equal(desk(gs).list().length,1);
});

test("readers reject forged reveals, unbounded links and invalid charters without acquiring a seat",async()=>{
  const {h,invite,scout,locked,ready,id}=await completed(),reader=desk();
  const fields=ready.hash.split("."),changed=fields.slice();
  // The final proof reveals the host's earlier commitment. Change one legal digit in the opening salt.
  const salt=changed.at(-1);
  changed[changed.length-1]=salt.slice(0,-1)+(salt.endsWith("0")?"1":"0");
  const alteredPicks=fields.slice(),pickField=fields.length-2;
  alteredPicks[pickField]=alteredPicks[pickField].split("").reverse().join("");
  const bad=[false,"",ready.hash+"!",ready.hash+".".repeat(1500),scout.hash.replace("v1=","v2="),
    locked.hash+"..0",ready.hash.replace("mossbell","cindlet"),ready.hash.replace("mossbell","__proto__"),
    changed.join("."),alteredPicks.join(".")];
  assert.notEqual(alteredPicks.join("."),ready.hash);
  for(const hash of bad){
    assert.equal(await reader.inspect(hash),null,String(hash));
    await rejects(h.receive(hash));assert.equal(h.export(id),ready.hash);
  }
  assert.equal(reader.list().length,0);assert.equal((await reader.inspect(invite.hash)).seat,null);
});

test("absence of secure randomness or SHA-256 never produces a weak substitute invitation",async()=>{
  for(const crypto of [undefined,{getRandomValues:a=>a},{subtle:webcrypto.subtle}]){
    const s=storage(),h=desk(s,runtime(crypto));
    assert.equal(h.secure,false);const result=await h.invite(home);
    assert.equal(result.ok,false);assert.match(result.message,/secure|crypto|https/i);
    assert.equal(h.list().length,0);assert.equal(s.map.size,0);
  }
});

test("independently encoded SHA-256 charters preserve battle order and jointly determine either opening seat",async()=>{
  // Digests precomputed independently with node:crypto using the v1 transcript and the ASCII fields below.
  const wire=["#scout-v1=00112233445566778899aabb","2364a075e325b00f92d41230921574821294963a7265692490d8b9dfc685847e",
    "ffeeddccbbaa998877665544","cindlet~relay-bell,fernprickle,gustlance,kilnbeak~prism-lens",
    "charquill,dewfin~last-stitch,mossbell~opening-pennant,sprigkit~mender-wrap","11111111111111111111111111111111",
    "4ae5a7ecf8dc4546956139554ac584004315d89b602f67b24d6c15a3ade768d5","320","33333333333333333333333333333333",
    "301","22222222222222222222222222222222"];
  const reader=desk();
  for(const [coin,expected] of [["33333333333333333333333333333333",1],["33333333333333333333333333333332",0]]){
    const fields=wire.slice();fields[8]=coin;
    const r=await reader.inspect(fields.join("."));
    assert.ok(r);assert.equal(r.battle.first,expected);assert.equal(r.stage,4);
    assert.deepEqual(copy(r.battle.teams),[lineup(home,homeThree),lineup(guest,guestThree)]);
  }
  // Each modified field is syntactically legal but no longer opens its commitment or its parent transcript.
  for(const [index,replacement] of [[1,"f".repeat(64)],[2,"0".repeat(24)],[3,wire[3].replace("prism-lens","seam-hook")],
    [5,"1".repeat(31)+"0"],[6,"e".repeat(64)],[9,"310"],[10,"2".repeat(31)+"3"]]){
    const fields=wire.slice();fields[index]=replacement;
    assert.equal(await reader.inspect(fields.join(".")),null,"Unbound field "+index);
  }
});

test("an undelivered final reveal can be resent; a copied local seat cannot submit its own missed private choice through a letter",async()=>{
  const {hs,gs,h,g,id,joined}=await registered(),copiedHost=desk(storage(new Map(hs.map)));
  const sealed=await ok(h.lock(id,homeThree));
  await rejects(copiedHost.receive(sealed.hash),"seat");
  assert.equal(copiedHost.export(id),joined.hash);
  await ok(g.receive(sealed.hash));
  const copiedGuest=desk(storage(new Map(gs.map))),locked=await ok(g.lock(id,guestThree));
  await rejects(copiedGuest.receive(locked.hash),"seat");assert.equal(copiedGuest.export(id),sealed.hash);
  const final=await ok(h.receive(locked.hash));
  assert.equal((await desk(hs).receive(locked.hash)).code,"duplicate");
  assert.equal((await ok(desk(hs).receive(locked.hash))).hash,final.hash);
  await rejects(copiedGuest.receive(final.hash),"seat");
  assert.deepEqual(copy((await ok(desk(gs).receive(final.hash))).battle),copy(final.battle));
});

test("blocked local storage keeps the table playable during its browser session",async()=>{
  const blocked={getItem(){throw Error("Denied");},setItem(){throw Error("Denied");}};
  const h=desk(blocked),g=desk(blocked),t=await ok(h.invite(home)),j=await ok(g.join(t.hash,guest));
  assert.equal(h.persistent,false);assert.equal(g.persistent,false);
  await ok(h.receive(j.hash));const sc=await ok(h.lock(t.id,homeThree));await ok(g.receive(sc.hash));
  const l=await ok(g.lock(t.id,guestThree)),final=await ok(h.receive(l.hash));
  assert.deepEqual(copy((await ok(g.receive(final.hash))).battle),copy(final.battle));
  assert.equal(desk(blocked).get(t.id),null);
});
