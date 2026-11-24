const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),crypto=require("node:crypto").webcrypto;
const names=["atlas","bestiary","activities","campaign","story","duets","sparring-gear","sparring-signatures","sparring-battle",
  "sparring-teams","bellpost-rules","bellpost-arena","bellpost","engine"];
const root=path.join(__dirname,"../games/wilderkin");
function device(store=new Map(),openFilmRoom){
  const localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
  const messages=[],w={localStorage,crypto,location:{origin:"https://game.test",pathname:"/games/wilderkin/",search:"?release=1"},navigator:{},
    history:{replaceState:(_,__,hash)=>{w.location.hash=hash;}}};
  const ctx=vm.createContext({window:w,crypto,btoa,atob,TextEncoder,TextDecoder,Uint8Array});
  for(const n of names){const f=path.join(root,n+".js");vm.runInContext(fs.readFileSync(f,"utf8"),ctx,{filename:f});}
  const game=w.WilderGame,rows=()=>model.sections.flatMap(s=>s.rows||[]);
  let route="desk",model,clip=null,prompt=null;
  const repaint=()=>{model=desk.model(route);};
  const go=(screen,next)=>{assert.equal(screen,"bellpost");route=next;repaint();};
  const row=(id,label,value,detail,extra)=>({id,label,value,detail,...extra});
  const desk=w.WilderBellpost.create({game,row,image:id=>id+".png",go,render:repaint,notify:m=>messages.push(m),openFilmRoom});
  w.navigator.clipboard={writeText:async url=>{clip=url;}};
  w.prompt=(label,value)=>{prompt={label,value};return null;};
  function open(hash){route=desk.loadFragment(hash);assert.ok(route);repaint();}
  function click(id,value){
    const action=rows().find(r=>r.id===id&&(value===undefined||r.value===value)&&!r.disabled);
    assert.ok(action,"No "+id+"/"+value+" in "+model.title);desk.act(action.id,action.value,route);
  }
  open("#bellpost");
  return {w,game,open,click,rows,desk,store,route:()=>route,model:()=>model,clip:()=>clip,prompt:()=>prompt,messages,
    hash:()=>w.location.hash,repaint:()=>repaint()};
}
const plain=x=>JSON.parse(JSON.stringify(x)),code=url=>url.slice(url.indexOf("#"));

test("returning to an earlier rehearsal keeps the selected film frame and preserves a newer correspondence position",()=>{
  const launched=[],host=device(new Map(),(...args)=>launched.push(args)),guest=device();
  host.click("post-new");host.click("post-confirm");guest.open(host.hash());guest.click("post-join",host.route().split("|")[1]);guest.click("post-confirm");
  host.open(guest.hash());host.click("post-move");
  const early=host.hash(),rules=host.w.WilderBellpostRules.create({game:host.game}),source=rules.inspect(early);
  host.click("post-film");host.click("post-rehearse",0);
  assert.equal(launched.length,1);assert.equal(launched[0][0].hash,source.hash);
  assert.equal(launched[0][1],0);assert.equal(launched[0][2].publicHash,early);
  guest.open(early);guest.click("post-move");host.open(guest.hash());
  const current=host.hash(),stored=JSON.stringify([...host.store]);
  const route=host.desk.showSourceFilm({source:{...source,seat:null},publicHash:early},0);
  assert.equal(host.desk.model(route).kicker,"DECISION 1 OF 1");
  assert.equal(host.hash(),early);assert.equal(JSON.stringify([...host.store]),stored);
  host.desk.act("post-battle",null,route);
  assert.equal(host.hash(),current);assert.equal(host.model().title,"Your turn");
});

