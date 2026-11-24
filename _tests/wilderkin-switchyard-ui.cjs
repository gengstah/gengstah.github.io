const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const scripts=["atlas","bestiary","activities","campaign","story","duets","sparring-gear","sparring-signatures","sparring-battle","sparring-teams","engine",
  "twin-battle","switchyard-series","switchyard-scout","switchyard"].map(id=>{
  const file=path.join(__dirname,"../games/wilderkin",id+".js");return new vm.Script(fs.readFileSync(file,"utf8"),{filename:file});
});
const plain=x=>JSON.parse(JSON.stringify(x));
function device(store=new Map(),peaceful=false){
  const ctx=vm.createContext({window:{}});for(const script of scripts)script.runInContext(ctx);
  const w=ctx.window,game=w.WilderGame,sim=w.WilderTwinBattle.create({game});
  const storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
  const rules=peaceful?{...sim,coach:(pos,seat)=>pos.sides[seat].active.map((x,i)=>x===null?null:"cover:"+i)}:sim;
  const series=w.WilderSwitchyardSeries.create({game,sim:rules,storage});
  let view,opened=null,prompt="",errors=[];
  const ext={name:"Local four",ids:["sprigkit","mossbell","dewfin","pincoil"],gear:{sprigkit:"opening-pennant",pincoil:"last-stitch"}};
  w.prompt=()=>prompt;
  const desk=w.WilderSwitchyard.create({game,series,row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),
    image:id=>"kin/"+id,importFour:()=>ext,go:(route,v)=>{assert.equal(route,"switchyard");view=v;},
    openRing:(v="ring")=>{opened=v;view="external";},render(){},notify:m=>errors.push(m)});
  const model=()=>desk.model(view),rows=()=>model().sections.flatMap(s=>s.rows||[]);
  const find=(id,value)=>rows().find(r=>r.id==="yard-"+id&&(value===undefined||value===r.value));
  const click=(id,value)=>{const r=find(id,value);assert.ok(r&&!r.disabled,[id,value,view,JSON.stringify(rows())].join(" / "));assert.ok(desk.act(r.id,r.value,view));};
  return {w,game,sim,rules,series,desk,store,ext,errors,model,rows,find,click,prompt:s=>{prompt=s;},where:()=>view,ring:()=>opened,home:()=>{view=desk.entry();},
    key:key=>desk.key({key},view)};
}
function rounds(h,orderFor){
  while(h.series.read().pos.phase==="plan"){
    const r=h.series.read(),orders=orderFor(r);
    orders.forEach((id,i)=>{if(id!==null)assert.ok(h.series.commit("pick",i,id).ok);});
    assert.ok(h.series.commit("round").ok);
  }
  h.home();
}
test("six editable loaners, unique fittings, Twinbell transfer, and names/skills search are usable before registration",()=>{
  const h=device(),base=plain(h.series.desk().roster);
  assert.equal(h.model().title,"Switchyard Cup");assert.equal(h.model().sections.find(s=>s.title.includes("tap to edit")).rows.length,6);
  h.click("view","rival");assert.deepEqual(plain(h.model().sections[0].rows.map(r=>r.label)),Array.from(h.series.desk().captain.ids,id=>h.game.species[id].name));
  h.click("view","signup");h.click("view","slot:1");h.click("view","gear:1");
  assert.ok(h.find("fit","1|opening-pennant").disabled);h.click("fit","1|prism-lens");assert.equal(h.series.desk().roster.gear.thicketowl,"prism-lens");
  h.click("catalog",1);assert.ok(h.model().sections.some(s=>s.title==="500 matches"));h.prompt("Bubble Jet");h.click("search",1);
  assert.ok(h.find("choose","1|dewfin").disabled);h.prompt("pincoil");h.click("search",1);h.click("choose","1|pincoil");
  assert.equal(h.series.desk().roster.ids[1],"pincoil");assert.equal(h.series.desk().roster.gear.thicketowl,undefined);
  const career=JSON.stringify(h.game.state),externalCopy=plain(h.ext);
  assert.ok(h.ext.ids.every(id=>h.game.species[id]));h.click("import");
  assert.deepEqual(plain(h.series.desk().roster.ids.slice(0,4)),h.ext.ids);
  assert.equal(h.series.desk().roster.gear.sprigkit,"opening-pennant");assert.equal(h.series.desk().roster.gear.kilnclaw,undefined);
  assert.deepEqual(h.ext,externalCopy);assert.equal(JSON.stringify(h.game.state),career);
  assert.notDeepEqual(plain(h.series.desk().roster),base);assert.equal(device(h.store).desk.entry(),"signup");
});
test("choose, compare, trade, substitute and recall four; readable enemy registration stays independent of the private pair",()=>{
  const h=device();h.key("R");h.click("pick","dewfin");assert.equal(h.where(),"pick");h.key("2");
  const actual=h.model().sections.find(s=>s.title==="Opening scout").rows;
  assert.match(actual[0].label,/Dewfin.+Thicketowl.+Rain Garden.+2 beats/);assert.match(actual[1].label,/HP/);
  const again=device(h.store);assert.equal(again.desk.entry(),"pick");assert.deepEqual(plain(again.series.desk().picks),["dewfin","thicketowl"]);
  h.click("view","scout");h.click("view","scout:kilnclaw");assert.ok(h.model().sections[0].rows.length);h.click("pick","kilnclaw");
  h.click("pick","cairnwatch");assert.ok(h.rows().some(r=>r.id==="nav"&&r.value==="signal-box"));
  h.click("view","pick-slot:cairnwatch");h.click("trade","cairnwatch|kilnclaw");
  h.click("view","pick-slot:cairnwatch");h.click("replace","cairnwatch|gustlance");
  h.click("view","pick-slot:kilnclaw");h.click("remove","kilnclaw");h.click("pick","sprigkit");h.click("undo");h.click("pick","kilnclaw");
  assert.deepEqual(plain(h.series.desk().picks),["dewfin","thicketowl","gustlance","kilnclaw"]);
  h.click("view","rival");assert.equal(h.model().sections[0].rows.length,6);assert.ok(h.model().sections.find(s=>s.title==="How Sela picks").text);
  assert.equal(h.series.read(),null);h.click("view","pick");h.key("R");assert.equal(h.ring(),"ring");assert.deepEqual(plain(h.series.read().left.ids),plain(h.series.desk().picks));
  const j=device(h.store);assert.equal(j.desk.entry(),"battle");j.click("resume");assert.equal(j.ring(),"ring");
  assert.deepEqual(plain(j.series.read().right.ids),plain(h.series.read().right.ids));
});
test("real draws return the same numbered game with a choice of new leads and confirmed withdrawal checks the current save",()=>{
  const h=device(new Map(),true);h.click("register");h.click("default");h.click("start");
  rounds(h,r=>h.rules.coach(r.pos,0));assert.match(h.model().subtitle,/same game number/);
  h.click("view","game:0");const report=h.model();assert.equal(report.title,"Game 1 · Draw");assert.match(report.sections[0].text,/24 rounds/);
  assert.equal(report.sections.find(s=>s.title==="Your formation").rows.length,4);h.click("log",24);assert.equal(h.ring(),"log:24");
  h.home();h.click("next");assert.equal(h.series.desk().gameNumber,1);assert.deepEqual(plain(h.series.desk().picks),[]);h.click("default");
  h.click("view","pick-slot:dewfin");h.click("replace","dewfin|sprigkit");h.click("start");
  h.home();h.click("abandon");h.model();
  const other=device(h.store,true);assert.ok(other.series.commit("pick",0,"cover:0").ok);
  h.desk.act("yard-confirm",null,"abandon");assert.equal(h.series.desk().phase,"battle");assert.match(h.errors.at(-1),/Review/);
  h.click("abandon");h.click("view","battle");assert.equal(h.series.desk().phase,"battle");
  h.click("abandon");h.click("confirm");assert.equal(h.series.desk().phase,"register");
});
test("score and original six survive a completed losing series; a prior game's details never open another game's film",()=>{
  const h=device(),career=JSON.stringify(h.game.state),six=plain(h.series.desk().roster);h.click("register");
  for(let i=0;i<2;i++){
    h.click("default");h.click("start");rounds(h,r=>r.pos.sides[0].active.map((x,lane)=>x===null?null:"cover:"+lane));assert.equal(h.series.desk().games[i].winner,1);
    if(i===0){assert.match(h.find("next").label,/game 2/);h.click("next");}
  }
  const j=device(h.store);assert.equal(j.desk.entry(),"score");assert.equal(j.model().title,"Sela takes the Cup");assert.deepEqual(plain(j.series.desk().score),[0,2]);
  j.click("view","game:0");assert.equal(j.find("log"),undefined);assert.equal(j.model().sections.find(s=>s.title==="Sela’s formation").rows.length,4);
  j.click("view","score");j.click("restart");assert.deepEqual(plain(j.series.desk().roster),six);assert.equal(JSON.stringify(j.game.state),career);
});
test("an old picker cannot alter a freshly registered Cup with the identical six and empty draft",()=>{
  const h=device();h.click("register");const choice=h.find("pick","dewfin"),before=h.series.desk().id;
  const other=device(h.store);assert.ok(other.series.reset(true).ok);assert.ok(other.series.register().ok);
  assert.notEqual(other.series.desk().id,before);
  assert.ok(h.desk.act(choice.id,choice.value,"pick"));assert.match(h.errors.at(-1),/entry changed/);
  assert.deepEqual(plain(other.series.desk().picks),[]);
});
