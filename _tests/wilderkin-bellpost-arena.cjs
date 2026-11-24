const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const files=["atlas","bestiary","activities","campaign","story","duets","sparring-gear","sparring-signatures","sparring-battle","bellpost-arena","engine"];
const scripts=files.map(name=>{
  const filename=path.join(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(fs.readFileSync(filename,"utf8"),{filename});
});
function duel(){
  const w={},ctx=vm.createContext({window:w});scripts.forEach(s=>s.runInContext(ctx));
  const game=w.WilderGame,sim=w.WilderSparringBattle.create({game}),row=(id,label,value,detail,extra)=>({id,label,value,detail,...extra});
  const arena=w.WilderBellpostArena.create({game,row,image:id=>id+".png"});
  const teams=[{ids:["gustlance","opalclasp","cindlet"],gear:{gustlance:"opening-pennant"}},
    {ids:["fernprickle","dewfin","mossbell"],gear:{fernprickle:"last-stitch"}}];
  const pos=sim.start(teams[0].ids,teams[1].ids,0,{left:teams[0].gear,right:teams[1].gear});
  const record={id:"ABC",teams,first:0,seat:0,moves:[],pos,status:"active",winner:null};
  function play(id){
    const next=sim.apply(record.pos,id);assert.ok(next,id);record.pos=next;record.moves.push(id);
    if(next.phase==="done"){record.status="done";record.winner=next.winner;}
  }
  return {arena,record,sim,play};
}
const rows=m=>Array.from(m.sections).flatMap(s=>Array.from(s.rows||[])),legal=m=>rows(m).filter(r=>r.id==="post-move"&&!r.disabled);
test("only the active human can command; guest camera, both teams' gear and all actual legal options agree with the kernel",()=>{
  const {arena,record:r,sim,play}=duel();
  for(const seat of [0,1,null]){
    const v={...r,seat},m=arena.model(v);
    assert.equal(m.ally.species,seat===1?"fernprickle":"gustlance");
    assert.equal(m.lineups.left.label,seat===null?"Host":"You");
    assert.equal(m.lineups.right.label,seat===null?"Guest":"Friend");
    assert.equal(m.ally.gear.spent,seat!==1);
    assert.deepEqual(Array.from(m.lineups.left.team,p=>p.id),r.teams[seat===1?1:0].ids);
    const available=[...legal(m),...legal(arena.model(v,"partners"))].map(r=>r.value).sort();
    const expected=seat===0?Array.from(sim.options(r.pos)).filter(o=>o.available).map(o=>o.id).sort():[];
    assert.deepEqual(available,expected);
  }
  const crew=arena.model(r,"crew");assert.ok(rows(crew).find(x=>x.label==="Gustlance").detail.includes("Opening Pennant · used"));
  play("beacon:opalclasp");const guest={...r,seat:1},m=arena.model(guest),page=arena.model(guest,"partners");
  assert.match(m.log[0],/Friend’s Gustlance · Beacon Pass/);
  assert.ok(rows(arena.model(guest,"crew")).find(x=>x.label==="Gustlance").detail.includes("Beacon Pass used"));
  assert.equal(page.kind,undefined);assert.ok(legal(page).some(r=>r.value==="stance:thorn-read"));
  assert.ok(!rows(arena.model(r)).some(x=>x.id==="post-move"));
});
test("film steps keep the acting side, individual HP delta, gear status and the exact battle position at that decision",()=>{
  const {arena,record:r,sim,play}=duel();play("beacon:opalclasp");play("stance:thorn-read");
  const reply=sim.forecast(r.pos,"skill:rill-jet"),hp=r.pos.sides[1].team[0].hp;play(reply.id);
  const sealed=JSON.stringify(r),log=arena.model(r).log;assert.match(log[0],new RegExp("Fernprickle −"+reply.damage+" HP"));
  const guest={...r,seat:1},film=arena.review(guest,2),delta=rows(film).find(x=>x.label.includes("−"+reply.damage+" HP"));
  assert.equal(film.ally.hp,hp-reply.damage);assert.ok(delta.detail.startsWith("You · "+hp+" → "));
  assert.ok(film.sections.some(s=>s.text?.includes("Thorn Read exposes Opalclasp")));
  assert.equal(arena.review(guest,0).ally.hp,hp);assert.equal(arena.review(guest,0).foe.species,"opalclasp");
  const spectator=arena.review({...r,seat:null},1);
  assert.equal(spectator.lineups.left.label,"Host");assert.match(spectator.subtitle,/Guest’s Fernprickle/);
  const oldCrew=arena.review(guest,0,"crew"),afterStance=arena.review(guest,1,"crew");
  assert.match(rows(oldCrew).find(x=>x.label==="Fernprickle").detail,/Thorn Read ready/);
  assert.match(rows(afterStance).find(x=>x.label==="Fernprickle").detail,/Thorn Read used/);
  assert.ok(rows(oldCrew).some(x=>x.id==="post-film-step"&&x.value===0));
  assert.deepEqual(legal(film),[]);assert.ok(rows(film).some(x=>x.id==="post-film-step"&&x.value===1));
  assert.equal(JSON.stringify(r),sealed);
});
test("real free replacements leave a played action for the same seat, and both terminal and conceded matches are inspectable without active controls",()=>{
  const {arena,record:r,sim,play}=duel();let saw=false;
  const pending={...r,seat:null};assert.equal(arena.review(pending).title,"Battle film");
  for(let n=0;n<66&&r.status!=="done";n++){
    r.seat=r.pos.turn;const previous=r.seat,phase=r.pos.phase,move=sim.recommend(r.pos);
    if(phase==="replace"){
      const m=arena.model(r);assert.match(m.title,/next lead/);assert.ok(legal(m).every(x=>x.value.startsWith("replace:")));
      assert.deepEqual(legal(arena.model({...r,seat:1-r.seat})),[]);saw=true;
    }
    play(move.id);
    if(phase==="replace"){
      assert.equal(r.pos.turn,previous);assert.ok(legal(arena.model(r)).length>0);
      assert.match(arena.review(r,-1).subtitle,/Free replacement/);
    }
  }
  assert.ok(saw);assert.equal(r.status,"done");
  for(const seat of [0,1,null]){
    const m=arena.model({...r,seat});assert.deepEqual(legal(m),[]);assert.match(m.title,/won|drawn/);
    const review=arena.review({...r,seat},-1);assert.ok(review.sections.some(s=>s.title===m.title));
  }
  const fresh=duel().record;
  const conceded={...fresh,seat:1,status:"done",winner:1,resigned:0};
  assert.equal(arena.model(conceded).title,"You won");assert.match(arena.model(conceded).subtitle,/Friend resigned/);
  assert.deepEqual(legal(arena.model(conceded)),[]);assert.match(arena.review(conceded).subtitle,/Friend resigned/);
});
test("a 60-action draw shows the same verdict from both devices and the spectator's final film",()=>{
  const {arena,record:r,play}=duel();
  for(let n=0;n<60;n++){
    const s=r.pos.sides[r.pos.turn],target=s.team[s.active===0?1:0];
    play("swap:"+target.id);
  }
  assert.equal(r.status,"done");assert.equal(r.winner,"draw");
  for(const seat of [0,1,null]){
    const view={...r,seat},floor=arena.model(view),film=arena.review(view);
    assert.equal(floor.title,"Match drawn");assert.match(floor.kicker,/60 OF 60/);
    assert.match(film.kicker,/60 OF 60/);assert.ok(film.sections.some(s=>s.title==="Match drawn"));
    assert.deepEqual(legal(floor),[]);
  }
});
