const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const scripts=["atlas","bestiary","activities","story","campaign","duets","trials","engine"].map(name=>{
  const file=path.join(__dirname,"../games/wilderkin",name+".js");
  return new vm.Script(fs.readFileSync(file,"utf8"),{filename:file});
});
const clone=v=>JSON.parse(JSON.stringify(v));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function boot(saved,animate=()=>{},browser={}) {
  let record=saved;
  const storage={getItem:key=>key==="wilderkin.trail.v3"?record:null,setItem:(_,data)=>{record=data;}};
  const ctx=vm.createContext({window:{localStorage:storage,...browser}});
  scripts.forEach(s=>s.runInContext(ctx));
  const w=ctx.window,g=w.WilderGame;
  const api=w.WilderTrials.create({game:g,row:(id,label,value,detail,extra)=>({id,label,value,detail,...extra}),
    image:id=>id,render(){},notify(){},animate});
  const rows=()=>api.model().sections.flatMap(s=>s.rows||[]);
  const click=(id,v)=>{
    const row=rows().find(r=>r.id==="circuit-"+id&&(v===undefined||r.value===v));
    assert.ok(row&&!row.disabled,"enabled course control "+id+"/"+v);assert.ok(api.act(row.id,row.value));
  };
  return {g,api,click,rows,restore:w.WilderTrials.restore,reload:()=>boot(record,animate,browser),saved:()=>record};
}
function launch(h,mode="round"){
  h.click("start",mode);
  h.click("pick","sprigkit");h.click("pick","cindlet");h.click("pick","dewfin");
  h.click("launch");
}
const run=h=>h.g.state.circuit.run;
function campaign(h){const state=clone(h.g.state);delete state.circuit;return state;}

function chooseTurn(h) {
  const r=run(h),start=r.field;
  function evaluate(field,outcome,prior){
    const party=field.party,sum=party.reduce((n,p)=>n+p.hp/p.maxHp,0);
    if(outcome?.kind==="defeat")return -1000;
    if(outcome?.kind==="victory")return 200+sum;
    const b=field.battle,alive=party.filter(p=>p.hp).length;
    return 96-41*b.remaining.length-41*b.enemy.hp/b.enemy.maxHp+
      7*sum+2*alive+1.8*b.beats+(b.opening?1:0)-(prior?.id==="swap"?.2:0);
  }
  function options(field){
    return h.g.withLoaners(field,()=>{
      const lead=h.g.state.battle.activeId;
      return [...h.g.species[lead].skills.map(s=>({id:"skill",v:s.id})),...h.g.duets().options.filter(o=>o.available).map(o=>({id:"duet",v:o.partnerId})),
        ...h.g.team().filter(p=>p.id!==lead&&p.hp).map(p=>({id:"swap",v:p.id}))];
    });
  }
  function tryOption(field,choice){
    const temp=clone(field);
    const result=h.g.withLoaners(temp,()=>choice.id==="duet"?h.g.useDuet(choice.v):choice.id==="swap"?h.g.swap(choice.v):h.g.useSkill(choice.v));
    return result.ok?{temp,result}:null;
  }
  let winner=null,best=-Infinity;
  for(const choice of options(start)){
    const first=tryOption(start,choice);if(!first)continue;
    let value=evaluate(first.temp,first.result,choice);
    if(first.temp.battle){
      const follow=options(first.temp).map(c=>tryOption(first.temp,c)).filter(Boolean);
      value=.30*value+.70*Math.max(...follow.map(f=>evaluate(f.temp,f.result)));
    }
    if(value>best){winner=choice;best=value;}
  }
  return winner;
}

