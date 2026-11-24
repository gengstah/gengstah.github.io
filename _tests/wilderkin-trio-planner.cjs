const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const scripts=["atlas","bestiary","activities","campaign","story","duets","growth","wardens","sparring-gear","trail-fittings","fitting-notes","wild-calls","third-beat","engine","rehearsal-core","trio-planner"].map(id=>{
  const filename=path.join(__dirname,"../games/wilderkin",id+".js");return new vm.Script(fs.readFileSync(filename,"utf8"),{filename});
});
const plain=value=>JSON.parse(JSON.stringify(value));
function device(){
  const disk=new Map(),window={localStorage:{getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,v)}},ctx=vm.createContext({window});
  scripts.forEach(s=>s.runInContext(ctx));const game=window.WilderGame,practice=window.WilderRehearsal.create({game});
  let view=null,started=null,scopeCount=0;
  const planner=window.WilderTrioPlanner.create({game,practice:{...practice,preview(o){scopeCount++;return practice.preview(o);}},
    row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),image:(id,owned)=>id+(owned?"-owned":""),
    go:(name,v)=>{assert.equal(name,"trio-planner");view=v;},notify(){},
    start:(o,l)=>{started=l;planner.setGuide(l);return practice.start(o);}});
  const model=()=>planner.model(view),rows=()=>model().sections.flatMap(s=>s.rows||[]);
  function click(id,value){const r=rows().find(r=>r.id==="trio-"+id&&(value===undefined||r.value===value));
    assert.ok(r&&!r.disabled,[id,value,view,JSON.stringify(rows())].join(" / "));assert.ok(planner.act(r.id,r.value,view));}
  function grant(id,level=5){if(game.state.party.some(k=>k.id===id))return;game.state.party.push(game.loaner(id,level));}
  return {game,window,practice,planner,view:()=>view,model,rows,click,grant,count:()=>scopeCount,started:()=>started,disk,
    lines:(d,p,f)=>window.WilderTrioPlanner.lines(practice,d,p,f)};
}
test("fresh starter team has both an offensive and protective handoff; each native decision exactly reproduces the advertised finish",()=>{
  const h=device(),before=JSON.stringify(h.game.state);
  h.planner.open();assert.equal(h.planner.current().foe,"opalclasp");assert.equal(h.model().formationStrip.slots.length,3);
  for(const [skill,damage,health,foeHp] of [["bubble-jet",9,17,4],["slick-slide",7,24,6]]){
    h.click("line",skill);assert.ok(h.model().sections.some(s=>s.rows.some(r=>r.label==="Firebreak")));
    h.click("play",skill);const line=h.started(),run=h.practice.read();
    assert.equal(run.game.state.battle.activeId,"sprigkit");assert.equal(line.steps.length,3);
    assert.equal(line.damage,damage);assert.equal(line.hpAfter,health);assert.equal(line.foeHp,foeHp);
    for(const s of line.steps){
      const scope=h.practice.read().game;assert.equal(scope.state.battle.turn,s.turn);
      assert.equal(h.planner.guidance(h.practice.read()).rows[0].value,s.value);
      if(s.method==="useTrio"){
        const forecast=scope.trio().options.find(o=>o.skill===skill&&o.id==="dewfin");
        assert.equal(forecast.damage,damage);assert.equal(forecast.hpAfter,health);assert.equal(forecast.foeHpAfter,foeHp);
      }
      assert.ok(h.practice.act(s.method,...s.args).ok);
    }
    const after=h.practice.read().game;
    assert.equal(after.state.battle.activeId,"dewfin");assert.equal(after.state.battle.enemy.hp,foeHp);
    assert.equal(after.team().find(p=>p.id==="dewfin").hp,health);assert.match(h.planner.guidance(h.practice.read()).title,/completed/);
    assert.ok(h.practice.rewind().ok);const other=skill==="slick-slide"?"bubble-jet":"slick-slide";
    assert.ok(h.practice.act("useTrio","dewfin",other).ok);assert.match(h.planner.guidance(h.practice.read()).title,/Alternate/);
    h.practice.leave();h.click("home");
  }
  assert.equal(JSON.stringify(h.game.state),before);assert.equal(h.disk.size,0);
});
test("a favorite can trade roles, bring an owned reserve to a partial team, and explicitly replace a seat on a full team",()=>{
  const h=device(),s=h.game.state;for(const id of ["mossbell","gustlance","pincoil","opalclasp"])h.grant(id);
  h.planner.open({lead:"dewfin"});h.click("role","lead");h.click("choose","cindlet");
  assert.equal(h.planner.current().lead,"cindlet");assert.equal(new Set(["lead","partner","finisher"].map(k=>h.planner.current()[k])).size,3);
  h.click("role","finisher");h.click("choose","mossbell");
  assert.equal(h.planner.current().finisher,"mossbell");assert.deepEqual(plain(h.planner.current().team),["sprigkit","cindlet","dewfin","mossbell"]);
  assert.deepEqual(plain(s.team),["sprigkit","cindlet","dewfin"]);
  s.team.push("mossbell","gustlance","pincoil");const before=JSON.stringify(s);
  h.planner.open({lead:"opalclasp"});assert.equal(h.view(),"slot");assert.match(h.model().title,/Opalclasp/);assert.equal(h.rows().filter(r=>r.id==="trio-slot").length,6);
  h.click("cancel");assert.deepEqual(plain(h.planner.current().team),plain(s.team));
  h.planner.reset({lead:"opalclasp"});assert.match(h.model().title,/Make room/);
  h.click("slot","mossbell");assert.deepEqual(plain(h.planner.current().team),["sprigkit","cindlet","dewfin","opalclasp","gustlance","pincoil"]);
  assert.equal(h.planner.current().lead,"opalclasp");assert.equal(JSON.stringify(s),before);
});
test("the partner and third pickers compare only one page of the actual catalog, cache repeat views and search including later reserves",()=>{
  const h=device();for(const id of Object.keys(h.game.species))h.grant(id);
  const before=JSON.stringify(h.game.state);h.planner.open({lead:"dewfin"});h.click("role","partner");const initial=h.count();
  const compared=h.rows().filter(r=>r.id==="trio-choose");assert.equal(compared.length,4);
  assert.ok(compared.some(r=>r.detail.includes("Rain Garden (2 beats)")&&r.detail.includes("damage")));
  const after=h.count();assert.ok(after-initial<=4);h.model();h.model();assert.equal(after,h.count());
  h.window.prompt=()=>"gustlance";h.click("search");assert.equal(h.rows().filter(r=>r.id==="trio-choose").length,1);
  h.click("choose","gustlance");assert.equal(h.planner.current().partner,"gustlance");
  h.click("role","finisher");h.window.prompt=()=>"mossbell";h.click("search");assert.match(h.rows().find(r=>r.id==="trio-choose").detail,/Sail Change/);
  h.click("choose","mossbell");assert.equal(h.planner.current().finisher,"mossbell");assert.equal(JSON.stringify(h.game.state),before);
});
test("only public campaign targets are offered, a Warden rehearsal launches its real lineup, and an impossible KO window offers other targets",()=>{
  const h=device(),s=h.game.state;s.met.push(0);const w=h.practice.targets().find(t=>t.kind==="warden");
  h.planner.open();h.click("targets");h.click("target",[0,"warden",w.foe].join("|"));
  const d=h.planner.current();assert.equal(d.kind,"warden");const scope=h.practice.preview(d);
  assert.deepEqual(plain([scope.state.battle.enemy.id,...scope.state.battle.remaining]),plain(w.roster));
  const first=h.rows().find(r=>r.id==="trio-line");assert.ok(first);h.click("line",first.value);h.click("play",first.value);
  assert.deepEqual(plain([h.practice.read().game.state.battle.enemy.id,...h.practice.read().game.state.battle.remaining]),plain(w.roster));
  s.party.forEach(k=>{Object.assign(k,h.game.loaner(k.id,60));});h.planner.open({kind:"wild",foe:"gustlance"});
  assert.equal(h.rows().filter(r=>r.id==="trio-line").length,0);assert.ok(h.rows().some(r=>r.id==="trio-targets"));
});
test("deep-linked full-team favorite retains its name until seated, and a foreign save change safely discards vanished ownership",()=>{
  const h=device(),s=h.game.state;for(const id of ["mossbell","gustlance","pincoil","opalclasp"])h.grant(id);
  s.team.push("mossbell","gustlance","pincoil");h.planner.reset({lead:"opalclasp"});
  assert.equal(h.planner.current().requestedLead,"opalclasp");assert.match(h.model().title,/Opalclasp/);
  h.click("slot","pincoil");assert.equal(h.planner.current().lead,"opalclasp");assert.equal(h.planner.current().requestedLead,undefined);
  s.party=s.party.filter(p=>p.id!=="opalclasp");h.model();assert.equal(h.planner.current().lead,s.lead);assert.deepEqual(plain(h.planner.current().team),plain(s.team));
});
test("the veteran opponent board pages and searches by region, opponent and Warden while preserving the favorite",()=>{
  const h=device(),s=h.game.state;
  s.visited=h.game.regions.map((_,i)=>i);s.met=s.visited.slice();s.crests=s.visited.filter(i=>h.game.regions[i].warden);
  h.planner.open({lead:"cindlet"});h.click("targets");assert.equal(h.rows().filter(r=>r.id==="trio-target").length,6);
  h.click("target-page",1);assert.equal(h.rows().filter(r=>r.id==="trio-target").length,6);
  const region=s.crests.at(-1),w=h.practice.targets(region).find(t=>t.kind==="warden");
  h.window.prompt=()=>h.game.regions[region].name;h.click("target-search");h.click("target",[region,"warden",w.foe].join("|"));
  assert.equal(h.planner.current().foe,w.foe);assert.equal(h.planner.current().region,region);assert.equal(h.planner.current().lead,"cindlet");
});
