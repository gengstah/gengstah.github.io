const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const sandbox=vm.createContext({window:{localStorage:{getItem:()=>null,setItem(){throw new Error("Cup rules changed campaign storage");}}}});
for(const n of ["atlas","bestiary","activities","campaign","story","duets","stillwake","sparring-gear","sparring-signatures","sparring-battle","cup-rules","engine"]){
  const file=path.join(__dirname,"../games/wilderkin",n+".js");vm.runInContext(fs.readFileSync(file,"utf8"),sandbox,{filename:file});
}
const {WilderGame:game,WilderSparringBattle:battle,WilderCupRules:cup,WilderKinDex:dex,WilderDuets:duets}=sandbox.window;
const sim=battle.create({game}),rules=cup.create({game}),R=rules.defaultRoster,L=R.slice(0,3),copy=x=>JSON.parse(JSON.stringify(x));
const campaign=JSON.stringify(game.state);

function bout(c,history,left=L,policy="coached",gear={}){
  const choice=rules.commit(c,R,history,gear);assert.ok(choice);
  const first=rules.first(history.length),kit={left:rules.selectGear(left,gear),right:choice.gear};
  let pos=sim.start(left,choice.team,first,kit);const moves=[];
  while(pos.phase!=="done"&&policy!=="concede"){
    const legal=sim.options(pos).filter(m=>m.available);
    const m=policy==="draw"?legal.find(m=>m.kind==="swap"):
      policy==="practice"&&pos.turn===1?legal.find(m=>m.kind==="attack"||m.kind==="replace"):sim.recommend(pos);
    moves.push(m.id);pos=sim.apply(pos,m.id);assert.ok(pos);
  }
  return {left:left.slice(),right:choice.team.slice(),gear:kit,first,human:0,moves,winner:policy==="concede"?1:pos.winner,conceded:policy==="concede"};
}

test("a registration contains six distinct standard species with one public piece per holder and no shared duplicates",()=>{
  const gear={cindlet:"opening-pennant",pincoil:"last-stitch"},roster=R.slice(),saved=rules.register(roster,gear);
  assert.equal(saved.roster.length,6);assert.ok(saved.roster.includes("fernprickle")&&saved.roster.includes("mossbell"));
  roster.reverse();gear.cindlet="relay-bell";assert.deepEqual(copy(saved.roster),copy(R));assert.equal(saved.gear.cindlet,"opening-pennant");
  assert.deepEqual(copy(rules.selectGear(L,saved.gear)),{cindlet:"opening-pennant"});
  for(const bad of [R.slice(1),[...R,R[0]],["stillwake",...R.slice(1)],["__proto__",...R.slice(1)],[R[1],...R.slice(1)]])assert.equal(rules.register(bad),null);
  for(const bad of [null,[],{coalmoth:"last-stitch"},{sprigkit:"last-stitch",dewfin:"last-stitch"},{sprigkit:"imaginary"}])assert.equal(rules.register(R,bad),null);
  assert.deepEqual(copy(rules.captains.map(c=>c.id)),["orin","nessa","ilda"]);
  for(const c of rules.captains){assert.ok(rules.register(c.roster,c.gear));assert.ok(c.name&&c.title&&c.plan);}
});

test("the sealed trio is independent of today’s picks and the scout shows actual seats, affinities, duets and ordinary counterplay",()=>{
  const gear={cindlet:"prism-lens",sprigkit:"opening-pennant"};
  for(const c of rules.captains){
    const saved=rules.commit(c.id,R,[],gear),report=rules.scout(c.id,R,[],gear);
    assert.deepEqual(copy(saved.team),copy(c.roster.slice(0,3)));assert.equal(saved.round,1);
    assert.deepEqual(copy(rules.commit(c.id,[...R].reverse(),[]).team),copy(saved.team));
    const sealed=saved.team.slice();saved.team.reverse();assert.deepEqual(copy(rules.commit(c.id,R,[]).team),copy(sealed));
    assert.deepEqual(copy(report.bench),copy(c.roster.filter(id=>!report.team.includes(id))));
    assert.deepEqual(copy(report.gear),copy(rules.selectGear(report.team,c.gear)));
    for(const type of Object.keys(dex.types)){
      const covered=report.team.some(id=>game.species[id].skills.some(s=>s.kind==="attack"&&dex.effectiveness(s.type,[type])>1));
      assert.equal(report.coverage.includes(type),covered);
      assert.equal(report.weaknesses.includes(type),report.team.filter(id=>dex.effectiveness(type,game.species[id].types)>1).length>=2);
    }
    assert.equal(report.duets.length,3);
    for(const d of report.duets){
      const score=duets.score(...d.ids.map(id=>game.species[id].type));
      assert.equal(d.name,score.name);assert.equal(d.cost,score.cost);assert.equal(d.role,score.role);
    }
    const prediction=report.projection,left=[prediction.id,...R.filter(x=>x!==prediction.id)].slice(0,3);
    let p=sim.start(left,report.team,prediction.first,{left:rules.selectGear(left,gear),right:report.gear});
    const strike=sim.options(p).find(m=>m.label===prediction.playerMove);assert.equal(strike.damage,prediction.playerDamage);
    p=sim.apply(p,strike.id);const reply=sim.options(p).find(m=>m.label===prediction.rivalMove);
    assert.equal(reply.damage,prediction.rivalDamage);assert.ok(report.counter.includes(game.species[left[0]].name));
  }
});