test("clipboard, native share, selectable text and the address bar use a chat-safe letter while the stored packet stays raw",async()=>{
  const host=device(),guest=device(),spectator=device();
  host.click("post-new");host.click("post-confirm");host.click("post-copy");
  const url=host.clip(),invitation=code(url),id=host.route().split("|")[1];
  const rules=host.w.WilderBellpostRules.create({game:host.game}),legacy=rules.export(id);
  assert.match(url,/^https:\/\/game\.test\/games\/wilderkin\/\?release=1#bellpost-v2=/);
  assert.match(invitation,/\.x\.x\.x\.x$/);assert.equal(host.hash(),invitation);
  assert.match(legacy,/\.{4}$/);assert.equal(rules.inspect(invitation).hash,legacy);
  let shared;
  host.w.navigator.share=async payload=>{shared=payload;};host.repaint();host.click("post-share");
  await new Promise(r=>setImmediate(r));assert.equal(shared.url,url);
  host.click("post-link");assert.equal(host.prompt().value,url);

  guest.open(legacy+"%E2%80%9D");assert.equal(guest.hash(),invitation);guest.click("post-join",id);guest.click("post-confirm");
  const accepted=guest.hash();assert.match(accepted,/\.x\.x$/);
  host.open(accepted+"’");host.click("post-move");const turn=host.hash();assert.match(turn,/\.[A-W]+\.x$/);
  for(const suffix of ["’","”","…","。","%E2%80%99","%e2%80%9d","%E2%80%A6","%E3%80%82"]){
    assert.equal(rules.inspect(turn+suffix),null);
    spectator.open(turn+suffix);assert.equal(spectator.hash(),turn);assert.ok(!spectator.rows().some(r=>r.id==="post-move"));
  }
  spectator.click("post-copy");assert.equal(code(spectator.clip()),turn);
  spectator.click("post-desk");assert.equal(spectator.hash(),"#bellpost");
  spectator.w.prompt=()=>url+"…";spectator.click("post-paste");assert.equal(spectator.model().title,"You’re invited to Bellpost");
  assert.equal(spectator.hash(),invitation);
  spectator.open(invitation.replace("sprigkit","spri%E2%80%9Dgkit"));assert.equal(spectator.route(),"error");
  assert.equal(rules.export(id),rules.inspect(turn).hash);
});

test("drafts remain personal to the invitation, campaign lead and equipped Hall trio are usable, and viewing never joins",()=>{
  const a=device(),b=device();a.game.setLead("dewfin");
  const battle=a.game.state.battle,party=JSON.stringify(a.game.state.party);
  a.click("post-new");assert.deepEqual(plain(a.rows().filter(r=>r.id==="post-slot").map(r=>r.label)),["Dewfin","Sprigkit","Cindlet"]);
  a.click("post-slot",2);a.click("post-swap",0);assert.equal(a.rows()[0].label,"Cindlet");a.click("post-confirm");a.click("post-copy");
  const first=code(a.clip()),id=a.route().split("|")[1];assert.match(first,/^#bellpost-v2=/);
  b.open(first);assert.equal(b.model().title,"You’re invited to Bellpost");b.click("post-join",id);
  b.click("post-slot",0);b.click("post-choose","dewfin");b.click("post-desk");
  assert.equal(b.rows().some(r=>r.id==="post-open"),false);
  b.click("post-new");assert.equal(b.rows()[0].label,"Sprigkit");
  b.open(first);b.click("post-join",id);assert.equal(b.rows()[0].label,"Dewfin");
  const reload=device(b.store);reload.open(first);reload.click("post-join",id);assert.equal(reload.rows()[0].label,"Dewfin");
  const sh=a.game.state.sparring||{setup:{}};sh.setup={left:["gustlance","opalclasp","fernprickle"],gear:{left:{gustlance:"relay-bell"}}};
  a.game.state.sparring=sh;a.click("post-desk");a.click("post-new");a.click("post-use-hall");
  assert.ok(a.rows().find(r=>r.label==="Gustlance").detail.includes("Relay Bell"));
  a.click("post-use-trail");assert.equal(a.rows()[0].label,"Dewfin");
  assert.equal(a.game.state.battle,battle);assert.equal(JSON.stringify(a.game.state.party),party);
});

test("pasting a whole message extracts its Bellpost letter and preserves the complete legacy or current turn",()=>{
  const host=device(),guest=device(),reader=device();
  host.click("post-new");host.click("post-confirm");host.click("post-copy");
  const invitation=host.clip(),id=host.route().split("|")[1];
  function paste(d,message){
    d.open("#bellpost");d.w.prompt=()=>message;d.click("post-paste");
  }
  const rawInvite=host.w.WilderBellpostRules.create({game:host.game}).export(id);
  for(const message of [invitation+".","#news: Your move! "+invitation+". Good luck!",
    "Choose your team:\n**[Join](<"+rawInvite+">)**.\nSee you there."]){
    paste(guest,message);
    assert.equal(guest.model().title,"You’re invited to Bellpost");assert.equal(guest.hash(),code(invitation));
  }
  guest.click("post-join",id);guest.click("post-confirm");host.open(guest.hash());host.click("post-move");
  const turn=host.hash(),rawTurn=host.w.WilderBellpostRules.create({game:host.game}).export(id);
  for(const message of ["Your move! https://game.test/games/wilderkin/"+turn+". Good luck!",
    "Play [your turn]("+turn+"), then send it back.","Your reply: "+rawTurn+"..",
    "Copy this fragment: "+String.fromCharCode(96)+turn+String.fromCharCode(96)+"!"]){
    paste(reader,message);assert.equal(reader.hash(),turn);
    assert.ok(reader.rows().some(r=>r.id==="post-film"));assert.ok(!reader.rows().some(r=>r.id==="post-move"));
  }
  for(const bad of [turn.replace("sprigkit","sprig)kit"),turn.replace(/\.[A-W]+\.x$/,".Afoo!B.x"),
    turn.replace(/\.[A-W]+\.x$/,".A!B.x"),turn+".broken",turn+"!".repeat(2000)+"Z"]){
    paste(reader,"Your move! "+bad+". Good luck!");
    assert.equal(reader.route(),"error");assert.equal(reader.rows().some(r=>r.id==="post-join"||r.id==="post-move"),false);
  }
});

test("real two-seat exchange uses the latest link, handles cancellation and lets a spectator inspect film",async()=>{
  const host=device(),guest=device(),observer=device();host.click("post-new");host.click("post-confirm");host.click("post-copy");
  const invite=code(host.clip()),id=host.route().split("|")[1];guest.open(invite);guest.click("post-join",id);guest.click("post-confirm");
  assert.ok(!guest.rows().some(r=>r.id==="post-move"));guest.click("post-copy");
  const answer=code(guest.clip());host.open(answer);assert.ok(host.rows().some(r=>r.id==="post-move"));
  host.click("post-move");const after=host.hash();assert.notEqual(after,answer);
  guest.open(after);assert.ok(guest.rows().some(r=>r.id==="post-move"));
  guest.open(invite);assert.ok(guest.rows().some(r=>r.id==="post-move"));guest.click("post-copy");
  assert.equal(code(guest.clip()),after);
  observer.open(after);assert.ok(!observer.rows().some(r=>r.id==="post-move"));observer.click("post-film");assert.equal(observer.model().title,"Battle film");
  host.w.navigator.clipboard={writeText:async()=>{throw Error("denied");}};
  host.click("post-copy");await new Promise(r=>setImmediate(r));assert.equal(code(host.prompt().value),after);
  host.w.navigator.share=async()=>{const e=Error("cancel");e.name="AbortError";throw e;};
  host.repaint();const count=host.messages.length;host.click("post-share");await new Promise(r=>setImmediate(r));
  assert.equal(host.messages.length,count);assert.equal(host.hash(),after);
});

test("closing an invitation or archiving a result requires confirmation and preserves other local and guest seats",()=>{
  const a=device(),b=device(),observer=device();
  a.click("post-new");a.click("post-confirm");const withdrawn=a.hash();
  a.click("post-manage","withdraw");a.click("post-battle");assert.equal(a.model().title,"Invitation ready");
  a.click("post-manage","withdraw");a.click("post-close","withdraw");
  assert.ok(!a.rows().some(r=>r.id==="post-open"));a.open(withdrawn);assert.equal(a.model().title,"Invitation withdrawn");
  a.click("post-new");a.click("post-confirm");const invitation=a.hash(),id=a.route().split("|")[1];
  b.open(invitation);assert.ok(!b.rows().some(r=>r.id==="post-manage"));b.click("post-join",id);b.click("post-confirm");
  const old=device(a.store);old.open(invitation);old.click("post-manage","withdraw");
  a.open(b.hash());old.click("post-close","withdraw");assert.ok(a.rows().some(r=>r.id==="post-move"));
  a.click("post-resign-confirm");a.click("post-resign");const final=a.hash();
  b.open(final);observer.open(final);assert.ok(!observer.rows().some(r=>r.id==="post-manage"||r.id==="post-resign-confirm"));
  a.click("post-manage","archive");a.click("post-close","archive");assert.ok(!a.rows().some(r=>r.id==="post-open"));
  a.open(final);a.click("post-film");assert.equal(a.model().title,"Battle film");
  b.click("post-desk");assert.ok(b.rows().some(r=>r.id==="post-open"&&r.value===id));
});

test("a still-legal move in an old rendered tab cannot modify a newer exchange",()=>{
  const a=device(),b=device();a.click("post-new");a.click("post-confirm");
  const invite=a.hash(),id=a.route().split("|")[1];b.open(invite);b.click("post-join",id);b.click("post-confirm");
  a.open(b.hash());const old=device(a.store);old.open(b.hash());
  a.click("post-move");b.open(a.hash());b.click("post-move");a.open(b.hash());
  const latest=b.hash();old.click("post-move");assert.match(old.messages.at(-1),/updated this match/);
  old.click("post-copy");assert.equal(code(old.clip()),latest);
});
