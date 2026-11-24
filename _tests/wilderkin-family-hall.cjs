const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
function boot(enabled=true) {
  const ctx=vm.createContext({window:{localStorage:{getItem:()=>null,setItem(){throw Error("Wrote campaign storage");}}}});
  for(const script of ["atlas","bestiary","activities","campaign","story","duets","engine","sparring-gear","sparring-signatures","sparring-battle"]){
    const file=path.join(__dirname,"../games/wilderkin",script+".js");
    vm.runInContext(fs.readFileSync(file,"utf8"),ctx,{filename:file});
  }
  const w=ctx.window;
  if(!enabled)delete w.WilderFamilyTechniques;
  return {sim:w.WilderSparringBattle.create({game:w.WilderGame}),book:w.WilderSparringSignatures,game:w.WilderGame};
}
const {sim,book,game}=boot(),copy=p=>JSON.parse(JSON.stringify(p));
const left=["gustlance","galeskip","mossbell"],right=["cindlet","dewfin","sprigkit"];
const lead=(p,i)=>p.sides[i].team[p.sides[i].active];
const kin=(p,i,id)=>p.sides[i].team.find(k=>k.id===id);
function take(p,id){
  const before=JSON.stringify(p),next=sim.apply(p,id);
  assert.ok(next,"Unavailable move "+id);assert.equal(JSON.stringify(p),before);return next;
}
const play=(p,ids)=>ids.reduce(take,p);
const onlyMove=(p,kind)=>sim.options(p).find(m=>m.kind===kind&&m.available);
const familyMoves=p=>sim.options(p).filter(m=>["beacon-pass","slipstream-pass"].includes(m.signatureId));

test("all 38 catalog members offer their own family handoff to each living reserve",()=>{
  const count={beacon:0,slipstream:0};
  for(const k of Object.values(game.species)){
    const offered=book.byId(k.id);
    const key=k.skills.some(s=>s.id==="reed-lunge")?"beacon":k.skills.some(s=>s.id==="sail-juke")?"slipstream":null;
    assert.equal(offered?.familyKey||null,key,k.name);
    if(!key)continue;
    count[key]++;
    assert.equal(offered.speciesId,k.id);assert.equal(offered.name,book.byId(key+"-pass").name);
    const p=sim.start([k.id,"cindlet","dewfin"],right),choices=familyMoves(p);
    assert.deepEqual(copy(choices.map(m=>m.id)),[key+":cindlet",key+":dewfin"]);
    for(const m of choices){
      assert.equal(m.cost,1);assert.equal(m.type,k.type);
      assert.equal(m.available,false);assert.match(m.reason,/beat/);
    }
    assert.equal(sim.apply(p,key+":"+k.id),null);assert.equal(book.used(p.sides[0],k.id),false);
  }
  assert.deepEqual(count,{beacon:19,slipstream:19});
  for(const id of ["toString","__proto__","missing-pass"])assert.equal(book.byId(id),null);
});

test("Beacon Pass marks the specific foe, costs the charge, bypasses no incoming damage and earns no switch beat",()=>{
  const gear={left:{gustlance:"opening-pennant",galeskip:"relay-bell"}};
  const p=sim.start(left,right,0,gear),m=sim.forecast(p,"beacon:galeskip");
  assert.ok(m.available&&m.markFoe);assert.equal(m.cover,1);assert.equal(m.beatsAfter,0);
  const marked=take(p,m.id),plain=take(p,"swap:galeskip");
  assert.equal(marked.ply,1);assert.equal(lead(marked,0).id,"galeskip");
  assert.equal(lead(marked,0).spent,false);assert.equal(lead(plain,0).spent,true);
  assert.equal(marked.sides[0].beats,0);assert.equal(plain.sides[0].beats,3);
  assert.equal(marked.sides[0].familyPassUsed,"beacon-pass");
  assert.equal(book.used(marked.sides[0],"slipstream"),true);assert.equal(book.used(marked.sides[0],"mossbell"),false);
  assert.ok(lead(marked,1).exposed);assert.ok(!lead(marked,0).exposed);
  const guard="skill:cinder-roll";
  assert.equal(sim.forecast(marked,guard).damage,sim.forecast(plain,guard).damage);
  const guarded=take(marked,guard),unmarked=take(plain,guard);
  assert.ok(familyMoves(guarded).every(m=>!m.available&&m.reason.includes("pass used")));
  const strike=onlyMove(guarded,"attack"),normal=sim.forecast(unmarked,strike.id);
  const uncovered=take(plain,"skill:ember-pop"),base=sim.forecast(uncovered,strike.id).damage;
  assert.ok(strike.consumeMark);assert.equal(normal.damage,Math.round(base*.5));
  assert.equal(strike.damage,Math.round(base*1.5));
  assert.equal(lead(take(guarded,strike.id),1).exposed,false);
  assert.equal(lead(take(guarded,onlyMove(guarded,"guard").id),1).exposed,true);
  const charged=play(guarded,["skill:sail-juke","skill:cinder-roll","skill:bough-nap","skill:cinder-roll"]);
  const duet=onlyMove(charged,"duet");assert.ok(duet&&duet.damage>0);
  assert.equal(lead(take(charged,duet.id),1).exposed,true);
  const away=take(marked,"swap:dewfin");
  assert.equal(kin(away,1,"cindlet").exposed,true);assert.equal(lead(away,1).exposed,false);
  assert.equal(onlyMove(away,"attack").consumeMark,false);
});

