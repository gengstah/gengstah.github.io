const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const scripts=['atlas','bestiary','call-habitats','wild-calls','activities','campaign','story','duets','fieldwork','opening','growth','wardens','sparring-gear','trail-fittings','first-battle','engine','world']
  .map(id=>new vm.Script(fs.readFileSync(path.resolve(__dirname,'../games/wilderkin',id+'.js'),'utf8'),{filename:id+'.js'}));
const key='wilderkin.trail.v3',copy=value=>JSON.parse(JSON.stringify(value));
const ok=r=>{assert.equal(r?.ok,true,r?.message);return r;};
function boot(saved,shared){
  const storage=shared||new Map(saved?[[key,JSON.stringify(saved)]]:[]);
  let writes=0;
  const window={localStorage:{getItem:k=>storage.get(k)??null,setItem(k,bytes){writes++;storage.set(k,bytes);}}};
  const ctx=vm.createContext({window});for(const script of scripts)script.runInContext(ctx);
  return {g:window.WilderGame,world:window.WilderWorld,read:()=>JSON.parse(storage.get(key)),writes:()=>writes,storage};
}
function once(h,act){const n=h.writes(),r=ok(act());assert.equal(h.writes(),n+1);return r;}
function refuse(h,act){const before=copy(h.g.state),n=h.writes();assert.equal(act().ok,false);assert.deepEqual(copy(h.g.state),before);assert.equal(h.writes(),n);}
function tracks(h){
  const g=h.g,map=h.world.regions[0],site=map.sites.find(s=>s.id==='wild');
  const p=g.state.positions[0]||map.spawn;
  // The straight path crosses Brookside Mill's bridge on the first map.
  for(let x=p.x;x<site.x;x++)assert.equal(g.setPosition(x+1,p.y),true);
  assert.equal(p.y,site.y);assert.equal(g.visitSite('wild'),true);
}
function enter(lead='sprigkit',h=boot()){
  once(h,()=>h.g.firstBattle.choose(lead));tracks(h);once(h,()=>h.g.startBattle('first-battle'));
  return h;
}
test('an explicit starter choice and physical visit survive every walk step and reload; no remote approach',()=>{
  const h=boot(),g=h.g,initial=copy(g.state),offer=g.firstBattle.read();
  assert.deepEqual(Array.from(offer.choices,p=>p.id),['sprigkit','cindlet','dewfin']);assert.equal(offer.stage,'choose');
  assert.equal(offer.canStart,false);assert.equal(h.writes(),0);refuse(h,()=>g.firstBattle.begin());
  for(const invalid of ['opalclasp','__proto__',{},null])refuse(h,()=>g.firstBattle.choose(invalid));
  const choice=once(h,()=>g.firstBattle.choose('dewfin'));assert.equal(choice.site,'wild');
  assert.deepEqual(copy(g.state.party),initial.party);assert.deepEqual(copy(g.state.positions),{});
  assert.equal(g.state.firstOuting,initial.firstOuting);assert.equal(g.state.lead,'dewfin');
  assert.equal(g.visitSite('wild'),false);refuse(h,()=>g.startBattle('first-battle'));
  assert.equal(g.setPosition(12,7),true);const j=boot(h.read());assert.equal(j.g.firstBattle.read().stage,'walk');
  tracks(j);assert.equal(j.g.firstBattle.read().atTracks,true);refuse(j,()=>j.g.startBattle('first-battle','mossbell'));
  const k=boot(j.read());once(k,()=>k.g.firstBattle.begin());assert.equal(k.g.state.battle.kind,'wild');
  assert.deepEqual(copy(k.g.state.battle.firstBattle),{lead:'dewfin'});assert.equal(k.g.state.battle.activeId,'dewfin');
  assert.equal(k.g.state.battle.enemy.id,'opalclasp');assert.deepEqual(copy(k.g.state.bag),initial.bag);
  assert.equal(k.g.firstBattle.read().stage,'battle');refuse(k,()=>k.g.firstBattle.choose('sprigkit'));
});

