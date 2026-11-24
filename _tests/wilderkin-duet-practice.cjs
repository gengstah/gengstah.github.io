const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const scripts=["atlas","bestiary","activities","campaign","story","duets","sparring-gear","sparring-signatures","sparring-battle",
  "sparring-teams","engine","bellpost-rules","bellpost-arena","film-practice","partner-search","duet-exercise","duet-practice"].map(name=>{
  const filename=path.join(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(fs.readFileSync(filename,"utf8"),{filename});
});
const plain=x=>JSON.parse(JSON.stringify(x));
const selection={anchor:"sprigkit",partner:"glimmeray",foe:"cindlet",role:"mend",team:["sprigkit","glimmeray","dewfin"],
  foes:["cindlet","coalmoth","pincoil"],gear:{sprigkit:"opening-pennant",glimmeray:"relay-bell"},foeGear:{cindlet:"prism-lens"}};
function desk(session=new Map()){
  const writes=[],notices=[],tones=[],films=[],visits=[];
  const win={localStorage:{getItem:()=>null,setItem:k=>writes.push(k),removeItem:k=>writes.push(k)},
    sessionStorage:{getItem:k=>session.get(k)??null,setItem:(k,v)=>session.set(k,v)}};
  const ctx=vm.createContext({window:win});
  scripts.forEach(script=>script.runInContext(ctx));
  const game=win.WilderGame,sim=win.WilderSparringBattle.create({game}),exercise=win.WilderDuetExercise.create({game,sim});
  const search=win.WilderPartnerSearch.create({game,sim}),practice=win.WilderFilmPractice.create({game,storage:null});
  const career=JSON.stringify(game.state),originalWrites=writes.length;
  let view=null,back=0;
  const ui=win.WilderDuetPractice.create({game,row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),
    image:id=>"art/"+id+".png",go:(screen,next)=>{assert.equal(screen,"duet-practice");visits.push(next);view=next;},
    notify:text=>notices.push(text),playTone:t=>tones.push(t),openFinder:()=>{back++;},playFilm:(tape,pivot)=>films.push({tape,pivot})});
  const page=()=>ui.model(view);
  function click(id,value){
    const row=page().sections.flatMap(s=>s.rows||[]).find(r=>r.id==="drill-"+id&&(value===undefined||value===r.value));
    assert.ok(row&&!row.disabled,"Expected visible drill-"+id+" "+value+" in "+page().title);
    assert.ok(ui.act(row.id,row.value));return page();
  }
  function lesson(p=selection){return exercise.prepare(search.exercise({...p,rivals:p.foes},p.partner));}
  function unchanged(){assert.equal(JSON.stringify(game.state),career);assert.equal(writes.length,originalWrites);}
  return {game,sim,exercise,practice,ui,page,click,lesson,unchanged,films,notices,tones,visits,session,backs:()=>back};
}
function sameBoard(model,pos){
  for(const [seat,key] of ["left","right"].entries()){
    const visible=model.lineups[key],side=pos.sides[seat];
    assert.equal(visible.beats,side.beats);assert.equal(visible.active,side.active);
    assert.deepEqual(plain(visible.team.map(k=>[k.id,k.hp,k.maxHp,k.gear?.id||null,k.gear?.spent||false])),
      plain(side.team.map(k=>[k.id,k.hp,k.maxHp,k.gear||null,k.spent||false])));
  }
}
const group=(p,title)=>p.sections.find(s=>s.title===title);

test("the guided warmup shows real lead changes, capped beat gains and the opposing moves that injured the pair",()=>{
  const d=desk(),l=d.lesson();let returned=0;
  assert.ok(d.ui.open({...selection,returnToFinder:()=>{returned++;}}));
  const ready=d.page();sameBoard(ready,l.ready);
  assert.equal(ready.title,l.duet+" practice");assert.match(ready.subtitle,/Cindlet is braced/);
  assert.ok(group(ready,"Before your move"));
  const choices=group(ready,"Choose your move").rows;
  assert.deepEqual(plain(choices.map(r=>[r.value,r.label,r.detail])),[
    ["duet",l.duetMove.label,l.duetMove.detail],["strike",l.strikeMove.label,l.strikeMove.detail]]);
  const opening=d.click("warmup");assert.match(opening.kicker,/1 OF 3/);
  for(let i=0;i<3;i++){
    const p=d.page(),e=l.warmup[2*i];sameBoard(p,e.before);
    const move=group(p,"Your move").rows[0],meter=group(p,"Beat meter").rows[0];
    assert.equal(move.label,e.move.label);
    assert.equal(meter.label,e.before.sides[0].beats+" → "+e.after.sides[0].beats+" / 3 beats");
    if(e.before.sides[0].beats===e.after.sides[0].beats)assert.match(p.subtitle,/meter is full/i);
    else assert.ok(p.subtitle.includes(e.before.sides[0].beats+" to "+e.after.sides[0].beats));
    const restored=desk(d.session),sameStep=restored.page();
    assert.equal(sameStep.kicker,p.kicker);assert.equal(sameStep.subtitle,p.subtitle);
    sameBoard(sameStep,e.before);restored.unchanged();
    if(i)assert.ok(p.log.some(line=>line.includes(l.warmup[2*i-1].move.label)));
    assert.ok(d.ui.key({key:"1",repeat:true}));assert.equal(d.page().kicker,p.kicker);
    assert.ok(d.ui.key({key:"1",repeat:false}));
  }
  assert.equal(d.page().title,ready.title);sameBoard(d.page(),l.ready);
  assert.equal(l.warmup[0].before.sides[0].beats,1);assert.equal(l.warmup[0].after.sides[0].beats,3);
  assert.ok(l.ready.sides[0].team.slice(0,2).every(k=>k.hp<k.maxHp));
  d.click("back");assert.equal(returned,1);assert.equal(d.backs(),0);d.unchanged();
});

