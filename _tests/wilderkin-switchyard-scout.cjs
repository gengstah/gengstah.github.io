const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const window={},context=vm.createContext({window});
for(const name of ["atlas","bestiary","activities","campaign","story","duets","sparring-gear","sparring-signatures","sparring-battle","engine","twin-battle","switchyard-scout"]){
  const file=path.join(__dirname,"../games/wilderkin",name+".js");
  vm.runInContext(fs.readFileSync(file,"utf8"),context,{filename:file});
}
const game=window.WilderGame,sim=window.WilderTwinBattle.create({game});
const scout=window.WilderSwitchyardScout.create({game,sim});
const roster=["dewfin","thicketowl","kilnclaw","cairnwatch","cindlet","sprigkit"];
const rival=["pincoil","coalmoth","mossbell","glimmeray","kilnbeak","gustlance"];
const ctx=(picks,more)=>({roster,rival,picks,...more});
const card=(ids,gear={})=>({ids,gear});
const note=(data,id)=>scout.kin(data,id).join(" ");

test("both leads' provisional shots and reserve protection match actual opening damage",()=>{
  const data=ctx(roster.slice(0,2)),lines=scout.lines(data);
  assert.equal(lines.length,3);
  assert.match(lines[0],/Dewfin \+ Thicketowl · Rain Garden \(2 beats\).*Both strike and recover/);
  assert.match(lines[1],/Before calls or cover · Dewfin’s Bubble Jet → Coalmoth for 24 HP \/ Thicketowl’s Tendril Whip → Glimmeray for 26 HP/);
  assert.match(lines[2],/If Pincoil uses Coil Snap \(Arc\), Cairnwatch loses 8 HP on entry versus 26 for Dewfin/);
  const opening=sim.start(card(roster.slice(0,4)),card(["coalmoth","glimmeray","pincoil","mossbell"]));
  const shots=sim.resolve(opening,["attack:bubble-jet:0","attack:tendril-whip:1"],["attack:flare-wing:0","attack:lunar-surge:1"]);
  assert.deepEqual(Array.from(shots.events.filter(e=>e.kind==="attack"&&e.side===0),e=>e.damage),[24,26]);
  const threatened=sim.start(card(roster.slice(0,4)),card(rival.slice(0,4)));
  for(const [order,id,hp] of [["call:0","dewfin",26],["swap:cairnwatch","cairnwatch",8]]){
    const result=sim.resolve(threatened,[order,"cover:1"],["attack:coil-snap:0","cover:1"]);
    const hit=result.events.find(e=>e.kind==="attack");
    assert.deepEqual([hit.targetId,hit.damage],[id,hp]);
  }
});

test("picking and inspecting partners covers each Twinbell duet and both reserve roles",()=>{
  const roles={ward:/quarter damage/,mend:/recover/,relay:/Trade lanes/,lure:/pin the foe through next round/,mark:/50% more damage/,rush:/Pierce cover/};
  for(const [role,effect] of Object.entries(roles)){
    const partner=Object.values(game.species).find(k=>!k.bonus&&!roster.includes(k.id)&&window.WilderDuets.score("Tide",k.type).role===role);
    const sheet=ctx(["dewfin"],{roster:["dewfin",partner.id,...roster.slice(2)]});
    const result=scout.kin(sheet,partner.id)[0],pair=window.WilderDuets.score("Tide",partner.type);
    assert.ok(result.includes("Possible leads · Dewfin + "+partner.name));
    assert.ok(result.includes(pair.name+" ("+pair.cost+" beats)"));assert.match(result,effect);
  }
  const afterThree=scout.lines(ctx(["dewfin","thicketowl","kilnclaw"]));
  assert.match(afterThree[1],/Pincoil.*Kilnclaw loses 12 HP/);
  assert.match(afterThree[2],/If Mossbell uses Briar Bloom \(Grove\), Cindlet loses 11 HP on entry versus 24 for Dewfin/);
  assert.match(note(ctx(roster.slice(0,2)),"kilnclaw"),/Kilnclaw’s .* for \d+ HP.*Steam Exchange/);
  const picked=scout.lines(ctx(["dewfin","thicketowl","cairnwatch","cindlet"]));
  assert.match(picked[1],/Cairnwatch loses 8 HP/);assert.match(picked[2],/Cindlet loses 11 HP/);
});

test("the public sheet is bounded, memoized across picks, and sensitive to visible equipment",()=>{
  let starts=0;
  const measured=window.WilderSwitchyardScout.create({game,sim:{options:sim.options,start:(...args)=>{starts++;return sim.start(...args);}}});
  const sheet=ctx(roster.slice(0,2),{getHidden:()=>assert.fail("Read a private team")});
  Object.defineProperty(sheet,"rivalPicks",{get(){assert.fail("Read hidden picks");}});
  const clean=measured.kin(sheet,"cairnwatch").join(" ");assert.match(clean,/Cairnwatch loses 8 HP/);
  assert.equal(starts,9);
  for(let n=0;n<=4;n++){
    const result=measured.lines({...sheet,picks:roster.slice(0,n)});
    assert.ok(result.length>0&&result.length<=3);
    measured.kin(sheet,roster[n]);
  }
  assert.equal(starts,9);
  const fitted=measured.kin({...sheet,rivalGear:{pincoil:"prism-lens"}},"cairnwatch").join(" ");
  assert.equal(starts,18);assert.notEqual(fitted,clean);
  assert.deepEqual(Array.from(measured.lines({...sheet,rival:rival.slice(0,4)})),[]);
  assert.deepEqual(Array.from(measured.lines({...sheet,picks:["dewfin","dewfin"]})),[]);
  assert.deepEqual(Array.from(measured.kin(sheet,"stillwake")),[]);
  assert.deepEqual(roster,["dewfin","thicketowl","kilnclaw","cairnwatch","cindlet","sprigkit"]);
});
