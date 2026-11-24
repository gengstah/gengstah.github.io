const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const files=["atlas","bestiary","call-habitats","wild-calls","activities","story","campaign","duets","fieldwork",
  "growth","wardens","second-bell","sparring-gear","trail-fittings","fitting-notes","caravans","engine","rehearsal-core","field-card","world"];
const scripts=files.map(id=>new vm.Script(fs.readFileSync(path.join(__dirname,"../games/wilderkin/"+id+".js"),"utf8"),{filename:id+".js"}));
const sessionKey="wilderkin.field-card.v1",careerKey="wilderkin.trail.v3";
const copy=x=>JSON.parse(JSON.stringify(x));
const yes=r=>{assert.equal(r?.ok,true,r?.message);return r;};
const rows=m=>(m?.sections||[]).flatMap(s=>s.rows||[]);
const storage=map=>({getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)});
function boot(local=new Map(),session=new Map()){
  const noop=()=>{},document={createElement(){const node={};node.getContext=()=>({canvas:node,drawImage:noop,fillRect:noop,
    putImageData:noop,createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),beginPath:noop,lineTo:noop,moveTo:noop,stroke:noop});return node;}};
  const w={localStorage:storage(local),sessionStorage:storage(session)},ctx=vm.createContext({window:w,document});
  scripts.forEach(s=>s.runInContext(ctx));
  const game=w.WilderGame,invocations=[];
  let card;
  const api={game,row:(id,label,value,detail="",extra={})=>({id,label,value,detail,...extra}),image:id=>id+".png",
    go:(...a)=>invocations.push(["go",...a]),notify:s=>invocations.push(["notify",s]),review:s=>invocations.push(["review",s]),
    travel:(region,back)=>{invocations.push(["travel",region,back]);return game.travel(region);},
    locate:(site,back)=>invocations.push(["locate",site,back]),
    fight:(kind,track,fromCard)=>{invocations.push(["fight",kind,track,fromCard]);const res=game.startBattle(kind,track);
      if(res.ok&&res.kind==="battle"&&fromCard)card.bind();return res;}};
  card=w.WilderFieldCard.create(api);
  const setup=(changes={})=>({kind:"wild",region:game.state.region,foe:"mossbell",team:Array.from(game.state.team),lead:game.state.lead,...changes});
  function at(kind){
    const site=w.WilderWorld.regions[game.state.region].sites.find(s=>(s.kind||s.id)===kind);
    assert.ok(game.setPosition(site.x,site.y));assert.ok(game.visitSite(kind));
  }
  return {w,game,card,local,session,invocations,setup,at};
}
function hp(g,id){return g.state.party.find(p=>p.id===id).hp;}
function stage(h,actions){
  const yard=h.w.WilderRehearsal.create({game:h.game}),setup=h.setup(),turns=[];
  yes(yard.start(setup));
  for(const [method,...args] of actions){
    const scope=yard.read().game,b=scope.state.battle,actor=b.activeId,foe=b.enemy,old=hp(scope,actor),enemyHp=foe.hp;
    const turn=b.turn;yes(yard.act(method,...args));const record=yard.read().history.at(-1);
    turns.push({turn,activeId:actor,foe:foe.id,method,args,label:record.label,
      actual:scope.kin(actor,{owned:true}).name+" "+old+" → "+hp(scope,actor)+" HP · "+scope.kin(foe.id).name+" "+enemyHp+" → "+foe.hp+" HP"});
  }
  // Preserve the opening on the card only after a real rehearsal has finished.
  for(let i=0;yard.read().phase==="battle"&&i<100;i++){
    const scope=yard.read().game,choice=scope.replacements();
    if(choice){yes(yard.act("replaceFainted",choice.defaultId));continue;}
    const skills=scope.kin(scope.state.battle.activeId,{owned:true}).skills.filter(s=>!s.trained&&["attack","guard"].includes(s.kind));
    const best=skills.map(s=>({s,p:scope.ordinaryForecast(s.id)})).filter(o=>o.p.available).sort((a,b)=>b.p.damage-a.p.damage)[0];
    yes(yard.act("useSkill",best.s.id));
  }
  const final=yard.read();assert.equal(final.phase,"done");
  return {...setup,tested:{result:final.result.kind,members:copy(final.game.team()),turns}};
}
function doMove(h,method,args,label){
  const mark=h.card.before(label);assert.ok(mark,"card is bound to this encounter");
  const res=h.game[method](...args);h.card.after(mark,res);return res;
}
function injure(h,id){
  yes(h.game.setLead(id));yes(h.game.startBattle("wild","mossbell"));
  for(let i=0;i<2;i++)yes(h.game.useSkill("trail-feint"));
  yes(h.game.flee());yes(h.game.setLead("sprigkit"));
}
function launch(h,plan){
  assert.ok(h.card.keep(plan));h.at("wild");
  assert.ok(rows(h.card.model()).some(r=>r.id==="card-battle"&&!r.disabled));
  h.card.act("card-battle");assert.ok(h.game.state.battle);
}

