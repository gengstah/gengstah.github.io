const {test}=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const scripts=["atlas","bestiary","activities","story","campaign","duets","sparring-gear","sparring-signatures","sparring-battle",
  "sparring-teams","sparring-grove","sparring-library","sparring","sparring-review","engine"].map(name=>{
  const file=path.join(__dirname,"../games/wilderkin",name+".js");return new vm.Script(fs.readFileSync(file,"utf8"),{filename:file});
});
const clone=v=>JSON.parse(JSON.stringify(v)),tick=()=>new Promise(resolve=>setImmediate(resolve));
const oldTape={left:["mossbell","dewfin","cindlet"],right:["fernprickle","pincoil","gustlance"],first:0,human:0,
  moves:["skill:briar-bloom","skill:briar-net","skill:shell-bump","skill:briar-net","duet:dewfin","skill:briar-net","skill:briar-bloom",
    "skill:quill-brace","skill:briar-bloom","duet:pincoil","skill:briar-bloom","replace:pincoil","skill:coil-snap","replace:dewfin",
    "skill:slick-slide","skill:coil-snap","duet:cindlet","skill:coil-snap","skill:ember-pop","skill:tunnel-feint","skill:ember-pop",
    "skill:coil-snap","skill:ember-pop","duet:gustlance","replace:dewfin","skill:slick-slide","replace:gustlance","skill:crosswind-cut",
    "skill:bubble-jet","skill:crosswind-cut","skill:bubble-jet","skill:reed-lunge","skill:bubble-jet","skill:crosswind-cut","skill:bubble-jet","skill:crosswind-cut"]};
