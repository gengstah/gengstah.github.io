const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const copy=x=>JSON.parse(JSON.stringify(x));
const scripts=["atlas","bestiary","activities","campaign","story","duets","engine","sparring-gear","sparring-signatures","sparring-battle","bellpost-rules"];
const ctx=vm.createContext({window:{crypto:require("node:crypto").webcrypto}});
for(const name of scripts){
  const file=path.join(__dirname,"../games/wilderkin",name+".js");
  vm.runInContext(fs.readFileSync(file,"utf8"),ctx,{filename:file});
}
const game=ctx.window.WilderGame,sim=ctx.window.WilderSparringBattle.create({game});
const factory=ctx.window.WilderBellpostRules;
const home={ids:["mossbell","fernprickle","dewfin"],gear:{mossbell:"opening-pennant",dewfin:"last-stitch"}};
const away={ids:["cindlet","gustlance","sprigkit"],gear:{gustlance:"opening-pennant"}};
function storage(map=new Map()){
  return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),
    key:i=>[...map.keys()][i],get length(){return map.size;}};
}
const desk=(s=storage())=>factory.create({game,storage:s});
function ok(res){assert.ok(res.ok,res.message);return res.record;}
function seated(left=home,right=away) {
  const sa=storage(),sb=storage(),h=desk(sa),g=desk(sb),ticket=ok(h.invite(left)),guest=ok(g.join(ticket.hash,right));
  ok(h.receive(guest.hash));
  return {sa,sb,h,g,id:ticket.id,ticket};
}
function strike(pos) {
  const legal=sim.options(pos).filter(m=>m.available);
  return pos.phase==="replace"?legal[0]:legal.filter(m=>m.kind==="attack"||m.kind==="duet").sort((a,b)=>b.damage-a.damage)[0];
}

test("a public invitation owns no seat until explicit join; guest identity, teams and legal equipment stay locked",()=>{
  const h=desk(),g=desk(),other=desk(),spectator=desk();
  const original=copy(game.state),t=ok(h.invite(home));
  assert.equal(t.status,"invite");assert.equal(t.first,0);assert.equal(t.seat,0);assert.equal(t.pos,null);
  assert.equal(spectator.inspect(t.hash).seat,null);assert.equal(spectator.list().length,0);
  assert.equal(spectator.receive(t.hash).code,"spectator");assert.equal(spectator.get(t.id),null);
  assert.equal(h.join(t.hash,away).code,"occupied");
  const a=ok(g.join(t.hash,away)),otherA=ok(other.join(t.hash,away));
  assert.notEqual(a.hash,otherA.hash);assert.deepEqual(copy(a.teams),[home,away]);assert.equal(a.seat,1);
  assert.equal(g.play(t.id,"skill:ember-pop").code,"turn");assert.equal(g.resign(t.id).code,"turn");
  assert.equal(g.join(t.hash,away).code,"duplicate");
  const accepted=ok(h.receive(a.hash));assert.equal(accepted.seat,0);assert.equal(accepted.pos.turn,0);
  assert.equal(accepted.pos.sides[0].beats,1);
  assert.equal(h.receive(otherA.hash).code,"fork");assert.equal(h.receive(t.hash).code,"stale");
  assert.equal(h.receive(a.hash).code,"duplicate");
  assert.equal(h.get(t.id).hash,a.hash);assert.deepEqual(copy(game.state),original);
});

test("strict fragment, roster, gear, legal move and resignation parsing rejects malformed public data",()=>{
  const {h,id}=seated(),fresh=desk(),hash=h.export(id);
  for(const t of [
    {},{ids:["mossbell","mossbell","coalmoth"]},{ids:["dewfin","sprigkit","unknown"]},
    {ids:away.ids,gear:{missing:"last-stitch"}},{ids:away.ids,gear:{gustlance:"fake"}},
    {ids:away.ids,gear:{gustlance:"relay-bell",cindlet:"relay-bell"}},{ids:away.ids,gear:null}
  ])assert.equal(h.invite(t).code,"team");
  const variants=[
    hash.replace("v2=","v3="),hash+"A",hash+".",hash.replace("mossbell~5","mossbell~9"),
    hash.replace("mossbell~5","__proto__"),hash.replace("mossbell~5","dewfin"),
    hash.replace("mossbell~5","mossbell%7E5"),hash.slice(0,-2)+"."+("A".repeat(65))+".",
    hash.slice(0,-2)+".C.", hash.slice(0,-2)+".Z.",hash+"1",hash.repeat(20)
  ];
  for(const bad of variants){assert.equal(fresh.inspect(bad),null,bad);assert.equal(fresh.receive(bad).code,"invalid");}
  assert.equal(fresh.list().length,0);assert.equal(h.export(id),hash);
});