test("cards publish only owned ordered teams at visited habitats and use native trail/lodge entry",()=>{
  const h=boot(),g=h.game,c=h.card,s=h.setup();
  const untouched=JSON.stringify(g.state);
  assert.equal(c.tag(s),"0/wild/mossbell/sprigkit/sprigkit+cindlet+dewfin");
  assert.deepEqual(copy(c.decode(c.tag(s).split("/"))),s);
  for(const bad of [{...s,team:["nope"]},{...s,lead:"gustlance"},{...s,team:["sprigkit","sprigkit"]},{...s,region:1},{...s,foe:"coalmoth"}]){
    assert.equal(c.keep(bad),false);assert.equal(c.tag(bad),"");
  }
  c.open(s);assert.deepEqual(h.invocations.at(-1),["go","field-card",null,"root"]);
  c.act("card-battle");assert.equal(g.state.battle,null);assert.equal(JSON.stringify(g.state),untouched);
  assert.ok(rows(c.model()).some(r=>r.id==="card-walk"));c.act("card-walk");assert.equal(h.invocations.at(-1)[1],"wild");
  const other=h.setup({lead:"dewfin"});c.open(other);assert.ok(rows(c.model()).some(r=>r.id==="card-review"));
  c.act("card-battle");assert.equal(g.state.battle,null);
  const warden=h.setup({kind:"warden",foe:g.wardenRoster(0)[0]});
  assert.equal(c.keep(warden),false);h.at("warden");yes(g.meetWarden());assert.ok(c.keep(warden));
  assert.equal(g.trialAccess().open,false);assert.ok(rows(c.model()).some(r=>r.id==="nav"&&r.value==="warden"));
  c.act("card-battle");assert.equal(g.state.battle,null);
});

test("a bound guide uses the live swap, medicine, gear and health forecasts and the actual first three exchanges survive reload",()=>{
  let h=boot();injure(h,"cindlet");const planned=stage(h,[["swap","cindlet"],["swap","sprigkit"],["useItem","balm","cindlet"]]);
  launch(h,planned);const steps=planned.tested.turns;
  for(let i=0;i<steps.length;i++){
    const g=h.game,s=steps[i],guide=h.card.guide(),button=guide?.rows?.[0];assert.ok(button);
    assert.ok(guide.text.includes(s.actual));
    assert.equal(button.disabled,false);
    const live=i<2?g.switchForecast(s.args[0]):g.itemForecast(...s.args);
    assert.equal(button.id,i<2?"swap":"use-item");assert.equal(button.value,i<2?s.args[0]:"balm|cindlet");
    const before=i<2?0:hp(g,"cindlet");
    if(i===2){assert.equal(live.gain>2,true);assert.ok(button.detail.includes(String(live.gain)));assert.ok(button.detail.includes(String(live.activeHpAfter)));}
    yes(doMove(h,s.method,s.args,s.label));
    if(i<2)assert.equal(hp(g,s.args[0]),live.hpAfter);
    else assert.equal(hp(g,"cindlet"),before+live.gain);
    if(i===0){
      const old=h;h=boot(old.local,old.session);h.card.restore();assert.equal(h.game.state.battle.turn,2);
      assert.equal(h.card.current().foe,"mossbell");assert.equal(h.card.guide().rows[0].value,"sprigkit");
    }
  }
  assert.equal(h.card.guide(),null);const stock=h.game.state.bag.balm;
  yes(doMove(h,"flee",[],"Return to the trail"));
  assert.equal(h.game.state.bag.balm,stock);
  const summary=h.card.resultSection();assert.equal(summary.rows.length,3);
  assert.match(summary.rows[2].detail,/Cindlet.*HP/);assert.ok(summary.rows[2].detail.includes(steps[2].actual));
  assert.doesNotThrow(()=>h.card.refreshBinding());
});