test('all three starters can hand off to a duet, guard the charge with a third, and actually recruit',()=>{
  const lines=[['sprigkit','brush-dash','cindlet','dewfin','slick-slide',24,9],['cindlet','cinder-roll','dewfin','sprigkit','brush-dash',23,8],
    ['dewfin','slick-slide','sprigkit','cindlet','cinder-roll',22,10]];
  for(const [lead,guard,partner,third,skill,hp,foeHp] of lines){
    const h=enter(lead),g=h.g;refuse(h,()=>g.recruit());once(h,()=>g.useSkill(guard));once(h,()=>g.useDuet(partner));
    let j=boot(h.read());const f=j.g.trio().options.find(o=>o.id===third&&o.skill===skill);
    assert.equal(j.g.foeIntent().charged,true);assert.equal(f.hpAfter,hp);assert.equal(f.foeHpAfter,foeHp);
    once(j,()=>j.g.useTrio(third,skill));const tag=j.g.state.battle.firstBattle;
    assert.deepEqual([tag.last.turn,tag.last.activeId,tag.last.activeHp,tag.last.foeHp,tag.last.beats],[3,third,hp,foeHp,0]);
    assert.match(tag.last.text,/Tuning Fork/);assert.deepEqual(copy(boot(j.read()).g.state.battle.firstBattle),copy(tag));
    const r=once(j,()=>j.g.recruit());assert.equal(r.kind,'recruited');assert.equal(r.firstBattle.lead,lead);
    assert.equal(r.firstBattle.activeHp,hp);assert.equal(r.firstBattle.foeHp,foeHp);assert.equal(r.firstBattle.outcome,r.kind);
    assert.equal(j.g.state.bag.kinweave,3);assert.equal(j.g.state.wins,0);assert.equal(j.g.team().at(-1).hp,32);
    assert.deepEqual(Array.from(j.g.state.team),['sprigkit','cindlet','dewfin','opalclasp']);
    const done=boot(j.read());assert.deepEqual(copy(done.g.firstBattle.read().receipt),copy(r.firstBattle));refuse(done,()=>done.g.firstBattle.choose(lead));
    once(done,()=>done.g.startBattle('wild','opalclasp'));assert.equal(done.g.state.battle.firstBattle,undefined);
    assert.equal(done.g.captureStatus().available,false);assert.equal(once(done,()=>done.g.flee()).firstBattle,undefined);
    assert.deepEqual(copy(done.g.firstBattle.read().receipt),copy(r.firstBattle));
  }
});

test('an early capture, ordinary XP victory, full retreat, and rescue use the campaign outcomes',()=>{
  const h=enter('cindlet'),g=h.g;once(h,()=>g.useSkill('trail-feint'));once(h,()=>g.useSkill('trail-feint'));
  assert.equal(g.captureStatus().available,true);assert.equal(g.foeIntent().charged,true);
  const early=boot(h.read());const caught=once(early,()=>early.g.useItem('kinweave'));assert.equal(caught.firstBattle.activeHp,18);
  assert.equal(caught.firstBattle.foeHp,16);assert.equal(early.g.state.bag.kinweave,3);
  const escaped=once(h,()=>g.flee());assert.equal(escaped.firstBattle.activeHp,18);assert.equal(g.state.bag.kinweave,4);
  assert.equal(g.state.party[1].hp,18);const retry=boot(h.read());assert.equal(retry.g.firstBattle.read().outcome,'escaped');
  const loss=enter('cindlet',retry);let r;
  for(let i=0;loss.g.state.battle&&i<60;i++){
    const ally=loss.g.team().find(p=>p.hp>0&&p.id!==loss.g.state.battle.activeId);
    r=once(loss,()=>ally?loss.g.swap(ally.id):loss.g.useSkill('trail-feint'));
  }
  assert.equal(r.kind,'defeat');assert.ok(Object.values(r.firstBattle.partyHp).every(n=>n===0));
  assert.ok(loss.g.team().every(p=>p.hp===p.maxHp));assert.equal(loss.g.state.wins,0);assert.equal(loss.g.state.bag.kinweave,4);
  assert.equal(boot(loss.read()).g.firstBattle.read().outcome,'defeat');
  const victory=enter();let win;
  for(let i=0;victory.g.state.battle&&i<20;i++){
    const b=victory.g.state.battle,move=victory.g.kin(b.activeId,{owned:true}).skills.filter(s=>s.kind==='attack').sort((a,c)=>victory.g.ordinaryForecast(c.id).damage-victory.g.ordinaryForecast(a.id).damage)[0];
    win=once(victory,()=>victory.g.useSkill(move.id));
  }
  assert.equal(win.kind,'victory');assert.equal(win.firstBattle.foeHp,0);assert.equal(victory.g.state.wins,1);
  assert.equal(victory.g.state.localWins[0],1);assert.ok(victory.g.team().every(p=>p.xp>0));assert.equal(victory.g.state.bag.kinweave,4);
  assert.deepEqual(copy(boot(victory.read()).g.firstBattle.read().receipt),copy(win.firstBattle));
});

