const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const scripts=["atlas","bestiary","activities","campaign","story","duets","engine","world"].map(name=>{
  const filename=path.resolve(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(fs.readFileSync(filename,"utf8"),{filename});
});
const saveKey="wilderkin.trail.v3";
const plain=value=>JSON.parse(JSON.stringify(value));
function boot(record) {
  const window={localStorage:{getItem:key=>key===saveKey?record:null,setItem:(_,bytes)=>{record=bytes;}}};
  const context=vm.createContext({window});
  scripts.forEach(script=>script.runInContext(context));
  return {game:window.WilderGame,world:window.WilderWorld,read:()=>JSON.parse(record),reload:()=>boot(record)};
}
function visit(run,kind,ordinal=0) {
  const {game,world}=run;
  const site=world.regions[game.state.region].sites.filter(site=>(site.kind||site.id)===kind)[ordinal];
  game.setPosition(site.x,site.y);
  assert.ok(game.visitSite(kind));
  return site;
}
function enterDanger(run) {
  const {game}=run,index=game.regions.length-1;
  assert.ok(game.travel(index).ok);
  visit(run,"wild");
  const id=game.pools[index][0];
  assert.ok(game.startBattle("wild",id).ok);
  assert.equal(game.state.battle.enemy.level,game.wildLevel(index));
  assert.ok(game.state.battle.enemy.level>Math.max(...game.team().map(p=>p.level))+100);
  return id;
}
function loseWildFight(game) {
  let result;
  for(let n=0;game.state.battle && n<24;n++) {
    const replacement=game.replacements();
    if(replacement)assert.ok(game.replaceFainted(replacement.defaultId).ok);
    result=game.useSkill("trail-feint");
    assert.ok(result.ok,result.message);
  }
  assert.equal(result.kind,"defeat");
  assert.equal(game.state.battle,null);
  assert.ok(Object.values(result.fieldHp).every(hp=>hp===0));
  return result;
}

test("a fresh party can be knocked out at the native wild level and wakes safely at Hearth Cottage",()=>{
  const run=boot(),g=run.game,party=plain(g.state.party),bag=plain(g.state.bag);
  const foe=enterDanger(run),origin=g.state.region,level=g.state.battle.enemy.level;
  const back=run.reload(),loss=loseWildFight(back.game);
  const camp=back.world.regions[0].sites.find(site=>site.id==="camp");
  assert.deepEqual(plain(loss.rescue),{foe,level,region:origin,campRegion:0,campName:camp.label});
  assert.ok(loss.message.includes("Lv. "+level+" "+g.species[foe].name));
  assert.ok(loss.message.includes(camp.label));
  const saved=back.reload().game.state;
  assert.equal(saved.region,0);assert.equal(saved.landmark,"camp");
  assert.deepEqual(plain(saved.positions[0]),{x:camp.x,y:camp.y});
  assert.equal(saved.positions[origin],undefined);
  assert.deepEqual(plain(saved.party),party);assert.deepEqual(plain(saved.bag),bag);
  assert.equal(saved.wins,0);assert.deepEqual(plain(saved.crests),[]);
  assert.ok(saved.visited.includes(origin));
});

test("only resting sets the rescue camp, including a region's second campsite",()=>{
  const run=boot(),g=run.game;
  assert.ok(g.travel(1).ok);
  const camp=visit(run,"camp",1);
  assert.ok(g.heal().message.includes(camp.label));
  assert.deepEqual(plain(g.state.lastCamp),{region:1,site:1});
  assert.ok(g.travel(0).ok);visit(run,"camp");
  const back=run.reload();
  enterDanger(back);const loss=loseWildFight(back.game);
  assert.equal(loss.rescue.campRegion,1);assert.equal(loss.rescue.campName,camp.label);
  const saved=back.reload().game.state;
  assert.equal(saved.region,1);
  assert.deepEqual(plain(saved.positions[1]),{x:camp.x,y:camp.y});
  assert.deepEqual(plain(saved.lastCamp),{region:1,site:1});
  assert.equal(saved.rests,1);
});

test("existing careers without a checkpoint and damaged checkpoint data can recover without losing other progress",()=>{
  const old=boot();old.game.gather();const record=old.read();
  for(const lastCamp of [undefined,{region:999,site:0},{region:0,site:14}]) {
    const run=boot(JSON.stringify({...record,lastCamp}));
    enterDanger(run);const loss=loseWildFight(run.game);
    assert.equal(loss.rescue.campName,"Hearth Cottage");
    assert.deepEqual(plain(run.game.state.bag),record.bag);
    assert.deepEqual(plain(run.reload().game.state.lastCamp),{region:0,site:0});
  }
});
