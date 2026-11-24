const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const scripts=["atlas","bestiary","activities","campaign","story","duets","sparring-gear","sparring-signatures",
  "sparring-battle","sparring-teams","engine","partner-search"].map(name=>{
  const filename=path.join(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(fs.readFileSync(filename,"utf8"),{filename});
});
const plain=value=>JSON.parse(JSON.stringify(value));
function boot(){
  const writes=[],win={localStorage:{getItem:()=>null,setItem:(k,v)=>writes.push([k,v]),removeItem:k=>writes.push([k,null])}};
  const ctx=vm.createContext({window:win});
  for(const s of scripts)s.runInContext(ctx);
  const game=win.WilderGame,sim=win.WilderSparringBattle.create({game});
  let starts=0;
  const counted={...sim,start(...args){starts++;return sim.start(...args);}};
  return {win,game,sim,writes,starts:()=>starts,finder:win.WilderPartnerSearch.create({game,sim:counted})};
}
const roleIds=["ward","mend","relay","lure","mark","rush"];
function natural(h,from,to){
  const k=h.game.species[from],target=h.game.species[to];
  return k.skills.filter(s=>s.kind==="attack"&&!s.trained).map(s=>({skill:s,mult:h.win.WilderKinDex.effectiveness(s.type,target.types)}))
    .sort((a,b)=>b.mult-a.mult||b.skill.power-a.skill.power);
}
function strongest(h,pos){
  return h.sim.options(pos).filter(o=>o.available&&o.kind==="attack").sort((a,b)=>b.damage-a.damage)[0];
}
function matchup(h,a,b){
  return h.win.WilderDuets.score(h.game.species[a].type,h.game.species[b].type);
}
const ids=rows=>plain(rows.map(r=>r.id));

test("search seeds share role aliases and genuine duet names while ordinary skills can search across all roles",()=>{
  const h=boot(),seed=h.win.WilderPartnerSearch.searchSeed;
  assert.deepEqual(plain(seed("heal")),{role:"mend",query:""});
  assert.deepEqual(plain(seed("Set Up")),{role:"mark",query:""});
  assert.deepEqual(plain(seed("  rain garden ")),{role:"mend",query:"Rain Garden"});
  assert.deepEqual(plain(seed("Fault Stamp")),{role:"",query:"Fault Stamp"});
  assert.deepEqual(ids(h.finder.search({anchor:"sprigkit",catalog:["dewfin","cindlet"],...seed("Rain Garden")})),["dewfin"]);
  assert.deepEqual(ids(h.finder.search({anchor:"cindlet",...seed("Rain Garden")})),[]);
  const skill=h.finder.search({anchor:"sprigkit",...seed("Fault Stamp")});
  assert.ok(skill.length>0);assert.ok(skill.every(r=>r.skills.some(s=>s.name==="Fault Stamp")));
  assert.deepEqual(ids(h.finder.search({anchor:"sprigkit",role:""})),ids(h.finder.search({anchor:"sprigkit"})));
});

test("an optional rival ranks every eligible partner by its strongest natural affinity, incoming exposure and displayed name",()=>{
  const h=boot(),anchor="dewfin",reserved=["cindlet","fernprickle"];
  const catalog=Object.keys(h.game.species).reverse();
  const input={anchor,catalog:[...catalog,"brookpeep","stillwake","unknown-kin",anchor],reserved,foe:"gustlance"};
  const saved=JSON.stringify(input),original=JSON.stringify(h.game.state);
  for(const foe of ["gustlance","pincoil"]){
    const rows=h.finder.search({...input,foe});
    const expected=catalog.filter(id=>!h.game.species[id].bonus&&id!==anchor&&!reserved.includes(id));
    const fit=new Map(expected.map(id=>[id,{out:natural(h,id,foe)[0].mult,inc:natural(h,foe,id)[0].mult}]));
    expected.sort((a,b)=>fit.get(b).out-fit.get(a).out||fit.get(a).inc-fit.get(b).inc||h.game.species[a].name.localeCompare(h.game.species[b].name));
    assert.deepEqual(ids(rows),expected);
    for(const {id,fit:pair} of rows){
      assert.equal(pair.outgoing.multiplier,fit.get(id).out);
      assert.equal(pair.incoming.multiplier,fit.get(id).inc);
      for(const [from,to,shown] of [[id,foe,pair.outgoing],[foe,id,pair.incoming]]){
        const valid=natural(h,from,to).filter(m=>m.mult===shown.multiplier);
        assert.ok(valid.some(({skill})=>skill.name===shown.name&&skill.type===shown.type),from+" vs "+to);
      }
    }
    const dual=rows.find(r=>r.types.length===2&&r.fit.outgoing.type!==r.types[0]&&r.fit.outgoing.multiplier>
        h.win.WilderKinDex.effectiveness(r.types[0],h.game.species[foe].types));
    assert.ok(dual,"a usable secondary attack changes the matchup");
  }
  const base=h.finder.search({anchor,catalog:["dewfin","mossbell","gustlance","mossbell","stillwake"],reserved:["gustlance"]});
  assert.deepEqual(ids(base),["mossbell"]);assert.equal(base[0].fit,null);
  assert.equal(h.starts(),0,"catalog matching needs no simulated positions");
  assert.equal(JSON.stringify(input),saved);assert.equal(JSON.stringify(h.game.state),original);assert.deepEqual(h.writes,[]);
});

test("search finds the actual paired role, individual guard, named recovery art and signatures without matching everyone's recovery skill",()=>{
  const h=boot(),anchor="dewfin";
  const all=h.finder.search({anchor}),roles=new Set();
  for(const role of roleIds){
    const got=h.finder.search({anchor,role});
    assert.ok(got.length>0,role);assert.deepEqual(ids(got).sort(),ids(all.filter(x=>matchup(h,anchor,x.id).role===role)).sort());
    for(const r of got){
      const shared=matchup(h,anchor,r.id);
      assert.equal(r.duet.name,shared.name);assert.equal(r.duet.cost,shared.cost);assert.equal(r.duet.role,role);
      assert.ok(typeof r.duet.effect==="string"&&r.duet.effect.length);
    }
    roles.add(got[0].duet.role);
  }
  assert.equal(roles.size,6);assert.deepEqual(ids(h.finder.roles).sort(),roleIds.slice().sort());
  assert.deepEqual(ids(h.finder.search({anchor,query:"heal"})).sort(),ids(h.finder.search({anchor,role:"mend"})).sort());
  for(const [query,id] of [["Pincer Block","opalclasp"],["Roll Brace","cragroll"],["Banked Warmth","charquill"],
      ["Backdraft","kilnbeak"],["Shelter Call","mossbell"],["Thorn Read","fernprickle"],["Beacon Pass","gustlance"]]){
    const rows=h.finder.search({anchor,query:query.toUpperCase()}),row=rows.find(r=>r.id===id);
    assert.ok(row,query+" finds "+id);
    const owner=h.game.species[id];
    assert.deepEqual(ids(row.skills),ids(owner.skills.filter(s=>!s.trained)));
    assert.equal(row.emberArt?.name,owner.emberArt?.name);
    assert.equal(row.signature?.name,h.win.WilderSparringSignatures.byId(id)?.name);
    for(const r of rows){
      const k=h.game.species[r.id],sig=h.win.WilderSparringSignatures.byId(r.id)?.name;
      assert.ok([k.name,...k.skills.filter(s=>!s.trained).map(s=>s.name),k.emberArt?.name,sig,r.duet.name].includes(query),r.id+" for "+query);
    }
  }
});

test("opening previews use registered gear, both active ordinary strikes and the anchor's actual duet forecast, then reuse that result",()=>{
  const h=boot(),options={anchor:"dewfin",foe:"pincoil",role:"mend",team:["dewfin","mossbell","cindlet"],rivals:["pincoil","gustlance","glimmeray"],
    gear:{dewfin:"opening-pennant",glimmeray:"prism-lens",cindlet:"relay-bell"},foeGear:{pincoil:"last-stitch",gustlance:"mender-wrap"}};
  const published=JSON.stringify(options),candidate="glimmeray",initial=JSON.stringify(h.game.state);
  const rows=h.finder.search(options);assert.ok(rows.some(x=>x.id===candidate));
  const found=h.finder.preview(options,candidate);assert.ok(found);
  const firstCount=h.starts();assert.ok(firstCount>0);
  const gear={left:{glimmeray:"prism-lens",dewfin:"opening-pennant"},right:options.foeGear};
  const wall=[options.anchor,candidate,"mossbell"],left=[candidate,options.anchor,"mossbell"],right=options.rivals;
  const outgoing=strongest(h,h.sim.start(left,right,0,gear)),incoming=strongest(h,h.sim.start(left,right,1,gear));
  const duet=h.sim.forecast(h.sim.start(wall,right,0,gear),"duet:"+candidate);
  for(const [expected,shown] of [[outgoing,found.ordinary],[incoming,found.reply],[duet,found.duetMove]]){
    assert.equal(shown.id,expected.id);assert.equal(shown.damage,expected.damage);assert.equal(shown.cost,expected.cost);
    assert.equal(shown.available,expected.available);
  }
  assert.ok(found.ordinary.gearEvents?.some(e=>e.gearId==="prism-lens"));
  assert.ok(found.ordinary.damage>strongest(h,h.sim.start(left,right,0)).damage);
  const openingHp=found.opening.sides[0].team[0].hp;
  found.opening.sides[0].team[0].hp=1;
  h.finder.search({...options,query:"glimm"});
  assert.equal(h.finder.preview({...options},candidate).opening.sides[0].team[0].hp,openingHp);
  assert.equal(h.starts(),firstCount,"repeating an identical preview across catalog filters uses its existing forecasts");
  const changed=h.finder.preview({...options,gear:{dewfin:"opening-pennant"}},candidate);
  assert.ok(changed.ordinary.damage<found.ordinary.damage,"different equipment gets a fresh forecast");
  assert.equal(JSON.stringify(options),published);assert.equal(JSON.stringify(h.game.state),initial);assert.deepEqual(h.writes,[]);
});

test("all six recommended duets can be paid for from genuine opening positions; a registered pennant contributes its real opening beat",()=>{
  const h=boot(),baseline=JSON.stringify(h.game.state);
  for(const role of roleIds){
    const opts={anchor:"dewfin",role,foe:"pincoil",team:["dewfin","mossbell","cindlet"],rivals:["pincoil","coalmoth","gustlance"]};
    const candidates=h.finder.search(opts),chosen=candidates.find(r=>!opts.team.includes(r.id)&&!opts.rivals.includes(r.id));
    const drill=h.finder.exercise(opts,chosen.id);assert.ok(drill);
    assert.equal(drill.first,0);assert.deepEqual(plain(drill.moves),[]);assert.equal(drill.duetId,"duet:"+chosen.id);
    assert.equal(drill.setup.mode,"cpu");assert.equal(drill.setup.rival,"custom");
    assert.equal(drill.setup.left[0],opts.anchor);assert.ok(drill.setup.left.includes(chosen.id));
    assert.ok(drill.setup.left.slice(1).some(id=>opts.team.includes(id)));
    assert.deepEqual(plain(drill.setup.right),opts.rivals);
    let pos=h.sim.start(drill.setup.left,drill.setup.right,drill.first,drill.setup.gear);
    assert.equal(pos.sides[0].beats,0);assert.equal(h.sim.forecast(pos,drill.duetId).available,false);
    for(let round=0;pos.sides[0].beats<drill.cost;round++){
      assert.ok(round<3);const kind=round%2?"attack":"guard",ours=h.sim.options(pos).find(m=>m.available&&m.kind===kind);
      pos=h.sim.apply(pos,ours.id);
      while(pos.turn===1){
        assert.ok(pos.phase!=="done");
        const reply=h.sim.recommend(pos);pos=h.sim.apply(pos,reply.id);
      }
    }
    const move=h.sim.forecast(pos,drill.duetId);
    assert.equal(move.available,true);assert.equal(move.role,role);assert.equal(move.cost,chosen.duet.cost);
    const after=h.sim.apply(pos,move.id);assert.equal(after.sides[0].beats,pos.sides[0].beats-move.cost);
  }
  const opts={anchor:"dewfin",foe:"pincoil",gear:{dewfin:"opening-pennant",mossbell:"relay-bell"}};
  const drill=h.finder.exercise(opts,"mossbell"),pos=h.sim.start(drill.setup.left,drill.setup.right,drill.first,drill.setup.gear);
  assert.equal(pos.sides[0].beats,1);assert.equal(pos.sides[0].team[0].spent,true);
  assert.equal(pos.sides[0].team.find(k=>k.id==="mossbell").gear,"relay-bell");
  assert.equal(JSON.stringify(h.game.state),baseline);assert.deepEqual(h.writes,[]);
});
