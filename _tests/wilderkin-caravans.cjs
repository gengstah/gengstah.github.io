const {test}=require("node:test");
const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const copy=value=>JSON.parse(JSON.stringify(value));
const ctx=vm.createContext({window:{}});
for(const script of ["trail-fittings","caravans"]) vm.runInContext(readFileSync(path.join(__dirname,"../games/wilderkin",script+".js"),"utf8"),ctx);
const model=ctx.window.WilderCaravans;

function camp(save,guards={}) {
  const species=Object.fromEntries(["fox","tern","hare","mole","newt","kite","yak"].map(id=>[id,{name:id,types:["Loam"]}]));
  const hpAt=(_,level)=>20+level*3;
  const companion=(id,level)=>({id,level,hp:hpAt(id,level),maxHp:hpAt(id,level),xp:12});
  const state=save?copy(save):{party:[companion("fox",60),companion("tern",51),companion("hare",48),companion("mole",42),
      companion("newt",37),companion("kite",43),companion("yak",8)],team:["fox","tern","hare","mole","newt","kite"],lead:"tern",
    region:0,landmark:"camp",bag:{reed:24,sap:20,ore:10},battle:null,crests:[0,1]};
  state.caravan=model.restore(save?.caravan,state.party);
  const regions=[{name:"High Shelf",wildLevel:58},{name:"Hearth",wildLevel:4}];
  const items={reed:{name:"Silver reed"},sap:{name:"Sun sap"},ore:{name:"Bellstone"}};
  let saves=0;
  const api=model.create({state:()=>state,species,regions,items,hpAt,...guards,commit(kind,message){saves++;return {ok:true,kind,message};}});
  return {state,api,game:{state,species,regions,items,caravan:api},saves:()=>saves};
}

test("formation recalls and undo preserve the identities, injuries, order, lead and experience of the roster",()=>{
  const f=camp(),{api,state}=f;
  assert.ok(api.saveFormation(0).ok);
  state.team[4]="yak";state.lead="yak";
  state.party[0].hp=5;
  const roster=JSON.stringify(state.party);
  assert.ok(api.recallFormation("0").ok);
  assert.equal(state.team[4],"newt");
  assert.equal(state.lead,"tern");
  assert.equal(JSON.stringify(state.party),roster);
  const loaded=camp(state);
  assert.ok(loaded.api.undoFormation().ok);
  assert.equal(loaded.state.team[4],"yak");assert.equal(loaded.state.lead,"yak");
  assert.equal(JSON.stringify(loaded.state.party),roster);
  assert.ok(!loaded.api.undoFormation().ok);
  assert.equal(f.saves(),2);
});

test("recall selects a conscious partner if the pennant lead is injured, and refuses an entirely fainted formation",()=>{
  const {api,state}=camp();
  state.team=["fox","tern"];state.lead="tern";assert.ok(api.saveFormation(2).ok);
  state.team=["hare"];state.lead="hare";state.party[1].hp=0;
  assert.equal(api.formations().slots[2].lineup.readyLead,"fox");assert.ok(api.recallFormation(2).ok);
  assert.equal(state.lead,"fox");assert.equal(state.party[1].hp,0);assert.ok(api.undoFormation().ok);
  state.party[0].hp=0;
  const before=JSON.stringify(state);
  assert.ok(!api.recallFormation(2).ok);assert.equal(JSON.stringify(state),before);
});

test("missing, empty and corrupt save records migrate independently of other pennants",()=>{
  const {state}=camp();
  const good={team:["fox","tern"],lead:"tern"};
  assert.deepEqual(copy(model.restore(undefined,state.party)),{slots:[null,null,null],previous:null});
  for (const bad of [{team:["fox","lost"],lead:"fox"},{team:["fox"],lead:"yak"},
    {team:["fox","fox"],lead:"fox"},{team:[],lead:"fox"},{team:state.party.map(p=>p.id),lead:"fox"}]) {
    const read=model.restore({slots:[bad,good,{}],previous:bad},state.party);
    assert.deepEqual(copy(read),{slots:[null,good,null],previous:null});assert.notEqual(read.slots[1].team,good.team);
  }
  for(const invalid of [null,"01","3",true,-1,{}]) {
    const {api}=camp();
    assert.ok(!api.saveFormation(invalid).ok);
    assert.ok(!api.recallFormation(invalid).ok);
  }
});

