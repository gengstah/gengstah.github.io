const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {webcrypto}=require("node:crypto");

const window={crypto:webcrypto},ctx=vm.createContext({window,TextEncoder});
for(const name of ["atlas","bestiary","activities","story","campaign","duets","engine","sparring-gear","sparring-signatures","sparring-battle","bellpost-rules","scout-rules","film-practice"]){
  const file=path.join(__dirname,"../games/wilderkin",name+".js");
  vm.runInContext(fs.readFileSync(file,"utf8"),ctx,{filename:file});
}
const game=window.WilderGame,sim=window.WilderSparringBattle.create({game});
const spectator=window.WilderBellpostRules.create({game,storage:null});
const scouts=window.WilderScoutRules.create({game,storage:null});
const clone=x=>JSON.parse(JSON.stringify(x));
const match="3b4c8f910c03d2e92d0ced0b",visitor="9b097cc6944894c0e48003ba";
const sources={
  legacy:"#bellpost-v1=c7f3e4a7edc7326261e78c1f.cindlet,sprigkit,dewfin.e29a2db9d5aa54a7505ee8b7.dewfin,cindlet,sprigkit.GBBBBBBBBANINJABBBBBBBNBMBBBBBBBB.x",
  // A played Scout Table final. Keeping its sealed public letter here exercises the real four and its unchosen fourth.
  scout:"#scout-bout1="+match+".e82fb3acf96ef00de47af39880b04b712fa1a14e413a7e74e3c644e906bd5772."+visitor+
    ".cindlet,dewfin,gustlance~mender-wrap,kilnbeak~prism-lens.cindlet,dewfin~last-stitch,mossbell,sprigkit~opening-pennant"+
    ".5dc1bc0b3868c338a742f7f7f0d0b901.7b0296555e9984484453c96b0fd2e36406d5f7b2369426b5803713c6d2485970"+
    ".320.0f7096cfaa1417a7b74697610f66db72.321.328230b1c8c34257f4a37e18f4a9dc14!BCKABCBJNANBBBBBBBBMAJAAAMAAAAA!x"
};
const quick=(v,tape="",left="dewfin,charquill,sprigkit",right="kilnbeak,cindlet,mossbell",flag="")=>
  "#bellpost-v"+v+"="+[match,left,visitor,right,tape,flag].join(".");
function storage(map=new Map()){
  return {map,getItem:key=>map.get(key)??null,setItem:(key,v)=>map.set(key,v),removeItem:key=>map.delete(key),
    key:i=>[...map.keys()][i]??null,get length(){return map.size;}};
}
const desk=(s=storage())=>window.WilderFilmPractice.create({game,storage:s});
function record(res){
  assert.equal(res.ok,true,res.message);
  assert.ok(res.record);
  return res.record;
}
function refused(res){
  assert.equal(res.ok,false,res.message);
  assert.ok(res.message);
}
async function released(){
  const [charter,tape,flag]=sources.scout.replace("#scout-bout1=","").split("!");
  const table=await scouts.inspect("#scout-v1="+charter);
  assert.equal(table.stage,4);
  const hash=spectator.scoutedHash(table.battle,tape,flag==="x"?"":flag);
  return {hash,table,film:spectator.review(hash)};
}
function checkReplies(branch){
  let pos=branch.origin;
  assert.deepEqual(clone(branch.events.map(e=>e.move.id)),clone(branch.moves));
  for(const e of branch.events){
    assert.deepEqual(clone(e.before),clone(pos));
    if(pos.turn!==branch.seat)assert.equal(e.move.id,sim.recommend(pos).id,"coach followed the actual protocol");
    pos=sim.apply(pos,e.move.id);
    assert.deepEqual(clone(e.after),clone(pos));
  }
  assert.deepEqual(clone(pos),clone(branch.pos));
  assert.ok(branch.pos.phase==="done"||branch.pos.turn===branch.seat);
}

