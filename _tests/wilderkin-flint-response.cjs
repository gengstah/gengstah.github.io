const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const scripts=["atlas","bestiary","activities","story","campaign","duets","growth","wardens","engine"].map(id=>{
  const filename=path.join(__dirname,"../games/wilderkin",id+".js");
  return new vm.Script(fs.readFileSync(filename,"utf8"),{filename});
});
const ok=x=>{assert.ok(x.ok,x.message);return x;};
function boot(json){
  const ctx=vm.createContext({window:{localStorage:{getItem:k=>k==="wilderkin.trail.v3"?json:null,setItem(){}}}});
  scripts.forEach(s=>s.runInContext(ctx));return ctx.window;
}
function ordinary(g,kind){
  const k=g.kin(g.state.battle.activeId,{owned:true});
  return ok(g.useSkill(k.skills.find(s=>s.kind===kind).id));
}
function finish(g,kind="attack"){
  let out;
  for(let n=0;n<100&&g.state.battle;n++)out=ordinary(g,kind);
  assert.equal(g.state.battle,null);return out.kind;
}
// Reach Flint by playing both commissions on their shortest available paths.
function arrival(){
  const {WilderGame:g,WilderStory:story}=boot();
  ok(g.setLead("dewfin"));
  const rest=()=>{assert.ok(g.visitSite("camp"));ok(g.heal());};
  for(let i=0;i<2;i++){
    while(!g.expedition().done){
      rest();assert.ok(g.visitSite(g.expedition().targetSite));
      const job=g.expedition().choices.filter(c=>c.available).sort((a,b)=>a.foes-b.foes)[0];
      ok(g.expeditionAction(job.id));if(g.state.battle)assert.equal(finish(g),"victory");
    }
    const id="chapter-"+(i+1);
    while(!story.chapterDone(g.state,i))ok(g.storyStep(id,story.scene(g.state,id).choices[0]?.id));
    rest();assert.ok(g.visitSite("warden"));ok(g.meetWarden());ok(g.startBattle("warden"));
    if(i===0){assert.equal(finish(g),"victory");ok(g.travel(1));}
  }
  assert.deepEqual(Array.from(g.team(),p=>p.level),[6,6,6]);
  return JSON.stringify(g.state);
}
const start=arrival(),load=save=>boot(save||start).WilderGame;
const snapshot=g=>JSON.stringify(g.state);

test("Flint announces the color before cadence, shows two exact replies and restores the number of lit wicks",()=>{
  const g=load();assert.match(g.wardenLesson().brief,/two wicks/);
  ordinary(g,"attack");const cue=g.wardenForecast();
  assert.equal(cue.active,true);assert.equal(cue.kind,"cadence");assert.match(cue.description,/Cragroll.*two Loam wicks/);
  const correct=load(snapshot(g));
  ordinary(correct,"guard");assert.ok(correct.state.battle.opening);assert.equal(correct.state.battle.coach.lantern,undefined);
  ordinary(g,"attack");const b=g.state.battle;
  assert.equal(b.coach.lantern.left,2);assert.equal(g.foeIntent().skill.name,"Loam lantern volley");
  const resumed=load(snapshot(g));assert.deepEqual(JSON.parse(JSON.stringify(resumed.wardenForecast())),JSON.parse(JSON.stringify(g.wardenForecast())));
  assert.equal(resumed.wardenForecast().kind,"lantern");assert.match(resumed.wardenForecast().description,/2 charged Loam replies/);
  const hit=g.ordinaryForecast("bubble-jet"),guard=g.ordinaryForecast("slick-slide"),swap=g.switchForecast("sprigkit");
  assert.equal(hit.returnDamage,27);assert.equal(guard.returnDamage,16);assert.equal(swap.damage,11);
  const before=g.team().find(k=>k.id==="dewfin").hp;ordinary(g,"guard");
  assert.equal(g.team().find(k=>k.id==="dewfin").hp,before-guard.returnDamage);
  const last=load(snapshot(g));assert.match(last.wardenForecast().title,/Final wick/);
  assert.equal(last.foeIntent().skill.type,"Loam");
  const switched=ok(resumed.swap("sprigkit"));assert.match(switched.message,/One Loam wick remains/);
  assert.equal(resumed.team()[0].hp,swap.hpAfter);
  ordinary(last,"attack");assert.equal(last.state.battle.coach.lantern,undefined);
  assert.equal(last.wardenForecast().kind,"relay");
});

