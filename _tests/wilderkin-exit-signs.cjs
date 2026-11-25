const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const shell=new vm.Script(fs.readFileSync(path.join(__dirname,"../games/wilderkin/canvas-shell.js"),"utf8"));

function renderMap(width) {
  const paints=[],buttons=[],actions=[],noop=()=>{};
  const ctx=new Proxy({measureText:t=>({width:t.length*7}),fillText:(value,x,y)=>paints.push({value,x,y})},
    {get:(target,key)=>key in target?target[key]:noop});
  function node(tag){
    const listeners={};
    const element={dataset:{},listeners,style:{},addEventListener:(name,cb)=>{listeners[name]=cb;},
      getContext:()=>ctx,getBoundingClientRect:()=>({width,height:800,left:0,top:0}),
      after:noop,append:noop,replaceChildren:noop,setAttribute:noop,focus:noop,setPointerCapture:noop,hasPointerCapture:()=>false};
    if(tag==="button")buttons.push(element);
    return element;
  }
  const regions=[{cols:24,rows:13,spawn:{x:11,y:7}}];
  const window={matchMedia:()=>({matches:true}),WilderWorld:{regions,draw:noop}};
  const document={createElement:node,createDocumentFragment:node,addEventListener:noop};
  shell.runInNewContext({window,document,performance:{now:()=>50},Image:class{},AbortController,
    ResizeObserver:class{observe(){}},requestAnimationFrame:noop,setTimeout:noop});
  const canvas=node("canvas");
  const ui=window.WilderCanvas.create(canvas,{action:(id,value)=>actions.push([id,value])});
  const exits=[["up",10,0,"The Silver Windfalls"],["left",0,5,"Fossil Steps"],["right",23,7,"Cinderfall Ridge"],["down",11,12,"Kingfisher Narrows"]]
    .map(([direction,x,y,label],i)=>({id:"walk-marker",value:"road-"+i,direction,x,y,label,level:10+i,near:i===0}));
  ui.show({id:"world:",kind:"world",title:"Crossroads",region:0,sections:[],exits});
  function tap(x,y){
    const ev={clientX:x,clientY:y,button:0,pointerId:1};
    canvas.listeners.pointerdown(ev);canvas.listeners.pointerup(ev);
  }
  return {paints,buttons:buttons.filter(b=>b.dataset.action==="walk-marker"),actions,exits,tap};
}

for(const width of [320,1280]){
  test("map exit labels, pointer targets and accessible actions agree at "+width+"px",()=>{
    const {paints,buttons,actions,exits,tap}=renderMap(width);
    assert.equal(buttons.length,4);
    for(const [i,exit] of exits.entries()){
      const b=buttons.find(b=>b.dataset.value===exit.value);
      assert.ok(b.textContent.includes(exit.label)&&b.textContent.includes("Wild level "+exit.level));
      if(exit.near)assert.match(b.textContent,/Enter /);
      b.listeners.click();
      const firstWord=exit.label.split(" ")[0],text=paints.find(t=>t.value===firstWord||t.value.startsWith(firstWord+" "));
      assert.ok(text&&text.x>=0&&text.x+text.value.length*7<=width);
      tap(text.x+2,text.y+3);
      assert.deepEqual(actions.slice(i*2),[["walk-marker",exit.value],["walk-marker",exit.value]]);
    }
  });
}