test("all decisions of the published Scout film start at their exact before-state, including all free replacements",async()=>{
  const {hash,film}=await released(),career=JSON.stringify(game.state),original=JSON.stringify(film);
  assert.equal(film.events.length,31);
  assert.equal(film.events.filter(e=>e.move.kind==="replace").length,4);
  assert.equal(film.events.at(-1).after.ply,27);
  assert.equal(film.record.winner,0);
  for(const [pivot,e] of film.events.entries()){
    const practice=desk();
    const b=record(await practice.start({sourceHash:hash,seat:e.before.turn,pivot}));
    assert.deepEqual(clone(b.origin),clone(e.before),"before decision "+(pivot+1));
    assert.deepEqual(clone(b.pos),clone(e.before),"controlled the recorded seat");
    assert.equal(b.source.moves.length,31);
    assert.equal(b.moves.length,0);
    if(e.move.kind==="replace"){
      const after=record(practice.play(e.move.id,b.revision));
      assert.equal(after.pos.ply,b.pos.ply);
      assert.equal(after.pos.turn,b.seat);
      assert.equal(after.events.length,1);
      checkReplies(after);
    }
  }
  assert.equal(JSON.stringify(spectator.review(hash)),original);
  assert.equal(JSON.stringify(game.state),career);
  assert.equal(spectator.get(match),null);assert.equal(scouts.get(match),null);
});

test("historical techniques, spent gear, reserve health and beats are carried through restore for either seat",async()=>{
  const old=desk(),newer=desk(),legacy=quick(1,"B"),recent=quick(2,"B2GAX");
  const a=record(await old.start({sourceHash:legacy,pivot:1,seat:1}));
  assert.equal(a.pos.protocol,1);
  assert.equal(sim.forecast(a.pos,"vent:backdraft"),null);
  refused(old.play("vent:backdraft",a.revision));
  assert.equal(old.get().revision,a.revision);

  const tape=spectator.review(recent);assert.equal(tape.events.at(-1).move.id,"warmth:dewfin");
  const b=record(await newer.start({sourceHash:recent,pivot:5,seat:1}));
  assert.deepEqual(clone(b.pos),clone(tape.final));
  assert.equal(b.pos.sides[0].team[1].emberArtSpent,true);
  assert.equal(b.pos.sides[1].team[0].emberArtSpent,true);
  assert.equal(sim.forecast(b.pos,"vent:backdraft").available,false);

  const {hash,film}=await released(),pivot=9;
  for(const seat of [0,1]){
    const disk=storage(),p=desk(disk),r=record(await p.start({sourceHash:hash,publicHash:sources.scout,seat,pivot}));
    const first=film.events[pivot].before;
    assert.deepEqual(clone(r.origin),clone(first));
    assert.equal(first.sides[0].team.find(k=>k.id==="sprigkit").spent,true);
    assert.ok(first.sides.some(s=>s.team.some(k=>k.hp<k.maxHp)));
    assert.equal(r.moves.length>0,first.turn!==seat);
    checkReplies(r);
    const saved=new Map(disk.map),reloaded=record(await desk(disk).resume());
    assert.deepEqual(clone(reloaded.origin),clone(r.origin));assert.deepEqual(clone(reloaded.pos),clone(r.pos));
    assert.deepEqual(clone(reloaded.moves),clone(r.moves));assert.equal(reloaded.revision,r.revision);
    assert.deepEqual(disk.map,saved,"restoring is read-only");
  }
});

test("a different final action changes a real 60-action draw while a private retry reopens that same decision",async()=>{
  const trio="cindlet,sprigkit,dewfin",hash=quick(2,"GGFF".repeat(15),trio,trio);
  const real=spectator.review(hash);
  assert.equal(real.record.winner,"draw");assert.equal(real.final.ply,60);
  const p=desk(),start=record(await p.start({sourceHash:hash,pivot:59,seat:1}));
  assert.equal(start.origin.ply,59);
  const attack=sim.options(start.pos).find(m=>m.available&&m.kind==="attack");
  const altered=record(p.play(attack.id,start.revision));
  assert.equal(altered.pos.ply,60);assert.equal(altered.pos.phase,"done");
  assert.equal(altered.pos.winner,1);assert.equal(altered.source.winner,"draw");
  checkReplies(altered);
  refused(p.play(attack.id,altered.revision));
  const again=record(p.retry(altered.revision));
  assert.deepEqual(clone(again.pos),clone(start.pos));assert.equal(again.moves.length,0);
  const repeated=record(p.play(real.events[59].move.id,again.revision));
  assert.equal(repeated.pos.winner,"draw");
  assert.deepEqual(clone(repeated.pos),clone(real.final));
});