function boot(raw,animate){
  let saved=raw,view=null,launch,writes=0;
  const w={localStorage:{getItem:k=>k==="wilderkin.trail.v3"?saved:null,setItem:(_,v)=>{saved=v;writes++;}}},ctx=vm.createContext({window:w});
  scripts.forEach(s=>s.runInContext(ctx));
  const library=w.WilderSparringLibrary;
  w.WilderSparringLibrary={...library,create(options){launch=options.playFromPractice;return library.create(options);}};
  const g=w.WilderGame,sim=w.WilderSparringBattle.create({game:g});
  const row=(id,label,value,detail,extra)=>({id,label,value,detail,...extra});
  const hall=w.WilderSparring.create({game:g,row,image:x=>x,go:(_,v)=>{view=v;},render(){},notify(){},animate});
  const review=w.WilderSparringReview.create({game:g,row,read:()=>hall.reviewRecord()});
  const model=v=>hall.model(v??view),rows=page=>page.sections.flatMap(s=>s.rows||[]);
  function press(id,value){
    const r=rows(model()).find(r=>r.id===id&&(value===undefined||r.value===value));
    assert.ok(r&&!r.disabled,id+"/"+value+" on "+model().title);assert.ok(hall.act(r.id,r.value));
  }
  function pos(){
    const m=g.state.sparring.match,s=m.setup;let p=sim.start(s.left,s.right,m.first,s.gear);
    m.moves.forEach(id=>{p=sim.apply(p,id);});return p;
  }
  return {g,sim,hall,review,launch,pos,press,model,rows,writes:()=>writes,save:()=>saved,reload:()=>boot(saved)};
}
async function finish(h){
  for(let i=0;i<80&&h.pos().phase!=="done";i++){
    if(h.g.state.sparring.match.handoff)h.press("spar-ready");
    const p=h.pos();
    if(h.g.state.sparring.match.setup.mode==="cpu"&&p.turn===1){h.press("spar-cpu");await tick();continue;}
    const m=h.sim.recommend(p);
    if(["swap","duet","signature"].includes(m.kind))h.press("spar-view","cmd:"+m.kind);
    h.press("spar-move",m.id);await tick();
  }
  assert.equal(h.pos().phase,"done");
}
const campaign=g=>{const s=clone(g.state);delete s.sparring;return s;};
test("three regular buttons and one species-specific action fit the skill grid; local seats can forecast both reserves and the opponent can counter a read",async()=>{
  const h=boot(),s=h.g.state.sparring;
  const gear={left:{mossbell:"opening-pennant",dewfin:"relay-bell"},right:{}};
  h.g.saveSparring({...s,setup:{left:["mossbell","cindlet","dewfin"],right:["fernprickle","sprigkit","pincoil"],mode:"local",rival:"custom",gear}});
  h.hall.act("spar-start");
  const skills=h.model().sections.find(x=>x.title==="Choose a skill");
  assert.equal(skills.rows.length,4);assert.equal(skills.columns,2);
  assert.equal(skills.rows[3].label,"Shelter Call");assert.ok(h.hall.key({key:"4"},"match"));
  assert.equal(h.model().title,"Shelter Call");assert.match(h.model().subtitle,/1 use remaining/);
  const reserves=h.rows(h.model()).filter(r=>r.id==="spar-move");
  assert.deepEqual(clone(reserves.map(x=>x.value)),["shelter:cindlet","shelter:dewfin"]);
  assert.ok(reserves.every(r=>r.detail.includes("quarter cover")&&r.detail.includes("HP")));
  for(const r of reserves){
    const after=h.sim.apply(h.pos(),r.value),moves=h.sim.options(after).filter(m=>m.kind==="attack"&&m.available);
    const hit=moves.sort((a,b)=>b.damage-a.damage)[0];assert.ok(r.detail.includes(hit.label+" would deal "+hit.damage+" damage"));
  }
  h.press("spar-move","shelter:dewfin");await tick();assert.equal(h.model().title,"Pass to Player 2");
  const n=h.reload();n.press("spar-view","match");n.press("spar-ready");
  let p=n.pos();assert.ok(p.sides[0].team[0].signatureSpent);assert.equal(p.sides[0].team[p.sides[0].active].id,"dewfin");
  assert.equal(p.sides[0].team[2].spent,false);assert.equal(p.sides[0].cover,.25);assert.equal(p.sides[0].beats,0);
  n.press("spar-view","cmd:signature");assert.equal(n.model().title,"Thorn Read");assert.match(n.model().subtitle,/No beat cost/);
  n.press("spar-move","stance:thorn-read");await tick();n.press("spar-ready");
  assert.match(n.model().log.at(-1),/reading the next hit/);
  assert.equal(n.model().sections.find(s=>s.title==="Choose a skill").rows.length,3);
  assert.ok(!n.hall.key({key:"4"},"match"));
  const attack=n.rows(n.model()).find(r=>r.value==="skill:bubble-jet");
  assert.match(attack.detail,/Thorn Read exposes Dewfin/);
  n.press("spar-move",attack.value);await tick();n.press("spar-ready");
  p=n.pos();assert.ok(p.sides[0].team[2].exposed);assert.equal(p.sides[1].beats,1);assert.ok(!p.sides[1].thornRead);
  n.press("spar-view","cmd:signature");assert.match(n.model().subtitle,/Use spent/);
  assert.ok(n.rows(n.model()).find(r=>r.value==="stance:thorn-read").disabled);
});
test("the real lesson continues after the exact two actions; completed replay branches compare spent uses, exposed kin and beats",async()=>{
  for(const id of ["mossbell","fernprickle"]){
    const h=boot(),s=h.g.state.sparring,base=campaign(h.g);
    const slots=[{name:"My trio",team:["sprigkit","cindlet","dewfin"],gear:{}},null,null,null];
    h.g.saveSparring({...s,slots,lastReview:clone(oldTape)});
    const route="bench:grove:"+id+":signature:strike";h.hall.act("spar-view",route);
    const before=h.writes();h.press("grove-play",route);assert.equal(h.writes(),before+1);
    const m=h.g.state.sparring.match,cmd=id==="mossbell"?"shelter:dewfin":"stance:thorn-read";
    assert.equal(h.model().kind,"battle");assert.deepEqual(clone(m.moves),[cmd,"skill:ember-pop"]);
    assert.equal(h.pos().turn,0);assert.equal(h.pos().ply,2);assert.deepEqual(clone(h.hall.reviewRecord()),oldTape);
    assert.deepEqual(clone(h.g.state.sparring.slots),slots);assert.deepEqual(campaign(h.g),base);
    const n=h.reload();n.press("spar-view","match");assert.deepEqual(clone(n.pos()),clone(h.pos()));
    await finish(n);
    assert.deepEqual(campaign(n.g),base);assert.ok(n.model().sections.some(x=>x.title==="Signature plays"));
    const book=n.hall.reviewRecord();assert.equal(book.moves[0],cmd);assert.ok(n.review.valid(book));
    const immutable=JSON.stringify(book),index=n.review.model("p0");assert.equal(index.sections[0].rows[0].badge,"SIGNATURE");
    const record=n.review.model("t0");assert.ok(record.sections.find(x=>x.title==="Recorded play").rows[0].label.includes(id==="mossbell"?"Shelter Call":"Thorn Read"));
    const variation=n.review.model("a0/"+(id==="mossbell"?"swap:dewfin":"skill:quill-brace"));
    assert.equal(variation.title,"Try another move");
    const changed=variation.sections.find(x=>x.title==="Signature after the exchange").rows;
    assert.ok(changed.some(r=>r.detail.includes("Still available in this variation")));
    if(id==="fernprickle")assert.ok(changed.some(r=>r.label.includes("exposure")));
    if(id==="mossbell"){
      const alternate=n.review.model("a0/shelter:coalmoth");
      assert.equal(alternate.title,"Try another move");assert.ok(alternate.sections.find(x=>x.title==="Projected position").rows[0].label.includes("Coalmoth"));
    }
    assert.equal(JSON.stringify(n.hall.reviewRecord()),immutable);
  }
});
test("a stale or invalid lesson transfer never starts or overwrites a match",async()=>{
  let release;const h=boot(undefined,()=>new Promise(r=>release=r));
  const setup={left:["fernprickle","dewfin","coalmoth"],right:["cindlet","sprigkit","glimmeray"],mode:"cpu",rival:"custom"},
    moves=["stance:thorn-read","skill:ember-pop"];
  const bad=[null,{...setup,left:["invalid","dewfin","coalmoth"]},{...setup,mode:"local"},{...setup,gear:{left:{dewfin:"bogus"}}}];
  for(const s of bad)assert.equal(h.launch(s,moves),false);
  for(const ids of [[],["stance:thorn-read"],["stance:thorn-read","skill:nope"],["replace:dewfin","skill:ember-pop"]])assert.equal(h.launch(setup,ids),false);
  assert.equal(h.writes(),0);assert.ok(h.launch(setup,moves));assert.equal(h.writes(),1);
  const prior=h.save();assert.equal(h.launch(setup,moves),false);assert.equal(h.save(),prior);
  h.press("spar-move","skill:briar-net");const mid=h.save();
  assert.equal(h.launch(setup,moves),false);assert.equal(h.save(),mid);release();
});
test("a shipped pre-signature tape with both Grove species reproduces every recorded position byte for byte",()=>{
  const h=boot(),digest=crypto.createHash("sha256");
  let p=h.sim.start(oldTape.left,oldTape.right,oldTape.first);
  for(const id of oldTape.moves){p=h.sim.apply(p,id);assert.ok(p);digest.update(JSON.stringify(p));}
  // Captured with the Hall reducer released in e61b990, before signatures existed.
  assert.equal(digest.digest("hex"),"155d4e2de60cb52ff52da3a33669ebbd52ba5041fa97b90f35558d980841a8ae");
  assert.equal(p.ply,32);assert.equal(p.winner,1);assert.ok(h.review.valid(oldTape));
  h.g.saveSparring({...h.g.state.sparring,lastReview:clone(oldTape)});
  assert.deepEqual(clone(h.reload().hall.reviewRecord()),oldTape);
});
