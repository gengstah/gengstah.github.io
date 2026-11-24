const {test}=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm"),fs=require("node:fs"),path=require("node:path");
const files=["atlas","bestiary","activities","campaign","story","duets","stillwake","sparring-gear","sparring-battle","sparring-teams","engine"].map(name=>{
  const file=path.join(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(fs.readFileSync(file,"utf8"),{filename:file});
});
const copy=obj=>JSON.parse(JSON.stringify(obj));
function room() {
  const win={location:{origin:"https://example.org",pathname:"/games/wilderkin/"}},ctx=vm.createContext({window:win});
  files.forEach(s=>s.runInContext(ctx));
  const g=win.WilderGame,api=win.WilderSparringTeams,ui={};
  let rec=api.restore(null,{species:g.species});
  const b=api.create({game:g,row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),image:id=>id,
    read:()=>rec,write:patch=>{rec=b.restore({...rec,...patch});},go:(_,p)=>{ui.page=p;},render:()=>{},notify:()=>{},onStart:()=>{}});
  return {win,g,b,ui,rec:()=>rec};
}
const rows=page=>page.sections.flatMap(s=>s.rows||[]);
test("all six equipment options expose source rules, a concrete example and slot cost before a commitment",()=>{
  const {win,g,b,rec}=room(),initial=copy(rec()),gear=win.WilderSparringGear;
  const examples={
    "relay-bell":/Switch to bring Sprigkit in/, "last-stitch":/8 HP.*1 HP/, "seam-hook":/Leaf Flurry.*two beats/,
    "mender-wrap":/Brush Dash.*Cindlet/, "prism-lens":/Leaf Flurry.*×1.*×0\./, "opening-pennant":/one beat toward Firebreak/
  };
  const cards=rows(b.page("edit:left:gear:0"));
  assert.equal(cards.filter(r=>r.value?.includes(":piece:")).length,6);
  for(const piece of gear.items){
    const page=b.page("edit:left:piece:0:"+piece.id),sections=page.sections;
    assert.equal(page.title,piece.name);
    assert.equal(page.art.src,"art/gear/"+piece.id+".png");
    assert.equal(cards.find(r=>r.label===piece.name).image,page.art.src);
    assert.match(page.kicker,new RegExp(piece.role.toUpperCase(),"i"));
    assert.equal(sections.find(s=>s.title==="Trigger and effect").text,piece.trigger+" "+piece.effect);
    assert.equal(sections.find(s=>s.title==="Trade-off").text,piece.cost);
    assert.match(sections.find(s=>s.title==="On Sprigkit").text,examples[piece.id]);
    assert.ok(rows(page).some(r=>r.id==="spar-team-equip"));
  }
  assert.deepEqual(copy(rec()),initial);
  for(const k of Object.values(g.species).filter(k=>!k.bonus)){
    b.act("spar-team-select","left:0:"+k.id);
    const lens=b.page("edit:left:piece:0:prism-lens").sections.find(s=>s.title==="On "+k.name);
    assert.ok(lens.text.includes(k.skills.find(m=>m.kind==="attack").name));
    assert.match(lens.text,/×0\./);
  }
});
test("a usable empty slot, explicit transfers and replacements preserve both side kits and follow the holder",()=>{
  const {g,b,rec}=room(),trail=JSON.stringify(g.state);
  assert.equal(rec().gear,undefined);
  b.act("spar-team-equip","left:0:seam-hook");
  b.act("spar-team-equip","right:0:seam-hook");
  b.act("spar-team-equip","left:1:opening-pennant");
  const swapPage=b.page("edit:left:piece:1:seam-hook"),equip=rows(swapPage).find(r=>r.id==="spar-team-equip");
  assert.equal(equip.label,"Move to Cindlet");assert.match(equip.detail,/Sprigkit gives up/);assert.match(equip.detail,/Replaces Opening Pennant/);
  assert.ok(b.act(equip.id,equip.value));
  assert.deepEqual(copy(rec().gear),{left:{cindlet:"seam-hook"},right:{mossbell:"seam-hook"}});
  b.act("spar-team-swap","left:1:0");assert.equal(rec().left[0],"cindlet");assert.equal(rec().gear.left.cindlet,"seam-hook");
  const scout=b.page("edit:scout").sections.find(s=>s.title==="Visible equipment");
  assert.deepEqual(Array.from(scout.rows,r=>r.label),["Cindlet · Seam Hook","Mossbell · Seam Hook"]);
  b.act("spar-team-select","left:0:charcroak");assert.deepEqual(copy(rec().gear.left),{});
  b.act("spar-team-equip","left:0:prism-lens");
  b.act("spar-team-equip","left:0:none");assert.deepEqual(copy(rec().gear.left),{});
  b.act("spar-team-equip","left:1:__proto__");assert.deepEqual(copy(rec().gear.left),{});
  b.act("spar-team-rival","bell-keepers");assert.deepEqual(copy(rec().gear.right),{});
  assert.equal(JSON.stringify(g.state),trail);
});
test("validated gear challenges round-trip each item and lead across all 500 species; bare links and old records stay bare",()=>{
  const {win,g,b,rec}=room(),species=Object.values(g.species).filter(k=>!k.bonus),gear=win.WilderSparringGear;
  const legacy=copy(rec()),before=JSON.stringify(legacy);
  assert.equal(JSON.stringify(b.restore(legacy)),before);
  for(let i=0;i<species.length;i++){
    const ids=[0,97,194].map(offset=>species[(i+offset)%species.length].id);
    const kit=Object.fromEntries(ids.map((id,j)=>[id,gear.items[(i+j)%6].id]));
    const url=b.encodeLoadout(ids,kit);
    assert.match(url,/^#spar-v2=/);assert.deepEqual(copy(b.decodeLoadout(url)),{ids,gear:kit});assert.deepEqual([...b.decode(url)],ids);
    assert.equal(b.encodeLoadout(ids,{}),b.encode(ids));assert.deepEqual(copy(b.decodeLoadout(b.encode(ids))),{ids,gear:{}});
  }
  const ids=legacy.left;
  for(const raw of [{sprigkit:"bad"},{stillwake:"seam-hook"},{mossbell:"relay-bell"},{sprigkit:"relay-bell",cindlet:"relay-bell"},
    {sprigkit:"__proto__"},[],null])assert.equal(b.encodeLoadout(ids,raw),null);
  for(const hash of ["#spar-v2=sprigkit,cindlet,dewfin","#spar-v2=sprigkit~relay-bell,cindlet~relay-bell,dewfin",
    "#spar-v2=sprigkit~foo,cindlet,dewfin","#spar-v2=sprigkit~,cindlet,dewfin","#spar-v2=sprigkit~~relay-bell,cindlet,dewfin",
    "#spar-v2=sprigkit~__proto__,cindlet,dewfin","#spar-v1=sprigkit~last-stitch,cindlet,dewfin",
    "#spar-v2=sprigkit%7Erelay-bell,cindlet,dewfin","#spar-v2=sprigkit~last-stitch,cindlet,sprigkit",
    "#spar-v3=sprigkit~last-stitch,cindlet,dewfin"])assert.equal(b.decodeLoadout(hash),null,hash);
  const corrupt={...legacy,gear:{left:{sprigkit:"last-stitch",dewfin:"last-stitch",other:"relay-bell"},right:{mossbell:"not-real"}}};
  assert.deepEqual(copy(b.restore(corrupt).gear),{left:{sprigkit:"last-stitch"},right:{}});
});
test("a copied exact kit starts the same simulation as the original profile",async()=>{
  const {win,g,b,rec}=room();
  b.act("spar-team-equip","left:0:opening-pennant");b.act("spar-team-equip","left:2:prism-lens");
  let url=null;win.navigator={clipboard:{writeText:async value=>{url=value;}}};
  b.act("spar-team-share","left");await Promise.resolve();
  const guest=b.decodeLoadout(url.slice(url.indexOf("#")));
  assert.deepEqual(copy(guest),{ids:copy(rec().left),gear:copy(rec().gear.left)});
  const sim=win.WilderSparringBattle.create({species:g.species});
  const pos=sim.start(rec().right,guest.ids,1,{left:{},right:guest.gear});
  assert.equal(pos.sides[1].beats,1);
  assert.equal(pos.sides[1].team[0].gear,"opening-pennant");
  assert.equal(pos.sides[1].team[2].gear,"prism-lens");
  assert.equal(pos.sides[0].beats,0);
});