test("Slipstream heals the named reserve before a full reply, leaves personal recovery alone and caps at max HP",()=>{
  const crew=["dewfin","galeskip","gustlance"],p=sim.start(crew,right,1);
  const wounded=play(p,["skill:ember-pop","skill:bubble-jet","skill:cinder-roll","swap:galeskip","skill:ember-pop"]);
  const old=kin(wounded,0,"dewfin"),m=sim.forecast(wounded,"slipstream:dewfin");
  assert.ok(m.available);const amount=Math.min(old.maxHp-old.hp,Math.floor(old.maxHp/4));
  assert.ok(amount>0);assert.equal(m.healPartner,amount);assert.equal(m.heal,amount);assert.equal(m.cover,1);
  const pass=take(wounded,m.id),swap=take(wounded,"swap:dewfin");
  assert.equal(pass.sides[0].familyPassUsed,"slipstream-pass");
  assert.equal(lead(pass,0).hp,old.hp+amount);assert.equal(lead(pass,0).recovery,old.recovery);
  const counter="skill:ember-pop";assert.equal(sim.forecast(pass,counter).damage,sim.forecast(swap,counter).damage);
  const after=take(pass,counter);assert.equal(lead(after,0).hp,old.hp+amount-sim.forecast(pass,counter).damage);
  assert.ok(!lead(after,1).exposed);assert.equal(book.used(after.sides[0],"gustlance"),true);
  const flat=sim.forecast(wounded,"slipstream:gustlance");assert.ok(flat.available);assert.equal(flat.heal,0);
  assert.equal(lead(take(wounded,flat.id),0).hp,sim.maxHp("gustlance"));
  const gone=copy(wounded);kin(gone,0,"dewfin").hp=0;assert.ok(sim.restore(gone));
  assert.equal(sim.forecast(gone,m.id),null);assert.equal(sim.apply(gone,m.id),null);
});

test("a lure blocks either family pass and preserves the charge; a pass can expire a rival Thorn Read without contact",()=>{
  for(const opener of ["gustlance","galeskip"]){
    let p=sim.start([opener,"mossbell","dewfin"],["sprigkit","frostmull","cindlet"],1);
    p=take(p,"skill:leaf-flurry");p=take(p,onlyMove(p,"guard").id);
    p=take(p,"skill:brush-dash");p=take(p,onlyMove(p,"attack").id);
    p=take(p,"duet:frostmull");assert.ok(p.sides[0].pinned);
    for(const m of familyMoves(p)){assert.equal(m.available,false);assert.match(m.reason,/lure/);assert.equal(sim.apply(p,m.id),null);}
    p=take(p,onlyMove(p,"guard").id);p=take(p,"swap:cindlet");
    assert.ok(familyMoves(p).every(m=>m.available));
  }
  const q=take(sim.start(left,["fernprickle","cindlet","dewfin"],1,{left:{gustlance:"opening-pennant"}}),"stance:thorn-read");
  const pass=sim.forecast(q,"beacon:mossbell");assert.match(pass.detail,/without contact/);
  const after=take(q,pass.id);assert.equal(after.sides[1].thornRead,undefined);
  assert.equal(kin(after,0,"gustlance").exposed,false);assert.equal(lead(after,1).exposed,true);
});

