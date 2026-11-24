const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const scripts=["atlas","bestiary","activities","campaign","story","duets","sparring-gear","sparring-signatures","sparring-battle","sparring-teams","partner-search","partner-finder","engine"].map(name=>{
  const file=path.join(__dirname,"../games/wilderkin",name+".js");return new vm.Script(fs.readFileSync(file,"utf8"),{filename:file});
});
const plain=x=>JSON.parse(JSON.stringify(x));
function boot(){
  let view,demo,guided,left=false,prompt="",applied=[];
  const w={prompt:()=>prompt},sandbox=vm.createContext({window:w});scripts.forEach(s=>s.runInContext(sandbox));
  const game=w.WilderGame,source={anchor:"dewfin",slot:1,team:["dewfin","sprigkit","cindlet"],foes:["pincoil","coalmoth","mossbell"],role:"mend",
    label:"your Hall trio",apply:id=>applied.push(id),back:()=>{left=true;}};
  const ctrl=w.WilderPartnerFinder.create({game,go:(name,value)=>{assert.equal(name,"partner-finder");view=value;},row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),
    image:id=>id+".png",openDrill:r=>{demo=r;},defaultContext:()=>source,fieldGuide:id=>{guided=id;}});
  const model=()=>ctrl.model(view),rows=()=>model().sections.flatMap(s=>s.rows||[]),find=(id,value)=>rows().find(r=>r.id==="finder-"+id&&(value===undefined||value===r.value));
  const click=(id,value)=>{const b=find(id,value);assert.ok(b&&!b.disabled,[id,value,view,model().title].join(" / "));assert.ok(ctrl.act(b.id,b.value,view));};
  return {ctrl,source,game,model,rows,find,click,applied,view:()=>view,demo:()=>demo,guided:()=>guided,left:()=>left,prompt:q=>{prompt=q;}};
}

test("a fresh player can play the advertised pair with one key, compare a real offensive/defensive tradeoff and keep one partner",()=>{
  const h=boot(),before=JSON.stringify(h.game.state);
  assert.match(h.model().subtitle,/Keep Dewfin/);
  assert.ok(h.find("drill","sprigkit"));assert.equal(h.find("drill","sprigkit").key,"1");
  assert.equal(h.ctrl.key({key:"1",repeat:true}),false);
  assert.equal(h.ctrl.key({key:"1"}),true);const drill=h.demo();assert.equal(drill.anchor,"dewfin");assert.equal(drill.partner,"sprigkit");
  assert.equal(drill.cost,2);assert.equal(drill.role,"mend");assert.deepEqual(plain(drill.team),h.source.team);
  h.click("compare","marshcurl|thicketowl");const parts=h.model().sections;
  assert.deepEqual(plain(parts.slice(0,2).map(s=>s.title)),["Marshcurl","Thicketowl"]);
  assert.match(parts[0].rows[0].label,/Returning Current · 2 beats/);assert.match(parts[1].rows[0].label,/Rain Garden · 2 beats/);
  assert.match(parts[0].rows[1].detail,/deals 27 to Pincoil.+deals 17 to Marshcurl/);assert.match(parts[1].rows[1].detail,/deals 24 to Pincoil.+deals 12 to Thicketowl/);
  assert.match(parts[0].rows[2].detail,/Needs 2 more beats/);
  h.click("drill","marshcurl");assert.deepEqual(plain(h.demo().team),["dewfin","marshcurl","cindlet"]);h.demo().returnToFinder();
  assert.equal(h.view(),"kin:marshcurl");h.click("guide","marshcurl");assert.equal(h.guided(),"marshcurl");h.click("apply","marshcurl");
  assert.deepEqual(h.applied,["marshcurl"]);assert.equal(JSON.stringify(h.game.state),before);
});

test("all six jobs, kin/move/duet search, any-opponent mode and arbitrary pair comparison use actual eligible holders",()=>{
  const h=boot();
  h.click("view","jobs");assert.equal(h.rows().filter(r=>r.id==="finder-role"&&!r.disabled).length,7);h.click("role","rush");
  assert.match(h.model().sections[0].rows[0].label,/Storm Channel/);
  h.prompt("Rain Garden");h.click("search");assert.ok(h.find("view","jobs").label.includes("Heal together"));
  const first=h.rows().find(r=>r.id==="finder-kin");assert.match(first.detail,/Rain Garden · 2 beats/);
  h.click("kin",first.value);h.click("pin",first.value);
  const second=h.rows().find(r=>r.id==="finder-kin"&&r.value!==first.value);h.click("kin",second.value);assert.equal(h.model().title,"Compare partners");
  h.click("view",null);h.prompt("Backdraft");h.click("search");const vent=h.rows().find(r=>r.id==="finder-kin");h.click("kin",vent.value);
  assert.ok(h.rows().some(r=>r.label==="Backdraft"));h.click("view",null);
  h.prompt("does not exist");h.click("search");assert.ok(h.model().sections.some(s=>s.title==="No matching partner"));h.click("clear");
  h.click("view","foes");h.prompt("iceribbon");h.click("foe-search");h.click("foe","iceribbon");assert.match(h.find("view","foes").label,/Iceribbon/);
  h.click("view","foes");h.click("foe","all");assert.match(h.find("view","foes").label,/Any/);
  assert.ok(h.rows().filter(r=>r.id==="finder-kin").every(r=>!r.detail.includes("×")));
  h.click("view","anchors");h.click("anchor","cindlet");h.click("view","jobs");assert.ok(h.find("role","mend").disabled);h.click("view",null);
  h.click("back");assert.equal(h.left(),true);
});