test('waiting walk cannot take over peaceful study or regular wild encounters; changed lead or region requires a deliberate choice',()=>{
  const h=boot(),g=h.g;once(h,()=>g.firstBattle.choose('sprigkit'));once(h,()=>g.setLead('dewfin'));tracks(h);
  refuse(h,()=>g.firstBattle.begin());once(h,()=>g.startBattle('wild','opalclasp'));assert.equal(g.state.battle.firstBattle,undefined);
  assert.equal(once(h,()=>g.flee()).firstBattle,undefined);assert.equal(g.firstBattle.read().stage,'walk');
  const save=h.read();save.firstOuting='cindlet';delete save.firstBattle;save.wins=6;
  const legacy=boot(save);assert.equal(legacy.g.firstBattle.read().receipt,null);assert.equal(legacy.g.state.firstOuting,'cindlet');
  once(legacy,()=>legacy.g.firstBattle.choose('cindlet'));const base=legacy.read();base.region=1;base.crests=[0];base.visited=[0,1];
  const away=boot(base);refuse(away,()=>away.g.firstBattle.begin());refuse(away,()=>away.g.firstBattle.choose('sprigkit'));
  once(away,()=>away.g.travel(0));tracks(away);once(away,()=>away.g.firstBattle.begin());assert.equal(away.g.state.battle.activeId,'cindlet');
  const injured=copy(base);injured.region=0;injured.party.find(p=>p.id==='dewfin').hp=0;injured.team=['dewfin','cindlet'];
  const i=boot(injured);refuse(i,()=>i.g.firstBattle.choose('dewfin'));refuse(i,()=>i.g.firstBattle.choose('sprigkit'));
  assert.equal(i.g.firstBattle.read().choices.find(p=>p.id==='cindlet').available,true);
  const blocked=boot({...base,region:0,landmark:'wild',positions:{0:{x:11,y:7}}});refuse(blocked,()=>blocked.g.firstBattle.begin());
});

test('strict restore strips unrelated encounter markers and damaged receipts without losing the career',()=>{
  const h=enter(),g=h.g;once(h,()=>g.useSkill('brush-dash'));const raw=h.read();
  for(const mutate of [s=>delete s.battle.firstBattle,s=>delete s.firstBattle,s=>{s.battle.firstBattle.lead='dewfin';},s=>{s.landmark='camp';},
    s=>{s.battle.enemy=copy(g.loaner('mossbell',4));},s=>{s.battle.kind='expedition';}]){
    const s=copy(raw);mutate(s);const j=boot(s);assert.equal(j.g.firstBattle.read().stage,'choose');assert.equal(j.g.state.battle?.firstBattle,undefined);
    assert.deepEqual(copy(j.g.state.party),s.party);if(j.g.state.battle)assert.equal(once(j,()=>j.g.flee()).firstBattle,undefined);
  }
  const edited=copy(raw);edited.battle.firstBattle.last.foeHp=100;const repaired=boot(edited);
  assert.equal(repaired.g.state.battle.firstBattle.last,undefined);assert.equal(repaired.g.firstBattle.read().stage,'battle');
  ok(g.flee());const receipt=h.read();for(const change of [r=>r.outcome='victory',r=>r.partyHp.sprigkit=99,r=>r.foe='mossbell',r=>r.activeId='__proto__']){
    const s=copy(receipt);change(s.firstBattle.receipt);const j=boot(s);assert.equal(j.g.firstBattle.read().receipt,null);assert.deepEqual(copy(j.g.state.party),s.party);
  }
});

