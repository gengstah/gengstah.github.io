const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const scripts=["atlas","bestiary","activities","campaign","story","duets","sparring-gear","sparring-signatures","sparring-battle","sparring-teams","engine","bellpost-rules","rental-cards","rental-counter"].map(name=>{
  const file=path.join(__dirname,"../games/wilderkin",name+".js");return new vm.Script(fs.readFileSync(file,"utf8"),{filename:file});
});
const plain=x=>JSON.parse(JSON.stringify(x));
function boot(){
  let view=null,prompt=null,afterDrill=null;const map=new Map(),actions=[],notices=[];
  const storage={get length(){return map.size;},getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),
    removeItem:k=>map.delete(k),key:i=>[...map.keys()][i]??null};
  const window={localStorage:storage,prompt:()=>prompt};const ctx=vm.createContext({window});scripts.forEach(s=>s.runInContext(ctx));
  const game=window.WilderGame,library=window.WilderRentalCards.create({game,storage});
  const room=window.WilderRentalCounter.create({game,library,go:(route,v)=>{assert.equal(route,"rental-counter");view=v;},row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),
    image:id=>id+".png",notify:msg=>notices.push(msg),borrowSolo:c=>actions.push(["solo",c]),borrowTable:c=>actions.push(["host",c]),
    challengeSolo:c=>actions.push(["rival",c]),tryPair:(c,back)=>{actions.push(["drill",c]);afterDrill=back;},
    share:(hash,name)=>actions.push(["share",hash,name]),pasteRental:()=>actions.push(["paste"])});
  const model=()=>room.model(view),rows=()=>model().sections.flatMap(s=>s.rows||[]);
  const find=(id,value)=>rows().find(r=>r.id==="hire-"+id&&(value===undefined||r.value===value));
  const click=(id,value)=>{const b=find(id,value);assert.ok(b&&!b.disabled,[id,value,model().title,JSON.stringify(plain(rows()).map(r=>[r.id,r.value]))].join(" "));
    assert.equal(room.act(b.id,b.value,view),true);};
  return {room,window,game,library,model,rows,find,click,actions,notices,answer:x=>{prompt=x;},view:()=>view,returnPair:()=>afterDrill?.()};
}

test("fresh card opens on the real four, actual gear and all six duets, then borrows or challenges that whole team",()=>{
  const h=boot(),home=h.model(),expected=plain(h.library.featured()[0].card),opening=JSON.stringify(h.game.state);
  assert.equal(home.title,expected.name);assert.equal(h.room.hashFor(null),null);
  assert.deepEqual(plain(home.sections[0].rows.map(r=>r.image)),expected.ids.map(x=>x+".png"));
  assert.match(home.subtitle,/Mossbell.+Pincoil/);assert.match(home.sections[0].rows[0].detail,/Opening Pennant/);
  h.click("kin","featured:0|thicketowl");assert.equal(h.model().sections[0].rows[0].label,"Mender’s Wrap");
  assert.match(h.model().sections[1].rows.find(r=>r.label.includes("Rain Garden")).detail,/Dewfin.+quarter/);
  h.click("card","featured:0");h.click("duets");assert.equal(h.model().sections[0].rows.length,6);
  const pairs=expected.ids.flatMap((a,i)=>expected.ids.slice(i+1).map(b=>h.window.WilderSparringTeams.scoutDuets(h.game.species,[a,b])[0]));
  assert.deepEqual(plain(h.model().sections[0].rows.map(r=>r.label)),pairs.map(p=>p.label));
  h.click("card","featured:0");h.model();assert.equal(h.room.key({key:"1",repeat:true},h.view()),false);
  assert.equal(h.room.key({key:"1"},h.view()),true);
  h.click("challenge");h.click("table");h.click("pair");h.returnPair();
  assert.deepEqual(plain(h.actions),[["solo",expected],["rival",expected],["host",expected],["drill",expected]]);
  assert.equal(JSON.stringify(h.game.state),opening);assert.equal(h.library.list().length,0);
});

