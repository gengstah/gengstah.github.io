const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const scripts=["atlas","bestiary","activities","story","campaign","duets","sparring-gear","sparring-signatures",
  "sparring-battle","sparring-teams","sparring","sparring-review","cup-rules","cup-desk","engine"].map(name=>{
    const file=path.join(__dirname,"../games/wilderkin",name+".js");
    return new vm.Script(fs.readFileSync(file,"utf8"),{filename:file});
  });
const rows=page=>page.sections.flatMap(s=>s.rows||[]),clone=value=>JSON.parse(JSON.stringify(value));
function boot(){
  const w={},ctx=vm.createContext({window:w});
  scripts.forEach(s=>s.runInContext(ctx));
  const game=w.WilderGame,sim=w.WilderSparringBattle.create({species:game.species});
  let current="lobby";
  const hall=w.WilderSparring.create({game,image:id=>id,row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),
    go:(_,view)=>{current=view;},render(){},notify(){}});
  const model=()=>hall.model(current);
  function click(id,value){
    const item=rows(model()).find(r=>r.id===id&&(value===undefined||r.value===value));
    assert.ok(item&&!item.disabled,id+" / "+value+" on "+model().title);
    assert.ok(hall.act(item.id,item.value));
  }
  function position(){
    const m=game.state.sparring.match,s=m.setup;
    return m.moves.reduce((p,id)=>sim.apply(p,id),sim.start(s.left,s.right,m.first,s.gear));
  }
  return {game,w,sim,hall,model,click,position};
}
test("family filters reveal every eligible loaner, and both scout perspectives name the pass holders and their shared use",()=>{
  const {game,w,hall,model,click}=boot(),before=clone(game.state.sparring.setup);
  for(const side of ["left","right"]){
    const slot=1,route="edit:"+side+":pick:"+slot;
    hall.act("spar-view",route);
    for(const key of ["beacon","slipstream"]){
      const eligible=Object.keys(game.species).filter(id=>!game.species[id].bonus&&w.WilderFamilyTechniques.forKin(id)?.id===key).sort();
      const name=w.WilderFamilyTechniques.byId(key).name;
      click("spar-team-family",side+":"+slot+":"+key);
      const seen=[];
      while(true){
        const matches=model().sections.find(s=>s.title===eligible.length+" matching kin");
        assert.ok(matches.rows.every(r=>r.detail.includes(name)));
        seen.push(...Array.from(matches.rows,r=>r.value.split(":").at(-1)));
        const next=rows(model()).find(r=>r.id==="spar-team-page"&&r.label==="Next");
        if(!next||next.disabled)break;
        click(next.id,next.value);
      }
      assert.equal(eligible.length,19);assert.deepEqual(seen.sort(),eligible);
      const candidate=matchesCandidate(model());
      click(candidate.id,candidate.value);
      assert.ok(model().sections.some(s=>s.title?.startsWith(name)&&s.text.includes("Herons and gliders share one pass")));
      click("spar-team-open",route);click("spar-team-family",side+":"+slot+":all");
      assert.ok(model().sections.some(s=>s.title==="500 matching kin"));
    }
  }
  assert.deepEqual(clone(game.state.sparring.setup),before);
  for(const [side,slot,id] of [["left",0,"gustlance"],["left",1,"arcbill"],["left",2,"galeskip"],["right",0,"gustlance"]]){
    hall.act("spar-team-select",side+":"+slot+":"+id);
  }
  for(const view of ["edit:scout","edit:scout:right"]){
    hall.act("spar-view",view);
    const report=model().sections.find(s=>s.title==="Signature moves").rows;
    assert.equal(report.length,3);
    assert.ok(report.some(r=>r.label==="Gustlance, Arcbill · Beacon Pass"&&r.badge.includes("Your team")));
    assert.ok(report.some(r=>r.label==="Galeskip · Slipstream Pass"&&r.badge.includes("Your team")));
    assert.ok(report.some(r=>r.label==="Gustlance · Beacon Pass"&&r.badge.includes("Rival team")));
    assert.ok(report.every(r=>r.detail.includes("Herons and gliders share this use.")));
  }
});
function matchesCandidate(page){
  return page.sections.find(s=>s.title?.endsWith(" matching kin")).rows[0];
}
test("the actual fourth skill prices, previews and executes both passes against a living reserve, then locks the other family",()=>{
  for(const [giver,target,key] of [["gustlance","galeskip","beacon"],["galeskip","gustlance","slipstream"]]){
    const h=boot(),s=h.game.state.sparring,learn=h.w.WilderFamilyTechniques.forKin(giver);
    h.game.saveSparring({...s,setup:{left:[target,giver,"dewfin"],right:["sprigkit","cindlet","dewfin"],rival:"custom",mode:"local"}});
    h.hall.act("spar-start");
    const firstHit=()=>h.sim.options(h.position()).find(o=>o.kind==="attack"&&o.available).id;
    h.click("spar-view","cmd:signature");
    assert.ok(rows(h.model()).filter(r=>r.id==="spar-move").every(r=>r.disabled&&r.detail.includes("Needs 1 beat")));
    h.click("spar-view","match");
    h.click("spar-move",firstHit());h.click("spar-ready");
    h.click("spar-move",firstHit());h.click("spar-ready");
    h.click("spar-view","cmd:swap");h.click("spar-move","swap:"+giver);h.click("spar-ready");
    h.click("spar-move",firstHit());h.click("spar-ready");
    assert.equal(h.model().sections.find(s=>s.title==="Choose a skill").rows[3].label,learn.name);
    assert.ok(h.hall.key({key:"4"},"match"));
    const page=h.model(),options=rows(page).filter(r=>r.id==="spar-move");
    assert.equal(page.title,learn.name);assert.match(page.subtitle,/1 team pass remaining/);
    assert.deepEqual(Array.from(options,r=>r.value),[key+":"+target,key+":dewfin"]);
    const p=h.position(),healed=p.sides[0].team[0];
    assert.ok(healed.hp<healed.maxHp);
    for(const row of options){
      const m=h.sim.forecast(p,row.value),after=h.sim.apply(p,row.value);
      const best=h.sim.options(after).filter(o=>o.kind==="attack"&&o.available).sort((a,b)=>b.damage-a.damage)[0];
      assert.equal(row.label,"Pass to "+h.game.species[m.targetId].name);
      assert.ok(row.detail.includes(best.label+" would deal "+best.damage+" damage."));
      assert.ok(!row.detail.includes("quarter cover"));
      if(key==="beacon")assert.match(row.detail,/Exposes Sprigkit/);
      else assert.ok(row.detail.includes("Heals "+m.healPartner+" HP · "+after.sides[0].team[after.sides[0].active].hp+"/"));
    }
    h.click("spar-move",key+":"+target);h.click("spar-ready");
    const after=h.position();
    assert.equal(after.sides[0].team[after.sides[0].active].id,target);
    assert.equal(after.sides[0].familyPassUsed,key+"-pass");assert.equal(after.sides[0].beats,p.sides[0].beats-1);
    if(key==="beacon")assert.equal(after.sides[1].team[0].exposed,true);
    else assert.ok(after.sides[0].team[0].hp>healed.hp);
    h.click("spar-move",firstHit());h.click("spar-ready");
    h.click("spar-view","cmd:signature");assert.match(h.model().subtitle,/Team pass spent/);
    assert.ok(rows(h.model()).filter(r=>r.id==="spar-move").every(r=>r.disabled));
  }
});
test("Reedbank presets reproduce all four coached outcomes, restore the rival opener and preserve a live Hall match",()=>{
  for(const course of ["bell","ferry"])for(const id of ["gustlance","galeskip"]){
    const h=boot(),rec=h.game.state.sparring,original=JSON.stringify(rec);
    assert.equal(h.hall.prepareReedbank("sprigkit",course),false);
    assert.equal(h.hall.prepareReedbank(id,"elsewhere"),false);assert.equal(JSON.stringify(rec),original);
    assert.ok(h.hall.prepareReedbank(id,course));assert.equal(h.model().title,"Team preview");
    const s=h.game.state.sparring.setup,bell=course==="bell";
    assert.match(h.model().subtitle,bell?/Red Foundry opens/:/Ice Harbor Pilots opens/);
    assert.deepEqual(Array.from(s.left),bell?[id,"kilnclaw","iceribbon"]:[id,"dewfin","pincoil"]);
    assert.equal(s.gear,undefined);assert.equal(s.first,1);
    const restored=h.w.WilderSparring.restore(clone(h.game.state.sparring),{species:h.game.species});
    h.game.saveSparring(restored);h.click("spar-start");
    assert.equal(h.game.state.sparring.match.first,1);assert.equal(h.game.state.sparring.match.moves.length,1);
    const before=JSON.stringify(h.game.state.sparring);
    assert.equal(h.hall.prepareReedbank(id,bell?"ferry":"bell"),false);assert.equal(JSON.stringify(h.game.state.sparring),before);
    let p=h.position();
    for(let i=0;i<70&&p.phase!=="done";i++)p=h.sim.apply(p,h.sim.recommend(p).id);
    assert.equal(p.phase,"done");assert.equal(p.winner,(bell? id==="gustlance":id==="galeskip")?0:1);
  }
});
test("match film reports the one shared charge after passing to the other family and compares a regular switch in either direction",()=>{
  const {w,game,sim}=boot(),row=(id,label,value,detail,extra)=>({id,label,value,detail,...extra});
  for(const [lead,partner,pass] of [["gustlance","galeskip","beacon"],["galeskip","gustlance","slipstream"]]){
    const name=w.WilderFamilyTechniques.byId(pass).name;
    for(const recordedPass of [true,false]){
      const tape={left:[lead,partner,"sprigkit"],right:["mossbell","cindlet","dewfin"],first:0,human:0,
        gear:{left:{[lead]:"opening-pennant"},right:{}},moves:[]};
      let p=sim.start(tape.left,tape.right,0,tape.gear);
      while(p.phase!=="done"){
        const id=tape.moves.length?sim.recommend(p).id:(recordedPass?pass:"swap")+":"+partner;
        tape.moves.push(id);p=sim.apply(p,id);assert.ok(p);
      }
      const frozen=JSON.stringify(tape),review=w.WilderSparringReview.create({game,read:()=>tape,row});
      assert.ok(review.valid(tape));
      const context=review.model("t1").sections.find(s=>s.title==="On the floor").rows[0];
      assert.ok(context.label.includes(game.species[partner].name));
      assert.ok(context.detail.includes(recordedPass?"Team pass spent on "+name:"team pass ready"));
      const model=review.model("a0/"+(recordedPass?"swap":pass)+":"+partner);
      const comparisons=model.sections.find(s=>s.title==="Signature after the exchange").rows;
      const report=comparisons.filter(r=>r.label.includes("shared family pass"));
      assert.equal(report.length,1);assert.ok(report[0].label.includes("Your team"));
      assert.ok(report[0].detail.includes("spent on "+name+(recordedPass?" in the recorded match":" in this variation")));
      assert.ok(report[0].detail.includes("available"+(recordedPass?" in this variation":" in the recorded match")));
      assert.equal(JSON.stringify(tape),frozen);
    }
  }
});
test("Cup registration, each draft slot and the captain's public scout reveal pass names and the per-bout charge",()=>{
  const {w,game,sim}=boot(),rules=w.WilderCupRules.create({game,sim}),record={series:null};
  const desk=w.WilderCupDesk.create({species:game.species,sim,rules,read:()=>record,write:e=>{record.series=e;},show(){},render(){},
    image:id=>id,row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra})});
  for(const [i,id] of ["gustlance","galeskip"].entries()){
    const move=w.WilderFamilyTechniques.forKin(id),view="cup:search:"+i;
    desk.act("cup-desk-key","clear");
    for(const letter of move.id)desk.key({key:letter},view);
    const found=desk.model("cup:roster:"+i).sections.find(s=>s.title==="19 matching kin");
    assert.ok(found.rows.every(r=>r.detail.includes(move.name)));
    const learn=page=>page.sections.some(s=>s.title===move.name&&s.text.includes(move.summary)&&s.text.includes("one pass per team each bout"));
    assert.ok(learn(desk.model("cup:candidate:"+i+":"+id)));
    desk.act("cup-desk-choose",i+":"+id);
    assert.ok(learn(desk.model("cup:member:"+i)));
    assert.ok(rows(desk.model("cup:register")).find(r=>r.value==="cup:member:"+i).detail.includes(move.name));
  }
  desk.act("cup-desk-lock");
  const picks=rows(desk.model("cup:pick")).filter(r=>r.id==="cup-desk-add");
  assert.ok(picks[0].detail.includes("Beacon Pass")&&picks[1].detail.includes("Slipstream Pass"));
  const captain=rules.captains[0],scout=desk.model("cup:scout"),state=JSON.stringify(record);
  const intel=scout.sections.find(s=>s.title==="Captain’s family pass");
  assert.ok(intel.text.includes("Gustlance can use Beacon Pass")&&intel.text.includes("one pass per team each bout"));
  const publicSix=scout.sections.find(s=>s.title==="Public registration");
  assert.equal(publicSix.rows.length,captain.roster.length);
  for(const r of publicSix.rows){
    const move=w.WilderFamilyTechniques.forKin(r.image);
    if(move)assert.ok(r.detail.includes(move.name));
    else assert.ok(!r.detail.includes("Pass"));
  }
  assert.equal(JSON.stringify(record),state);
});
