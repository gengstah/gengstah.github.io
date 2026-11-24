const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const files=["atlas","bestiary","activities","story","campaign","duets","sparring-gear","trail-fittings","fitting-notes","engine"];
function open(storage=new Map()){
  const w={localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}},ctx=vm.createContext({window:w});
  for(const file of files)vm.runInContext(fs.readFileSync(path.join(__dirname,"../games/wilderkin",file+".js"),"utf8"),ctx);
  const g=w.WilderGame,book=w.WilderFittingNotes.create({game:g,row:(id,label,value,detail,opt)=>({id,label,value,detail,...opt}),image:id=>id});
  return {g,w,book,storage};
}
test("the notebook stores a real first use, keeps it after another encounter, and restores an actionable account of the original battle",()=>{
  const {g,storage}=open();g.visitSite("camp");assert.ok(g.claimFittings("camp").ok);
  assert.ok(g.equipFitting("sprigkit","opening-pennant").ok);assert.ok(g.equipFitting("dewfin","last-stitch").ok);
  assert.deepEqual(Object.keys(g.state.fittingNotes),[]);
  assert.ok(g.startBattle("wild","mossbell").ok);
  const initial=JSON.stringify(g.state.fittingNotes),note=g.state.fittingNotes["opening-pennant"];
  assert.equal(note.foe,"mossbell");assert.equal(note.holder,"sprigkit");assert.match(note.text,/opening meter.*beats/);
  g.switchForecast("dewfin");assert.equal(JSON.stringify(g.state.fittingNotes),initial);
  assert.ok(g.flee().ok);assert.ok(g.startBattle("wild","gustlance").ok);assert.equal(JSON.stringify(g.state.fittingNotes),initial);
  const {book,g:resumed}=open(storage);assert.equal(JSON.stringify(resumed.state.fittingNotes),initial);
  const page=book.model("opening-pennant");assert.match(page.subtitle,/Mossbrook Vale/);assert.match(page.sections[0].title,/Sprigkit against Mossbell/);
  assert.equal(page.sections[0].text,note.text);assert.ok(page.sections.flatMap(s=>s.rows||[]).some(r=>r.value==="kit-bench|item:opening-pennant"));
  assert.equal(book.model().sections[0].rows.length,1);
});
test("an incomplete or mismatched notebook entry cannot invent a first use",()=>{
  const {g,w}=open(),entry={item:"opening-pennant",holder:"sprigkit",foe:"mossbell",kind:"wild",turn:1,region:0,text:"Sprigkit raised the meter to two beats."};
  for(const bad of [{...entry,foe:"invented"},{...entry,region:300},{...entry,holder:"bad-id"},{...entry,kind:"rental"}, {...entry,turn:-1},{...entry,text:""}]){
    assert.equal(w.WilderFittingNotes.record(g.state,bad),false);
    assert.equal(Object.keys(w.WilderFittingNotes.restore({"opening-pennant":bad})).length,0);
  }
  assert.equal(Object.keys(w.WilderFittingNotes.restore({"relay-bell":entry})).length,0);
});