test("switching the comparison starts from identical HP, beats and cover; both choices survive a fresh UI instance",()=>{
  const session=new Map(),d=desk(session),l=d.lesson();assert.ok(d.ui.open(selection));
  const outcomes={duet:d.exercise.tryMove(l,"duet"),strike:d.exercise.tryMove(l,"strike")};
  for(const [i,kind] of ["duet","strike"].entries()){
    const p=d.click("use",kind),attempt=outcomes[kind],other=outcomes[i?"duet":"strike"];
    sameBoard(p,attempt.pos);assert.equal(p.title,attempt.move.label);assert.equal(p.subtitle,attempt.move.detail);
    const events=group(p,"Played exchange").rows;
    assert.deepEqual(plain(events.map(r=>r.detail)),plain(attempt.events.map(e=>e.move.detail)));
    assert.ok(events.at(-1).label.includes(attempt.events.at(-1).move.label));
    const compared=group(p,"From the same position").rows;
    for(const [slot,a] of [attempt,other].entries()){
      assert.equal(compared[slot].badge,slot?"":"PLAYED");assert.ok(compared[slot].label.includes(a.move.label));
      const side=a.pos.sides[0];
      for(const id of [selection.anchor,selection.partner]){
        const k=side.team.find(f=>f.id===id);
        assert.ok(compared[slot].detail.includes(d.game.species[id].name+" "+k.hp+"/"+k.maxHp+" HP"));
      }
      assert.ok(compared[slot].detail.includes(side.beats+"/3 beats"));
    }
    const reloaded=desk(session);
    assert.equal(reloaded.page().title,p.title);sameBoard(reloaded.page(),attempt.pos);
    reloaded.click("back");assert.equal(reloaded.backs(),1);reloaded.unchanged();
  }
  const ready=d.click("ready");sameBoard(ready,l.ready);
  assert.equal(desk(session).page().title,l.duet+" practice");
  assert.deepEqual(d.tones,["reward","strike"]);d.unchanged();
});

test("an invalid saved warmup page cannot skip to an invented state or grant a film result",()=>{
  const d=desk();assert.ok(d.ui.open(selection));d.click("warmup");d.click("warmup-next",0);
  const key="wilderkin.duet-practice.v1",saved=JSON.parse(d.session.get(key));
  d.session.set(key,JSON.stringify({...saved,stage:"warmup:0.5",choice:"unearned",beats:1000}));
  const restored=desk(d.session),page=restored.page();
  assert.equal(page.title,d.lesson().duet+" practice");sameBoard(page,d.lesson().ready);
  assert.equal(restored.films.length,0);restored.unchanged();
});

test("playing from the bell and continuing after either reply export the original registered trios at the exact selected decision",async()=>{
  const d=desk(),l=d.lesson();assert.ok(d.ui.open(selection));
  for(const kind of [null,"duet","strike"]){
    let expected=l.opening,pivot=0;
    if(kind){
      d.click("use",kind);
      const a=d.exercise.tryMove(l,kind);expected=a.pos;pivot=l.warmup.length+a.events.length;
    }
    d.click("film",kind?"continue":"opening");
    const {tape,pivot:at}=d.films.at(-1);
    assert.equal(at,pivot);assert.deepEqual(plain(tape.left),plain(l.setup.left));
    assert.deepEqual(plain(tape.right),plain(l.setup.right));assert.deepEqual(plain(tape.gear),plain(l.setup.gear));
    const hash=d.practice.hallFilm(tape);assert.ok(hash);
    const review=d.practice.review(hash);assert.equal(review.final.phase,"done");
    assert.deepEqual(plain(review.events[at].before),plain(expected));
    const persisted=d.practice.get();
    const branch=await d.practice.start({sourceHash:hash,seat:expected.turn,pivot:at,replace:true,expectedRevision:persisted?.revision});
    assert.ok(branch.ok,branch.message);assert.deepEqual(plain(branch.record.pos),plain(expected));
  }
  assert.equal(d.films.length,3);assert.deepEqual(d.notices,[]);d.unchanged();
});