test('a stale campaign tab cannot duplicate the paid encounter or consume a second Kinweave',()=>{
  const h=enter(),g=h.g;once(h,()=>g.useSkill('trail-feint'));once(h,()=>g.useSkill('trail-feint'));
  const stale=boot(null,h.storage),r=once(h,()=>g.recruit());const conflict=stale.g.recruit();assert.equal(conflict.code,'changed');
  assert.equal(conflict.firstBattle,undefined);assert.equal(stale.writes(),0);assert.equal(stale.g.state.bag.kinweave,3);
  assert.equal(stale.g.state.team.filter(id=>id==='opalclasp').length,1);assert.deepEqual(copy(stale.g.firstBattle.read().receipt),copy(r.firstBattle));
});

test('veteran supplies, a real family helper and its waiting choice work; loaners and rehearsals cannot register another outing',()=>{
  const h=boot(),g=h.g;
  // Earn the required heron through its own genuine call, then volunteer for Opalclasp.
  once(h,()=>g.setLead('cindlet'));once(h,()=>g.startBattle('wild','gustlance'));
  once(h,()=>g.answerWildCall('ember-pop'));once(h,()=>g.recruit());
  assert.equal(g.state.bag.kinweave,3);assert.equal(g.state.firstBattle,null);
  enter('dewfin',h);once(h,()=>g.swap('gustlance'));const call=g.wildCall();
  const pass=call.options.find(o=>o.actor==='gustlance'&&o.partner==='sprigkit');assert.ok(pass.available);
  once(h,()=>g.answerWildCall(pass.skill,pass.partner));assert.equal(g.state.battle.enemy.hp,32);
  const resumed=boot(h.read());assert.equal(resumed.g.wildCall().waiting,true);
  assert.equal(resumed.g.firstBattle.read().stage,'battle');refuse(resumed,()=>resumed.g.useSkill('brush-dash'));
  const rec=once(resumed,()=>resumed.g.recruit());assert.equal(rec.firstBattle.foeHp,32);assert.equal(rec.firstBattle.lead,'dewfin');
  assert.equal(rec.firstBattle.activeId,'sprigkit');assert.equal(resumed.g.state.bag.kinweave,2);
  assert.deepEqual(copy(boot(resumed.read()).g.firstBattle.read().receipt),copy(rec.firstBattle));
  const bytes=resumed.read(),writes=resumed.writes(),s=resumed.g,newMatch=s.rehearsalTeam(['dewfin','sprigkit'],'dewfin',['opalclasp'],0)();
  assert.equal(newMatch.startBattle('first-battle').ok,false);assert.equal(newMatch.firstBattle,undefined);
  const loan={region:0,team:['dewfin'],party:[s.loaner('dewfin',5)],lead:'dewfin',battle:null};
  s.withLoaners(loan,start=>{
    assert.equal(s.firstBattle.choose('dewfin').ok,false);assert.equal(s.firstBattle.begin().ok,false);
    ok(start(['opalclasp'],4,'Borrowed team'));assert.equal(s.state.battle.firstBattle,undefined);
  });
  assert.equal(resumed.writes(),writes);assert.deepEqual(resumed.read(),bytes);
});