test("public copies survive chat punctuation handling and preserve the original invitation, turns, seats and replay",()=>{
  const h=desk(),g=desk(),spectator=desk(),ticket=ok(h.invite(home)),id=ticket.id;
  const invite=h.forSharing(ticket.hash);
  assert.equal(invite,ticket.hash.slice(0,-4)+".x.x.x.x");
  assert.equal(h.forSharing(invite),invite);
  // Clients may trim any number of the old trailing periods.
  for(let n=0;n<=4;n++){
    const legacy=ticket.hash.slice(0,ticket.hash.length-n);
    assert.equal(h.inspect(legacy).seat,0);assert.equal(h.receive(legacy).code,"duplicate");
    assert.equal(h.forSharing(legacy),invite);
  }
  assert.equal(spectator.inspect(invite).hash,ticket.hash);assert.equal(spectator.inspect(invite).seat,null);
  const accepted=ok(g.join(invite,away)),ready=g.forSharing(accepted.hash);
  assert.equal(ready,accepted.hash.slice(0,-2)+".x.x");
  assert.equal(g.join(ticket.hash.replace(/\.+$/,""),away).code,"duplicate");
  assert.equal(ok(h.receive(ready)).hash,accepted.hash);assert.equal(h.export(id),accepted.hash);
  for(const hash of [accepted.hash,accepted.hash.slice(0,-1),accepted.hash.slice(0,-2),ready]){
    assert.equal(h.receive(hash).code,"duplicate");assert.equal(h.inspect(hash).seat,0);
  }
  const opener=ok(h.play(id,"skill:briar-bloom",ready)),move=h.forSharing(opener.hash);
  assert.equal(move,opener.hash+"x");assert.equal(h.export(id),opener.hash);
  assert.equal(ok(g.receive(opener.hash.slice(0,-1))).hash,opener.hash);
  assert.equal(g.receive(move).code,"duplicate");assert.equal(g.review(move).record.seat,1);
  assert.equal(g.receive(ready).code,"stale");
  const end=ok(g.resign(id,move)),resigned=g.forSharing(end.hash);
  assert.equal(resigned,end.hash);assert.ok(resigned.endsWith(".A.1"));
  assert.equal(ok(h.receive(resigned)).winner,0);assert.equal(h.receive(end.hash).code,"duplicate");
  assert.deepEqual(copy(spectator.review(move).record.moves),["skill:briar-bloom"]);
  assert.equal(spectator.review(resigned).record.winner,0);assert.equal(spectator.list().length,0);

  const empty=seated(),noMoves=ok(empty.h.resign(empty.id));
  const safe=empty.h.forSharing(noMoves.hash);assert.ok(safe.endsWith(".x.0"));
  assert.equal(ok(empty.g.receive(safe)).hash,noMoves.hash);assert.equal(empty.g.export(empty.id),noMoves.hash);
});

test("the film published before Ember arts retains its original moves, winning seat and every final HP",()=>{
  const hash="#bellpost-v1=c7f3e4a7edc7326261e78c1f.cindlet,sprigkit,dewfin.e29a2db9d5aa54a7505ee8b7.dewfin,cindlet,sprigkit.GBBBBBBBBANINJABBBBBBBNBMBBBBBBBB.x";
  const film=desk().review(hash);
  assert.equal(film.record.protocol,1);assert.equal(film.record.winner,0);
  assert.equal(film.events.length,33);assert.equal(film.events.at(-1).move.id,"skill:slick-slide");
  assert.deepEqual(copy(film.final.sides.map(s=>s.team.map(k=>k.hp))),[[0,0,3],[0,0,0]]);
});

test("both Ember arts travel between seats in new letters, while legacy matches retain their command set",()=>{
  const left={ids:["dewfin","charquill","sprigkit"]},right={ids:["kilnbeak","cindlet","mossbell"]};
  const {h,g,id,ticket}=seated(left,right);
  assert.equal(ticket.protocol,2);
  function deliver(from,to,command){
    const next=ok(from.play(id,command)),letter=from.forSharing(from.export(id));
    assert.equal(ok(to.receive(letter)).hash,next.hash);
    assert.deepEqual(copy(desk().review(letter).final),copy(next.pos));
    return next;
  }
  deliver(h,g,"skill:slick-slide");
  const vent=deliver(g,h,"vent:backdraft");
  assert.match(vent.hash,/\.B2\.$/);
  assert.equal(g.receive(vent.hash.replace("v2=","v1=")).code,"invalid");
  deliver(h,g,"swap:charquill");
  deliver(g,h,"skill:reed-lunge");
  const before=h.get(id).pos,after=deliver(h,g,"warmth:dewfin"),healed=after.pos.sides[0].team[0];
  assert.ok(healed.hp>before.sides[0].team[0].hp);
  assert.equal(after.pos.sides[0].active,1);assert.equal(after.pos.sides[0].cover,.5);
  assert.match(after.hash,/X\.$/);assert.equal(after.moves.at(-1),"warmth:dewfin");
  const oldInvite=ticket.hash.replace("v2=","v1="),legacy=desk();
  const v1=ok(legacy.join(oldInvite,right));
  assert.equal(v1.protocol,1);assert.equal(h.receive(v1.hash).code,"fork");
  assert.equal(legacy.join(ticket.hash,right).code,"occupied");
  const first=desk().inspect(v1.hash.replace(/\.\.$/,".B."));
  assert.equal(first.pos.turn,1);
  assert.equal(sim.options(first.pos).some(m=>m.id==="vent:backdraft"),false);
  assert.equal(legacy.inspect(first.hash.slice(0,-1)+"2."),null);
  assert.equal(legacy.export(id),v1.hash);
});