test("invalid turns do not consume a guide and an ordinary winning strike earns real XP while practice HP stays comparison-only",()=>{
  const h=boot(),g=h.game;yes(g.setLead("cindlet"));
  g.team().find(p=>p.id==="cindlet").xp=g.xpNeeded(5)-1;
  const planned=stage(h,[["useSkill","ember-pop"],["useSkill","ember-pop"]]);
  launch(h,planned);
  const first=h.card.guide().rows[0],oldBag=JSON.stringify(g.state.bag),oldWins=g.state.wins,oldLevel=g.team().find(p=>p.id==="cindlet").level;
  assert.equal(first.id,"skill");assert.equal(first.value,"ember-pop");
  const expected=g.ordinaryForecast(first.value);assert.ok(first.detail.includes(String(expected.damage)));
  assert.equal(doMove(h,"useSkill",["unknown"],"Unavailable move").ok,false);assert.equal(h.card.guide().rows[0].value,first.value);
  let finishingHP;
  for(let i=0;g.state.battle&&i<10;i++){finishingHP=hp(g,"cindlet");yes(doMove(h,"useSkill",["ember-pop"],"Ember Pop"));}
  assert.equal(g.state.wins,oldWins+1);assert.equal(g.team().find(p=>p.id==="cindlet").level,oldLevel+1);assert.equal(hp(g,"cindlet"),finishingHP+3);assert.equal(JSON.stringify(g.state.bag),oldBag);
  const summary=h.card.resultSection();assert.ok(summary.rows.length<=3);
  assert.match(summary.rows[0].detail,/Practice|practice/);assert.ok(!JSON.stringify(summary).includes("Unavailable move"));assert.match(summary.rows.at(-1).detail,/→ 0 HP/);assert.ok(summary.rows.at(-1).detail.includes("Cindlet "+finishingHP+" → "+finishingHP+" HP"));
  // Starting an independent real encounter must never surface the earlier card.
  yes(g.startBattle("wild","gustlance"));assert.equal(h.card.guide(),null);assert.equal(h.card.before("ordinary strike"),null);
  assert.equal(h.card.resultSection(),null);h.card.unbind();yes(g.flee());assert.equal(h.card.resultSection(),null);
});

test("a paid action that loses the last kin reports its knockout even though the actual campaign restores trailhead HP",()=>{
  const h=boot(),g=h.game;
  g.state.team=["sprigkit"];g.state.party[0].hp=1;
  const planned=stage(h,[["useSkill","brush-dash"]]);
  launch(h,planned);const loss=yes(doMove(h,"useSkill",["brush-dash"],"Brush Dash"));
  assert.equal(loss.kind,"defeat");assert.equal(g.state.battle,null);assert.equal(hp(g,"sprigkit"),g.state.party[0].maxHp);
  assert.match(h.card.resultSection().rows[0].detail,/Sprigkit 1 → 0 HP/);
});

test("corrupt local session fragments, incompatible actor/foe IDs and malformed hashes cannot produce a spurious guide or crash menus",()=>{
  const h=boot(),s=h.setup(),parts=h.card.tag(s).split("/");
  for(const argument of [null,{},[],parts.slice(0,4),[...parts,""],["00",...parts.slice(1)],["0","wild","mossbell","sprigkit",null],
    ["0","wild","mossbell","sprigkit","sprigkit+sprigkit"],["0","wild","mossbell","sprigkit","sprigkit+__proto__"]]){
    assert.equal(h.card.decode(argument),null);
  }
  for(const bad of [{turns:"not an array"},{turns:[null]},{turns:[{turn:1,activeId:"missing",foe:"bad",label:"untrusted",args:[]}]},
    {turns:[{turn:1,activeId:"sprigkit",foe:"mossbell",method:"swap",label:"broken",args:["__proto__"]}]}]){
    const session=new Map([[sessionKey,JSON.stringify({plan:{...s,tested:{result:"victory",members:copy(h.game.team()),...bad}},record:{result:"victory",turns:"bad"}})]]),k=boot(new Map(),session);
    k.card.restore();assert.doesNotThrow(()=>k.card.model());assert.ok(!k.card.resultSection());
    const fresh=k.card.decode(parts);assert.ok(fresh);assert.equal(fresh.tested?.turns?.length||0,0);
  }
});