test("either side can play to a conclusion against the same coach, including counterfactuals from a concession",async()=>{
  const storageA=storage(),practice=desk(storageA),legacy=spectator.review(sources.legacy);
  const original=JSON.stringify(legacy),career=JSON.stringify(game.state);
  for(const seat of [1,0]){
    let r=record(await practice.start({sourceHash:sources.legacy,seat,pivot:0,replace:true,expectedRevision:practice.get()?.revision}));
    for(let turns=0;r.pos.phase!=="done";turns++){
      assert.ok(turns<65);
      const best=sim.recommend(r.pos);assert.equal(r.pos.turn,seat);
      r=record(practice.play(best.id,r.revision));
    }
    checkReplies(r);
    assert.ok(r.pos.ply<=60);assert.ok(r.status==="done");
    assert.equal(r.events.length,r.moves.length);
    assert.ok(r.events.some(e=>e.before.turn===1-seat));
    assert.deepEqual(clone(record(await desk(storageA).resume()).pos),clone(r.pos));
  }
  const conceded=quick(2,"B",undefined,undefined,"1");
  const lost=record(await desk().start({sourceHash:conceded,pivot:1,seat:1}));
  assert.equal(lost.source.winner,0);assert.equal(lost.source.resigned,1);
  assert.equal(lost.pos.winner,null);assert.equal(lost.pos.turn,1);
  assert.equal(JSON.stringify(spectator.review(sources.legacy)),original);
  assert.equal(JSON.stringify(game.state),career);
});

test("an opening redraft keeps the opponent, opening seat and registered fittings, verifying the charter before allowing the fourth",async()=>{
  const {hash,table}=await released(),host=table.battle.teams[0];
  const reordered={ids:["dewfin","sprigkit","mossbell"],gear:{dewfin:"last-stitch",sprigkit:"opening-pennant"}};
  const withFourth={ids:["cindlet","sprigkit","dewfin"],gear:{sprigkit:"opening-pennant",dewfin:"last-stitch"}};
  const options={sourceHash:hash,publicHash:sources.scout,seat:0,pivot:0,loadout:withFourth};
  const store=storage(),p=desk(store),practice=record(await p.start(options));
  assert.deepEqual(clone(practice.teams[0]),withFourth);assert.deepEqual(clone(practice.teams[1]),clone(table.battle.teams[1]));
  assert.equal(practice.origin.first,table.battle.first);
  assert.equal(practice.origin.sides[0].team[0].id,"cindlet");assert.equal(practice.origin.sides[0].beats,0);
  assert.equal(practice.source.teams[0].ids[0],host.ids[0]);
  assert.deepEqual(clone(record(await desk(store).resume()).pos),clone(practice.pos));

  const rawGuestFirst=spectator.scoutedHash({...table.battle,first:1});
  const fallback=record(await desk().start({sourceHash:rawGuestFirst,seat:0,pivot:0,loadout:reordered}));
  assert.equal(fallback.origin.first,1);assert.equal(fallback.pos.turn,0);checkReplies(fallback);
  const openingPublic=sources.scout.replace(/![A-Z2]+!x$/,"!x!x");
  const changedOpponent={...table.battle,teams:[table.battle.teams[0],{...table.battle.teams[1],ids:table.battle.teams[1].ids.slice().reverse()}]};
  refused(await desk().start({...options,sourceHash:spectator.scoutedHash(changedOpponent),publicHash:openingPublic}));
  const q=quick(2,"","sprigkit~5,mossbell,dewfin~1");
  for(const sourceHash of [q,q.replace("v2=","v1="),rawGuestFirst]){
    const fixed=record(await desk().start({sourceHash,seat:0,pivot:0,loadout:reordered}));
    assert.deepEqual(clone(fixed.teams[0]),reordered);
    refused(await desk().start({sourceHash,seat:0,pivot:0,loadout:withFourth}));
  }
  for(const invalid of [
    {...options,loadout:{ids:["gustlance","sprigkit","dewfin"],gear:withFourth.gear}},
    {...options,seat:1}, {...options,pivot:1},
    {...options,loadout:{ids:withFourth.ids,gear:{sprigkit:"relay-bell",dewfin:"last-stitch"}}},
    {...options,loadout:{ids:["cindlet","cindlet","dewfin"],gear:{dewfin:"last-stitch"}}},
    {...options,sourceHash:rawGuestFirst},
    {...options,publicHash:sources.scout.replace(/!B[^!]+!x$/,"!B!x")},
    {...options,publicHash:sources.scout.replace("opening-pennant","mender-wrap")}
  ])refused(await desk().start(invalid));
});