test("drafting, scouting and cancellation do not touch the campaign team or bag",()=>{
  const h=boot(),before=campaign(h);
  h.click("start","round");h.click("pick","cindlet");h.click("pick","dewfin");
  const preview=h.rows().find(row=>row.label==="Steam Exchange");
  assert.ok(preview.detail.includes("counter"));
  assert.ok(h.rows().some(row=>row.id==="circuit-launch"&&row.disabled));
  h.click("pick","sprigkit");h.click("launch");h.click("lead","sprigkit");h.click("route",1);
  assert.equal(h.api.model().kind,"battle");assert.equal(run(h).field.battle.remaining.length,1);
  assert.ok(run(h).field.party.every(p=>p.level===18));assert.equal(run(h).field.battle.enemy.level,18);
  h.click("quit");h.click("resume");
  assert.equal(run(h).phase,"bout");
  assert.deepEqual(campaign(h),before);
});

for(const [mode,n,route] of [["round",3,0],["night",4,1]]){
  test(mode+" crew completes the course from a fresh save, including admission, services, and a rematch",async()=>{
    let h=boot();const before=campaign(h);launch(h,mode);
    let usedDuets=0,traded=false,patched=false;
    for(let i=0;i<n;i++){
      assert.equal(run(h).leg,i);assert.equal(run(h).phase,"route");h.click("route",route);
      for(let turns=0;run(h).phase==="bout"&&turns<80;turns++){
        const c=chooseTurn(h);
        h.click(c.id,c.v);await tick();
        if(c.id==="duet")usedDuets++;
        if(turns===1&&i===0){
          const current=clone(run(h));h=h.reload();assert.deepEqual(clone(run(h)),current);
        }
      }
      if(i<n-1){
        assert.equal(run(h).phase,"service");
        const field=run(h).field,injured=field.party.some(p=>p.hp<p.maxHp);
        assert.ok(injured);
        const offer=h.rows().find(row=>row.id==="circuit-trade");
        if(offer&&!traded){
          h.click("trade",offer.value);traded=true;
          assert.ok(run(h).field.party.some(p=>p.hp===p.maxHp));assert.ok(!run(h).picks.includes(offer.value));
        }else{
          const starting=clone(field.party);
          h.click("mend");patched=true;
          for(const [j,p] of run(h).field.party.entries())
            assert.equal(p.hp,Math.min(p.maxHp,starting[j].hp+Math.ceil(p.maxHp*(route===0?.45:.20))));
        }
      }
    }
    assert.equal(run(h).phase,"cleared");assert.ok(usedDuets>0);
    assert.ok(traded||patched);
    assert.equal(h.g.state.circuit.best[mode],run(h).marks);
    const currentBoard=run(h).board;h.click("replay",mode);assert.equal(run(h).board,currentBoard);
    h.click("quit");h.click("retire");assert.equal(run(h),null);assert.ok(h.g.state.circuit.best[mode]>0);
    h.click("start",mode);assert.notEqual(run(h).board,currentBoard);
    assert.deepEqual(campaign(h),before);
  });
}

test("the committed turn survives a reload during its animation and double input spends one turn",async()=>{
  let unlock;const effects=[],h=boot(null,fx=>new Promise(resolve=>{effects.push(fx);unlock=resolve;}));
  launch(h);h.click("route",0);
  const before=h.api.model();
  h.click("skill","brush-dash");
  assert.equal(run(h).field.battle.turn,2);
  assert.equal(effects.length,1);assert.equal(effects[0].impact.ally.hp,before.ally.hp);
  assert.ok(effects[0].impact.foe.hp<before.foe.hp);
  assert.ok(h.api.key({key:"1",repeat:false}));
  assert.equal(run(h).field.battle.turn,2);
  assert.equal(run(h.reload()).field.battle.turn,2);
  unlock();await tick();
  assert.equal(effects[1].side,"foe");assert.ok(effects[1].impact.ally.hp<before.ally.hp);
  assert.equal(effects[1].impact.foe.hp,effects[0].impact.foe.hp);
  unlock();await tick();
});

test("malformed course state is isolated, and a real trail encounter can never advance a loaner fight",()=>{
  const h=boot();launch(h);h.click("route",0);
  const broken=clone(h.g.state);broken.circuit.best.round=8;broken.circuit.run.field.battle.enemy.id="__proto__";
  const other=boot(JSON.stringify(broken));
  assert.equal(run(other),null);assert.equal(other.g.state.circuit.best.round,8);assert.equal(other.g.state.party[0].id,"sprigkit");
  assert.ok(h.g.startBattle("wild","mossbell").ok);
  assert.equal(h.api.model().sections.length,0);
  assert.ok(h.api.act("circuit-skill","leaf-flurry"));
  assert.equal(run(h).field.battle.turn,1);assert.equal(h.g.state.battle.turn,1);
});