test("a free faint replacement and reload preserve the paid turn and guide, even after a different companion takes the lead",()=>{
  let h=boot();h.game.state.party[0].hp=1;
  const planned=stage(h,[["useSkill","brush-dash"],["useSkill","brush-dash"]]);launch(h,planned);
  yes(doMove(h,"useSkill",["brush-dash"],"Brush Dash"));assert.ok(h.game.replacements());
  assert.equal(h.game.state.battle.turn,2);
  yes(h.game.replaceFainted("dewfin"));h.card.refreshBinding();
  h=boot(h.local,h.session);h.card.restore();
  assert.equal(h.game.state.battle.activeId,"dewfin");assert.equal(h.game.state.battle.turn,2);
  const guidance=h.card.guide();
  assert.ok(guidance);assert.equal(guidance.rows?.length||0,0);assert.match(guidance.text,/Sprigkit/);
  yes(doMove(h,"useSkill",["bubble-jet"],"Bubble Jet"));yes(doMove(h,"flee",[],"Call the party back"));
  const recap=h.card.resultSection();
  assert.equal(recap.rows[1].label,"Turn 2 · Bubble Jet");assert.match(recap.rows[1].detail,/Practice · Brush Dash/);
});

function catchLocal(h,id){
  yes(h.game.startBattle("wild",id));
  while(!h.game.captureStatus().available)yes(h.game.useSkill("trail-feint"));
  yes(h.game.recruit());
}

test("a practiced family pass is offered with its actual reserve and hands off the marked foe at the campaign forecast",()=>{
  const h=boot(),g=h.game;catchLocal(h,"gustlance");yes(g.setLead("gustlance"));
  const draft=stage(h,[["useFamilyTechnique","cindlet"]]);launch(h,draft);
  const guide=h.card.guide(),button=guide?.rows?.[0];assert.ok(button);
  assert.equal(button.id,"family-pass");assert.equal(button.value,"cindlet");assert.equal(button.disabled,false);
  const target=g.familyTechnique().targets.find(t=>t.id==="cindlet");
  yes(doMove(h,"useFamilyTechnique",["cindlet"],"Beacon Pass"));
  assert.equal(g.state.battle.activeId,"cindlet");assert.equal(hp(g,"cindlet"),target.hpAfter);assert.ok(g.state.battle.enemy.beaconMarked);
});

test("a practiced Banked Warmth can target an injured reserve but disables itself if alternate field moves keep that reserve safe",()=>{
  function encounter(){
    const h=boot(),g=h.game;catchLocal(h,"charquill");yes(g.setLead("charquill"));
    const draft=stage(h,[["swap","dewfin"],["swap","charquill"],["useEmberTechnique","dewfin"]]);launch(h,draft);
    return h;
  }
  const h=encounter(),g=h.game;
  yes(doMove(h,"swap",["dewfin"],"Send Dewfin"));yes(doMove(h,"swap",["charquill"],"Send Charquill"));
  const live=g.emberTechnique(),target=live.targets.find(t=>t.id==="dewfin");
  assert.ok(target.available);const before=hp(g,"dewfin"),button=h.card.guide()?.rows?.[0];assert.ok(button);
  assert.equal(button.id,"ember-technique");assert.equal(button.value,"dewfin");assert.equal(button.disabled,false);
  yes(doMove(h,"useEmberTechnique",["dewfin"],"Banked Warmth"));assert.equal(hp(g,"dewfin"),before+target.heal);
  const other=encounter();const guard=other.game.kin("charquill",{owned:true}).skills.find(m=>m.kind==="guard").id;
  for(let i=0;i<2;i++)yes(doMove(other,"useSkill",[guard],"Hold the front"));
  assert.equal(other.game.state.battle.turn,3);const blocked=other.card.guide();
  assert.ok(!blocked.rows?.length||blocked.rows[0].disabled);
});

