const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const scripts=["atlas","bestiary","activities","story","campaign","duets","sparring-battle","sparring-teams","sparring","engine"].map(name=>{
  const file=path.join(__dirname,"../games/wilderkin",name+".js");return new vm.Script(fs.readFileSync(file,"utf8"),{filename:file});
});
const clone=v=>JSON.parse(JSON.stringify(v));
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function boot(raw,animate){
  let saved=raw,view=null;const FX=[],notes=[];
  const ctx=vm.createContext({window:{localStorage:{getItem:k=>k==="wilderkin.trail.v3"?saved:null,setItem:(_,v)=>{saved=v;}}}});
  for(const script of scripts)script.runInContext(ctx);
  const w=ctx.window,g=w.WilderGame;
  const hall=w.WilderSparring.create({game:g,row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),image:id=>"loan/"+id,
    go:(name,v)=>{assert.equal(name,"sparring");view=v;},render(){},notify:m=>notes.push(m),animate:fx=>{FX.push(fx);return animate?.(fx);}});
  const sim=w.WilderSparringBattle.create({species:g.species});
  const model=()=>hall.model(view),rows=()=>model().sections.flatMap(s=>s.rows||[]);
  const click=(id,value)=>{const m=rows().find(r=>r.id===id&&(value===undefined||r.value===value));assert.ok(m&&!m.disabled,id+"/"+value+" in "+model().title);assert.ok(hall.act(m.id,m.value));};
  function pos(){
    const m=g.state.sparring.match;
    let p=sim.start(m.setup.left,m.setup.right,m.first);
    for(const id of m.moves)p=sim.apply(p,id);
    return p;
  }
  return {g,hall,sim,model,rows,click,pos,FX,notes,restore:r=>w.WilderSparring.restore(r,{species:g.species}),
    reload:()=>boot(saved),save:()=>saved,view:()=>view};
}
function campaign(h){const s=clone(h.g.state);delete s.sparring;return s;}
function launch(h,mode){h.click("spar-mode",mode);assert.equal(h.model().title,"Team preview");h.click("spar-start");}
async function finish(h){
  for(let i=0;i<132&&h.pos().phase!=="done";i++){
    const m=h.g.state.sparring.match,p=h.pos();
    if(m.handoff)h.click("spar-ready");
    const best=h.sim.recommend(p);
    if(["duet","swap"].includes(best.kind))h.click("spar-view","cmd:"+best.kind);
    h.click("spar-move",best.id);await settle();
  }
  assert.equal(h.pos().phase,"done");assert.match(h.model().kicker,/MATCH RESULT/);
}
test("a full rival match preserves the adventure, animates opposing replies, reports real turns and archives the replay across rematches",async()=>{
  const h=boot(),base=campaign(h);launch(h,"cpu");
  const arena=h.model();assert.equal(arena.kind,"battle");assert.equal(arena.ally.level,20);assert.equal(arena.foe.level,20);
  for(const strip of Object.values(arena.lineups)){assert.equal(strip.team.length,3);assert.ok(strip.team.every(p=>p.src&&p.hp===p.maxHp));}
  await finish(h);
  const p=h.pos(),r=h.g.state.sparring,m=r.match,summary=h.model();
  assert.ok(h.FX.some(f=>f.side==="ally"));assert.ok(h.FX.some(f=>f.side==="foe"));
  assert.match(summary.subtitle,new RegExp(p.ply+" actions played"));
  assert.ok(summary.sections.some(x=>/^Turning point · action \d+/.test(x.title)));assert.ok(summary.sections.some(x=>/^Rematch idea/.test(x.title)));
  assert.ok(h.rows().some(x=>x.id==="nav"&&x.value==="sparring-review"));
  assert.deepEqual(clone(h.hall.reviewRecord()),{left:clone(m.setup.left),right:clone(m.setup.right),first:0,human:0,moves:clone(m.moves)});
  const tape=clone(h.hall.reviewRecord()),loaded=h.reload();assert.deepEqual(clone(loaded.hall.reviewRecord()),tape);
  loaded.click("spar-view","result");loaded.click("spar-rematch");await settle();
  assert.equal(loaded.pos().first,1);assert.equal(loaded.pos().ply,1);assert.equal(loaded.pos().turn,0);
  assert.deepEqual(clone(loaded.hall.reviewRecord()),tape);assert.deepEqual(campaign(loaded),base);
});
test("two seated players alternate only on an explicit handoff, get free replacements and produce a complete independent match",async()=>{
  const h=boot(),base=campaign(h);launch(h,"local");
  assert.ok(h.hall.key({key:"1"},"match"));await settle();
  assert.equal(h.model().title,"Pass to Player 2");assert.equal(h.g.state.sparring.match.moves.length,1);
  h.hall.act("spar-move","skill:shell-bump");assert.equal(h.g.state.sparring.match.moves.length,1);
  const resumed=h.reload();resumed.click("spar-view","match");assert.equal(resumed.model().title,"Pass to Player 2");
  await finish(resumed);
  const m=resumed.g.state.sparring.match;assert.ok(m.moves.some(id=>id.startsWith("replace:")));
  assert.ok(m.moves.length>resumed.pos().ply);assert.equal(resumed.hall.reviewRecord(),null);
  assert.ok(resumed.rows().every(x=>x.value!=="sparring-review"));
  resumed.click("spar-rematch");assert.equal(resumed.model().title,"Pass to Player 2");assert.equal(resumed.pos().ply,0);
  assert.deepEqual(campaign(resumed),base);
});
test("reload after a human decision preserves that command exactly once and can finish the interrupted CPU response",async()=>{
  let release;
  const h=boot(undefined,()=>new Promise(r=>{release=r;}));launch(h,"cpu");
  const opening=h.rows().find(r=>r.id==="spar-move"&&!r.disabled);
  h.click(opening.id,opening.value);assert.ok(h.save());assert.equal(h.pos().ply,1);
  h.hall.act("spar-move",opening.value);assert.equal(h.pos().ply,1);
  const resumed=h.reload();resumed.click("spar-view","match");resumed.click("spar-cpu");await settle();
  assert.equal(resumed.pos().ply,2);assert.equal(resumed.pos().turn,0);assert.equal(resumed.g.state.sparring.match.moves[0],opening.value);
  assert.equal(resumed.notes.length,0);release();
});
test("guest links require a valid explicit acceptance and cannot silently replace a live match or the builder's saved lineup",async()=>{
  const h=boot(),defaultSetup=clone(h.g.state.sparring.setup);
  assert.ok(h.hall.loadFragment("#sparring"));assert.ok(!h.hall.loadFragment("#spar-v1=dewfin,dewfin,cindlet"));
  const hash="#spar-v1=dewfin,pincoil,boltbur";
  assert.ok(h.hall.loadFragment(hash));assert.equal(h.model().title,"Guest crew");
  assert.deepEqual(clone(h.g.state.sparring.setup),defaultSetup);
  h.click("spar-accept");assert.equal(h.model().title,"Team preview");assert.equal(h.g.state.sparring.setup.rival,"shared");
  h.click("spar-start");const m=clone(h.g.state.sparring.match);
  assert.ok(h.hall.loadFragment("#spar-v1=cindlet,sprigkit,dewfin"));assert.equal(h.hall.model().sections.at(-1).rows[0].disabled,true);
  h.hall.act("spar-accept");h.hall.act("spar-team-rival","ice-harbor");assert.deepEqual(clone(h.g.state.sparring.match),m);
  h.click("spar-view","retire");h.click("spar-retire");assert.equal(h.g.state.sparring.match,null);
  h.click("spar-invitation");h.click("spar-accept");assert.deepEqual(clone(h.g.state.sparring.setup.right),["cindlet","sprigkit","dewfin"]);
});
test("invalid histories cannot restore an impossible fighter or review, and invalid saves keep the rest of the desk usable",()=>{
  const h=boot();launch(h,"cpu");const rec=clone(h.g.state.sparring);
  for(const bad of [["skill:made-up"],["skill:sun-nap"],Array(100).fill("skill:leaf-flurry")]){
    const restored=h.restore({...rec,match:{...rec.match,moves:bad}});assert.equal(restored.match,null);assert.deepEqual(clone(restored.setup),rec.setup);
  }
  const bad=h.restore({...rec,lastReview:{...rec.setup,human:0,first:0,moves:["skill:leaf-flurry"]},
    match:{...rec.match,setup:{...rec.match.setup,left:["sprigkit","sprigkit","dewfin"]}}});
  assert.equal(bad.match,null);assert.equal(bad.lastReview,null);
});