test("one ordinary decision reverses the same level-6 starter team's loss without medicine or extra training",()=>{
  for(const policy of ["attack","guard"])assert.equal(finish(load(),policy),"defeat");
  for(const [turn,move] of [[2,"slick-slide"],[2,"dew-bath"],[3,"slick-slide"],[3,"swap"],[5,"swap"]]){
    const g=load(),before=g.state.bag.tonic;
    while(g.state.battle.turn<turn)ordinary(g,"attack");
    if(move==="swap")ok(g.swap(turn===5?"cindlet":"sprigkit"));
    else ok(g.useSkill(move));
    assert.equal(finish(g),"victory","Single alternative on turn "+turn+" · "+move);
    const sealReward=g.state.wardenLessons.includes(1)?1:0;
    assert.equal(g.state.bag.tonic,before+sealReward);assert.ok(g.state.crests.includes(1));
  }
});

test("an uncontested exchange passes the lantern to Coalmoth; a voluntary switch closes the lane",()=>{
  const g=load();while(g.state.battle.turn<5)ordinary(g,"guard");
  assert.equal(g.state.battle.enemy.id,"cragroll");assert.match(g.wardenForecast().description,/Coalmoth.*two Ember wicks/);
  const close=load(snapshot(g));ok(close.swap("cindlet"));
  assert.equal(close.state.battle.enemy.id,"cragroll");assert.equal(close.state.battle.coach.lantern,undefined);
  assert.ok(close.state.battle.coach.heard.includes("relay"));
  const exchange=ordinary(g,"guard");assert.ok(exchange.foeShifted);assert.equal(g.state.battle.enemy.id,"coalmoth");
  assert.match(exchange.message,/two Ember wicks/);assert.equal(g.foeIntent().skill.type,"Ember");
});

test("Pincer Block still learns on an actual lantern hit and an earned Pincer Hold denies the relay's two wicks",()=>{
  const data=JSON.parse(start),tmp=load();
  data.party.push(tmp.loaner("opalclasp",7));data.team.push("opalclasp");data.lead=data.battle.activeId="opalclasp";
  const g=load(JSON.stringify(data));ordinary(g,"guard");ordinary(g,"guard");
  assert.equal(g.foeIntent().skill.type,"Loam");
  const read=ordinary(g,"guard");assert.equal(read.learnedGuard,"Pincer Hold");assert.equal(g.state.battle.enemy.pincerOpening,true);
  ok(g.useItem("tonic","opalclasp"));
  assert.equal(g.state.battle.activeId,"opalclasp");assert.equal(g.wardenForecast().kind,"relay");
  const held=ordinary(g,"guard");assert.match(held.message,/reserve stays back/);
  assert.equal(g.state.battle.enemy.id,"cragroll");assert.equal(g.state.battle.coach.lantern,undefined);
});

test("existing crests and historical single-charge saves survive; malformed lanterns cannot mint extra shots",()=>{
  const g=load();ordinary(g,"attack");ordinary(g,"attack");
  const old=JSON.parse(snapshot(g));delete old.battle.coach.lantern;
  const legacy=load(JSON.stringify(old));assert.ok(legacy.foeIntent().charged);assert.doesNotMatch(legacy.foeIntent().skill.name,/lantern/);
  assert.deepEqual(Array.from(legacy.state.crests),[0]);
  for(const [left,type] of [[0,"Loam"],[3,"Ember"],["2","Loam"],[2,"Neutral"],[2,"toString"]]){
    const record=JSON.parse(snapshot(g));record.battle.coach.lantern={left,type};
    assert.equal(load(JSON.stringify(record)).state.battle.coach.lantern,undefined);
  }
});
