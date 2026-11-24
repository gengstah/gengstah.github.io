const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const window={localStorage:{getItem(){return null;},setItem(){throw new Error("Sparring touched campaign storage");}}};
const ctx=vm.createContext({window});
for(const name of ["atlas","bestiary","activities","campaign","story","duets","growth","engine","sparring-battle"]) {
  const file=path.join(__dirname,"../games/wilderkin",name+".js");
  vm.runInContext(fs.readFileSync(file,"utf8"),ctx,{filename:file});
}
const g=window.WilderGame,sim=window.WilderSparringBattle.create({species:g.species});
const copy=v=>JSON.parse(JSON.stringify(v));
const left=["sprigkit","cindlet","dewfin"],right=["mossbell","coalmoth","glimmeray"];
const go=(pos,id)=>{const next=sim.apply(pos,id);assert.ok(next,id);return next;};
const current=p=>p.sides[p.turn].team[p.sides[p.turn].active];
const record=JSON.stringify(g.state);

test("both loan teams use actual base species at level 20, independent of campaign and starting seat",()=>{
  const a=sim.start(left,right),b=sim.start(right,left,1);
  assert.ok(a);assert.equal(sim.maxHp("sprigkit"),a.sides[0].team[0].maxHp);assert.equal(sim.maxHp("no-such-kin"),null);assert.equal(a.turn,0);assert.equal(b.turn,1);
  assert.deepEqual(copy(a.sides[0]),copy(b.sides[1]));
  const f=sim.forecast(a,"skill:leaf-flurry"),mirror=sim.forecast(b,f.id);
  assert.deepEqual(copy(f),copy(mirror));
  const q=go(a,f.id),r=go(b,f.id);
  assert.deepEqual(copy(q.sides[0]),copy(r.sides[1]));assert.deepEqual(copy(q.sides[1]),copy(r.sides[0]));
  assert.equal(a.sides[1].team[0].hp,a.sides[1].team[0].maxHp);
  assert.equal(q.sides[1].team[0].hp,a.sides[1].team[0].hp-f.damage);
  assert.ok(a.sides.every(s=>s.team.every(m=>m.level===20&&m.hp===m.maxHp&&m.maxHp===g.species[m.id].baseHp+45)));
  for(const ids of [[],["sprigkit"],["sprigkit","sprigkit","dewfin"],["__proto__","dewfin","cindlet"]])assert.equal(sim.start(ids,right),null);
  assert.equal(sim.apply(a,"craft"),null);assert.equal(sim.apply(a,"duet:cindlet"),null);
  assert.equal(JSON.stringify(g.state),record);
});

test("swaps preserve each fighter, brace can be broken, recovery has one charge and changing parts earns beats",()=>{
  let p=sim.start(left,right);
  assert.equal(sim.forecast(p,"skill:sun-nap").available,false);
  const guard="skill:brush-dash";p=go(p,guard);
  assert.equal(p.sides[0].beats,1);assert.equal(p.sides[0].cover,.5);
  const braceBreak=sim.forecast(p,"skill:shell-bump"),strike=sim.forecast(p,"skill:briar-bloom");
  assert.ok(braceBreak.damage>strike.damage);p=go(p,braceBreak.id);
  const hurt=p.sides[0].team[0].hp;p=go(p,guard);assert.equal(p.sides[0].beats,1);
  p=go(p,"swap:coalmoth");p=go(p,"skill:sun-nap");
  assert.equal(p.sides[0].team[0].recovery,0);assert.equal(p.sides[0].beats,2);assert.ok(p.sides[0].team[0].hp>hurt);
  p=go(p,"skill:flare-wing");assert.ok(!sim.forecast(p,"skill:sun-nap").available);
  const oldHP=p.sides[0].team[0].hp;p=go(p,"swap:dewfin");assert.equal(p.sides[0].beats,3);
  assert.equal(p.sides[0].team[0].hp,oldHP);assert.equal(p.sides[0].team[2].hp,p.sides[0].team[2].maxHp);
});

test("all 55 pair scores produce their real role, cost, targeting, forecast and consequent response",()=>{
  const groups={};for(const k of Object.values(g.species))(groups[k.type]??=[]).push(k.id);
  const types=Object.keys(groups),seen=new Set(),roles=new Set();
  for(const [i,first] of types.entries())for(const second of types.slice(i)) {
    const a=groups[first][0],b=groups[second][first===second?1:0],c=left.find(id=>id!==a&&id!==b);
    const p=sim.start([a,b,c],right),s=p.sides[0],o=p.sides[1],peer=s.team[1],lead=s.team[0],foe=o.team[0];
    s.beats=3;lead.hp-=21;peer.hp-=17;o.cover=.25;
    const full=sim.forecast(p,"duet:"+b);assert.ok(full.available);const pair=window.WilderDuets.score(first,second);
    assert.equal(full.label,pair.name);assert.equal(full.cost,pair.cost);assert.equal(full.role,pair.role);
    seen.add(full.label);roles.add(full.role);
    const q=go(p,full.id),a2=q.sides[0],o2=q.sides[1];
    assert.equal(a2.beats,3-full.cost);assert.equal(a2.cover,pair.counter);assert.equal(o2.team[0].hp,foe.hp-full.damage);
    assert.equal(a2.team[0].hp,lead.hp+full.healLead);assert.equal(a2.team[1].hp,peer.hp+full.healPartner);
    assert.equal(a2.active,full.role==="relay"?1:0);assert.equal(o2.pinned,full.role==="lure");
    assert.equal(o2.team[0].exposed,full.role==="mark");
    if(full.role==="mend")assert.equal(full.heal,Math.min(21,Math.ceil(lead.maxHp/4))+Math.min(17,Math.ceil(peer.maxHp/4)));
    o.cover=1;const open=sim.forecast(p,full.id);
    assert.equal(full.role==="rush",open.damage===full.damage);
  }
  assert.equal(seen.size,55);assert.equal(roles.size,6);
});

