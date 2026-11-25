const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

function boot(){
  const c=vm.createContext({window:{}});
  for(const id of ["atlas","bestiary","activities","story","campaign","duets","trials","growth","stillwake","wardens","engine"]){
    const file=path.join(__dirname,"../games/wilderkin",id+".js");
    vm.runInContext(fs.readFileSync(file,"utf8"),c,{filename:file});
  }
  return c.window.WilderGame;
}

test("ordinary skill forecasts across the roster match both immediate health changes",()=>{
  const game=boot(),ids=Object.keys(game.species);
  let count=0;
  // Rotate field conditions, cover, exposure, a charged reply and a near-finished enemy.
  for(const [i,id] of ids.entries()){
    const kin=game.species[id],reserve=id==="sprigkit"?"cindlet":"sprigkit";
    for(const skill of kin.skills){
      const party=[game.loaner(id,20),game.loaner(reserve,20)],lead=party[0],foeId=ids[(i+53)%ids.length];
      const field={region:0,team:party.map(p=>p.id),party,lead:id,battle:null};
      game.withLoaners(field,begin=>{
        begin([foeId],20,"Forecast", {condition:["echo","ledge","gale","shelter"][i%4],weather:i%2?kin.type:null});
        const b=game.state.battle,enemy=b.enemy;
        Object.assign(b,{turn:i%3===0?3:4,opening:i%4===1,cover:i%5===0?2:0,lastAttack:skill.id});
        if(i%7===0 && skill.kind!=="heal")enemy.hp=1;
        lead.hp-=11;
        const before=[lead.hp,enemy.hp],record=JSON.stringify(field),plan=game.ordinaryForecast(skill.id);
        assert.equal(JSON.stringify(field),record);
        assert.ok(plan.available);
        const res=game.useSkill(skill.id);
        assert.ok(res.ok);
        const strike=res.impacts.ally,reply=res.impacts.foe;
        assert.equal(strike.foe.hp,before[1]-plan.damage);
        assert.equal(strike.foe.change,0-plan.damage);
        assert.equal(strike.ally.hp,before[0]+plan.healing);
        assert.equal(strike.ally.change,plan.healing);
        if(plan.finishes)assert.equal(reply,undefined);
        else{
          assert.equal(reply.ally.hp,strike.ally.hp-plan.returnDamage);
          assert.equal(reply.ally.change,0-plan.returnDamage);
        }
        assert.equal(before[1]-enemy.hp,plan.damage,kin.name+" "+skill.name);
        assert.equal(lead.hp,before[0]+plan.healing-plan.returnDamage,kin.name+" "+skill.name);
        assert.equal(res.kind==="victory",plan.finishes);
        count++;
      });
    }
  }
  assert.ok(ids.length>=500 && count>=1600);
});

test("capture feints preserve 1 HP, and the preview identifies unusable moves without spending a turn",()=>{
  const g=boot();
  assert.equal(g.ordinaryForecast("trail-feint"),null);
  g.startBattle("wild","opalclasp");
  const b=g.state.battle,active=g.team().find(p=>p.id===b.activeId);
  assert.equal(g.ordinaryForecast("sun-nap").available,false);
  assert.equal(g.ordinaryForecast("an-unknown-move"),null);
  while(b.enemy.hp>1){
    const before=[active.hp,b.enemy.hp],p=g.ordinaryForecast("trail-feint");
    assert.ok(p.available);assert.ok(!p.finishes);g.useSkill("trail-feint");
    assert.equal(active.hp,before[0]-p.returnDamage);assert.equal(b.enemy.hp,before[1]-p.damage);
  }
  const record=JSON.stringify(g.state);
  assert.equal(g.ordinaryForecast("trail-feint").available,false);
  assert.ok(!g.useSkill("trail-feint").ok);assert.equal(JSON.stringify(g.state),record);
});
