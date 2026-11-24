const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.join(__dirname,"../games/wilderkin");
const source=fs.readFileSync(path.join(root,"index.html"),"utf8");
const files=[...source.matchAll(/src="([\w-]+)\.js(?:\?[^"]*)?"/g)].map(m=>m[1])
  .filter(n=>!["canvas-shell","canvas-games","kin-art","world","game","score"].includes(n));
const scripts=files.map(n=>new vm.Script(fs.readFileSync(path.join(root,n+".js"),"utf8"),{filename:n+".js"}));
function boot(raw){
  const w={localStorage:{getItem:k=>k==="wilderkin.trail.v3"?raw:null,setItem:(_,s)=>{raw=s;}}},ctx=vm.createContext({window:w});
  scripts.forEach(s=>s.runInContext(ctx));
  const g=w.WilderGame,sim=w.WilderSparringBattle.create({game:g}),row=(id,label,value,detail,extra)=>({id,label,value,detail,...extra});
  let view="lobby";const hall=w.WilderSparring.create({game:g,row,image:id=>id,go:(_,v)=>{view=v;},render(){},notify(){}});
  const show=v=>{view=v;return hall.model(v);},model=()=>hall.model(view),rows=()=>model().sections.flatMap(s=>s.rows||[]);
  function click(id,value){
    const item=rows().find(r=>r.id===id&&(value===undefined||r.value===value));
    assert.ok(item&&!item.disabled,"missing "+id+"/"+value+" on "+view);assert.ok(hall.act(id,item.value));
  }
  return {w,g,sim,row,hall,show,model,rows,click,reload:()=>boot(raw),save:()=>raw};
}
const clone=x=>JSON.parse(JSON.stringify(x));
const campaign=g=>{const s=clone(g.state);delete s.sparring;return s;};
const pos=(sim,m)=>m.moves.reduce((p,id)=>sim.apply(p,id),sim.start(m.setup.left,m.setup.right,m.first,m.setup.gear));
test("both Hall exercises begin at the same real wound and guard, play alternative replies, and transfer the exact six commands without changing the trail",()=>{
  for(const id of ["charquill","kilnbeak"])for(const branch of ["art","brace"]){
    const h=boot(),base=campaign(h.g),startSave=clone(h.g.state.sparring),other=id==="charquill"?"kilnbeak":"charquill",move=id==="charquill"?"warmth:dewfin":"vent:backdraft";
    h.click("spar-view","ember");assert.equal(h.model().art.src,"ui/ember-partners.png");assert.deepEqual(clone(h.rows().filter(r=>r.id==="open-kin").map(r=>r.value)),["charquill","kilnbeak"]);
    h.click("ember-open","ember:"+id);const m=h.model(),team=m.lineups.left.team;
    assert.equal(m.ally.species,id);assert.ok(team[0].hp<team[0].maxHp);assert.match(m.subtitle,/braced/);
    h.click("ember-open","ember:"+id+":"+branch);const after=h.model();
    assert.ok(after.sections.find(s=>s.title==="Compare the same reply").rows.length===3);
    h.click("ember-open","ember:"+other);assert.equal(h.model().ally.species,other);
    assert.deepEqual(clone(h.g.state.sparring),startSave);
    h.show("ember:"+id+":"+branch);h.click("ember-play","ember:"+id+":"+branch);
    const tape=h.g.state.sparring.match,p=pos(h.sim,tape);assert.equal(tape.moves.length,6);
    assert.equal(tape.moves[4]===move,branch==="art");assert.equal(p.ply,6);assert.equal(p.turn,0);
    assert.equal(after.ally.hp,p.sides[0].team[p.sides[0].active].hp);
    assert.equal(after.foe.hp,p.sides[1].team[p.sides[1].active].hp);
    assert.deepEqual(clone(after.lineups.left.team.map(k=>k.hp)),clone(p.sides[0].team.map(k=>k.hp)));
    const restored=h.reload();assert.deepEqual(clone(restored.g.state.sparring.match),clone(tape));
    restored.show("match");restored.click("spar-view","cmd:ember");
    const option=restored.rows().find(r=>r.value===move);
    assert.ok(option);assert.equal(Boolean(option.disabled),branch==="art");
    restored.show("ember:"+id+":"+branch);assert.ok(restored.rows().some(r=>r.id==="spar-view"&&r.value==="match"));
    assert.deepEqual(campaign(h.g),base);
  }
});
test("two touch filters and full typed technique names find the actual holders; builder shows how the ability fits the team",()=>{
  const h=boot();
  for(const [id,name] of [["charquill","Banked Warmth"],["kilnbeak","Backdraft"]]){
    h.show("edit:left:pick:0");
    h.click("spar-team-ember","left:0:"+id);
    const count=Object.values(h.g.species).filter(k=>k.emberArt?.name===name).length;
    assert.equal(count,26);assert.ok(h.model().sections.some(s=>s.title===count+" matching kin"));
    h.click("spar-team-ember","left:0:"+id);
    h.show("edit:left:search:0");for(const key of name)assert.ok(h.hall.key({key},"edit:left:search:0"));
    h.hall.key({key:"Enter"},"edit:left:search:0");assert.ok(h.model().sections.some(s=>s.title===count+" matching kin"));
    h.show("edit:left:candidate:0:"+id);assert.ok(h.model().sections.some(s=>s.title===name+" · once per kin"));
    h.click("spar-team-select","left:0:"+id);h.show("edit:scout");
    assert.ok(h.model().sections.find(s=>s.title==="Ember techniques").rows.some(r=>r.label.includes(name)));
    h.show("edit:left:search:0");h.click("spar-team-key","left:clear");
  }
});
test("Bellpost v2 shows exact Ember options, HP changes and film, while old-v1 seats and spectators cannot submit them",()=>{
  const {w,g,sim,row}=boot(),arena=w.WilderBellpostArena.create({game:g,row,image:id=>id});
  for(const [id,cmd] of [["charquill","warmth:dewfin"],["kilnbeak","vent:backdraft"]]){
    const a={ids:["dewfin","charquill","kilnbeak"],gear:{}},b={ids:["mossbell","cindlet","glimmeray"],gear:{}};
    const prefix=["skill:bubble-jet","skill:briar-bloom","swap:"+id,"skill:shell-bump"];
    for(const version of [1,2]){
      const p=prefix.reduce((s,id)=>sim.apply(s,id),sim.start(a.ids,b.ids,0,{left:{},right:{}},version));
      const rec={first:0,protocol:version,seat:0,teams:[a,b],moves:prefix,status:"active",pos:p};
      const choices=arena.model(rec,"partners").sections.flatMap(s=>s.rows||[]);
      const move=choices.find(r=>r.value===cmd);assert.equal(Boolean(move),version===2);
      if(version===1)continue;
      assert.equal(move.disabled,false);const matched=sim.forecast(p,cmd);assert.ok(move.detail.startsWith(matched.detail));assert.match(move.detail,/could reply for/);
      const after=sim.apply(p,cmd),played={...rec,moves:[...prefix,cmd],pos:after};
      const film=arena.review(played,4);
      assert.ok(film.sections.some(s=>s.text===matched.detail));assert.equal(film.ally.hp,after.sides[0].team[after.sides[0].active].hp);
      const guest=arena.review({...played,seat:1},4);assert.equal(guest.foe.hp,film.ally.hp);
      assert.equal(arena.model({...rec,seat:null},"partners").sections.flatMap(s=>s.rows||[]).filter(r=>r.id==="post-move").length,0);
    }
  }
});
test("a completed Hall film records the reserve’s actual heal and shows its charge restored on a legal branch",()=>{
  const h=boot();h.show("ember:charquill:art");h.click("ember-play","ember:charquill:art");
  const m=clone(h.g.state.sparring.match);let p=pos(h.sim,m);
  while(p.phase!=="done"){
    const move=h.sim.recommend(p);m.moves.push(move.id);p=h.sim.apply(p,move.id);
  }
  const review=h.w.WilderSparringReview.create({sim:h.sim,game:h.g,row:h.row,read:()=>m});
  const book=review.model("");
  assert.ok(book.sections[0].rows.some(r=>r.badge==="EMBER"&&r.label.includes("Banked Warmth")));
  const turn=review.model("t4");
  assert.ok(turn.sections.find(s=>s.title==="Recorded play").rows.some(r=>r.detail.includes("Restore 18 HP to Dewfin")));
  const branch=review.model("a4/skill:reed-lunge");
  assert.ok(branch.sections.find(s=>s.title==="Ember technique after the exchange").rows.some(r=>r.label.includes("Charquill")&&r.detail.includes("Ready in this variation")));
});