test("restoring stripped fields and public placeholders still requires whole teams and lawful commands",()=>{
  const {h,g,id,ticket}=seated(),fields=h.export(id).split("."),[match,host,guest,visitor]=fields;
  const invalid=[match,match+".x",[match,host,guest].join("."),[match,host,"x",visitor].join("."),
    [match,host,"x","x","A","x"].join("."),[match,host,"x","x","x","0"].join("."),
    [match,host,guest,visitor,"Ax","x"].join("."),[match,host,guest,visitor,"X","x"].join("."),
    [match,host,guest,visitor,"C"].join("."),[match,host,guest,visitor,"x","1"].join("."),
    h.forSharing(ticket.hash)+".x"];
  const before=h.export(id);
  for(const hash of invalid){
    assert.equal(h.forSharing(hash),null);assert.equal(h.inspect(hash),null);assert.equal(h.review(hash),null);
    assert.equal(h.receive(hash).code,"invalid");assert.equal(g.join(hash,away).code,"invitation");
  }
  assert.equal(h.export(id),before);
});

test("stale tabs, altered gear, forked lines, invented local commands and delayed duplicates preserve the desk",()=>{
  const {h,g,sa,sb,id}=seated(),old=h.get(id),tab=desk(sa),fork=desk(storage(new Map(sa.map)));
  tab.get(id);
  const played=ok(h.play(id,"skill:briar-bloom",old.hash)),other=ok(fork.play(id,"skill:shell-bump"));
  assert.equal(tab.play(id,"skill:shell-bump",old.hash).code,"changed");
  assert.equal(h.receive(other.hash).code,"fork");
  assert.equal(g.receive(played.hash.replace("mossbell~5","mossbell~3")).code,"fork");
  const otherGuest=desk(storage(new Map(sb.map)));ok(otherGuest.receive(played.hash));
  const mixed=ok(otherGuest.play(id,"skill:ember-pop"));
  assert.equal(g.receive(mixed.hash).code,"seat");
  assert.equal(g.get(id).moves.length,0);
  ok(g.receive(played.hash));const response=ok(g.play(id,"skill:ember-pop"));ok(h.receive(response.hash));
  assert.equal(h.receive(played.hash).code,"stale");
  assert.equal(h.receive(response.hash).code,"duplicate");
  assert.equal(tab.play(id,"skill:briar-bloom",old.hash).code,"changed");
  assert.equal(tab.get(id).hash,h.get(id).hash);
});

test("two independent desks reach the same public result; replacement and subsequent action travel together",()=>{
  const {h,g,id}=seated(),desks=[h,g],reader=desk(),career=copy(game.state);
  let current=h.get(id),replacements=0;
  while(current.status==="active"){
    const seat=current.pos.turn,own=desks[seat],other=desks[1-seat],before=own.get(id),move=strike(before.pos);
    current=ok(own.play(id,move.id));
    if(move.kind==="replace"){
      replacements++;
      assert.ok(current.incomplete);assert.equal(current.pos.ply,before.pos.ply);
      assert.equal(own.export(id),before.hash);assert.equal(other.receive(current.hash).code,"incomplete");
      assert.equal(other.get(id).hash,before.hash);
      continue;
    }
    const next=ok(other.receive(own.export(id)));
    assert.deepEqual(copy(next.pos),copy(current.pos));
    assert.equal(next.hash,current.hash);
  }
  assert.ok(replacements>=2);
  assert.ok(current.pos.ply<=60);
  assert.ok(current.hash.length<250);
  assert.equal(reader.inspect(current.hash).seat,null);
  const film=reader.review(current.hash);
  assert.equal(film.events.length,current.moves.length);
  assert.deepEqual(copy(film.final),copy(current.pos));
  assert.equal(reader.list().length,0);
  assert.equal(reader.play(id,"skill:ember-pop").code,"inactive");
  assert.equal(desks[current.seat].resign(id).code,"inactive");
  assert.deepEqual(copy(game.state),career);
  console.log("Ordinary strike/duet Bellpost match:",current.pos.ply,"actions,",replacements,"free replacements,",current.hash.length,"fragment characters");
});

