const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const ctx=vm.createContext({window:{localStorage:{getItem(){return null;},setItem(){throw new Error("Review changed campaign storage");}}}});
for(const id of ["atlas","bestiary","activities","campaign","story","duets","engine","sparring-battle","sparring-review"]) {
  const file=path.join(__dirname,"../games/wilderkin",id+".js");vm.runInContext(fs.readFileSync(file,"utf8"),ctx,{filename:file});
}
const {WilderGame:game,WilderSparringBattle:kernel,WilderSparringReview:moduleReview}=ctx.window;
const copy=value=>JSON.parse(JSON.stringify(value)),sim=kernel.create({game});
const left=["sprigkit","cindlet","dewfin"],right=["mossbell","coalmoth","glimmeray"];
function fixture(human=0,first=0,useCoach=false) {
  const record={left:left.slice(),right:right.slice(),first,human,moves:[]},events=[];
  let p=sim.start(left,right,first);
  while(p.phase!=="done"){
    const choices=sim.options(p).filter(m=>m.available),move=useCoach&&p.turn!==human?sim.recommend(p):
      choices.find(m=>m.kind==="attack"||m.kind==="replace");
    const after=sim.apply(p,move.id);events.push({p,move,after});record.moves.push(move.id);p=after;
  }
  return {record,events,p};
}
function desk(record){
  const nav=[];
  const api=moduleReview.create({game,read:()=>record,
    row:(id,label,value,detail="",extras={})=>({id,label,value,detail,...extras}),
    go:(...args)=>nav.push(args)});
  return {api,nav};
}
const rows=page=>page.sections.flatMap(s=>s.rows||[]);
const section=(page,title)=>page.sections.find(s=>s.title===title);
const allText=page=>JSON.stringify(page);
const alive=(p,i)=>p.sides[i].team[p.sides[i].active];
const hp=(p,i)=>p.sides[i].team.reduce((n,a)=>n+a.hp,0);

test("the exact starting side, turn and every actual command—including replacements—replay in order",()=>{
  for(const human of [0,1])for(const first of [0,1]){
    const {record,events,p}=fixture(human,first),{api}=desk(record),catalog=[];
    assert.ok(api.valid(record));assert.ok(api.valid({setup:{left,right,mode:"cpu"},first,moves:record.moves,human}));
    for(let page=0;page<Math.ceil(events.length/6);page++)catalog.push(...api.model("p"+page).sections[0].rows);
    assert.equal(catalog.length,events.length);
    assert.ok(api.model("").kicker.includes(p.winner===human?"YOUR TEAM WON":"RIVAL TEAM WON"));
    for(const [i,e] of events.entries()){
      assert.equal(catalog[i].value,"t"+i);assert.ok(catalog[i].label.endsWith(e.move.label));
      const turn=api.model(catalog[i].value),r=section(turn,"Recorded play").rows;
      assert.ok(r[0].label.endsWith(e.move.label));
      assert.equal(!!section(turn,"Try another move here"),e.p.turn===human&&sim.options(e.p).filter(m=>m.available).length>1);
      const phrase=game.species[alive(e.p,e.p.turn).id].name;assert.ok(turn.subtitle.includes(phrase));
      if(e.move.kind==="replace")assert.ok(r[1].label.endsWith(events[i+1].move.label));
    }
  }
});

test("a different first move uses the actual immutable position, with exact alternate projections and the recorded result",()=>{
  const {record,events}=fixture(),saved=JSON.stringify(record),campaign=JSON.stringify(game.state),{api,nav}=desk(record);
  const before=events[0].p,alternative=sim.forecast(before,"skill:brush-dash");
  const after=sim.apply(before,alternative.id),answer=sim.recommend(after),end=sim.apply(after,answer.id);
  const choice=rows(api.model("t0")).find(r=>r.value==="a0/"+alternative.id);assert.ok(choice);
  assert.equal(choice.detail,alternative.detail);assert.ok(api.act(choice.id,choice.value));assert.deepEqual(nav.at(-1),["sparring-review",choice.value,"replace"]);
  const page=api.model(choice.value),line=section(page,"If you chose "+alternative.label).rows;
  assert.equal(line.length,2);assert.ok(line[1].label.includes(answer.label));
  assert.equal(section(page,"Projected position").rows[0].detail.split(" · ")[0],alive(end,0).hp+"/"+alive(end,0).maxHp+" HP");
  const realEnd=events[1].after,delta=hp(end,0)-hp(realEnd,0);
  assert.ok(section(page,"After this exchange").text.includes(delta===0?"the same HP":Math.abs(delta)+(delta>0?" more HP":" less HP")));
  const back=rows(page).find(r=>r.label==="Return to recorded turn");assert.ok(api.act(back.id,back.value));assert.equal(nav.at(-1)[1],"t0");
  assert.ok(section(api.model("t0"),"Recorded play").rows[0].label.endsWith(events[0].move.label));
  assert.equal(JSON.stringify(record),saved);assert.equal(JSON.stringify(game.state),campaign);
  assert.ok(api.act("spar-review-leave"));assert.deepEqual(nav.at(-1),["sparring","result","replace"]);
  assert.equal(api.act("spar-move","skill:brush-dash"),false);
});

