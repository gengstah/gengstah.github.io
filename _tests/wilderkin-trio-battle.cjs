const test=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs"),path=require("node:path");
const scripts=["atlas","bestiary","wild-calls","activities","story","campaign","duets","growth","wardens","sparring-gear","trail-fittings","engine",
  "rehearsal-core","trio-battle","rehearsal-ring"].map(n=>new vm.Script(fs.readFileSync(path.join(__dirname,"../games/wilderkin",n+".js"),"utf8"),{filename:n+".js"}));
const rows=m=>m.sections.flatMap(s=>s.rows||[]);
function station(){
  const disk=new Map(),window={localStorage:{getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,v)}},scope=vm.createContext({window});
  scripts.forEach(s=>s.runInContext(scope));
  const g=window.WilderGame,opt={row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),image:id=>"art/"+id+".png"};
  const ui=window.WilderTrioBattle.create(opt),practice=window.WilderRehearsal.create({game:g}),effects=[],notes=[];
  let page="battle",carry=null;
  const ring=window.WilderRehearsalRing.create({...opt,game:g,practice,go:(screen,next)=>{assert.equal(screen,"rehearsal-ring");page=next;},
    render(){},notify:m=>notes.push(m),animate:async fx=>{effects.push(fx);},onTrail:s=>{carry=s;}});
  const model=()=>ring.model(page);
  async function press(id,value){
    const r=rows(model()).find(r=>r.id===id&&(value===undefined||r.value===value)&&!r.disabled);
    assert.ok(r,"Missing "+id+" "+value+" on "+page);ring.act(id,r.value,page);await new Promise(r=>setImmediate(r));
  }
  const move=s=>press("rehearse-move",s),open=p=>press("rehearse-view",p);
  return {g,ui,practice,ring,model,move,open,effects,notes,press,carry:()=>carry};
}
async function finish(h){
  for(let n=0;n<35&&h.practice.read().phase==="battle";n++){
    const g=h.practice.read().game,b=g.state.battle,reserve=g.replacements()?.options[0];
    if(reserve){await h.move("replaceFainted|"+reserve.id);continue;}
    const pick=g.kin(b.activeId,{owned:true}).skills.map(s=>[s.id,g.ordinaryForecast(s.id)]).filter(([,f])=>f?.available)
      .sort((a,b)=>b[1].damage-a[1].damage||a[1].returnDamage-b[1].returnDamage)[0];
    await h.move("useSkill|"+pick[0]);
  }
  assert.equal(h.practice.read().phase,"done");
}
test("fresh trail teaches the duet, then offers only the third companion with actual role, portraits, cost and forecast",()=>{
  const {g,ui}=station();assert.ok(g.startBattle("wild","opalclasp").ok);
  assert.match(ui.entry(g).detail,/next turn, a third/);assert.ok(rows(ui.model(g)).some(r=>r.value==="duets"));
  g.useSkill("brush-dash");assert.ok(g.useDuet("cindlet").ok);
  const t=g.trio(),page=ui.model(g),options=rows(page).filter(r=>r.id==="trio");
  assert.match(page.subtitle,/Sprigkit and Cindlet used Firebreak/);assert.match(page.kicker,/0 BEATS/);
  assert.deepEqual([...new Set(options.map(r=>r.value.split("|")[0]))],["dewfin"]);
  assert.ok(options.some(r=>r.disabled));assert.equal(ui.entry(g).tone,"primary");
  const q=t.options.find(o=>o.role==="guard"&&o.available),button=options.find(r=>r.value===q.id+"|"+q.skill);
  assert.ok(button.image.endsWith("/dewfin.png"));assert.match(button.detail,new RegExp("Deal "+q.damage+" damage"));
  assert.ok(button.detail.includes(q.kinName+" "+q.hpAfter+"/"+q.maxHp+" HP"));assert.ok(button.detail.includes("take "+q.returnDamage+" in reply"));
  const c=ui.choice(g,button.value),fx=ui.effect(g,c);
  assert.equal(fx.source,"art/sprigkit.png");assert.equal(fx.partner,"art/cindlet.png");assert.equal(fx.incomingKin.src,button.image);
  assert.equal(fx.role,"guard");assert.equal(fx.skillName,q.name);assert.ok(fx.announce.includes(q.name));
  assert.equal(ui.choice(g,"sprigkit|brush-dash"),null);assert.equal(ui.choice(g,button.value+"|extra"),null);
  assert.ok(g.useTrio(c.id,c.skillId).ok);assert.equal(g.state.battle.activeId,"dewfin");
  assert.equal(g.state.battle.enemy.hp,q.foeHpAfter);assert.equal(g.team().find(k=>k.id==="dewfin").hp,q.hpAfter);
  assert.equal(ui.entry(g),null);assert.equal(ui.choice(g,button.value),null);
});
test("trio teaching is confined to an ordinary encounter with three standing companions",()=>{
  const {g,ui}=station();assert.equal(ui.entry(g),null);
  g.startBattle("wild","mossbell");const b=g.state.battle;
  for(const kind of ["circuit","stillwake"]){b.kind=kind;assert.equal(ui.entry(g),null);}
  b.kind="warden";b.secondBell={};assert.equal(ui.entry(g),null);delete b.secondBell;
  b.kind="wild";b.wildCall={answered:true};assert.equal(ui.entry(g),null);delete b.wildCall;
  g.team().at(-1).hp=0;assert.equal(ui.entry(g),null);
});
test("a relay duet retains both original performers and offers the eligible third with its actual portrait",()=>{
  const {g,ui}=station();assert.ok(g.setLead("cindlet").ok);g.startBattle("wild","opalclasp");
  const guard=g.kin("cindlet").skills.find(s=>s.kind==="guard");g.useSkill(guard.id);assert.ok(g.useDuet("dewfin").ok);
  assert.equal(g.state.battle.activeId,"dewfin");
  const m=ui.model(g);assert.match(m.subtitle,/Cindlet and Dewfin used Steam Exchange/);
  const c=ui.choices(g).find(o=>o.available);assert.equal(c.id,"sprigkit");
  const e=ui.effect(g,c);assert.equal(e.source,"art/cindlet.png");assert.equal(e.partner,"art/dewfin.png");
  assert.equal(e.incomingKin.src,"art/sprigkit.png");
});
test("manual rehearsal can rewind the trio and change its real skill; the revised choice appears in comparison, film and field guidance",async()=>{
  const h=station(),original=JSON.stringify(h.g.state);
  assert.ok(h.practice.start({kind:"wild",region:0,foe:"opalclasp",lead:"sprigkit"}).ok);
  assert.ok(h.ring.key({key:"t"},"battle"));assert.equal(h.model().title,"Trail trios");
  await h.open("duets");await h.open("battle");await h.move("useSkill|brush-dash");await h.open("duets");await h.move("useDuet|cindlet");
  const g=h.practice.read().game,turn=g.state.battle.turn,before=JSON.stringify(g.state);
  assert.equal(h.model().sections[0].rows[0].value,"trios");await h.open("trios");
  const options=g.trio().options;
  const attack=options.find(o=>o.available&&o.role==="attack"),guard=options.find(o=>o.available&&o.role==="guard");
  await h.move("useTrio|dewfin|"+attack.skill);assert.equal(h.effects.find(f=>f.kind==="trio").role,"attack");
  assert.ok(h.notes.length===0);await h.press("rehearse-rewind");
  assert.equal(JSON.stringify(g.state),before);assert.equal(g.state.battle.turn,turn);
  await h.open("trios");await h.move("useTrio|dewfin|"+guard.skill);
  const compared=rows(h.model()).filter(r=>r.label.startsWith("Previous ·")||r.label.startsWith("Revised ·"));
  assert.deepEqual(Array.from(compared,r=>r.label),["Previous · Dewfin · "+attack.name,"Revised · Dewfin · "+guard.name]);
  assert.notEqual(compared[0].detail,compared[1].detail);
  await finish(h);await h.open("log");assert.ok(rows(h.model()).some(r=>r.label.includes("Dewfin · "+guard.name)));
  await h.open("battle");await h.press("rehearse-trail");
  const note=h.carry().tested.turns.at(-1);assert.equal(note.method,"useTrio");assert.deepEqual(Array.from(note.args),["dewfin",guard.skill]);
  assert.equal(JSON.stringify(h.g.state),original);
});
test("a turn-four trio from the main guidance shelf survives completion and records at most one extra field-card turn",async()=>{
  const h=station();h.practice.start({kind:"wild",region:0,foe:"opalclasp",lead:"sprigkit"});
  await h.move("useSkill|brush-dash");await h.move("useSkill|brush-dash");await h.open("duets");await h.move("useDuet|cindlet");
  const g=h.practice.read().game,option=g.trio().options.find(o=>o.available&&o.role==="guard");
  assert.equal(g.state.battle.turn,4);assert.ok(h.ring.act("rehearse-move","useTrio|"+option.id+"|"+option.skill,"battle"));
  await new Promise(resolve=>setImmediate(resolve));await finish(h);await h.press("rehearse-trail");
  assert.deepEqual(Array.from(h.carry().tested.turns,v=>v.method),["useSkill","useSkill","useDuet","useTrio"]);
});
