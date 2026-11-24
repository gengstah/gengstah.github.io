const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {webcrypto}=require("node:crypto");
function session(){
  const disk=new Map(),storage={getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,v),removeItem:k=>disk.delete(k),key:i=>[...disk.keys()][i]??null,get length(){return disk.size;}};
  const w={crypto:webcrypto,localStorage:storage},ctx=vm.createContext({window:w});
  for(const file of ["atlas","bestiary","activities","story","campaign","duets","sparring-gear","sparring-signatures","sparring-battle","sparring-teams","bellpost-rules","rental-cards","twin-battle","twin-match","twin-ring","signal-box","engine"]){
    vm.runInContext(fs.readFileSync(path.join(__dirname,"../games/wilderkin",file+".js"),"utf8"),ctx);
  }
  const game=w.WilderGame,library=w.WilderRentalCards.create({game,storage}),row=(id,label,value,detail,extra)=>({id,label,value,detail,...extra});
  const four=library.featured()[0].card,roster={...four,ids:[...four.ids,"arcbill","cindlet"]},captain={...four,name:"Sela Switch",ids:["pincoil","coalmoth","mossbell","glimmeray","ironblink","gustlance"],gear:{}};
  const d={roster,captain,phase:"pick",picks:four.ids.slice(),games:[]};
  let view=null,route="signal-box";
  const room=w.WilderSignalBox.create({game,library,series:{desk:()=>d},row,image:id=>id,notify:msg=>assert.fail(msg),go:(r,v)=>{route=r;view=v;}});
  const model=()=>room.model(view),rows=()=>model().sections.flatMap(s=>s.rows||[]);
  function click(id,value){
    const option=rows().find(r=>r.id===id&&(value===undefined||r.value===value)&&!r.disabled);
    assert.ok(option,JSON.stringify([route,view,id,value,rows().map(r=>[r.id,r.value])]));assert.ok(room.act(id,option.value,view));model();
  }
  function order(lane,move){
    if(view!=="moves:"+lane)click("twin-lane",lane);
    if(!move.startsWith("attack:"))click("twin-tactic",lane+"|"+move.split(":")[0]);
    click("twin-pick",lane+"|"+move);
  }
  return {d,disk,view:()=>view,route:()=>route,model,rows,click,order,game,room};
}
test("a rehearsal shows only the public six, resolves real damage and compares a second attempt without editing any save",()=>{
  const h=session(),saved=[...h.disk],before=JSON.stringify(h.d),career=JSON.stringify(h.game.state);
  h.click("signal-lane",1);assert.equal(h.rows().filter(r=>r.id==="signal-foe").length,6);
  h.click("signal-foe","1|pincoil");h.click("signal-lane",0);h.click("signal-foe","0|pincoil");
  h.click("signal-start");assert.deepEqual([...h.model().twinField.right.map(x=>x.id)],["pincoil","coalmoth"]);
  h.order(0,"attack:bubble-jet:1");h.order(1,"call:1");h.click("twin-round");assert.equal(h.view(),"report");
  const first=h.rows().find(r=>r.label==="Coalmoth").detail;assert.match(first,/74 → 38/);
  h.click("signal-retry");h.order(0,"cover:1");h.order(1,"attack:tendril-whip:0");h.click("twin-round");
  assert.match(h.rows().find(r=>r.label==="Coalmoth").detail,/74 → 74 HP · \+36 HP/);
  h.click("twin-log",1);assert.match(h.model().title,/report/);h.click("twin-ring");assert.equal(h.view(),"report");
  h.click("signal-return");assert.equal(h.route(),"switchyard");assert.equal(h.view(),"pick");
  assert.deepEqual([...h.disk],saved);assert.equal(JSON.stringify(h.game.state),career);assert.equal(JSON.stringify(h.d),before);
});
test("a changed selection invalidates a stale rehearsal and a locked Cup cannot play another practice round",()=>{
  const h=session();h.click("signal-start");h.order(0,"attack:bubble-jet:1");
  h.d.picks=[...h.d.picks].reverse();assert.equal(h.model().title,"Signal Box");h.click("signal-start");
  assert.equal(h.model().twinField.left[0].id,h.d.picks[0]);h.d.phase="battle";assert.equal(h.model().title,"Signal Box");
  assert.equal(h.room.act("twin-round",null,h.view()),false);h.click("signal-return");assert.equal(h.route(),"switchyard");
});
