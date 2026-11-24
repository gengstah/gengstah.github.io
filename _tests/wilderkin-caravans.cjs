const {test}=require("node:test");
const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const copy=value=>JSON.parse(JSON.stringify(value));
const ctx=vm.createContext({window:{}});
vm.runInContext(readFileSync(path.join(__dirname,"../games/wilderkin/caravans.js"),"utf8"),ctx);
const model=ctx.window.WilderCaravans;

function camp(save) {
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
  const api=model.create({state:()=>state,species,regions,items,hpAt,commit(kind,message){saves++;return {ok:true,kind,message};}});
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