test("scoped four registration keeps all unchanged slots and equipment, admits stale-safe callbacks and imports catalog intent",()=>{
  const h=boot(),ids=["marshcurl","cindlet","dewfin","pincoil"],gear={marshcurl:"relay-bell",dewfin:"opening-pennant",cindlet:"prism-lens"};
  h.ctrl.open({...h.source,anchor:"dewfin",slot:0,team:ids,gear,query:"Rain Garden",label:"Nell’s practice"});assert.match(h.find("search").label,/Rain Garden/);
  h.prompt("Sprigkit");h.click("search");h.click("kin","sprigkit");
  assert.match(h.rows()[0].detail,/Dewfin holds Opening Pennant \+ Sprigkit/);
  h.click("drill","sprigkit");assert.deepEqual(plain(h.demo().team),["sprigkit","cindlet","dewfin","pincoil"]);
  assert.deepEqual(plain(h.demo().gear),{cindlet:"prism-lens",dewfin:"opening-pennant"});assert.ok(!h.demo().team.includes("marshcurl"));
  h.ctrl.act("finder-apply","cindlet");h.ctrl.act("finder-apply","stillwake");h.ctrl.act("finder-apply","dewfin");assert.deepEqual(h.applied,[]);
  h.click("apply","sprigkit");assert.deepEqual(h.applied,["sprigkit"]);assert.deepEqual(ids,["marshcurl","cindlet","dewfin","pincoil"]);assert.equal(gear.marshcurl,"relay-bell");
  h.ctrl.open({...h.source,query:"heal"});assert.match(h.find("view","jobs").label,/Heal together/);assert.equal(h.find("search").label,"Find a move or kin");
});

test("private registrations start without an opponent and keep a catalog job when changing the anchor",()=>{
  const h=boot();h.ctrl.open({...h.source,team:["sprigkit","cindlet","dewfin","gustlance"],slot:3,anchor:"sprigkit",foes:[],role:"mend",query:""});
  assert.ok(h.find("view","foes").label.endsWith("Any"));h.click("view","foes");
  assert.ok(!h.model().sections.some(s=>s.title==="Their roster"));h.click("view",null);
  h.click("view","anchors");h.click("anchor","dewfin");assert.ok(h.find("view","jobs").label.includes("Heal together"));
  h.click("view","anchors");h.click("anchor","cindlet");assert.ok(h.model().sections.some(s=>s.title==="No matching partner"));
  h.click("view","jobs");h.click("role","rush");assert.ok(h.rows().some(r=>r.id==="finder-kin"));
});

test("owned and current habitat stay within a field guide selection, including direct cards and commands",()=>{
  const h=boot(),area=plain(h.game.pools[h.game.state.region]),local=area.find(id=>!h.source.team.includes(id));
  h.ctrl.open({...h.source,catalog:["sprigkit",local,"stillwake"],catalogLabel:"Seen kin",role:"all"});
  const candidates=()=>h.rows().filter(r=>r.id==="finder-kin").map(r=>r.value);
  assert.deepEqual([...candidates()].sort(),["sprigkit",local].sort());
  h.click("view","scopes");h.click("scope","local");assert.deepEqual([...candidates()].sort(),[...new Set([local,...(area.includes("sprigkit")?["sprigkit"]:[])])].sort());
  h.click("view","scopes");h.click("scope","owned");assert.deepEqual([...candidates()],["sprigkit"]);
  h.ctrl.act("finder-apply",local);h.ctrl.act("finder-drill","thicketowl");assert.deepEqual(h.applied,[]);assert.equal(h.demo(),undefined);
  assert.equal(h.ctrl.model("kin:thicketowl").title,"Partner Finder");assert.equal(h.ctrl.model("compare:sprigkit|thicketowl").title,"Partner Finder");
  h.click("view","scopes");assert.ok(h.find("scope","all").label.includes("Seen"));h.click("scope","all");assert.ok(!candidates().includes("thicketowl"));
  const screen=h.view();h.ctrl.reset();assert.equal(h.view(),screen);assert.ok(h.find("compare","marshcurl|thicketowl"));
});
