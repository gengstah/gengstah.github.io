const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const scripts=["atlas","bestiary","activities","campaign","story","duets","growth","wardens","sparring-gear","trail-fittings","fitting-notes","wild-calls","engine","rehearsal-core","trail-matchups"].map(n=>{
  const filename=path.join(__dirname,"../games/wilderkin",n+".js");return new vm.Script(fs.readFileSync(filename,"utf8"),{filename});
});
const plain=x=>JSON.parse(JSON.stringify(x));
function device(){
  const map=new Map(),window={localStorage:{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}},ctx=vm.createContext({window});
  scripts.forEach(script=>script.runInContext(ctx));const game=window.WilderGame,practice=window.WilderRehearsal.create({game});
  let view=null,start=null,duet=null,lookups=0;
  const finder=window.WilderTrailMatchups.create({game,practice:{...practice,preview:o=>{lookups++;return practice.preview(o);}},
    row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),image:(id,owned)=>id+"-"+(owned?"owned":"wild"),
    play:o=>{start=plain(o);return practice.start(o);},openDuets:o=>{duet=plain(o);},go:(route,v)=>{assert.equal(route,"trail-matchups");view=v;},notify(){},render(){}});
  const model=()=>finder.model(view),rows=()=>model().sections.flatMap(s=>s.rows||[]);
  const click=(id,val)=>{const r=rows().find(r=>r.id==="matchup-"+id&&(val===undefined||r.value===val));
    assert.ok(r&&!r.disabled,[view,id,val,JSON.stringify(rows())].join(" / "));assert.ok(finder.act(r.id,r.value,view));};
  const grant=(id,level=5)=>{const k=game.species[id],maxHp=k.baseHp+(level-5)*3;game.state.party.push({id,hp:1,maxHp,level,xp:7});};
  return {finder,game,practice,model,rows,click,grant,map,view:()=>view,started:()=>start,duet:()=>duet,lookups:()=>lookups};
}
test("each ordinary move, including a stronger guard, and charged defensive check agree with two independent real camp projections",()=>{
  const h=device(),s=h.game.state,save=JSON.stringify(s);
  const d=h.finder.report({kind:"wild",foe:"mossbell",anchor:"dewfin"});
  assert.equal(d.members.length,3);assert.equal(d.active.move.id,"slick-slide");assert.equal(d.best.id,"cindlet");
  for(const member of d.members){
    const o={kind:"wild",foe:"mossbell",lead:member.id,team:d.team},a=h.practice.preview(o),ref=h.practice.reference(o,o.foe);
    assert.equal(member.intent,a.foeIntent().skill.name);assert.equal(member.threat.name,ref.foeIntent().skill.name);assert.equal(member.threat.charged,true);
    assert.equal(member.threat.damage,ref.incomingForecast(member.id).damage);
    for(const m of member.moves){
      const actual=a.ordinaryForecast(m.id);assert.equal(m.damage,actual.damage);assert.equal(m.reply,actual.returnDamage);assert.equal(m.finishes,actual.finishes);
    }
  }
  const lookups=h.lookups();h.finder.report({kind:"wild",foe:"mossbell"});assert.equal(h.lookups(),lookups);
  assert.equal(JSON.stringify(s),save);assert.equal(h.practice.read(),null);assert.equal(h.map.size,0);
  s.trailFittings={claimed:["camp","crest"],gear:{dewfin:"prism-lens"}};s.crests.push(0);
  const equipped=h.finder.report({kind:"wild",foe:"mossbell",anchor:"dewfin"});
  assert.equal(equipped.active.move.id,"bubble-jet");assert.ok(equipped.active.move.events.some(e=>e.id==="prism-lens"));
});
test("an injured reserve can be compared in any seat, measured across the local pool, and played at full health without changing the career",()=>{
  const h=device(),s=h.game.state;h.grant("mossbell",8);const before=JSON.stringify(s);
  h.finder.open({anchor:"dewfin",kind:"wild",foe:"gustlance"});h.click("view","reserves:0");h.click("reserve","mossbell");h.click("slot","cindlet");
  assert.equal(h.view(),"coverage");const diff=h.model().sections.filter(sec=>sec.rows?.some(r=>r.label==="Whole party"));
  assert.equal(diff.length,new Set(h.game.pools[s.region]).size);assert.ok(diff.some(sec=>sec.rows[0].detail.includes("→")));
  h.click("view",null);h.click("view","team");h.click("anchor","mossbell");
  const expected=h.finder.report({kind:"wild",foe:"gustlance",reserve:"mossbell",slot:"cindlet",anchor:"mossbell"}).active;
  h.click("duet-plan");assert.deepEqual(h.duet(),{region:0,kind:"wild",foe:"gustlance",lead:"mossbell",team:["sprigkit","mossbell","dewfin"]});
  h.click("play");assert.deepEqual(h.started().team,["sprigkit","mossbell","dewfin"]);assert.equal(h.started().lead,"mossbell");
  const round=h.practice.read().game;assert.equal(round.state.battle.activeId,"mossbell");const ally=round.team().find(k=>k.id==="mossbell");
  assert.equal(ally.hp,ally.maxHp);const hp=round.state.battle.enemy.hp;assert.ok(h.practice.act("useSkill",expected.move.id).ok);
  assert.equal(round.state.battle?.enemy.hp??0,hp-expected.move.damage);assert.equal(JSON.stringify(s),before);assert.equal(h.map.size,0);
  h.finder.open(h.started());assert.ok(h.rows().some(r=>r.detail?.includes("Mossbell takes Cindlet")));
  h.click("clear");h.click("view","team");assert.deepEqual(plain(h.rows().filter(r=>r.id==="matchup-anchor").map(r=>r.value)),plain(s.team));
});
test("a visited Warden’s later hypothetical stays distinct from its actual opening, and its full order launches in the selected region",()=>{
  const h=device(),s=h.game.state;
  s.visited.push(1,2);s.met.push(1,2);s.crests.push(0,1);
  const t=h.practice.targets(1).find(c=>c.kind==="warden");assert.ok(t.roster.length>1);assert.equal(s.region,0);
  h.finder.open({region:1,kind:"warden",foe:t.foe,anchor:"sprigkit"});h.click("view","opponents");h.click("foe","warden:"+t.roster.at(-1));
  assert.ok(h.model().sections.some(q=>q.title==="If this foe is charging"));
  const info=h.finder.report({kind:"warden",region:1,foe:t.roster.at(-1)}).active;
  assert.equal(info.hypothetical,true);assert.ok(info.threat.charged);h.click("play");
  assert.equal(h.started().foe,t.foe);const b=h.practice.read().game.state.battle;
  assert.deepEqual([b.enemy.id,...b.remaining],plain(t.roster));assert.equal(s.region,0);
});
test("favorite profile in a full team asks which seat to use, retains other members and projections include grown skills",()=>{
  const h=device(),s=h.game.state;
  for(const kin of ["mossbell","gustlance","pincoil","opalclasp"])h.grant(kin);
  s.team.push("mossbell","gustlance","pincoil");s.crests.push(0);s.growth.sprigkit={selected:"seamreader",demonstrated:true,classic:false};
  h.finder.open({anchor:"opalclasp"});assert.equal(h.view(),"slot");assert.equal(h.rows().filter(r=>r.id==="matchup-slot").length,6);
  h.click("slot","pincoil");h.click("view",null);assert.ok(h.model().subtitle.includes("Opalclasp"));
  h.click("view","team");h.click("anchor","sprigkit");assert.ok(h.model().subtitle.includes("Brackenveil"));
  h.click("view","kin:sprigkit");assert.ok(h.model().sections.find(q=>q.title==="Trained skills").rows.some(r=>r.label==="Briar Seam"));
  assert.equal(s.team.at(-1),"pincoil");
});