test("bad film input, concurrent writes, explicit replacement and retry preserve a single recoverable rehearsal",async()=>{
  const store=storage(),left=desk(store),right=desk(store),career=JSON.stringify(game.state);
  const empty=await left.resume();assert.ok(empty.ok);assert.equal(empty.record,null);assert.equal(store.length,0);
  const sourceHash=quick(2,"B"),settings={sourceHash,pivot:1,seat:1};
  for(const change of [{sourceHash:sourceHash.replace(".B.",".BZ.")},{sourceHash:"#scout-bout1=bad"},{sourceHash:"#bellpost-v2="+match+".dewfin,sprigkit,cindlet"},
    {sourceHash:"a".repeat(9000)},{pivot:2},{pivot:-1},{pivot:0.5},{seat:2},{seat:"0"}]){
    refused(await left.start({...settings,...change}));assert.equal(left.get(),null);
  }
  assert.equal(store.length,0);
  const a=record(await left.start(settings)),b=record(await right.resume());
  assert.equal(a.revision,b.revision);
  const stale=sim.recommend(a.pos).id;
  const advanced=record(left.play(stale,a.revision));
  refused(right.play(stale,b.revision));refused(right.retry(b.revision));
  refused(await right.start({...settings,seat:0,replace:true,expectedRevision:b.revision}));
  const fresh=record(await right.resume());assert.equal(fresh.revision,advanced.revision);
  refused(await right.start({...settings,seat:0}));
  const changed=record(await right.start({...settings,seat:0,replace:true,expectedRevision:fresh.revision}));
  assert.equal(changed.seat,0);assert.equal(changed.pivot,1);
  assert.equal(JSON.stringify(game.state),career);assert.deepEqual(clone(spectator.list()),[]);

  // A partially written blob must not materialize a team or put a seat into Bellpost.
  assert.equal(store.map.size,1);
  const [key,safe]=store.map.entries().next().value;
  assert.ok(safe.length<16000,"one bounded practice slot");
  store.setItem(key,safe.slice(0,-3));
  const corrupt=store.getItem(key),reopen=desk(store),restored=await reopen.resume();
  assert.equal(restored.record??null,null);assert.equal(store.getItem(key),corrupt);
  refused(await reopen.start({...settings,pivot:-1}));assert.equal(store.getItem(key),corrupt);
  refused(await reopen.start({...settings,replace:true,expectedRevision:changed.revision}));
  assert.equal(store.getItem(key),corrupt);
  const recovered=record(await reopen.start(settings));
  assert.equal(store.length,1);assert.equal(recovered.seat,settings.seat);
  assert.deepEqual(clone(record(await desk(store).resume()).pos),clone(recovered.pos));
  assert.equal(spectator.get(match),null);
});

