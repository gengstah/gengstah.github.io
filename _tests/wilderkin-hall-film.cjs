const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const {webcrypto}=require("node:crypto");
const scripts=["atlas","bestiary","activities","story","campaign","duets","sparring-gear","sparring-signatures",
  "sparring-battle","sparring-teams","scout-practice","engine","bellpost-rules","scout-rules","rental-cards","film-practice"].map(name=>{
  const filename=path.join(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(fs.readFileSync(filename,"utf8"),{filename});
});
const plain=v=>JSON.parse(JSON.stringify(v));
function device(map=new Map(),die=2){
  const localStorage={getItem:key=>map.get(key)??null,setItem:(key,v)=>map.set(key,v),removeItem:key=>map.delete(key),
    key:i=>[...map.keys()][i]??null,get length(){return map.size;}};
  const window={localStorage,crypto:{subtle:webcrypto.subtle,getRandomValues(a){
    if(a.length===1){a[0]=die-1;return a;}return webcrypto.getRandomValues(a);
  }}};
  const ctx=vm.createContext({window});for(const s of scripts)s.runInContext(ctx);
  const g=window.WilderGame,sim=window.WilderSparringBattle.create({game:g}),p=window.WilderFilmPractice.create({game:g});
  return {w:window,g,sim,p,map,bell:window.WilderBellpostRules.create({game:g})};
}
const starter=["sprigkit","cindlet","dewfin"];
function play(h,setup,chooser){
  let pos=h.sim.start(setup.left,setup.right,setup.first,setup.gear);
  const moves=[],positions=[];
  while(pos.phase!=="done"){
    assert.ok(moves.length<64);
    positions.push(pos);
    const m=chooser?chooser(h.sim.options(pos).filter(x=>x.available),pos):h.sim.recommend(pos);
    assert.ok(m?.available);moves.push(m.id);pos=h.sim.apply(pos,m.id);
  }
  return {tape:{...setup,human:0,moves},positions,final:pos};
}
function named(h,id){
  let setup;
  const table=h.w.WilderScoutPractice.create({game:h.g,sim:h.sim,row:(key,label,value)=>({id:key,label,value}),image:k=>k,
    live:()=>false,show(){},readSetup:()=>({left:starter}),
    playFromPractice:(raw,moves,offset,first,scout)=>{setup={left:raw.left,right:raw.right,gear:raw.gear,first,scout};return true;}
  });
  if(typeof id==="string")table.act("scout-pr-coach",id);
  else assert.equal(table.challengeRental(id),true);
  table.act("scout-pr-register");
  for(const pick of ["cindlet","sprigkit","dewfin"])table.act("scout-pr-pick",pick);
  table.act("scout-pr-lock");table.act("scout-pr-play");
  assert.ok(setup);
  return play(h,setup);
}
const get=r=>{assert.equal(r.ok,true,r.message);return r.record;};
const indexOfGear=g=>["relay-bell","last-stitch","seam-hook","mender-wrap","prism-lens","opening-pennant"].indexOf(g);
const pack=(ids,gear)=>ids.map(k=>k+(gear[k]?"~"+indexOfGear(gear[k]):"")).join(",");

test("a rental challenge film travels with both registered fours and supports playing its benched kin on a fresh device",async()=>{
  for(const die of [1,6]){
    const h=device(new Map(),die),guest=device();
    const rentals=h.w.WilderRentalCards.create({game:h.g,storage:null});
    const original=rentals.featured()[0].card;
    const rival={...original,name:die===1?"Café. 風 & Rain":"🌿".repeat(36),gear:die===1?original.gear:{}};
    const {tape,final}=named(h,rival),hash=h.p.hallFilm(tape),book=await guest.p.resolve(hash);
    assert.ok(hash);assert.equal(tape.scout.rental,rentals.encode(rival));
    assert.equal(book.source.labels[1],rival.name);assert.deepEqual(plain(book.source.pos),plain(final));
    assert.deepEqual(plain(book.rosters[1]),plain({ids:rival.ids,gear:rival.gear}));
    assert.deepEqual(plain(book.rosters[0]),plain({ids:tape.scout.ids,gear:tape.scout.gear}));
    assert.equal(guest.map.size,0);
    const unused=rival.ids.find(id=>!tape.right.includes(id)),ids=[unused,...tape.right.slice(0,2)];
    const gear=Object.fromEntries(ids.filter(id=>rival.gear[id]).map(id=>[id,rival.gear[id]]));
    const run=get(await guest.p.start({sourceHash:hash,pivot:0,returnIndex:1,seat:1,loadout:{ids,gear}}));
    assert.deepEqual(plain(run.teams[1]),plain({ids,gear}));assert.equal(run.origin.first,die%2);
    const resumed=get(await device(guest.map).p.resume());
    assert.deepEqual(plain(run.pos),plain(resumed.pos));
    assert.equal(guest.p.review(hash.replace(".rental.",".pike.")),null);
    assert.equal(guest.p.review(hash+".extra"),null);
    const wrong=rentals.encode({...rival,ids:["sprigkit","cindlet","dewfin","gustlance"],gear:{}});
    assert.equal(h.p.hallFilm({...tape,scout:{...tape.scout,rental:wrong}}),null);
  }
});

test("an ordinary Hall film carries 60 paid actions and four free replacements to an independent reader",async()=>{
  const h=device(),reader=device(),other=device(),career=plain(reader.g.state);
  const {tape,positions,final}=play(h,{left:starter,right:starter,first:1},(moves,pos)=>
    pos.phase==="replace"?moves[0]:moves.find(m=>m.kind===(pos.ply<32?"swap":"attack")));
  assert.equal(tape.moves.length,64);assert.equal(final.ply,60);assert.equal(final.winner,"draw");
  const hash=h.p.hallFilm(tape);assert.match(hash,/^#hall-film1=sprigkit,cindlet,dewfin\.sprigkit,cindlet,dewfin\.1\.[A-Z2]{64}\.hall$/);
  const original=reader.p.review(hash);assert.deepEqual(plain(original.final),plain(final));
  const resolved=await reader.p.resolve(hash+"”");
  assert.equal(resolved.publicHash,hash);assert.equal(resolved.source.kind,"hall");assert.equal(resolved.source.seat,null);
  assert.deepEqual(plain(resolved.source.labels),["Challenger","Hall coach"]);
  assert.deepEqual(plain(resolved.source.moves),plain(tape.moves));
  assert.deepEqual(plain(original.events.map(e=>e.before)),plain(positions));
  assert.deepEqual(plain(reader.g.state),career);assert.equal(reader.bell.list().length,0);assert.equal(reader.map.size,0);
  assert.equal(other.p.review(hash).events.length,64);
  assert.equal(reader.p.hallFilm({...tape,moves:tape.moves.slice(0,-1)}),null);
  assert.equal(reader.p.hallFilm({...tape,moves:[...tape.moves,"swap:dewfin"]}),null);
  const atEnd=await reader.p.start({sourceHash:hash,seat:1,pivot:64});
  assert.equal(atEnd.ok,false);assert.equal(reader.p.get(),null);
  for(const seat of [0,1]){
    const fresh=device(),pivot=positions.findIndex(p=>p.phase==="replace"&&p.turn===seat);assert.notEqual(pivot,-1);
    const fork=get(await fresh.p.start({sourceHash:hash,seat,pivot,returnIndex:11}));
    assert.deepEqual(plain(fork.origin),plain(positions[pivot]));assert.equal(fork.pos.phase,"replace");
    const after=get(fresh.p.play(tape.moves[pivot],fork.revision));
    assert.equal(after.pos.ply,fork.pos.ply);assert.equal(after.pos.turn,seat);
    const resume=get(await device(fresh.map).p.resume());assert.equal(resume.returnIndex,11);assert.equal(resume.publicHash,hash);
    assert.deepEqual(plain(resume.pos),plain(after.pos));assert.equal(fresh.bell.list().length,0);
  }
});

test("Nell Weir and Kit Pike films verify the real hidden trio, registered fourth and equipment, and opening draw",async()=>{
  for(const [id,name,die] of [["weir","Nell Weir",3],["pike","Kit Pike",6]]){
    const h=device(new Map(),die),{tape,positions,final}=named(h,id),hash=h.p.hallFilm(tape),recipient=device();
    assert.ok(hash);const fields=hash.slice("#hall-film1=".length).split(".");
    assert.deepEqual(fields.slice(4),[id,String(die),pack(tape.scout.ids,tape.scout.gear)]);
    assert.equal(fields[0],pack(tape.left,tape.gear.left));assert.equal(fields[1],pack(tape.right,tape.gear.right));
    assert.equal(fields[2],String(die%2));assert.equal(fields[3].length,tape.moves.length);
    const real=await recipient.p.resolve(hash);
    assert.deepEqual(plain(real.source.labels),["Challenger",name]);assert.deepEqual(plain(real.source.scout),plain(tape.scout));
    assert.deepEqual(plain(real.source.pos),plain(final));assert.deepEqual(plain(recipient.p.review(hash).events.map(e=>e.before)),plain(positions));
    assert.equal(real.rosters[1].ids.length,4);assert.ok(tape.right.every(k=>real.rosters[1].ids.includes(k)));
    assert.deepEqual(plain(real.rosters[0].ids),plain(tape.scout.ids));assert.equal(real.rosters[0].gear.gustlance,"opening-pennant");
    assert.equal(recipient.map.size,0);assert.equal(h.bell.list().length,0);
    for(const seat of [0,1]){
      const table=real.rosters[seat],original=seat?tape.right:tape.left,sits=table.ids.find(k=>!original.includes(k));
      const ids=[sits,...original.slice(0,2)],gear=Object.fromEntries(ids.filter(k=>table.gear[k]).map(k=>[k,table.gear[k]]));
      const m=device(),branch=get(await m.p.start({sourceHash:hash,seat,pivot:0,returnIndex:2,loadout:{ids,gear}}));
      assert.deepEqual(plain(branch.teams[seat]),{ids:plain(ids),gear:plain(gear)});
      assert.equal(branch.origin.first,die%2);assert.deepEqual(plain(branch.teams[1-seat]),plain(real.source.teams[1-seat]));
      assert.equal(get(await device(m.map).p.resume()).origin.sides[seat].team[0].gear,table.gear[sits]);
      const illegal=await device().p.start({sourceHash:hash,seat,pivot:0,loadout:{ids,gear:{...gear,[sits]:"seam-hook"}}});
      assert.equal(illegal.ok,false);
    }

    const raw=plain(tape),badCards=[
      {...raw.scout,coach:"not-a-coach"},{...raw.scout,coach:id==="weir"?"pike":"weir"},
      {...raw.scout,die:die%2?6:3},{...raw.scout,die:0},{...raw.scout,picks:[...raw.left].reverse()},
      {...raw.scout,ids:[...raw.left,raw.left[0]]},{...raw.scout,gear:{...raw.scout.gear,cindlet:"prism-lens"}}
    ];
    for(const scout of badCards)assert.equal(h.p.hallFilm({...raw,scout}),null);
    const reversed={...tape,right:[...tape.right].reverse()};
    // Replaying this new ordering to completion isolates a false coach claim from illegal battle moves.
    const alternate=play(h,reversed,(moves,pos)=>pos.phase==="replace"?moves[0]:moves.find(m=>m.kind==="attack")).tape;
    assert.equal(h.p.hallFilm(alternate),null);
    const validAnonymous=h.p.hallFilm({...alternate,scout:undefined});
    assert.ok(validAnonymous);const forged=validAnonymous.split(".").slice(0,4).concat(fields.slice(4)).join(".");
    assert.equal(recipient.p.review(forged),null);assert.equal(await recipient.p.resolve(forged),null);
    const badWire=[...fields];badWire[5]=String(die%2?6:3);
    assert.equal(await recipient.p.resolve("#hall-film1="+badWire.join(".")),null);
  }
});

test("ordinary named rivals require their published team in exact order and old anonymous tapes remain readable",async()=>{
  const h=device(),setup={left:starter,right:["mossbell","coalmoth","glimmeray"],first:0};
  const fought=play(h,setup),hash=h.p.hallFilm({...fought.tape,rival:"bell-keepers"});
  assert.ok(hash);assert.ok(hash.endsWith(".crew-bell-keepers"));
  const src=(await device().p.resolve(hash)).source;assert.deepEqual(plain(src.labels),["Challenger","The Bell Keepers"]);
  assert.equal(src.scout,undefined);assert.deepEqual(plain(src.pos),plain(fought.final));
  const older=h.p.hallFilm(fought.tape);assert.equal(older,hash.replace("crew-bell-keepers","hall"));
  assert.deepEqual(plain(device().p.review(older).record.labels),["Challenger","Hall coach"]);
  const custom=play(h,{...setup,right:[...setup.right].reverse()}).tape;
  assert.equal(h.p.hallFilm({...custom,rival:"bell-keepers"}),null);
  assert.equal(h.p.hallFilm({...fought.tape,rival:"fabricated"}),null);
  const relabeled=h.p.hallFilm(custom).replace(/\.hall$/,".crew-bell-keepers");
  for(const bad of [relabeled,hash.replace("bell-keepers","still-choir"),hash.replace("bell-keepers","no-such-crew")]){
    assert.equal(h.p.review(bad),null);assert.equal(await h.p.resolve(bad),null);
  }
});

test("incomplete, impossible, oversize and mislabelled Hall tapes cannot produce a film, seat, or saved practice",async()=>{
  const h=device(),setup={left:starter,right:["mossbell","kilnbeak","gustlance"],first:0,gear:{left:{sprigkit:"opening-pennant"}}};
  const {tape,final}=play(h,setup,(moves,pos)=>pos.phase==="replace"?moves[0]:moves.find(m=>m.kind==="attack"));
  assert.ok(final.ply<60);const hash=h.p.hallFilm(tape);assert.ok(hash);
  const fields=hash.split("."),tail=fields[3];
  for(const change of [
    {human:1},{human:"0"},{mode:"local"},{first:2},{left:["sprigkit","sprigkit","dewfin"]},
    {left:["stillwake","cindlet","dewfin"]},{right:["mossbell","kilnbeak","unknown"]},
    {gear:{left:{sprigkit:"no-such-item"}}},{gear:{left:{sprigkit:"prism-lens",cindlet:"prism-lens"}}},
    {moves:[]},{moves:tape.moves.slice(0,-1)},{moves:[...tape.moves,"skill:leaf-flurry"]},
    {moves:["replace:dewfin",...tape.moves.slice(1)]},{moves:Array(65).fill("swap:dewfin")}
  ])assert.equal(h.p.hallFilm({...tape,...change}),null);
  for(const bad of [
    hash.replace("v1=","v4=").replace("film1=","film4="),hash.replace("sprigkit~5","sprigkit~9"),hash.replace("sprigkit~5","sprigkit%7E5"),
    hash.replace("sprigkit~5","__proto__"),hash.replace(tail+".hall",tail.slice(0,-1)+".hall"),
    hash.replace(tail+".hall",tail+"A.hall"),hash.replace(tail+".hall","Z"+tail.slice(1)+".hall"),
    hash.replace(tail+".hall","A".repeat(65)+".hall"),hash.replace(".0.",".-1."),hash+".weir.3",
    hash.replace(".hall",".weir"),hash.replace(".hall",".crew-unknown"),hash.repeat(20)
  ]){
    assert.equal(h.p.review(bad),null,bad);assert.equal(await h.p.resolve(bad),null,bad);
    assert.equal((await h.p.start({sourceHash:bad,pivot:0,seat:1})).ok,false);
  }
  assert.equal(h.p.get(),null);assert.equal(h.bell.list().length,0);assert.equal(h.map.size,0);
});