test("the captain adapts to the last shown trio and verdict, keeping a winning lead and changing a losing lead",()=>{
  const grove=bout("orin",[],L,"practice"),tide=bout("orin",[],["dewfin","fernprickle","mossbell"],"practice");
  assert.equal(grove.winner,0);assert.equal(tide.winner,0);
  const a=rules.commit("orin",R,[grove]),b=rules.commit("orin",R,[tide]);
  assert.notEqual(a.team[0],grove.right[0]);assert.ok(a.team.some(id=>!grove.right.includes(id)));
  assert.equal(a.team[0],"opalmull");assert.equal(b.team[0],"fernprickle");
  assert.ok(a.reason.includes("Sprigkit"));assert.ok(b.reason.includes("Dewfin"));
  const yielded=bout("orin",[],L,"concede"),retained=rules.commit("orin",R,[yielded]);
  assert.equal(retained.team[0],yielded.right[0]);assert.equal(retained.team.filter(id=>yielded.right.includes(id)).length,2);
  const probe=rules.scout("orin",R,[yielded]).projection;assert.equal(probe.first,1);
  const squad=[probe.id,...R.filter(x=>x!==probe.id)].slice(0,3);
  const pos=sim.start(squad,retained.team,1,{left:{},right:retained.gear});
  const first=sim.options(pos).find(m=>m.label===probe.rivalMove);assert.equal(first.damage,probe.rivalDamage);
  const after=sim.apply(pos,first.id);assert.equal(sim.options(after).find(m=>m.label===probe.playerMove).damage,probe.playerDamage);
});

test("a complete series replays every turn and free replacement; first seat alternates and the series closes at two points",()=>{
  for(const c of rules.captains){
    const history=[],gear={sprigkit:"opening-pennant",cindlet:"last-stitch",dewfin:"relay-bell"};
    while(!rules.score(history).done){
      const left=history.length%2?["dewfin","pincoil","fernprickle"]:L;
      history.push(bout(c.id,history,left,"coached",gear));
    }
    assert.ok(history.length>=2&&history.length<=3);
    assert.ok(history.some(t=>t.moves.some(id=>id.startsWith("replace:"))));
    const replayed=rules.validateHistory(c.id,R,gear,history);
    assert.deepEqual(copy(replayed),copy(history));assert.notEqual(replayed[0].moves,history[0].moves);
    assert.deepEqual(copy(replayed.map(t=>t.first)),[0,1,0].slice(0,history.length));
    assert.equal(rules.commit(c.id,R,replayed,gear),null);
    assert.equal(rules.scout(c.id,R,replayed,gear),null);
    assert.equal(rules.validateHistory(c.id,R,gear,[...replayed,replayed[0]]),null);
  }
  assert.equal(JSON.stringify(game.state),campaign);
});

test("three real sixty-action draws count half each and yield a tied series, with a fresh captain reserve after a draw",()=>{
  const history=[];
  for(let i=0;i<3;i++){
    const t=bout("ilda",history,L,"draw");assert.equal(t.moves.length,60);assert.equal(t.winner,"draw");
    if(i)assert.ok(t.right.some(id=>!history[i-1].right.includes(id)));
    history.push(t);
    assert.deepEqual(copy(rules.score(history)),{home:(i+1)*.5,away:(i+1)*.5,done:i===2,winner:i===2?"draw":null});
  }
  assert.ok(rules.validateHistory("ilda",R,{},history));
  const wins=[{winner:0},{winner:0}];assert.equal(rules.score(wins).done,true);assert.equal(rules.score([...wins,{winner:1}]),null);
  assert.equal(rules.score([{winner:0},{winner:1},{winner:"draw"}]).winner,"draw");
  assert.equal(rules.score([{winner:1},{winner:"draw"},{winner:0}]).winner,"draw");
  assert.equal(rules.score([{winner:"draw"},{winner:"draw"},{winner:0}]).winner,0);
  assert.equal(rules.score([{winner:"Win"}]),null);
});

test("active tapes only accept exact sealed lineups, registered gear, expected seat and legal actions; a completed claim needs its actual verdict",()=>{
  const gear={sprigkit:"last-stitch"},finished=bout("nessa",[],L,"practice",gear),partial=copy(finished);
  partial.moves=partial.moves.slice(0,3);delete partial.winner;delete partial.conceded;
  const resumed=rules.validateMatch("nessa",R,gear,[],partial);assert.ok(resumed);
  assert.equal(resumed.pos.ply,3);assert.equal(resumed.pos.phase,"move");assert.equal(resumed.tape.winner,null);
  assert.equal(rules.validateHistory("nessa",R,gear,[partial]),null);
  for(const patch of [{first:1},{right:[finished.right[1],finished.right[0],finished.right[2]]},
    {left:[...L.slice(0,2),"stillwake"]},{left:["cindlet","cindlet","dewfin"]},{gear:{left:{},right:finished.gear.right}},
    {gear:{left:finished.gear.left,right:{}}},{winner:1},{human:1},{conceded:"yes"},{moves:["shelter:cindlet"]},
    {moves:[...finished.moves,"swap:cindlet"]},{moves:Array(67).fill("swap:cindlet")}]){
    assert.equal(rules.validateMatch("nessa",R,gear,[],{...partial,...patch}),null);
  }
  assert.equal(rules.validateHistory("nessa",R,gear,[{...finished,winner:1-finished.winner}]),null);
  assert.equal(rules.validateHistory("nessa",R,gear,[{...finished,winner:1,conceded:true}]),null);
  const con={...partial,winner:1,conceded:true};
  assert.equal(rules.validateHistory("nessa",R,gear,[con])[0].winner,1);
  assert.equal(rules.validateHistory("nessa",R,gear,[{...con,winner:0}]),null);
  assert.equal(rules.validateHistory("imaginary",R,gear,[]),null);assert.equal(JSON.stringify(game.state),campaign);
});