test("resolving public letters is seatless, recognizes the same film in both formats and preserves the film return index",async()=>{
  const {hash,film,table}=await released(),store=storage(),p=desk(store);
  for(const variant of [sources.scout,sources.scout+"”",sources.scout+"%E2%80%9D"]){
    const found=await p.resolve(variant);
    assert.deepEqual(clone(found.source),clone(film.record));
    assert.deepEqual(clone(found.rosters),clone(table.rosters));
    assert.equal(found.publicHash,sources.scout);assert.equal(found.source.seat,null);assert.equal(found.table.seat,null);
  }
  const raw=spectator.forSharing(hash);
  for(const variant of [hash,raw,raw+"!"]){
    const found=await p.resolve(variant);
    assert.deepEqual(clone(found.source),clone(film.record));assert.equal(found.source.seat,null);
    assert.deepEqual(clone(found.rosters),clone(table.battle.teams));assert.equal(found.table,null);
  }
  for(const bad of [null,"#scout-table","#scout-v1=unsealed",sources.scout.replace("~mender-wrap","~relay-bell"),"a".repeat(1250),sources.scout.replace(/![A-Z2]+!x$/,"!222!x")])
    assert.equal(await p.resolve(bad),null);
  assert.equal(store.map.size,0);assert.equal(p.get(),null);
  const original=sources.scout,b=record(await p.start({sourceHash:hash,publicHash:original,pivot:2,returnIndex:14,seat:0}));
  assert.equal(b.returnIndex,14);assert.equal(record(await desk(store).resume()).returnIndex,14);
  for(const i of [-1,film.events.length,4.3])
    refused(await desk().start({sourceHash:hash,seat:0,pivot:2,returnIndex:i}));
  assert.equal(b.publicHash,original);assert.equal(spectator.get(match),null);assert.equal(scouts.get(match),null);
});

test("stored choices replay legally after refresh and a coach reply cannot be substituted or truncated",async()=>{
  const st=storage(),p=desk(st),settings={sourceHash:quick(2),pivot:0,seat:0};
  const a=record(await p.start(settings)),b=record(p.play("skill:slick-slide",a.revision));
  assert.ok(b.events.length>=2);
  const step=b.events[1],alt=sim.options(step.before).find(m=>m.available&&m.id!==step.move.id);
  assert.equal(step.before.turn,1);assert.ok(alt);
  const [key,raw]=st.map.entries().next().value,original=JSON.parse(raw);
  for(const moves of [[b.moves[0]], [b.moves[0],alt.id],["skill:no-such-attack"],Array(65).fill("skill:slick-slide")]){
    const m=storage(new Map([[key,JSON.stringify({...original,moves})]])),target=desk(m);
    const bad=await target.resume();
    assert.equal(bad.ok,false);assert.equal(target.get(),null);
  }
  const first=record(await p.start(settings));
  assert.equal(first.revision,b.revision);assert.deepEqual(clone(first.pos),clone(b.pos));
  b.pos.sides[1].team[0].hp=0;b.moves.length=0;
  assert.deepEqual(clone(p.get().pos),clone(first.pos));
  assert.deepEqual(clone(p.get().moves),clone(first.moves));
});

test("unavailable storage supports a whole practice in this tab and simultaneous starts cannot silently replace one another",async()=>{
  const blocked={getItem(){throw Error("blocked");},setItem(){throw Error("blocked");}};
  const unavailable=desk(blocked),q=quick(2);
  assert.equal((await unavailable.resume()).record,null);
  const a=record(await unavailable.start({sourceHash:q,pivot:0,seat:0}));
  assert.equal(unavailable.persistent,false);
  const revised=record(unavailable.play(sim.recommend(a.pos).id,a.revision));
  assert.deepEqual(clone(record(await unavailable.resume()).moves),clone(revised.moves));
  assert.equal((await desk(blocked).resume()).record,null);

  const shared=storage(),left=desk(shared),right=desk(shared);
  const attempts=await Promise.all([left.start({sourceHash:q,pivot:0,seat:0}),right.start({sourceHash:q,pivot:0,seat:1})]);
  assert.equal(attempts.filter(r=>r.ok).length,1);
  const winner=record(await desk(shared).resume());
  assert.equal(winner.seat,attempts.find(r=>r.ok).record.seat);
  assert.equal(winner.revision,attempts.find(r=>r.ok).record.revision);
});