test("a shared or renamed exact roster retains its coach plan, valid Unicode title and public-only share link",()=>{
  const h=boot(),f=h.library.featured()[0],gift={...plain(f.card),name:"Jo’s green & gold"},hash=h.library.encode(gift);
  h.room.reset(gift);assert.equal(h.room.hashFor(null),hash);assert.equal(h.model().title,gift.name);assert.equal(h.model().subtitle,f.plan);
  h.click("share");assert.deepEqual(h.actions,[[ "share",hash,gift.name ]]);h.answer(null);h.click("save");assert.equal(h.library.list().length,0);
  h.answer("   ");h.click("save");assert.equal(h.library.list().length,0);assert.match(h.notices.at(-1),/name/);
  h.answer("Tide | Bell 🐦");h.click("save");assert.equal(h.model().title,"Tide | Bell 🐦");assert.equal(h.library.list().length,1);
  assert.equal(h.room.hashFor(h.view()),h.library.encode({...gift,name:"Tide | Bell 🐦"}));
  h.answer("Second edition");h.click("save");assert.equal(h.library.list().length,2);h.click("forget");h.click("card");assert.equal(h.library.list().length,2);
  const ref=h.find("forget").value;h.room.act("hire-remove",ref,h.view());assert.equal(h.library.list().length,2);
  h.click("forget");h.click("remove");assert.equal(h.library.list().length,1);assert.equal(h.model().title,"Browse rental teams");
  h.room.reset({...gift,ids:[gift.ids[1],gift.ids[0],...gift.ids.slice(2)]});assert.notEqual(h.room.model(null).subtitle,f.plan);
});

test("context starts on its registration, keeps saved and received examples private until an explicit apply, and lists all shelf pages",()=>{
  const h=boot(),sample=plain(h.library.featured()[1].card),current={...sample,name:"Under construction"},calls=[];
  const before=JSON.stringify(current);
  h.room.open({card:current,label:"My Scout registration",apply:c=>calls.push(plain(c)),back:()=>calls.push("back")});
  assert.equal(h.model().title,current.name);assert.equal(h.room.hashFor(h.view()),null);assert.ok(h.model().sections[1].rows.some(r=>r.id==="hire-save"));
  assert.equal(h.find("apply"),undefined);h.click("browse");h.click("card","featured:0");h.click("share");assert.deepEqual(calls,[]);
  assert.equal(h.room.hashFor(h.view()),null);h.click("apply");assert.deepEqual(calls,[plain(h.library.featured()[0].card)]);h.click("back");assert.equal(calls[1],"back");
  assert.equal(JSON.stringify(current),before);
  for(let i=0;i<8;i++)h.library.save({...sample,name:"Bench "+i});h.click("browse");assert.ok(h.find("browse",1));
  assert.equal(h.model().sections.find(s=>s.title==="Your saved teams · 8").rows.length,5);
  h.click("browse",1);assert.equal(h.model().sections.find(s=>s.title==="Your saved teams · 8").rows.length,3);
  const stored=h.model().sections.find(s=>s.title==="Your saved teams · 8").rows[0];h.click("card",stored.value);
  const record=h.library.list().find(r=>r.card.name===stored.label);h.library.remove(record.id);
  assert.equal(h.model().title,"Rental card unavailable");h.room.act("hire-remove",stored.value,h.view());assert.equal(h.model().title,"Browse rental teams");
  assert.equal(h.library.list().length,7);
});

test("invalid or missing cards show recovery actions without silently selecting a team or issuing an invitation",()=>{
  const h=boot();h.room.reset(null,"invalid");assert.equal(h.model().title,"Rental card unavailable");assert.equal(h.room.hashFor(null),null);
  h.click("paste");h.click("browse");assert.deepEqual(h.actions,[["paste"]]);h.click("card","featured:2");assert.match(h.model().subtitle,/Bell Foundry/);
  h.room.reset("#rental-v1=bad");assert.equal(h.room.model(null).title,"Rental card unavailable");assert.equal(h.library.list().length,0);
});

test("pasting a visiting rental keeps the original callback and orders, requires an explicit use, and recovers from a bad paste",()=>{
  const h=boot(),old=plain(h.library.featured()[2].card),next=plain(h.library.featured()[0].card),used=[];
  h.room.open({label:"Visiting registration",card:old,apply:c=>{used.push(plain(c));return false;},back:()=>used.push("left")});
  assert.equal(h.room.importCard(next),true);assert.equal(h.view(),"card|shared");
  assert.equal(h.model().title,next.name);assert.equal(h.room.hashFor(h.view()),null);assert.equal(used.length,0);
  const validView=h.view();
  assert.equal(h.room.importCard("bad packet"),false);assert.equal(h.model().title,"Rental card unavailable");assert.equal(h.room.model(validView).title,next.name);
  h.room.importCard(next);h.click("apply");assert.deepEqual(used,[next]);assert.match(h.notices.at(-1),/registration changed/i);h.click("back");assert.equal(used[1],"left");
  assert.equal(h.room.model("card|current").title,old.name);
});