test("both seats have separate charges, Grove spends independently and restore rejects forged or misplaced markers",()=>{
  const teams=[left,["galeskip","gustlance","fernprickle"]],kits={left:{gustlance:"opening-pennant"},right:{galeskip:"opening-pennant"}};
  const start=sim.start(...teams,0,kits),other=sim.start(teams[1],teams[0],1,{left:kits.right,right:kits.left});
  const tape=["beacon:mossbell","slipstream:fernprickle","skill:shell-bump","stance:thorn-read","shelter:galeskip"];
  let p=start,q=other;
  for(const id of tape){
    p=take(p,id);q=take(q,id);
    assert.deepEqual(copy(p.sides[0]),copy(q.sides[1]));assert.deepEqual(copy(p.sides[1]),copy(q.sides[0]));
    assert.deepEqual(copy(sim.restore(copy(p))),copy(p));
  }
  assert.equal(p.sides[0].familyPassUsed,"beacon-pass");assert.equal(p.sides[1].familyPassUsed,"slipstream-pass");
  assert.ok(book.used(p.sides[0],"shelter-call"));assert.ok(book.used(p.sides[1],"thorn-read"));
  const bad=(state,change)=>{const tampered=copy(state);change(tampered);assert.equal(sim.restore(tampered),null);};
  bad(start,x=>x.sides[0].familyPassUsed="beacon-pass");
  bad(p,x=>x.sides[0].familyPassUsed=true);bad(p,x=>x.sides[0].familyPassUsed="beacon");
  bad(p,x=>x.sides[0].team[0].signatureSpent=true);
  const first=take(start,tape[0]);bad(first,x=>x.sides[0].familyPassUsed="slipstream-pass");
  bad(first,x=>{delete x.sides[0].team[0].gear;delete x.sides[0].team[0].spent;});
  const onlyHerons=play(sim.start(["gustlance","cindlet","dewfin"],right,0,{left:{gustlance:"opening-pennant"}}),["beacon:cindlet","skill:ember-pop"]);
  bad(onlyHerons,x=>x.sides[0].familyPassUsed="slipstream-pass");
});

test("old family command tapes, options and sparse states remain byte-compatible",()=>{
  const old=boot(false).sim;let a=old.start(left,right),b=sim.start(left,right);
  while(a.phase!=="done"){
    const plain=sim.options(b).filter(m=>!["beacon-pass","slipstream-pass"].includes(m.signatureId));
    assert.deepEqual(copy(old.options(a)),copy(plain));
    const id=old.recommend(a).id;a=old.apply(a,id);b=take(b,id);
    assert.deepEqual(copy(b),copy(a));assert.deepEqual(copy(sim.restore(copy(a))),copy(a));
    assert.equal(Object.hasOwn(b.sides[0],"familyPassUsed"),false);
  }
});

test("the coach wins opposing matchups with equal-stat Gustlance and Galeskip; actual tapes replay identically",()=>{
  const ids=["gustlance","galeskip"];
  const profile=id=>({hp:sim.maxHp(id),types:game.species[id].types,moves:game.species[id].skills.map(s=>[s.kind,s.type,s.power])});
  assert.deepEqual(copy(profile(ids[0])),copy(profile(ids[1])));
  const bouts=[
    {bench:["kilnclaw","iceribbon"],rival:["smelteroll","boltbur","kilnclaw"],victor:"gustlance",action:4,pass:"beacon:iceribbon",plies:34},
    {bench:["dewfin","pincoil"],rival:["brookpeep","frostmull","creekroll"],victor:"galeskip",action:34,pass:"slipstream:pincoil",plies:46}
  ];
  for(const bout of bouts)for(const id of ids){
    const start=sim.start([id,...bout.bench],bout.rival,1);let p=start,record=[],pass;
    while(p.phase!=="done"){
      const move=sim.recommend(p);
      if(p.turn===0&&move.id===bout.pass)pass={ply:p.ply+1,move,target:kin(p,0,move.targetId)};
      record.push(move.id);p=take(p,move.id);
    }
    assert.deepEqual(copy(play(start,record)),copy(p));
    assert.equal(p.winner,id===bout.victor?0:1);
    if(id!==bout.victor)continue;
    assert.equal(p.ply,bout.plies);assert.equal(pass.ply,bout.action);
    if(id==="galeskip"){assert.equal(pass.target.hp,16);assert.equal(pass.move.heal,20);}
  }
});