test("one lesson trains the original reserve to the previewed regional cap for the displayed supplies",()=>{
  const {api,state,saves}=camp(),yak=state.party[6];
  yak.hp=17;yak.personalHistory={firstCrest:"Leaf"};
  const partyBefore=copy(state.party),oldHp=yak.hp,oldMax=yak.maxHp;
  const lesson=api.training("yak");
  assert.equal(lesson.target,56);assert.equal(lesson.teacher,"fox");assert.equal(lesson.gain,48);
  assert.deepEqual(copy(lesson.cost),{reed:6,sap:5,ore:3});assert.ok(lesson.available);
  assert.ok(api.trainReserve("yak").ok);
  assert.strictEqual(yak,state.party[6]);
  assert.equal(yak.level,56);assert.equal(yak.maxHp,188);assert.equal(yak.hp,Math.floor(oldHp/oldMax*188));
  assert.equal(yak.xp,12);assert.equal(yak.personalHistory.firstCrest,"Leaf");
  assert.deepEqual(state.bag,{reed:18,sap:15,ore:7});
  assert.deepEqual(state.party.slice(0,-1),partyBefore.slice(0,-1));
  assert.equal(state.lead,"tern");assert.ok(!state.team.includes("yak"));
  assert.ok(!api.trainReserve("yak").ok);assert.equal(saves(),1);
});

test("mentoring is capped by a healthy current mentor and does not revive a fainted student",()=>{
  const {api,state}=camp();
  state.party[0].hp=0;state.party[6].hp=0;
  assert.equal(api.training("yak").target,49);assert.ok(api.trainReserve("yak").ok);
  assert.equal(state.party[6].hp,0);assert.equal(state.party[6].xp,12);
  state.region=1;
  assert.equal(api.training("yak").target,2);
  assert.ok(!api.trainReserve("yak").ok);
});

test("camp, battle, supply and reserve requirements are checked before changing any state",()=>{
  for(const block of ["travel","battle","supplies","active","no mentor","missing"]) {
    const {api,state,saves}=camp();
    assert.ok(api.saveFormation(0).ok);
    if(block==="travel")state.landmark="wild";
    if(block==="battle")state.battle={turn:3};
    if(block==="supplies")state.bag.ore=0;
    if(block==="active")state.team[0]="yak";
    if(block==="no mentor")state.party.filter(p=>state.team.includes(p.id)).forEach(p=>{p.hp=0;});
    const before=JSON.stringify(state);
    assert.ok(!api.trainReserve(block==="missing"?"lost":"yak").ok);
    if(block==="battle") {
      assert.ok(!api.saveFormation(1).ok);assert.ok(!api.recallFormation(0).ok);assert.ok(!api.undoFormation().ok);
    }
    assert.equal(JSON.stringify(state),before,block);
    assert.equal(saves(),1,block);
  }
});

test("canvas views allow recording, recall, undo and walking to train the same selected friend",()=>{
  const {game,state}=camp();
  const messages=[],walks=[];
  const pages=model.pages({game,row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),
    image:id=>id+".png",go(){},locate(...args){walks.push(args);},render(){},notify(text){messages.push(text);}});
  const rows=(name,value)=>pages.model(name,value).sections.flatMap(s=>s.rows||[]);
  assert.equal(rows("formations").filter(r=>r.id==="view").length,3);
  pages.act("caravan-save",0);
  state.team[2]="yak";state.lead="yak";
  assert.ok(rows("formation",0).some(r=>r.id==="view" && r.value==="formation-replace|0"));
  pages.act("caravan-recall",0);
  assert.equal(state.lead,"tern");assert.ok(rows("formations").some(r=>r.id==="caravan-undo"));
  state.landmark="wild";
  assert.ok(rows("mentor","yak").find(r=>r.id==="caravan-train").disabled);
  pages.act("caravan-walk","yak");
  assert.deepEqual(walks,[["camp","mentor"]]);
  state.landmark="camp";
  assert.ok(!rows("mentor",null).find(r=>r.id==="caravan-train").disabled);
  pages.act("caravan-train","yak");
  assert.equal(state.party[6].level,56);assert.ok(messages.at(-1).includes("56"));
});

