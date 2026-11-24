const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),crypto=require("node:crypto").webcrypto;
const root=path.join(__dirname,"../games/wilderkin");
const files=["atlas","bestiary","activities","campaign","story","duets","sparring-gear","sparring-signatures","sparring-battle",
  "sparring-teams","sparring","scout-rules","scout-table","engine"];
const scripts=files.map(n=>new vm.Script(fs.readFileSync(path.join(root,n+".js"),"utf8"),{filename:n+".js"}));
const plain=x=>JSON.parse(JSON.stringify(x));
function browser(store=new Map()){
  const loc={origin:"https://game.test",pathname:"/games/wilderkin/",search:"?test=1",hash:"#scout-table"};
  const w={crypto,location:loc,history:{replaceState:(_,__,hash)=>{loc.hash=hash;}},navigator:{},
    localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k),
      key:i=>Array.from(store.keys())[i],get length(){return store.size;}}};
  const ctx=vm.createContext({window:w,crypto,Uint8Array});scripts.forEach(s=>s.runInContext(ctx));
  const g=w.WilderGame,rules=w.WilderScoutRules.create({game:g}),messages=[],opened=[];
  let route="desk",copied="",native="",answer=null,prompted="",active=true;
  const row=(id,label,value,detail,extra)=>({id,label,value,detail,...extra});
  const go=(screen,next)=>{assert.equal(screen,"scout-table");route=next;repaint();};
  let model;
  const shared=[],ui=w.WilderScoutTable.create({game:g,rules,row,image:id=>id+".png",go,render:repaint,notify:m=>messages.push(m),
    openBattle:r=>{opened.push(r);return true;},active:()=>active,openSharedMessage:async text=>{if(text.includes("#scout-bout1=")){shared.push(text);return true;}return false;}});
  function repaint(){model=ui.model(route);}
  w.prompt=(_message,value)=>{prompted=value;return answer;};
  w.navigator.clipboard={writeText:async s=>{copied=s;}};w.navigator.share=async o=>{native=o.url;};
  const rows=()=>model.sections.flatMap(s=>s.rows||[]);
  const act=(cmd,value)=>{const r=rows().find(r=>r.id==="scout-"+cmd&&(value===undefined||r.value===value)&&!r.disabled);
    assert.ok(r,"No "+cmd+" "+String(value)+" on "+route+" · "+model.title);ui.act(r.id,r.value,route);};
  async function at(match){
    const limit=Date.now()+2500;
    while(!route.startsWith(match)&&Date.now()<limit)await new Promise(r=>setTimeout(r,5));
    assert.ok(route.startsWith(match),"expected "+match+", at "+route+" · "+messages.join("; "));
  }
  async function open(hash){const next=await ui.loadFragment(hash);assert.ok(next);go("scout-table",next);}
  repaint();
  return {w,rules,g,ui,rows,act,at,open,opened,messages,shared,get view(){return model;},get route(){return route;},get hash(){return loc.hash;},
    get copy(){return copied;},get native(){return native;},get prompted(){return prompted;},type:text=>{answer=text;},setActive:v=>{active=v;},store};
}
async function register(d,guest=false){
  if(guest)d.act("join");else d.act("new");
  d.act("register-check");d.act("register");await d.at("table|");return d.hash;
}
async function lock(d,ids){
  d.act("order");for(const id of ids)d.act("pick",id);d.act("lock-check");d.act("lock");await d.at("table|");return d.hash;
}
test("fresh browsers build four, hide both choices until due, scout real attacks, receive late links, reveal six, and can enter their own or spectator battle",async()=>{
  const h=browser(),g=browser(),publicView=browser(),initial=JSON.stringify(h.g.state);
  h.act("new");assert.equal(h.rows().filter(r=>r.id==="scout-slot").length,4);
  h.act("slot",3);h.act("catalog");assert.ok(h.view.sections.some(s=>s.title==="500 matching loaners"));
  h.type("Backdraft");h.act("search");assert.ok(h.view.sections.some(s=>s.title==="26 matching loaners"));
  h.type("Kilnbeak");h.act("search");h.act("choose","kilnbeak");h.act("slot",3);h.act("gear");h.act("equip","opening-pennant");h.act("draft");
  h.act("register-check");h.act("register");await h.at("table|");const ticket=h.hash;
  h.act("copy");h.act("link");h.act("share");assert.equal(h.prompted,h.copy);assert.equal(h.native,h.copy);
  assert.ok(!ticket.includes("kilnbeak"));
  await g.open(ticket);assert.equal(JSON.stringify(g.view).includes("Kilnbeak"),false);
  const s1=await register(g,true);assert.ok(!s1.includes("kilnbeak"));
  await h.open(s1);h.act("rival");const rival=h.rows().find(r=>r.id==="scout-inspect");h.act("inspect",rival.value);
  assert.equal(h.view.sections.find(s=>s.title==="Your team’s attacks").rows.length,4);
  assert.equal(h.view.sections.find(s=>s.title==="Possible duets").rows.length,3);
  h.act("order");h.act("pick","dewfin");h.act("pick","sprigkit");h.act("remove","dewfin");h.act("table");
  const h2=browser(h.store);await h2.open(s1);h2.act("order");
  assert.ok(h2.rows().find(r=>r.label==="Lead · Sprigkit"));h2.act("pick","kilnbeak");h2.act("pick","dewfin");
  h2.act("lock-check");h2.act("lock");await h2.at("table|");const s2=h2.hash;
  assert.ok(s2.includes("kilnbeak~opening-pennant"));
  await publicView.open(s2);assert.equal(publicView.rows().some(r=>r.id==="scout-order"||r.id==="scout-join"),false);
  assert.equal(JSON.stringify(publicView.view).includes("Your sealed formation"),false);
  await g.open(s2);g.act("rival");g.act("inspect","kilnbeak");assert.ok(g.view.sections.some(s=>s.title==="Opening Pennant"));g.act("order");g.act("table");
  const s3=await lock(g,["dewfin","charquill","cindlet"]);
  await publicView.open(s3);assert.equal(publicView.view.sections.find(s=>s.title==="Guest’s locked formation").rows[0].label,"Dewfin");
  await h2.open(s3);const final=h2.hash;assert.notEqual(s3,final);
  await Promise.all([g.open(final),publicView.open(final)]);
  for(const [d,seat] of [[h2,0],[g,1],[publicView,null]]){
    assert.ok(d.rows().some(r=>r.id==="scout-play"));d.act("report");assert.match(d.view.subtitle,/takes the first turn/);
    assert.equal(d.rows().filter(r=>r.badge==="SITS OUT").length,2);d.act("play");
    const r=d.opened.at(-1);assert.equal(r.seat,seat);
    assert.deepEqual(plain(r.battle.teams[0]),{ids:["sprigkit","kilnbeak","dewfin"],gear:{kilnbeak:"opening-pennant"}});
    assert.deepEqual(plain(r.battle.teams[1].ids),["dewfin","charquill","cindlet"]);
  }
  await h2.open(s1);assert.equal(h2.hash,final);assert.equal(JSON.stringify(h.g.state),initial);
  h2.act("archive-check");h2.act("archive");assert.equal(h2.rules.list().length,0);
  await h2.open(final);h2.act("report");assert.equal(h2.view.title,"The revealed formations");
  assert.ok(h2.rows().some(r=>r.label==="Watch the battle"));h2.act("play");assert.equal(h2.opened.at(-1).seat,null);
  assert.ok(h2.rules.get(h2.opened.at(-1).id).archived);
  assert.equal(h2.ui.model("report|"+h2.opened.at(-1).id).title,"The revealed formations");
});
test("Hall and trail imports, personal equipment transfer and withdrawal preserve campaign and private drafts",async()=>{
  const d=browser();d.g.setLead("dewfin");
  const saved=plain(d.g.state.sparring);saved.setup={left:["kilnbeak","charquill","mossbell"],right:["sprigkit","cindlet","dewfin"],gear:{left:{mossbell:"last-stitch"},right:{}}};
  d.g.saveSparring(saved);const before=JSON.stringify(d.g.state);
  d.act("new");d.act("import","hall");let slots=d.rows().filter(r=>r.id==="scout-slot");
  assert.deepEqual(plain(slots.map(r=>r.label)),["Kilnbeak","Charquill","Mossbell","Dewfin"]);assert.match(slots[2].detail,/Lifeline Stitch/);
  d.act("slot",0);d.act("gear");assert.match(d.rows().find(r=>r.value==="last-stitch").detail,/Move from Mossbell/);
  d.act("equip","last-stitch");d.act("draft");slots=d.rows().filter(r=>r.id==="scout-slot");assert.match(slots[0].detail,/Stitch/);assert.doesNotMatch(slots[2].detail,/Stitch/);
  d.act("import","trail");assert.equal(d.rows().filter(r=>r.id==="scout-slot")[0].label,"Dewfin");
  d.act("register-check");d.act("register");await d.at("table|");const original=d.hash;d.act("archive-check");d.act("table");assert.equal(d.hash,original);
  d.act("archive-check");d.act("archive");assert.equal(d.route,"desk");assert.equal(d.rules.list().length,0);
  await d.open(original);assert.equal(d.view.title,"Table archived");assert.ok(!d.rows().some(r=>r.id==="scout-play"||r.id==="scout-order"));
  assert.equal(JSON.stringify(d.g.state),before);
});
test("native paste accepts chat wrappers, does not join on inspection and delegates only matching shared battle messages",async()=>{
  const h=browser(),d=browser();const ticket=await register(h);h.act("copy");const link=h.copy;
  d.type("My scout invitation: ["+link+"]( "+link+" )!");d.act("paste");await d.at("table|");assert.equal(d.hash,ticket);
  assert.equal(d.rules.list().length,0);d.act("desk");d.type("Open this [match](https://game.test/#scout-bout1=example).");d.act("paste");
  await new Promise(r=>setImmediate(r));assert.equal(d.shared.length,1);assert.equal(d.route,"desk");
  await d.open(ticket+"%E2%80%9D");assert.equal(d.hash,ticket);await d.open(ticket+".bad!");assert.equal(d.route,"error");
  assert.equal(d.rules.list().length,0);assert.equal(d.ui.act("elsewhere",null,"desk"),false);
});
