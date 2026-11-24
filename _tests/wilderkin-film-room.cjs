const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {webcrypto}=require("node:crypto");
const scripts=["atlas","bestiary","activities","campaign","story","duets","engine","sparring-gear","sparring-signatures","sparring-battle","sparring-teams","scout-practice","bellpost-rules","scout-rules","bellpost-arena","film-practice","film-room"].map(id=>{
  const filename=path.join(__dirname,"../games/wilderkin",id+".js");
  return new vm.Script(fs.readFileSync(filename,"utf8"),{filename});
});
const plain=x=>JSON.parse(JSON.stringify(x));
function device(store=new Map()){
  const storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
  const w={localStorage:storage,crypto:webcrypto},ctx=vm.createContext({window:w,TextEncoder});scripts.forEach(s=>s.runInContext(ctx));
  const g=w.WilderGame,core=w.WilderFilmPractice.create({game:g}),sim=w.WilderSparringBattle.create({game:g});
  let view="desk",m,exit=null,active=true,featured=0,letters=0,resumes=0,renders=0,hallCount=0,hasHall=false,shared=[];
  const notes=[],routes=[];
  const practice={...core,resume:()=>{resumes++;return core.resume();}};
  const ui=w.WilderFilmRoom.create({game:g,practice,row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),image:id=>id+".png",
    go:(_,v)=>{view=v;routes.push(v);m=ui.model(v);},render:()=>{renders++;m=ui.model(view);},notify:msg=>notes.push(msg),
    active:()=>active,returnToFilm:(...args)=>{exit=args;},openFeatured:()=>{featured++;},openLetter:()=>{letters++;},latestHallFilm:()=>hasHall,
    openHallFilm:()=>{hallCount++;},shareSource:hash=>shared.push(hash)});
  const model=()=>m=ui.model(view),rows=()=>m.sections.flatMap(s=>s.rows||[]);
  function click(id,v){const r=rows().find(x=>x.id==="film-"+id&&(v===undefined||x.value===v));
    assert.ok(r&&!r.disabled,[id,v,m.title,JSON.stringify(rows().map(r=>[r.id,r.value]))].join(" "));
    assert.ok(ui.act(r.id,r.value,view));}
  const tick=()=>new Promise(r=>setTimeout(r,4));
  async function until(fn){for(let i=0;i<200;i++){if(fn())return;await tick();}assert.fail("timed out in "+view);}
  async function openFeatured(){
    const f=w.WilderBellpostArena.featured,film=await practice.resolve(f.publicHash);assert.ok(film);
    assert.ok(ui.open(film.source,f.index,{publicHash:f.publicHash,rosters:film.rosters}));
    await until(()=>rows().some(r=>r.id==="film-take"&&!r.disabled));return film;
  }
  return {g,core,sim,w,ui,store,model,rows,click,tick,until,openFeatured,exit:()=>exit,view:()=>view,
    active:v=>{active=v;},setHall:v=>{hasHall=v;},shared,routes,notes,counts:()=>({featured,letters,resumes,renders,hallCount}),load:()=>device(store)};
}
test("the illustrated desk loads practice on demand; a featured losing decision faithfully previews the original film and returns to the same frame",async()=>{
  const d=device();assert.equal(d.counts().resumes,0);const desk=d.model();assert.equal(desk.art.src,"ui/film-room.png");assert.equal(d.counts().resumes,1);
  d.click("featured");d.click("letter");assert.equal(d.counts().featured,1);assert.equal(d.counts().letters,1);
  const film=await d.openFeatured(),m=d.model();assert.equal(d.counts().resumes,1);
  assert.equal(m.ally.species,"kilnbeak");assert.equal(m.ally.hp,22);assert.equal(m.foe.species,"sprigkit");assert.equal(m.foe.hp,32);
  assert.match(m.kicker,/DECISION 8/);assert.match(m.sections.find(s=>s.title==="On the original film").text,/Fire Kite/);
  d.click("source-crew");assert.equal(d.model().title,"Trios on the original film");d.click("source");
  d.click("decisions");d.click("seat",0);const entry=d.rows().find(r=>r.id==="film-decision");d.click("decision",entry.value);
  assert.match(d.model().subtitle,/Host/);d.click("return");
  assert.equal(d.exit()[0],film.source.hash);assert.equal(d.exit()[1],film.publicHash);assert.equal(d.exit()[2],7);assert.equal(d.core.get(),null);
});
test("Guest can save Kilnbeak with Backdraft, complete the new battle, compare decisive results, retry the original decision and resume after reload",async()=>{
  const d=device(),film=await d.openFeatured(),source=JSON.stringify(film.source),career=JSON.stringify(d.g.state);
  d.click("take");await d.until(()=>d.view()==="play");const start=d.core.get();
  assert.equal(start.seat,1);assert.equal(start.pivot,7);assert.equal(start.returnIndex,7);assert.equal(start.moves.length,0);
  d.click("partners");const vent=d.rows().find(r=>r.value==="vent:backdraft");assert.match(vent.detail,/10 damage/);assert.match(vent.detail,/18/);
  d.click("move","vent:backdraft");let run=d.core.get();assert.equal(run.events[0].after.sides[1].team[0].hp,40);assert.equal(run.moves[0],"vent:backdraft");
  assert.notEqual(run.revision,start.revision);d.click("compare");assert.match(d.model().title,/Film comparison/);d.click("return");assert.equal(d.exit()[2],7);
  const b=d.load();b.model();await b.until(()=>b.rows().some(r=>r.id==="film-resume"));b.click("resume");
  assert.equal(b.core.get().revision,run.revision);assert.ok(b.rows().some(r=>r.id==="film-compare"));
  while((run=b.core.get()).status!=="done"){
    const move=b.sim.recommend(run.pos);
    if(!b.rows().some(r=>r.value===move.id))b.click("partners");
    b.click("move",move.id);
  }
  const end=b.model();assert.equal(end.title,"Rehearsal result");
  assert.ok(end.sections[0].rows.some(r=>/Original · Host won/.test(r.label)));
  assert.ok(end.sections[0].rows.some(r=>/Rehearsal · You won/.test(r.label)));
  assert.ok(end.sections[0].rows.some(r=>r.detail.includes("Fire Kite")&&r.detail.includes("Backdraft")));
  b.click("return");assert.deepEqual(b.exit(),[film.source.hash,film.publicHash,7]);
  b.click("retry");run=b.core.get();assert.equal(run.status,"active");assert.deepEqual(plain(run.moves),[]);
  assert.equal(JSON.stringify(film.source),source);assert.equal(JSON.stringify(d.g.state),career);
  assert.deepEqual([...d.store.keys()],["wilderkin.film-practice.v1"]);
});
test("a public Scout Table opening can use its fourth kin with original gear, while a quick-match letter can only reorder the original three",async()=>{
  const d=device(),film=await d.openFeatured();d.click("redraft");d.click("slot",0);
  assert.equal(d.rows().filter(r=>r.id==="film-put").length,4);
  d.click("put","dewfin");d.click("open-play");await d.until(()=>d.view()==="play");
  let run=d.core.get();assert.equal(run.pivot,0);assert.equal(run.returnIndex,7);assert.equal(run.teams[1].ids[0],"dewfin");
  assert.deepEqual(plain(run.teams[0]),plain(film.source.teams[0]));
  assert.deepEqual(plain(run.loadout.gear),Object.fromEntries(run.loadout.ids.filter(id=>film.rosters[1].gear[id]).map(id=>[id,film.rosters[1].gear[id]])));
  const reloaded=d.load();reloaded.model();await reloaded.until(()=>reloaded.rows().some(r=>r.id==="film-resume"));reloaded.click("resume");reloaded.click("return");
  assert.equal(reloaded.exit()[2],7);
  const q=device();const simple=q.w.WilderBellpostRules.create({game:q.g}),host=simple.invite({ids:["sprigkit","cindlet","dewfin"],gear:{}});
  const guest=q.w.WilderBellpostRules.create({game:q.g,storage:null}),joined=guest.join(host.record.hash,{ids:["glimmeray","mossbell","coalmoth"],gear:{mossbell:"last-stitch"}});
  assert.ok(joined.ok);assert.ok(q.ui.open(joined.record,null));await q.until(()=>q.rows().some(r=>r.id==="film-take"&&!r.disabled));
  q.click("redraft");q.click("redraft-seat",1);q.click("slot",0);assert.equal(q.rows().filter(r=>r.id==="film-put").length,3);q.click("put","mossbell");
  q.click("open-play");await q.until(()=>q.view()==="play");run=q.core.get();assert.equal(run.teams[1].ids[0],"mossbell");assert.equal(run.loadout.gear.mossbell,"last-stitch");
});
test("changing an active fork requires confirmation, cross-tab conflicts reopen the actual saved turn, and off-screen async work never navigates",async()=>{
  const d=device(),film=await d.openFeatured();d.click("take");await d.until(()=>d.view()==="play");const first=d.core.get();
  d.click("compare");d.click("redraft");d.click("open-play");assert.equal(d.model().title,"Replace your active rehearsal?");assert.equal(d.core.get().revision,first.revision);
  d.click("cancel");assert.equal(d.model().title,"Redraft Guest’s opening");
  const b=d.load();b.model();await b.until(()=>b.rows().some(r=>r.id==="film-resume"));b.click("resume");
  // A newer move made elsewhere cannot be overwritten by an earlier rendered button.
  d.click("open-play");d.click("resume");d.click("move","vent:backdraft");
  b.ui.act("film-move","vent:backdraft","play");await b.until(()=>b.core.get()?.revision===d.core.get().revision);
  assert.ok(b.notes.some(x=>x.includes("Another tab")));
  b.click("compare");b.click("redraft");b.click("open-play");assert.equal(b.model().title,"Replace your active rehearsal?");
  b.click("confirm");b.active(false);const length=b.routes.length;await b.tick();await b.tick();
  assert.equal(b.routes.length,length);assert.equal(b.core.get().returnIndex,7);assert.equal(film.source.status,"done");
});

