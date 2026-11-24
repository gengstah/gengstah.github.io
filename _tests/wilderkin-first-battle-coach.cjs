const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const scripts=["atlas","bestiary","wild-calls","activities","story","campaign","duets","growth","wardens","fieldwork","first-battle","engine","first-battle-coach"].map(id=>
  new vm.Script(fs.readFileSync(path.join(__dirname,"../games/wilderkin",id+".js"),"utf8"),{filename:id+".js"}));
function station(disk=new Map()){
  const window={localStorage:{getItem:k=>disk.get(k)||null,setItem:(k,v)=>disk.set(k,v)}},ctx=vm.createContext({window});
  scripts.forEach(f=>f.runInContext(ctx));
  const g=window.WilderGame,coach=window.WilderFirstBattleCoach.create({game:g,image:id=>"art/"+id+".png",row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra})});
  function begin(lead){
    assert.ok(g.firstBattle.choose(lead).ok);assert.ok(g.visitSite("wild"));assert.ok(g.firstBattle.begin().ok);
    assert.ok(g.state.battle.firstBattle);assert.equal(g.state.battle.activeId,lead);
  }
  function move(r){
    assert.ok(r&&r.id,"Expected a live coaching choice");
    const [a,b]=String(r.value||"").split("|"),token=coach.before({name:r.label});
    const res=r.id==="skill"?g.useSkill(a):r.id==="duet"?g.useDuet(a):r.id==="trio"?g.useTrio(a,b):
      r.id==="capture"?g.recruit():r.id==="swap"?g.swap(a):r.id==="use-item"?g.useItem(a,b):g.answerWildCall(a,b);
    assert.ok(res.ok,res.message);return {res,feedback:coach.after(token,res)};
  }
  return {g,coach,disk,begin,move};
}
for(const lead of ["sprigkit","cindlet","dewfin"]){
  test(lead+" can strike or guard, call an actual available duet, and freely choose the next kin's skill",()=>{
    for(const first of ["STRIKE","GUARD"]){
      const h=station();h.begin(lead);const {g,coach}=h,atStart=JSON.stringify(g.state);
      const opening=coach.section(),skill=opening.rows.find(r=>r.badge===first);
      assert.ok(opening.rows.length<=3);assert.ok(skill);assert.match(opening.text,/earn a beat/);
      const f=g.ordinaryForecast(skill.value);
      assert.ok(skill.detail.includes("Deal "+f.damage+" damage")&&skill.detail.includes("take "+f.returnDamage));
      assert.equal(JSON.stringify(g.state),atStart);h.move(skill);
      const duets=coach.section(),duet=duets.rows.find(r=>r.id==="duet");
      assert.match(duets.title,/duet/);assert.ok(duet.detail.includes("2 beats"));
      assert.match(duets.lastExchange,new RegExp(skill.label));assert.match(duets.lastExchange,new RegExp("for "+f.returnDamage+" damage"));
      assert.match(duets.lastExchange,new RegExp(g.kin(lead).name+" "+g.team().find(k=>k.id===lead).hp+" HP"));
      const restored=station(h.disk);assert.equal(restored.coach.feedback().text,duets.lastExchange);
      h.move(duet);const t=g.trio(),sec=coach.section(),moves=sec.rows.filter(r=>r.id==="trio");
      assert.ok(moves.length>=2);assert.ok(sec.rows.length<=3);
      assert.ok(moves.every(r=>!r.value.startsWith(t.source+"|")&&!r.value.startsWith(t.partner+"|")));
      const chosen=moves.find(r=>r.badge.startsWith(first==="STRIKE"?"ATTACK":"GUARD"));
      const [id,skillId]=chosen.value.split("|"),forecast=t.options.find(o=>o.id===id&&o.skill===skillId);
      const {feedback}=h.move(chosen);assert.ok(feedback.text.includes(forecast.name));
      const end=forecast.finishes?g.firstBattle.read().receipt:g.state.battle.firstBattle.last;
      assert.equal(end.foeHp,forecast.foeHpAfter);assert.equal(end.partyHp[id],forecast.hpAfter);
    }
  });
}
test("legitimate capture, victory, retreat and a wild call carry actual results; a normal Opalclasp has no lesson",()=>{
  const plain=station();plain.g.startBattle("wild","opalclasp");assert.equal(plain.coach.section(),null);assert.equal(plain.coach.before(),null);
  const h=station();h.begin("sprigkit");const g=h.g;g.useSkill("trail-feint");g.useSkill("trail-feint");
  const c=h.coach.section().rows.find(r=>r.id==="capture"),before=g.state.bag.kinweave;
  assert.ok(c.detail.includes(before+" in your satchel"));const caught=h.move(c);
  assert.equal(g.state.bag.kinweave,before-1);assert.match(caught.feedback.text,/Opalclasp joined/);assert.equal(h.coach.section(),null);
  const w=station();w.begin("dewfin");
  while(w.g.state.battle.enemy.hp>w.g.ordinaryForecast("bubble-jet").damage)w.g.useSkill("bubble-jet");
  const tok=w.coach.before({name:"Bubble Jet"}),win=w.g.useSkill("bubble-jet"),recap=w.coach.after(tok,win);
  assert.equal(win.kind,"victory");assert.match(recap.text,/Bubble Jet/);assert.match(recap.text,/Opalclasp 0 HP/);
  const a=station();a.g.state.party.push(a.g.loaner("gustlance",5));a.g.state.team.push("gustlance");a.begin("cindlet");
  a.g.swap("gustlance");const option=a.g.wildCall().options.find(o=>o.actor==="gustlance"&&o.available);
  const answer=a.move({id:"answer-call",value:option.skill+"|"+option.partner,label:option.name});
  assert.match(answer.feedback.text,/Beacon Pass/);assert.equal(a.coach.section(),null);assert.equal(a.coach.feedback().text,answer.feedback.text);
  const leave=a.coach.before(),depart=a.g.flee();assert.match(a.coach.after(leave,depart).text,/Opalclasp/);
});
test("switches, depleted beats and satchel, reduced HP, pending faint and no spare kin never offer an illegal command",()=>{
  const h=station();h.begin("sprigkit");const g=h.g,b=g.state.battle,p=g.team()[0];
  p.hp=1;let sec=h.coach.section();const med=sec.rows.find(r=>r.id==="use-item"),escape=sec.rows.find(r=>r.id==="swap");
  assert.ok(escape&&med);assert.ok(med.detail.includes(g.itemForecast("balm",p.id).activeHpAfter+"/"+p.maxHp));
  g.state.bag.balm=0;g.state.bag.tonic=0;assert.ok(!h.coach.section().rows.some(r=>r.id==="use-item"));
  h.move(escape);assert.equal(b.activeId,escape.value);assert.match(h.coach.feedback().text,new RegExp(g.kin(escape.value).name));
  b.beats=0;sec=h.coach.section();assert.ok(!sec.rows.some(r=>r.id==="duet"||r.id==="trio"));assert.match(sec.text,/Change between/);
  g.team().filter(k=>k.id!==b.activeId).forEach(k=>k.hp=0);b.beats=3;assert.ok(!h.coach.section().rows.some(r=>r.id==="duet"||r.id==="trio"));
  g.state.bag.kinweave=0;b.enemy.hp=1;sec=h.coach.section();
  assert.ok(!sec.rows.some(r=>r.id==="capture"));assert.ok(sec.rows.some(r=>r.detail.includes("win before the reply")));
  b.pendingFallen=p.id;assert.equal(h.coach.section(),null);
});