async function finishRound(h){
  for(let i=0;i<3;i++){
    h.click("route",0);
    for(let n=0;run(h).phase==="bout"&&n<75;n++){
      const c=chooseTurn(h);h.click(c.id,c.v);await tick();
    }
    if(i<2)h.click("mend");
  }
  assert.equal(run(h).phase,"cleared");
}
test("a copied score challenge gives two independent players the same draft and routes",async()=>{
  let shared;
  const location={hash:"",origin:"https://example.test",pathname:"/games/wilderkin/",search:"?private=irrelevant"};
  const h=boot(null,undefined,{location,navigator:{clipboard:{writeText:async url=>{shared=url;}}}});
  launch(h);const board=run(h).board,options=h.rows().filter(r=>r.id==="circuit-route").map(r=>r.detail);
  await finishRound(h);
  const target=run(h).marks;h.click("copy");await tick();
  assert.equal(shared,"https://example.test/games/wilderkin/#WK1-R-01-"+target);
  const guest=boot(null,undefined,{location:{...location,hash:new URL(shared).hash}});
  assert.ok(guest.api.hasInvitation());
  assert.equal(guest.api.model().title,"Course invitation");
  assert.equal(run(guest),null);const original=campaign(guest);
  guest.click("join");assert.equal(run(guest).board,board);
  guest.click("pick","sprigkit");guest.click("pick","cindlet");guest.click("pick","dewfin");guest.click("launch");
  assert.deepEqual(Array.from(guest.rows().filter(r=>r.id==="circuit-route"),r=>r.detail),Array.from(options));
  await finishRound(guest);
  assert.equal(run(guest).marks,target);assert.equal(guest.api.model().sections.find(s=>s.title==="Challenge tied")?.title,"Challenge tied");
  guest.click("replay","round");assert.equal(run(guest).invite,"WK1-R-01-"+target);assert.deepEqual(campaign(guest),original);
});

test("an invitation never alters an in-progress crew, and blocked clipboard access shows the actual code",async()=>{
  const initial=boot();launch(initial);initial.click("route",0);const saved=initial.saved();
  const guest=boot(saved,undefined,{location:{hash:"#WK1-N-12",origin:"https://example.test",pathname:"/g/"},navigator:{clipboard:{writeText:()=>Promise.reject(new Error("denied"))}}});
  const prior=clone(run(guest));
  assert.equal(guest.api.model().title,"Course invitation");assert.ok(guest.rows().find(r=>r.id==="circuit-join").disabled);
  guest.api.act("circuit-join");guest.api.key({key:"1"});guest.api.act("circuit-skill","leaf-flurry");assert.deepEqual(clone(run(guest)),prior);
  guest.click("dismiss");guest.click("quit");guest.click("retire");
  guest.click("invite");guest.click("join");assert.equal(run(guest).mode,"night");assert.equal(run(guest).board,11);
  guest.click("copy");await tick();assert.ok(guest.rows().find(r=>r.id==="circuit-copy").detail.includes("Add #WK1-N-12"));
});

test("malformed, unversioned or impossible challenge codes have no effect",()=>{
  const broken=["#WK2-R-01","#WK1-X-01","#WK1-R-13","#WK1-R-00","#WK1-R-01-1","#WK1-R-01-19","#WK1-N-01-24",
    "#WK1-R-01-09","#WK1-R-01-0001","#WK1-R-01-9?x","#WK1-R-01-9\n","#WK1-R-01%23","javascript:alert(1)"];
  for(const hash of broken){
    const h=boot(null,undefined,{location:{hash}});assert.equal(h.api.hasInvitation(),false,hash);assert.equal(run(h),null);
  }
});