test("the latest Hall film and its real rival label follow the player through rehearsal, shared original link, and return to the same decision",async()=>{
  const d=device(),left=["sprigkit","cindlet","dewfin"],right=["mossbell","coalmoth","glimmeray"];
  let pos=d.sim.start(left,right,1);const moves=[];
  while(pos.phase!=="done"){const move=d.sim.recommend(pos);moves.push(move.id);pos=d.sim.apply(pos,move.id);}
  const hash=d.core.hallFilm({left,right,first:1,human:0,moves,rival:"bell-keepers"});
  const source=await d.core.resolve(hash);assert.equal(source.source.kind,"hall");
  d.model();assert.ok(!d.rows().some(r=>r.id==="film-hall"));
  d.setHall(true);d.model();d.click("hall");assert.equal(d.counts().hallCount,1);
  d.ui.open(source.source,0,source);await d.until(()=>d.rows().some(r=>r.id==="film-take"&&!r.disabled));
  d.click("share");assert.equal(d.shared[0],hash);
  assert.equal(d.rows().find(r=>r.id==="film-take").label,"Play as The Bell Keepers");
  d.click("decisions");assert.ok(d.rows().some(r=>r.label==="Challenger"));d.click("decision",0);d.click("take");
  await d.until(()=>d.view()==="play");assert.match(d.model().kicker,/THE BELL KEEPERS/);d.click("compare");
  const group=d.model().sections[0];assert.ok(group.rows[0].detail.includes("Challenger"));assert.ok(group.rows[0].detail.includes("The Bell Keepers"));
  d.click("share");d.click("return");assert.equal(d.shared[1],hash);assert.deepEqual(d.exit(),[hash,hash,0]);
});

test("a different source saved in another tab returns to the desk with an explanation, preserving both original official matches",async()=>{
  const a=device(),initial=await a.openFeatured();a.click("take");await a.until(()=>a.view()==="play");
  const b=a.load();b.model();await b.until(()=>b.rows().some(r=>r.id==="film-resume"));
  const book=b.w.WilderBellpostRules.create({game:b.g,storage:null}),guest=b.w.WilderBellpostRules.create({game:b.g,storage:null});
  const host=book.invite({ids:["dewfin","cindlet","sprigkit"],gear:{}}).record;
  const source=guest.join(host.hash,{ids:["mossbell","coalmoth","glimmeray"],gear:{}}).record;
  b.ui.open(source,null);b.click("take");assert.equal(b.model().title,"Replace your active rehearsal?");
  b.click("confirm");await b.until(()=>b.view()==="play");
  a.click("move","vent:backdraft");await a.until(()=>a.view()==="desk");
  assert.ok(a.notes.some(n=>n.includes("different film")));
  assert.equal(a.core.get().sourceHash,source.hash);a.click("resume");a.click("return");
  assert.equal(a.exit()[0],source.hash);assert.notEqual(initial.source.hash,source.hash);
  assert.equal(book.inspect(source.hash).moves.length,0);
});
