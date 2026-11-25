const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const scripts=["atlas","bestiary","activities","story","campaign","duets","trials","engine","reedbank"].map(name=>{
  const filename=path.join(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(fs.readFileSync(filename,"utf8"),{filename});
});

function boot(){
  const context=vm.createContext({window:{}});
  scripts.forEach(script=>script.runInContext(context));
  const game=context.window.WilderGame;
  let screen;const effects=[];
  const school=context.window.WilderReedbank.create({game,image:id=>id,go:(_,page)=>{screen=page;},
    row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),animate:fx=>{effects.push(fx);},render(){},notify(message){assert.fail(message);}});
  return {game,school,effects,opened:()=>school.model(screen)};
}

test("replaying the same relay with the other scout changes which crossing Cindlet clears",async()=>{
  const {game,school,effects,opened}=boot();
  game.startBattle("wild","gustlance");
  const career=()=>JSON.stringify({...game.state,relayClears:[]});
  const original=career();
  for(const [course,id,action,outcome] of [
    ["bell","gustlance","pass","Crossing cleared"],["bell","galeskip","pass","Back at the mill"],
    ["ferry","galeskip","pass","Crossing cleared"],["ferry","gustlance","pass","Back at the mill"],
    ["ferry","galeskip","swap","Back at the mill"],["bell","gustlance","swap","Back at the mill"]]){
    const choose=school.model(course).sections[0].rows.find(r=>r.value===course+"|"+id);
    school.act(choose.id,choose.value);
    assert.equal(opened().kind,"battle");
    const move=opened().sections[0].rows.find(r=>r.value===action);
    effects.length=0;
    school.act(move.id,move.value);
    await new Promise(resolve=>setImmediate(resolve));
    const [handoff,reply]=effects;
    assert.equal(handoff.impact.ally.fighter.species,"cindlet");assert.equal(reply.impact.ally.id,"cindlet");
    assert.equal(reply.impact.ally.hp-handoff.impact.ally.hp,reply.impact.ally.change);
    assert.ok(reply.impact.ally.change<0);
    if(course==="bell"){
      const hit=opened().sections[0].rows.find(r=>r.value==="ember-pop");
      school.act(hit.id,hit.value);
      await new Promise(resolve=>setImmediate(resolve));
    }
    assert.equal(opened().title,outcome);
    assert.equal(career(),original,"the campaign encounter and its team are independent of the school");
  }
  assert.deepEqual([...game.state.relayClears],["bell|gustlance","ferry|galeskip"]);
  assert.match(school.model().sections[0].title,/2 \/ 2/);
});