test("lure really pins, a relay escapes, and a mark persists on its target across bench changes",()=>{
  const p=sim.start(["sprigkit","frostmull","cindlet"],["coalmoth","dewfin","mossbell"]);
  p.sides[0].beats=3;p.sides[1].beats=3;p.sides[1].team[0].hp=2;
  let q=go(p,"duet:frostmull");assert.equal(current(q).hp,1);
  assert.match(sim.forecast(q,"swap:dewfin").reason,/pins/);assert.equal(sim.apply(q,"swap:dewfin"),null);
  q=go(q,"duet:dewfin");assert.equal(q.sides[1].active,1);assert.ok(!q.sides[1].pinned);
  const mark=sim.start(["sprigkit","pincoil","cindlet"],right);mark.sides[0].beats=2;
  q=go(mark,"duet:pincoil");assert.ok(q.sides[1].team[0].exposed);
  q=go(q,"swap:coalmoth");q=go(q,"swap:cindlet");q=go(q,"swap:mossbell");
  assert.ok(q.sides[1].team[0].exposed);
  q.sides[1].cover=.25;
  const f=sim.forecast(q,"skill:ember-pop");assert.ok(f.consumeMark);assert.ok(f.damage>20);
  q=go(q,f.id);assert.ok(!q.sides[1].team[0].exposed);
});

test("free replacement, mid-turn resume and ending states all validate without touching the campaign",()=>{
  let p=sim.start(left,right,1);p.sides[0].team[0].hp=1;p=go(p,"skill:briar-bloom");
  assert.equal(p.phase,"replace");assert.equal(p.turn,0);
  assert.deepEqual(copy(sim.restore(copy(p))),copy(p));
  assert.equal(sim.apply(p,"skill:leaf-flurry"),null);
  const ply=p.ply;p=go(p,"replace:cindlet");assert.equal(p.turn,0);assert.equal(p.ply,ply);assert.equal(p.phase,"move");
  assert.deepEqual(copy(sim.restore(copy(p))),copy(p));
  const forged=copy(p);forged.sides[0].team[2].hp=9999;assert.equal(sim.restore(forged),null);
  assert.equal(sim.restore({...copy(p),turn:1}),null);assert.equal(sim.restore({...copy(p),phase:"done",winner:0}),null);
  p.sides[1].team.forEach((m,i)=>{m.hp=i===0?1:0;});p=go(p,"skill:ember-pop");
  assert.equal(p.winner,0);assert.equal(p.phase,"done");assert.equal(sim.recommend(p),null);
  assert.deepEqual(copy(sim.restore(copy(p))),copy(p));assert.equal(JSON.stringify(g.state),record);
});

test("the 60th action judges standing count, percentage health, and exact draws",()=>{
  for(const expected of [0,1,"draw"]) {
    let p=sim.start(left,right);p.turn=1;p.ply=59;
    if(expected===0){p.sides[1].team[1].hp=0;p.sides[0].team[0].hp=1;}
    if(expected===1)p.sides[0].team[0].hp--;
    p=go(p,"swap:glimmeray");assert.equal(p.ply,60);assert.equal(p.winner,expected);
    assert.deepEqual(copy(sim.restore(copy(p))),copy(p));assert.equal(sim.options(p).length,0);
  }
});

test("the coach uses only legal forecast moves, plays both seats, and beats repeated first attack on ten lineups",()=>{
  const opponents=[right,["gustlance","arcbill","icereeve"],["smelteroll","boltbur","kilnclaw"],["chordowl","opalmull","nightgob"],["coilcrown","slateweaver","cairnwatch"]];
  let wins=0;const used=new Set();let longest=0;
  for(const ids of opponents)for(const coachSide of [0,1]) {
    let p=coachSide?sim.start(ids,left):sim.start(left,ids),inputs=0;
    while(p.phase!=="done"&&inputs++<68) {
      const before=JSON.stringify(p),m=p.turn===coachSide?sim.recommend(p):sim.options(p).find(a=>a.available&&(a.kind==="attack"||a.kind==="replace"));
      assert.ok(m?.available);assert.equal(JSON.stringify(p),before);
      if(p.turn===coachSide){used.add(m.kind);assert.ok(m.why.length>12);}
      p=go(p,m.id);
    }
    longest=Math.max(longest,p.ply);if(p.winner===coachSide)wins++;assert.equal(p.phase,"done");
  }
  assert.ok(wins>=7,JSON.stringify({wins,used:[...used],longest}));
  for(const kind of ["attack","guard","heal","duet","swap"])assert.ok(used.has(kind),[...used].join(","));
  assert.equal(JSON.stringify(g.state),record);
});
