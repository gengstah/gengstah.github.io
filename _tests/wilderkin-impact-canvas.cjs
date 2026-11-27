const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const shell=new vm.Script(fs.readFileSync(path.join(__dirname,"../games/wilderkin/canvas-shell.js"),"utf8"));

// Advance the renderer's frame and timeout clocks independently. Checking the
// drawing calls catches a HUD that jumps straight to the already-saved end of turn.
function arena(reduced=false,viewport={width:390,height:844}){
  let now=0,frame,finish;
  const ink=[],paint=[],noop=()=>{};
  const ctx=new Proxy({
    measureText:s=>({width:s.length*6}),fillText:(s,x,y)=>{ink.push(s);paint.push({s,x,y});}
  },{get:(target,key)=>key in target?target[key]:noop});
  const node=()=>({dataset:{},getContext:()=>ctx,getBoundingClientRect:()=>viewport,
    after:noop,append:noop,addEventListener:noop,setAttribute:noop,replaceChildren:noop});
  const window={matchMedia:()=>({matches:reduced}),WilderGame:{state:{animationSpeed:1}}};
  const document={createElement:node,createDocumentFragment:node,addEventListener:noop};
  shell.runInNewContext({window,document,performance:{now:()=>now},Image:class{},AbortController,
    ResizeObserver:class{observe(){}},requestAnimationFrame:cb=>{frame=cb;},setTimeout:cb=>{finish=cb;}});
  const ui=window.WilderCanvas.create(node());
  const actor=(name,hp)=>({species:name,name,src:name,level:5,hp,maxHp:hp});
  ui.show({id:"battle",kind:"battle",title:"Battle",sections:[],ally:actor("Cindlet",28),foe:actor("Opalclasp",32)});
  return {ui,ink,paint,draw(t){now=t;ink.length=0;paint.length=0;frame(t);},finish(t){now=t;finish();}};
}
const loss=(side,id,hp,maxHp,change)=>({[side]:{id,hp,maxHp,change}});

test("canvas paints only the target's damage at each attack impact and keeps the first hit through the counter windup",async()=>{
  const view=arena(),{ui,ink}=view;
  const attack=ui.animate({kind:"attack",side:"ally",impact:loss("foe","Opalclasp",25,32,-7)});
  view.draw(180);
  assert.ok(ink.includes("28/28")&&ink.includes("32/32")&&!ink.includes("−7"));
  view.draw(275);
  assert.ok(ink.includes("28/28")&&ink.includes("25/32")&&ink.includes("−7"));
  view.finish(550);await attack;
  const counter=ui.animate({kind:"attack",side:"foe",impact:loss("ally","Cindlet",23,28,-5)});
  view.draw(680);
  assert.ok(ink.includes("28/28")&&ink.includes("25/32")&&!ink.includes("−5"));
  view.draw(825);
  assert.ok(ink.includes("23/28")&&ink.includes("25/32")&&ink.includes("−5"));
  view.finish(1100);await counter;
  view.draw(2000);
  assert.ok(ink.includes("23/28")&&!ink.includes("−5")&&!ink.includes("−7"));
});

test("reduced motion shows the hit on the first static frame, and an unpainted background hit settles before the next animation",async()=>{
  const reduced=arena(true);
  reduced.ink.length=0;
  const strike=reduced.ui.animate({side:"ally",impact:loss("foe","Opalclasp",24,32,-8)});
  assert.ok(reduced.ink.includes("−8")&&reduced.ink.includes("24/32"));
  reduced.finish(95);await strike;
  const paused=arena();
  const unseen=paused.ui.animate({side:"ally",impact:loss("foe","Opalclasp",24,32,-8)});
  paused.finish(550);await unseen;
  paused.draw(600);assert.ok(paused.ink.includes("24/32"));
});

test("a short phone paints two complete interactive choices before the encounter art and log",()=>{
  const {ui,paint}=arena(true,{width:320,height:568});
  const actions=[{id:"capture",label:"Cast Kinweave"},{id:"skill",value:"spark",label:"Finish with Spark"}];
  ui.show({id:"battle:",kind:"battle",title:"Wild encounter",kicker:"Mossbrook / TURN 3",
    decisions:actions,sections:[{title:"Choices",rows:actions}]});
  const marks=actions.map(r=>paint.find(p=>p.s===r.label));
  assert.ok(marks.every(Boolean));
  assert.ok(marks[0].y>=50&&marks[1].y>=marks[0].y+47&&marks[1].y+47<=568-47);
});