test("the opening calls a native duet and a targetless Backdraft through their separate campaign controls",()=>{
  const a=boot();
  const paired=stage(a,[["useSkill","brush-dash"],["useDuet","dewfin"]]);launch(a,paired);
  yes(doMove(a,"useSkill",["brush-dash"],"Brush Dash"));
  const duet=a.card.guide().rows[0],pair=a.game.duets().options.find(o=>o.partnerId==="dewfin");
  assert.equal(duet.id,"duet");assert.equal(duet.value,"dewfin");assert.equal(duet.disabled,false);
  assert.equal(duet.detail,pair.preview);yes(doMove(a,"useDuet",["dewfin"],pair.name));

  const h=boot(),g=h.game;
  // Model a career with Fern's crest and a previous Cinderfall visit. The new bird is caught through native
  // Cinderfall combat and brings its actual species move back to Mossbrook.
  g.state.crests=[0];g.state.visited.push(1);yes(g.travel(1));catchLocal(h,"kilnbeak");yes(g.travel(0));yes(g.setLead("kilnbeak"));
  const practice=stage(h,[["useSkill","trail-feint"],["useEmberTechnique"]]);launch(h,practice);
  yes(doMove(h,"useSkill",["trail-feint"],"Hold Back"));const button=h.card.guide().rows[0],forecast=g.emberTechnique();
  assert.equal(button.id,"ember-technique");assert.equal(button.value,null);assert.equal(button.disabled,false);assert.ok(forecast.healing>0);
  const prior=hp(g,"kilnbeak"),enemyHP=g.state.battle.enemy.hp;
  yes(doMove(h,"useEmberTechnique",[],"Backdraft"));
  assert.equal(hp(g,"kilnbeak"),prior+forecast.healing-forecast.returnDamage);
  assert.equal(g.state.battle.enemy.hp,enemyHP-forecast.damage);
});

test("a valid signature copied alongside the wrong local quarry cannot attach a field card to an unrelated battle",()=>{
  const h=boot(),planned=stage(h,[["useSkill","brush-dash"]]);launch(h,planned);
  const corrupt=JSON.parse(h.session.get(sessionKey));
  // The record is authentic to Mossbell, but the description identifies Gustlance.
  corrupt.plan.foe="gustlance";h.session.set(sessionKey,JSON.stringify(corrupt));
  const other=boot(h.local,h.session);other.card.restore();assert.equal(other.game.state.battle.enemy.id,"mossbell");
  assert.equal(other.card.guide(),null);assert.equal(other.card.before("Brush Dash"),null);
});

test("the fourth paid decision survives reload when it completes the rehearsed trio",()=>{
  const h=boot(),actions=[["useSkill","brush-dash"],["useSkill","sun-nap"],["useDuet","cindlet"],["useTrio","dewfin","slick-slide"]];
  const plan=stage(h,actions);launch(h,plan);assert.equal(h.card.current().tested.turns.length,4);
  for(const [i,[method,...args]] of actions.slice(0,3).entries()){
    yes(doMove(h,method,args,plan.tested.turns[i].label));
  }
  const next=boot(h.local,h.session);next.card.restore();
  const button=next.card.guide().rows[0];
  assert.equal(button.id,"trio");assert.equal(button.value,"dewfin|slick-slide");
  yes(doMove(next,"useTrio",["dewfin","slick-slide"],"Dewfin · Slick Slide"));
  if(next.game.state.battle)yes(doMove(next,"flee",[],"Retreat"));
  const cold=boot(next.local,next.session);cold.card.restore();
  const recap=cold.card.resultSection().rows;assert.equal(recap.length,4);
  assert.equal(recap[3].label,"Turn 4 · Dewfin · Slick Slide");assert.ok(recap[3].detail.includes(plan.tested.turns[3].actual));
  const extra=copy(plan);extra.tested.turns[3]={...plan.tested.turns[2],turn:4};
  assert.ok(cold.card.keep(extra));assert.equal(cold.card.current().tested.turns.length,3);
});
