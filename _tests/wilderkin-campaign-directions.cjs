const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const scripts=["atlas","bestiary","activities","campaign","story","duets","fieldwork","caravans","engine","trail-guide"].map(name=>{
  const filename=path.join(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(fs.readFileSync(filename,"utf8"),{filename});
});
function boot(){
  const saves=new Map(),window={localStorage:{getItem:k=>saves.get(k)??null,setItem:(k,v)=>saves.set(k,v)}};
  const context=vm.createContext({window});
  scripts.forEach(script=>script.runInContext(context));
  const game=window.WilderGame;
  for(const key of ["WilderHollows","WilderStillwake","WilderWalkingPartner","WilderOpening"])window[key]={pages:()=>({act:()=>false})};
  const world={regions:game.regions.map(()=>({sites:["wild","camp","travel","activities","warden"].map(kind=>({kind,label:"Local "+kind}))})),wardenArt:()=>""};
  let current={};
  const go=(name,value)=>{current={name,value};};
  const travel=(region,next)=>{assert.ok(game.travel(region).ok);go(next.name,next.value);};
  const locate=(kind,next)=>{game.visitSite(kind);typeof next==="string"?go(next):go(next.name,next.value);};
  const pages=window.WilderPages.create({game,world,dex:window.WilderKinDex,go,locate,travel,
    row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),member:id=>game.state.party.find(p=>p.id===id),
    image:id=>id,render(){},notify(){},playTone(){}});
  const rows=(name=current.name,value=current.value)=>pages.model(name,value).sections.flatMap(s=>s.rows||[]);
  function press(r){
    assert.ok(r);assert.ok(!r.disabled);
    if(r.id==="nav")go(r.value);else pages.act(r.id,r.value);
  }
  return {game,rows,press,pages,at:()=>current};
}

test("Fern’s first blocked trial opens its exact unfinished field leg and distinguishes the two lodge rewards",()=>{
  const {game,rows,press,at}=boot();
  game.visitSite("warden");
  const lodge=rows("warden");
  assert.equal(lodge[0].disabled,true);assert.match(lodge[0].detail,/Leaf Crest/);
  assert.match(lodge[1].label,/^Continue Hazard census · leg 1 of 3$/);
  assert.match(lodge.find(r=>r.value==="second-bell|0").detail,/return seal.*Leaf Crest/);
  press(lodge[1]);assert.equal(at().name,"expedition");
  assert.equal(game.state.landmark,game.expedition().targetSite);assert.ok(rows().some(r=>r.id==="expedition-choice"&&!r.disabled));
  game.state.surveys[0]=1;game.visitSite("warden");
  assert.match(rows("warden")[1].label,/leg 2 of 3$/);
  game.state.surveys[0]=3;assert.equal(rows("warden")[1].value,"scene|chapter-1");
});

test("the completed chronicle opens Missing, selects an accessible habitat, and returns to the chosen species after travel",()=>{
  const {game,rows,press,at}=boot(),s=game.state;
  s.crests=[...game.wardens];s.story.records.ending={done:true,choice:"commons"};
  for(let n=1;n<=s.crests.length;n++)s.story.records["chapter-"+n]={done:true};
  assert.equal(game.objective().collection,true);
  press(rows("objective")[0]);assert.equal(at().name,"guide");
  assert.ok(rows().some(r=>r.label==="Collection: Missing"));
  const entries=rows().filter(r=>r.id==="view"&&r.value.startsWith("kin|"));
  assert.ok(entries.length);assert.ok(entries.every(r=>!s.party.some(p=>"kin|"+p.id===r.value)));
  const target=Object.keys(game.species).find(id=>!game.species[id].bonus&&!s.party.some(p=>p.id===id)&&game.homes[id].every(i=>i!==s.region)&&game.homes[id].some(i=>game.access(i).open));
  const move=rows("kin",target).find(r=>r.id==="habitat-travel");
  press(move);assert.deepEqual(at(),{name:"kin",value:target});
  assert.ok(game.homes[target].includes(s.region));
  press(rows().find(r=>r.id==="habitat-walk"));assert.equal(s.landmark,"wild");
  assert.equal(rows().find(r=>r.id==="track").value,target);
});

test("a reserve’s Bellstone route replenishes an exhausted patch through fieldwork and brings the same student back to camp",()=>{
  const {game,rows,press,pages,at}=boot(),s=game.state;
  s.region=game.regions.findIndex(r=>r.wildLevel>=90);s.visited.push(s.region);
  s.party[0].level=90;s.party.push(game.loaner("mossbell",5));s.bag.ore=0;s.bag.reed=s.bag.sap=20;
  s.forageReady=false;game.visitSite("camp");
  const lesson=game.caravan.training("mossbell"),find=rows("mentor","mossbell").find(r=>r.id==="caravan-find");
  assert.ok(lesson.cost.ore>=1);assert.match(find.detail,/required.*0 held/);press(find);
  assert.equal(at().value,"mossbell");assert.ok(rows().some(r=>r.value==="expedition"));
  assert.equal(pages.mentorshipReturn().value,"mentor-supplies|mossbell");
  const signal=Array.from({length:game.expedition().total},(_,step)=>{
    s.surveys[s.region]=step;return game.expedition();
  }).find(job=>job.choices.some(c=>c.available&&!c.foes));
  assert.ok(signal);s.surveys[s.region]=signal.completed;game.visitSite(signal.targetSite);
  const choice=signal.choices.find(c=>c.available&&!c.foes);assert.ok(game.expeditionAction(choice.id).ok);
  assert.equal(s.forageReady,true);
  s.bag.ore=lesson.cost.ore-1;
  press(pages.mentorshipReturn());press(rows().find(r=>r.id==="caravan-gather"));assert.ok(s.bag.ore>=lesson.cost.ore);
  press(rows().find(r=>r.id==="caravan-return"));assert.equal(at().name,"mentor");assert.equal(s.landmark,"camp");
  const train=rows().find(r=>r.id==="caravan-train");assert.equal(train.value,"mossbell");press(train);
  assert.equal(s.party.find(p=>p.id==="mossbell").level,lesson.target);assert.equal(pages.mentorshipReturn(),null);
});