test("all command families fit the tape; rescinded offers and completed archives preserve unrelated active matches",()=>{
  const simTeam={ids:["gustlance","rillsail","fernprickle"],gear:{gustlance:"opening-pennant"}};
  const {h,g,id}=seated(simTeam,away);
  const one=ok(h.play(id,"beacon:fernprickle"));ok(g.receive(one.hash));
  ok(h.receive(ok(g.play(id,"skill:ember-pop")).hash));
  const two=ok(h.play(id,"stance:thorn-read"));ok(g.receive(two.hash));
  const final=ok(g.resign(id));assert.equal(final.winner,0);assert.equal(final.resigned,1);
  assert.equal(final.status,"done");ok(h.receive(final.hash));
  const watcher=desk();assert.equal(watcher.inspect(final.hash).winner,0);
  assert.equal(watcher.review(final.hash).events.length,3);
  assert.equal(h.receive(two.hash).code,"stale");
  const another=ok(h.invite(home));assert.notEqual(id,another.id);
  assert.equal(h.archive(another.id).code,"active");
  ok(h.archive(id));assert.equal(h.list().length,1);assert.equal(h.get(id).winner,0);
  const guest=desk(),approval=ok(guest.join(another.hash,away));ok(h.withdraw(another.id));
  assert.equal(h.receive(approval.hash).code,"archived");
  assert.equal(h.list().length,0);assert.ok(h.get(another.id).archived);
  const slip=seated({ids:["rillsail","mossbell","dewfin"],gear:{rillsail:"opening-pennant"}},away);
  assert.ok(slip.h.play(slip.id,"slipstream:mossbell").ok);
  const shelter=seated();assert.ok(shelter.h.play(shelter.id,"shelter:dewfin").ok);
});

test("turn limit gives a compact public draw, even when both trios switch for the full match",()=>{
  const {h,g,id}=seated(home,home),desks=[h,g];
  let r=h.get(id);
  while(r.status==="active"){
    const seat=r.pos.turn,move=sim.options(r.pos).find(m=>m.kind==="swap"&&m.available);
    r=ok(desks[seat].play(id,move.id));ok(desks[1-seat].receive(r.hash));
  }
  assert.equal(r.winner,"draw");assert.equal(r.moves.length,60);assert.ok(r.hash.length<250);
  assert.equal(desk().inspect(r.hash).winner,"draw");
});

test("denied persistence keeps a working session; independent matches in shared browser storage survive reload",()=>{
  const denied={getItem(){throw Error("storage blocked");},setItem(){throw Error("storage blocked");}};
  const a=desk(denied),g=desk(),t=ok(a.invite(home)),accept=ok(g.join(t.hash,away));
  assert.equal(a.persistent,false);ok(a.receive(accept.hash));ok(a.play(t.id,"skill:briar-bloom"));assert.equal(a.list().length,1);
  const shared=storage(),x=desk(shared),y=desk(shared),one=ok(x.invite(home)),two=ok(y.invite(away));
  assert.notEqual(one.id,two.id);assert.equal(desk(shared).list().length,2);
  assert.deepEqual([...shared.map.keys()].sort(),["wilderkin.bellpost.v1."+one.id,"wilderkin.bellpost.v1."+two.id,"wilderkin.bellpost.v1.index"].sort());
  shared.map.set("wilderkin.bellpost.v1."+two.id,'{"seat":99,"hash":"invalid"}');
  assert.equal(desk(shared).list().length,1);assert.equal(desk(shared).get(one.id).seat,0);
});

test("a genuinely overlapping write from a second tab cannot replace the first action",()=>{
  const {sa,h,id}=seated(),other=desk(sa),original=sa.setItem;
  const hash=h.get(id).hash;
  let rival;
  sa.setItem=(key,value)=>{
    original(key,value);
    if(key.startsWith("wilderkin.bellpost.lock.")){
      sa.setItem=original;
      rival=other.play(id,"skill:shell-bump",hash);
    }
  };
  const played=ok(h.play(id,"skill:briar-bloom",hash));
  assert.equal(rival.code,"changed");assert.equal(other.get(id).hash,played.hash);
  assert.deepEqual(copy(played.moves),["skill:briar-bloom"]);
  assert.ok([...sa.map.keys()].every(k=>!k.startsWith("wilderkin.bellpost.lock.")));
});
