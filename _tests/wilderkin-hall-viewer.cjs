const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {webcrypto}=require("node:crypto");
const win={crypto:webcrypto},ctx=vm.createContext({window:win,TextEncoder});
for(const name of ["atlas","bestiary","activities","campaign","story","duets","engine","sparring-gear","sparring-signatures",
  "sparring-battle","sparring-teams","scout-practice","scout-rules","bellpost-rules","bellpost-arena","film-practice","hall-film"]){
  const file=path.join(__dirname,"../games/wilderkin",name+".js");vm.runInContext(fs.readFileSync(file,"utf8"),ctx,{filename:file});
}
test("a Hall film opens read-only, hands the exact recorded decision to practice, and returns to the original result",async()=>{
  const game=win.WilderGame,sim=win.WilderSparringBattle.create({game}),practice=win.WilderFilmPractice.create({game,storage:null});
  const left=["sprigkit","cindlet","dewfin"],right=["mossbell","coalmoth","glimmeray"],moves=[];
  let pos=sim.start(left,right,1);
  while(pos.phase!=="done"){const move=sim.recommend(pos);moves.push(move.id);pos=sim.apply(pos,move.id);}
  const hash=practice.hallFilm({left,right,first:1,human:0,moves}),entry=await practice.resolve(hash);
  let opened,shared,route;
  const row=(id,label,value,detail,extra)=>({id,label,value,detail,...extra});
  const viewer=win.WilderHallFilm.create({game,row,image:id=>id,go:(screen,v)=>{assert.equal(screen,"hall-film");route=v;},
    openPractice:(...args)=>{opened=args;},share:v=>{shared=v;}});
  const rows=()=>viewer.model(route).sections.flatMap(s=>s.rows||[]);
  const click=(id,val)=>{
    const button=rows().find(r=>r.id===id&&(val===undefined||val===r.value));assert.ok(button,id);
    assert.equal(viewer.act(id,button.value,route),true);
  };
  route=viewer.load(entry,null);assert.equal(route,"result");assert.equal(viewer.hash(),hash);
  assert.match(viewer.model(route).kicker,/HALL FILM/);
  assert.ok(!rows().some(r=>["post-join","post-move","post-resign","post-wire"].includes(r.id)));
  click("hall-film-share");assert.equal(shared,hash);
  click("post-film");assert.equal(route,"film|"+(moves.length-1));
  click("post-film-step",moves.length-2);
  const at=moves.length-2,kicker=viewer.model(route).kicker;
  click("post-rehearse",at);assert.equal(opened[1],at);assert.equal(opened[0].hash,hash);assert.equal(opened[2].publicHash,hash);
  route=viewer.load(await practice.resolve(hash),at);assert.equal(viewer.model(route).kicker,kicker);
  viewer.act("spar-view","equipment",route);assert.match(viewer.model(route).kicker,/HALL FILM/);
  click("post-film-step",at);click("post-battle");assert.equal(route,"result");assert.equal(viewer.model(route).title,entry.source.labels[pos.winner]+" won");
});