test("free replacements compare the selected incoming kin, its own opening action and the rival response",()=>{
  const {record,events}=fixture(0,0,true),{api}=desk(record);
  const i=events.findIndex(e=>e.p.turn===0&&e.move.kind==="replace"&&sim.options(e.p).length>1);assert.ok(i>=0);
  const e=events[i],alt=sim.options(e.p).find(m=>m.id!==e.move.id);
  const page=api.model("a"+i+"/"+alt.id),line=section(page,"If you chose "+alt.label).rows;
  assert.ok(line[0].label.endsWith(alt.label));assert.match(line[1].label,/Your team/);assert.match(line.at(-1).label,/Rival team/);
  assert.ok(line[0].detail.includes("Free replacement"));assert.ok(allText(page).includes("incoming leader"));
  const position=section(page,"Projected position").rows[0];assert.ok(position.label.includes(game.species[alt.targetId].name)||line.some(x=>x.detail.includes("takes the lead")));
});

test("an independently recorded rival can diverge from the coach and both branches are labeled",()=>{
  const {record,events}=fixture(),{api}=desk(record);
  const i=events.findIndex((e,i)=>e.p.turn===0&&e.move.kind!=="replace"&&e.after.phase==="move"&&
    sim.recommend(e.after).id!==events[i+1]?.move.id);
  assert.ok(i>=0);
  const e=events[i],alt=sim.options(e.p).find(m=>m.available&&m.id!==e.move.id);
  const page=api.model("a"+i+"/"+alt.id);
  assert.ok(section(page,"In the match").rows[1].label.endsWith(events[i+1].move.label));
  assert.ok(section(page,"Coach’s reply to your recorded move").rows[0].label.endsWith(sim.recommend(e.after).label));
  assert.ok(section(page,"If you chose "+alt.label));
});

test("partial games, altered tapes, post-result commands and foreign lineups cannot generate an official review",()=>{
  const {record}=fixture(),{api}=desk(record);
  const invalid=[null,{...record,moves:record.moves.slice(0,-1)},{...record,moves:[...record.moves,"skill:leaf-flurry"]},
    {...record,first:2},{...record,human:3},{...record,left:["sprigkit","sprigkit","__proto__"]},
    {...record,moves:Array(67).fill("swap:dewfin")},{...record,moves:[null]},
    {setup:{mode:"local",left,right},first:0,moves:record.moves}];
  for(const r of invalid){assert.equal(api.valid(r),false);assert.match(allText(desk(r).api.model("")),/Finish a rival match/);}
  const bad=copy(record),view=desk(bad).api;assert.ok(view.valid(bad));bad.moves[0]="move:unknown";assert.equal(view.valid(bad),false);
  assert.equal(api.model("a0/skill:unknown").title,"Action 1");
  assert.equal(api.model("t98").title,"Match review");
  assert.equal(api.model("a1/skill:root-rest").title,"Action 2");
  assert.equal(api.model("a0/"+record.moves[0]).title,"Action 1");
});

test("an alternative on the last action can change the projected verdict while the recorded draw remains intact",()=>{
  const record={left,right,first:1,human:0,moves:[]};
  let p=sim.start(left,right,1),last=null;
  while(p.phase!=="done"){
    last=p;const m=sim.options(p).find(o=>o.available&&o.kind==="swap");
    record.moves.push(m.id);p=sim.apply(p,m.id);
  }
  const {api}=desk(record),attack=sim.options(last).find(o=>o.kind==="attack");
  assert.equal(p.winner,"draw");assert.ok(api.model("").kicker.includes("DRAW"));
  const review=api.model("a59/"+attack.id);
  assert.equal(section(review,"If you chose "+attack.label).rows.length,1);
  assert.match(allText(review),/Your team wins in this variation/);assert.ok(api.model("").kicker.includes("DRAW"));assert.equal(record.moves.length,60);
});
