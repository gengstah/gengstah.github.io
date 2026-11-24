const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const scripts=["atlas","bestiary","activities","campaign","story","duets","sparring-gear","sparring-signatures","sparring-battle",
  "sparring-teams","scout-practice","engine","bellpost-rules","scout-rules","film-practice","partner-search","duet-exercise"].map(name=>{
  const filename=path.join(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(fs.readFileSync(filename,"utf8"),{filename});
});
const plain=x=>JSON.parse(JSON.stringify(x));
function lab(){
  const writes=[],w={localStorage:{getItem:()=>null,setItem:(k,v)=>writes.push([k,v]),removeItem:k=>writes.push([k])}};
  const ctx=vm.createContext({window:w});scripts.forEach(s=>s.runInContext(ctx));
  const game=w.WilderGame,sim=w.WilderSparringBattle.create({game});
  return {game,w,sim,writes,exercise:w.WilderDuetExercise.create({game,sim}),finder:w.WilderPartnerSearch.create({game,sim}),
    films:w.WilderFilmPractice.create({game,storage:null})};
}
const roles=["ward","mend","relay","lure","mark","rush"];
const active=side=>side.team[side.active];
const fighter=(side,id)=>side.team.find(k=>k.id===id);
const caps=(k,n)=>Math.min(k.maxHp-k.hp,Math.ceil(k.maxHp*n));
function seedFor(h,role){
  const options={anchor:"dewfin",foe:"mossbell",role,team:["dewfin","cindlet","sprigkit"],rivals:["mossbell","pincoil","coalmoth"]};
  const row=h.finder.search(options).find(r=>!options.team.includes(r.id)&&!options.rivals.includes(r.id));
  assert.ok(row);return h.finder.exercise(options,row.id);
}
function checkTrace(h,pos,events){
  for(const e of events){
    assert.deepEqual(plain(e.before),plain(pos));
    const available=h.sim.forecast(pos,e.move.id);
    const {why,...forecast}=e.move;
    assert.ok(available?.available,e.move.id);assert.deepEqual(plain(forecast),plain(available));
    pos=h.sim.apply(pos,e.move.id);
    assert.deepEqual(plain(e.after),plain(pos));
  }
  return pos;
}
function strongest(h,pos){
  return h.sim.options(pos).filter(m=>m.kind==="attack"&&m.available).reduce((a,b)=>b.damage>a.damage?b:a);
}

test("every duet lesson earns its beats through a playable opening, then demonstrates the real role against an ordinary strike",()=>{
  const h=lab(),original=JSON.stringify(h.game.state);
  for(const role of roles){
    const seed=seedFor(h,role),frozen=JSON.stringify(seed),l=h.exercise.prepare(seed);
    assert.ok(l,role);assert.equal(l.role,role);assert.equal(l.cost,seed.cost);assert.equal(l.partner,seed.partner);
    assert.equal(l.anchor,seed.anchor);assert.equal(l.foe,seed.foe);assert.equal(l.duet,h.w.WilderDuets.score(h.game.species[l.anchor].type,h.game.species[l.partner].type).name);
    assert.deepEqual(plain(l.setup),plain(seed.setup));
    const fresh=h.sim.start(seed.setup.left,seed.setup.right,seed.first,seed.setup.gear);
    assert.deepEqual(plain(l.opening),plain(fresh));
    assert.equal(l.opening.sides[0].beats,0);assert.ok(l.opening.sides.every(s=>s.team.every(k=>k.hp===k.maxHp)));
    assert.deepEqual(plain(checkTrace(h,fresh,l.warmup)),plain(l.ready));
    assert.equal(active(l.ready.sides[0]).id,l.anchor);assert.equal(active(l.ready.sides[1]).id,l.foe);
    assert.equal(l.ready.turn,0);assert.equal(l.ready.phase,"move");
    assert.equal(l.duetMove.id,"duet:"+seed.partner);assert.equal(l.duetMove.available,true);
    assert.equal(l.strikeMove.kind,"attack");assert.equal(l.strikeMove.damage,strongest(h,l.ready).damage);
    assert.ok(l.ready.sides[0].beats>=l.cost);assert.equal(l.ready.sides[1].braced,true);
    const sameReady=JSON.stringify(l.ready),a=h.exercise.tryMove(l,"duet"),b=h.exercise.tryMove(l,"strike");
    for(const [attempt,kind,id] of [[a,"duet",l.duetMove.id],[b,"strike",l.strikeMove.id]]){
      assert.equal(attempt.kind,kind);assert.equal(attempt.events[0].move.id,id);
      const latest=checkTrace(h,l.ready,attempt.events);assert.deepEqual(plain(latest),plain(attempt.pos));
      const responses=attempt.events.slice(1);
      if(attempt.events[0].after.phase!=="done"){
        assert.ok(responses.length>=1);
        const contact=responses.at(-1);assert.equal(contact.move.kind,"attack");
        assert.equal(contact.move.damage,strongest(h,contact.before).damage);
        assert.ok(responses.slice(0,-1).every(e=>e.move.kind==="replace"&&e.before.turn===1));
        assert.ok(latest.turn===0||latest.phase==="done");
      }
    }
    assert.equal(JSON.stringify(l.ready),sameReady);assert.equal(JSON.stringify(seed),frozen);
    assert.deepEqual(plain(h.exercise.tryMove(l,"duet")),plain(a),"retry starts from the same prepared situation");
    const {move,before,after}=a.events[0],us=before.sides[0],them=before.sides[1];
    assert.equal(move.role,role);assert.equal(after.sides[0].beats,us.beats-l.cost);
    assert.equal(active(them).hp-active(after.sides[1]).hp,move.damage);
    if(role==="ward"){assert.equal(after.sides[0].cover,.25);assert.equal(active(after.sides[0]).id,l.anchor);}
    if(role==="mend"){
      const target=fighter(us,l.partner);assert.ok(move.healLead>0||move.healPartner>0);
      assert.equal(move.healLead,caps(active(us),.25));assert.equal(move.healPartner,caps(target,.25));
      assert.equal(fighter(after.sides[0],l.partner).hp,target.hp+move.healPartner);
    }
    if(role==="relay"){assert.equal(active(after.sides[0]).id,l.partner);assert.equal(after.sides[0].cover,.5);}
    if(role==="lure"){
      assert.ok(active(after.sides[1]).hp>=1);assert.equal(after.sides[1].pinned,true);
      assert.ok(h.sim.options(after).filter(m=>m.kind==="swap").every(m=>!m.available));
    }
    if(role==="mark")assert.equal(active(after.sides[1]).exposed,true);
    if(role==="rush"){
      const last=l.warmup.at(-1);
      const attack=h.sim.options(last.before).find(m=>m.kind==="attack"&&m.available);
      const unbraced=h.sim.apply(last.before,attack.id);assert.equal(unbraced.sides[1].braced,false);
      assert.equal(h.sim.forecast(unbraced,move.id).damage,move.damage,"rush pierces the guarded opponent");
    }
  }
  assert.equal(JSON.stringify(h.game.state),original);assert.deepEqual(h.writes,[]);
});

test("Film Room opens the same verified position after each comparison, retaining all registered species, gear and actual commands",async()=>{
  const h=lab(),career=JSON.stringify(h.game.state);
  const options={anchor:"gustlance",foe:"pincoil",team:["gustlance","sprigkit","cindlet"],rivals:["pincoil","coalmoth","dewfin"],
    gear:{gustlance:"opening-pennant",kilnbeak:"last-stitch",sprigkit:"relay-bell"},foeGear:{pincoil:"prism-lens",coalmoth:"opening-pennant"}};
  const seed=h.finder.exercise(options,"kilnbeak"),l=h.exercise.prepare(seed);
  assert.equal(l.opening.sides[0].beats,1);assert.equal(active(l.opening.sides[0]).spent,true);
  const base=JSON.stringify(l),attempts=[undefined,h.exercise.tryMove(l,"duet"),h.exercise.tryMove(l,"strike")];
  const hashes=[];
  for(const attempt of attempts){
    const result=h.exercise.film(l,attempt),{tape,pivot}=result;
    const actual=[...l.warmup,...(attempt?.events||[])],played=actual.map(e=>e.move.id);
    assert.equal(tape.first,0);assert.equal(tape.human,0);
    assert.deepEqual(plain(tape.left),plain(seed.setup.left));assert.deepEqual(plain(tape.right),plain(seed.setup.right));
    assert.deepEqual(plain(tape.gear),plain(seed.setup.gear));
    assert.deepEqual(plain(tape.moves.slice(0,played.length)),plain(played));
    const pos=attempt?.pos||l.ready;assert.equal(pivot,pos.phase==="done"?played.length-1:played.length);
    const published=h.films.hallFilm(tape);assert.ok(published);hashes.push(published);
    const fresh=lab(),review=fresh.films.review(published);assert.ok(review);assert.equal(review.final.phase,"done");
    const expected=pos.phase==="done"?actual.at(-1).before:pos;
    assert.deepEqual(plain(review.events[pivot].before),plain(expected));
    const fork=await fresh.films.start({sourceHash:published,pivot,seat:expected.turn,returnIndex:pivot});
    assert.ok(fork.ok,fork.message);assert.deepEqual(plain(fork.record.origin),plain(expected));
  }
  assert.notEqual(hashes[1],hashes[2]);
  assert.equal(JSON.stringify(l),base);assert.equal(JSON.stringify(h.game.state),career);assert.deepEqual(h.writes,[]);
});

test("all 500 loaner species can rehearse with a real partner against a dangerous matchup, including scarce HP and unusual equipment",()=>{
  const h=lab(),creatures=Object.values(h.game.species).filter(k=>!k.bonus),gear=h.w.WilderSparringGear.items.map(x=>x.id);
  assert.equal(creatures.length,500);
  const casters=Object.values(Object.fromEntries(creatures.flatMap(k=>k.skills.filter(s=>s.kind==="attack"&&!s.trained).map(s=>[s.type,k]))));
  const species=h.game.species,observedRoles=new Set(),seenFoes=new Set();
  let close=0;
  for(const [i,k] of creatures.entries()){
    const partner=creatures[(i*31+11)%creatures.length].id===k.id?creatures[(i+1)%creatures.length].id:creatures[(i*31+11)%creatures.length].id;
    const threats=casters.filter(x=>x.id!==k.id&&x.id!==partner).map(x=>({id:x.id,damage:Math.max(...x.skills.filter(s=>s.kind==="attack").map(s=>
      (s.power+7.05)*h.w.WilderKinDex.effectiveness(s.type,k.types)))})).sort((a,b)=>b.damage-a.damage);
    const foe=threats[0].id;
    const opts={anchor:k.id,foe,rivals:[foe,"pincoil","mossbell"],gear:{[k.id]:gear[i%gear.length],[partner]:gear[(i+1)%gear.length]},
      foeGear:{[foe]:gear[(i+2)%gear.length]}};
    const seed=h.finder.exercise(opts,partner);assert.ok(seed,k.id);
    const drill=h.exercise.prepare(seed);
    assert.ok(drill,k.id+" + "+partner+" against "+foe);assert.equal(active(drill.ready.sides[0]).id,k.id);
    assert.equal(active(drill.ready.sides[1]).id,foe);assert.equal(drill.duetMove.id,"duet:"+partner);assert.ok(drill.duetMove.available);
    observedRoles.add(drill.role);seenFoes.add(foe);
    if(fighter(drill.ready.sides[0],partner).hp<=fighter(drill.ready.sides[0],partner).maxHp/2)close++;
    const challenger=active(drill.opening.sides[0]);
    assert.equal(challenger.gear,opts.gear[k.id]);assert.equal(active(drill.opening.sides[1]).gear,opts.foeGear[foe]);
    for(const kind of ["duet","strike"]){
      const attempt=h.exercise.tryMove(drill,kind);assert.ok(attempt,k.id+" "+kind);
      assert.ok(attempt.events.length>0);assert.ok(attempt.pos.phase==="done"||attempt.pos.turn===0);
    }
  }
  assert.equal(observedRoles.size,6);assert.ok(seenFoes.size>2);assert.ok(close>0);
  assert.deepEqual(h.writes,[]);
});

test("rivals choose a free replacement before replying; when an injured partner falls after its relay, the next choice stays with the challenger",async()=>{
  const h=lab();
  const make=(anchor,partner,foe)=>h.exercise.prepare(h.finder.exercise({anchor,foe},partner));
  const heavy=make("cindlet","charquill","sprigkit"),cleared=h.exercise.tryMove(heavy,"duet");
  assert.deepEqual(plain(cleared.events.map(e=>e.move.kind)),["duet","replace","attack"]);
  assert.equal(cleared.events[1].before.turn,1);assert.equal(cleared.events[1].before.phase,"replace");
  assert.equal(cleared.events[1].after.ply,cleared.events[1].before.ply);
  assert.equal(cleared.events[2].before.turn,1);
  assert.equal(cleared.events[2].move.damage,strongest(h,cleared.events[2].before).damage);
  assert.deepEqual(plain(checkTrace(h,heavy.ready,cleared.events)),plain(cleared.pos));
  const relay=make("sprigkit","whifflewick","floeribbon"),drop=h.exercise.tryMove(relay,"duet");
  assert.equal(relay.role,"relay");assert.equal(drop.pos.phase,"replace");assert.equal(drop.pos.turn,0);
  assert.equal(active(drop.pos.sides[0]).id,"whifflewick");assert.equal(active(drop.pos.sides[0]).hp,0);
  const {tape,pivot}=h.exercise.film(relay,drop),hash=h.films.hallFilm(tape);
  const replay=await h.films.start({sourceHash:hash,pivot,seat:0});
  assert.ok(replay.ok);assert.deepEqual(plain(replay.record.pos),plain(drop.pos));
  const replacements=h.sim.options(replay.record.pos).filter(m=>m.available);assert.equal(replacements.length,2);
  assert.ok(replacements.every(m=>m.kind==="replace"));
  const branch=h.films.play(replacements[1].id,replay.record.revision);
  assert.ok(branch.ok);assert.equal(branch.record.pos.turn,0);assert.equal(branch.record.pos.ply,drop.pos.ply);
});

test("a branch is regenerated from its published lineup and a different or edited reply cannot enter its film",()=>{
  const h=lab(),seed=seedFor(h,"mend"),l=h.exercise.prepare(seed),original=h.exercise.tryMove(l,"duet");
  const copied=plain(l);copied.ready.sides[0].team[0].hp=1;copied.ready.sides[0].beats=0;
  assert.deepEqual(plain(h.exercise.tryMove(copied,"duet").pos),plain(original.pos));
  const changed=plain(original);changed.pos.sides[0].team[0].hp=0;
  assert.equal(h.exercise.film(l,changed),null);
  assert.equal(h.exercise.film(l,h.exercise.tryMove(h.exercise.prepare(seedFor(h,"rush")),"duet")),null);
  assert.equal(h.exercise.tryMove(l,"unknown"),null);
  for(const value of [{...seed,first:1},{...seed,moves:["skill:leaf-flurry"]},{...seed,partner:seed.anchor},{...seed,cost:seed.cost+1}])
    assert.equal(h.exercise.prepare(value),null);
  assert.deepEqual(h.writes,[]);
});