const kit=ctx.window.WilderTrailFittings;
function fitted(){
  const h=camp(),s=h.state;
  s.team=["fox","tern","mole"];s.lead="tern";s.trailFittings={claimed:["camp","crest"],gear:{fox:"opening-pennant",tern:"relay-bell"}};
  assert.ok(h.api.saveFormation(0,{fittings:true,name:"Crossing party"}).ok);
  assert.ok(kit.apply(s,{fox:"last-stitch",tern:null,yak:"opening-pennant",hare:"relay-bell",mole:"prism-lens",kite:"seam-hook"}).ok);
  return h;
}
test("same-team recall names each real reserve transfer, clears recorded empty slots, and undoes them in one commit across a reload",()=>{
  const h=fitted(),s=h.state,prior=copy(s.trailFittings.gear);s.party[0].hp=3;s.walking={fixed:"hare"};
  const party=JSON.stringify(s.party),flag=h.api.formations().slots[0];
  assert.equal(flag.name,"Crossing party");assert.equal(flag.lineup.reason,"");assert.ok(!flag.lineup.active);
  assert.deepEqual(copy(flag.lineup.gear),{fox:"opening-pennant",tern:"relay-bell"});
  const moves=copy(flag.lineup.changes);assert.equal(moves.length,5);
  assert.deepEqual(moves.find(c=>c.id==="yak"),{id:"yak",before:"opening-pennant",after:null});
  assert.deepEqual(moves.find(c=>c.id==="mole"),{id:"mole",before:"prism-lens",after:null});
  assert.deepEqual(copy(s.trailFittings.gear),prior);assert.ok(h.api.recallFormation(0).ok);assert.equal(h.saves(),2);
  assert.deepEqual(copy(s.trailFittings.gear),{kite:"seam-hook",fox:"opening-pennant",tern:"relay-bell"});
  assert.ok(h.api.formations().slots[0].lineup.active);assert.ok(!h.api.recallFormation(0).ok);
  const loaded=camp(s);assert.equal(loaded.api.formations().previous.changes.length,5);
  assert.ok(kit.apply(loaded.state,{newt:"mender-wrap"}).ok);assert.ok(loaded.api.undoFormation().ok);
  assert.deepEqual(copy(loaded.state.trailFittings.gear),{...prior,newt:"mender-wrap"});
  assert.equal(JSON.stringify(loaded.state.party),party);assert.deepEqual(loaded.state.walking,{fixed:"hare"});assert.equal(loaded.saves(),1);
});
test("undo leaves newer equipment and its current holder in place while restoring independent changes",()=>{
  const h=fitted(),s=h.state;assert.ok(h.api.recallFormation(0).ok);
  assert.ok(kit.apply(s,{kite:"opening-pennant",fox:"seam-hook",newt:"last-stitch"}).ok);
  const r=h.api.formations().previous;
  assert.deepEqual(copy(r.kept.map(k=>k.id)).sort(),["fox","yak"]);assert.equal(r.kept.find(k=>k.id==="yak").holder,"kite");
  assert.ok(h.api.undoFormation().ok);
  assert.deepEqual(copy(s.trailFittings.gear),{kite:"opening-pennant",newt:"last-stitch",fox:"seam-hook",hare:"relay-bell",mole:"prism-lens"});
  assert.equal(h.api.formations().previous,null);
});
test("legacy or intentionally bare pennants leave the pack alone; custom names, empty-slot captures and a healthy fallback lead survive restore",()=>{
  const h=fitted(),s=h.state;
  assert.ok(h.api.renameFormation(0,"  Lantern   scouts  ").ok);
  assert.ok(h.api.saveFormation(0).ok);assert.equal(h.api.formations().slots[0].name,"Lantern scouts");
  assert.equal(h.api.formations().slots[0].lineup.gear,undefined);
  assert.ok(h.api.saveFormation(1,{fittings:true}).ok);s.trailFittings.gear={};assert.ok(h.api.saveFormation(2,{fittings:true}).ok);
  assert.ok(!h.api.saveFormation(2,{fittings:true}).ok);const loaded=camp(s);
  assert.deepEqual(copy(loaded.api.formations().slots[2].lineup.gear),{});
  assert.ok(kit.apply(loaded.state,{mole:"prism-lens"}).ok);
  const before=copy(loaded.state.trailFittings.gear);loaded.state.party[1].hp=0;loaded.state.team=["yak"];loaded.state.lead="yak";
  assert.ok(loaded.api.recallFormation(0).ok);assert.deepEqual(copy(loaded.state.trailFittings.gear),before);assert.equal(loaded.state.lead,"fox");
  assert.ok(loaded.api.recallFormation(2).ok);assert.deepEqual(copy(loaded.state.trailFittings.gear),{});assert.equal(loaded.state.party[1].hp,0);
  for(const[name,gear] of [["<bad>",{lost:"prism-lens"}],["x".repeat(33),{fox:"unknown"}],["\n",{fox:"relay-bell",tern:"relay-bell"}]]){
    const bad=model.restore({slots:[{name,gear,team:["fox","tern"],lead:"tern"}]},s.party);
    assert.deepEqual(copy(bad.slots[0]),{team:["fox","tern"],lead:"tern"});
  }
});
test("fitting changes and writing a pennant are atomic when combat, a loaner, an old tab or missing ownership forbids them",()=>{
  const base=fitted();
  for(const denied of ["battle","loaner","stale","unclaimed","fainted"]){
    const h=camp(base.state,{isCurrent:()=>denied!=="stale",blocked:()=>denied==="loaner"}),s=h.state;
    if(denied==="battle")s.battle={turn:1};
    if(denied==="unclaimed")s.trailFittings.claimed=[];
    if(denied==="fainted")s.party.forEach(k=>k.hp=0);
    const before=JSON.stringify(s);assert.ok(!h.api.recallFormation(0).ok,denied);
    if(["battle","loaner","stale"].includes(denied)){assert.ok(!h.api.saveFormation(1,{fittings:true}).ok);assert.ok(!h.api.renameFormation(0,"Changed").ok);}
    assert.equal(JSON.stringify(s),before,denied);assert.equal(h.saves(),0);
  }
});
test("the fitting review is read-only, includes prior reserve holders, and refuses a superseded confirmation",()=>{
  const h=fitted(),s=h.state,notices=[],links=[];
  const pages=model.pages({game:h.game,row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),image:id=>id,
    go:(...args)=>links.push(args),render(){},notify:m=>notices.push(m)});
  const controls=(screen,v)=>pages.model(screen,v).sections.flatMap(s=>s.rows||[]);
  const before=JSON.stringify(s);assert.ok(controls("formation",0).some(r=>r.value==="formation-recall|0"));
  const rows=controls("formation-recall",0);assert.ok(rows.some(r=>r.label==="yak"&&r.badge==="Camp reserve"&&r.detail==="Opening Pennant → No fitting"));
  assert.equal(JSON.stringify(s),before);assert.ok(kit.apply(s,{yak:"prism-lens"}).ok);
  pages.act("caravan-confirm-recall",0);assert.match(notices.at(-1),/Review the current holders/);assert.equal(h.saves(),1);
  controls("formation-recall",0);pages.act("caravan-confirm-recall",0);assert.equal(h.saves(),2);
  assert.ok(controls("formations").some(r=>r.value==="formation-undo|"));controls("formation-undo");pages.act("caravan-confirm-undo",null);
  assert.equal(h.saves(),3);assert.equal(s.trailFittings.gear.yak,"prism-lens");assert.deepEqual(links.at(-1),["formations",null,"replace"]);
});
