const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.join(__dirname,"../games/wilderkin");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const files=Array.from(html.matchAll(/<script src="([^"?]+)(?:\?[^"]*)?"/g),m=>m[1]);
const scripts=files.filter(f=>!["canvas-shell.js","kin-art.js","score.js"].includes(f)).map(f=>{
  const filename=path.join(root,f);return [f,new vm.Script(fs.readFileSync(filename,"utf8"),{filename})];
});
const clone=v=>JSON.parse(JSON.stringify(v)),tick=()=>new Promise(resolve=>setImmediate(resolve));
function boot(hash,save=null,prepare){
  let model,input,time=0;const frames=[],listeners={};
  const localStorage={getItem:k=>k==="wilderkin.trail.v3"?save:null,setItem:(_,v)=>{save=v;}};
  const w={localStorage,location:{hash},addEventListener:(event,fn)=>{listeners[event]=fn;},
    WilderKinArt:{sprite:id=>"sprite:"+id},WilderScore:{create:()=>({scene(){},answer(){}})},
    WilderCanvas:{create:(_,handlers)=>{input=handlers;return {show:m=>{model=m;},animate:()=>Promise.resolve(),toast(){},invalidate(){}};}}};
  function canvas(){
    const node={toDataURL:()=>"image:test"},noop=()=>{};
    node.getContext=()=>({canvas:node,drawImage:noop,fillRect:noop,putImageData:noop,beginPath:noop,lineTo:noop,moveTo:noop,
      stroke:noop,createImageData:(width,height)=>({data:new Uint8ClampedArray(width*height*4)})});
    return node;
  }
  const ctx=vm.createContext({window:w,document:{getElementById:canvas,createElement:canvas,hidden:false},performance:{now:()=>time},
    matchMedia:()=>({matches:true}),requestAnimationFrame:cb=>frames.push(cb)});
  for(const [file,script] of scripts){if(file==="game.js")prepare?.(w.WilderGame);script.runInContext(ctx);}
  return {g:w.WilderGame,model:()=>model,save:()=>save,key:key=>input.key({key}),hash:value=>{w.location.hash=value;listeners.hashchange();},
    click(id,value){const rows=model.sections.flatMap(s=>s.rows||[]);const found=rows.find(r=>r.id===id&&(value===undefined||value===r.value));
      assert.ok(found&&!found.disabled,id+" / "+value+" on "+model.title);input.action(found.id,found.value);},
    walk(){for(let i=0;frames.length&&i<300;i++){time+=130;frames.shift()(time);}assert.equal(frames.length,0);}
  };
}
const ok=result=>assert.ok(result.ok,result.message);
test("the real controller prioritizes a saved knockout over a deep link and ordinary attack keys",()=>{
  const a=boot("#second-bell",null,g=>{
    ok(g.setLead("dewfin"));
    for(let n=0;n<10&&!g.replacements();n++){
      ok(g.startBattle("wild","mossbell"));
      while(!g.replacements()&&g.ordinaryForecast("trail-feint").available)ok(g.useSkill("trail-feint"));
      if(!g.replacements())ok(g.flee());
    }
  });
  assert.equal(a.model().id,"replacement:");
  assert.equal(a.model().ally.hp,0);assert.equal(a.model().ally.species,"dewfin");
  const before=clone(a.g.state.battle),pick=a.g.replacements(),target=pick.options.find(p=>p.id!==pick.defaultId);
  const slot=pick.options.indexOf(target),row=a.model().sections[0].rows[slot];
  assert.equal(row.value,target.id);assert.ok(row.detail.includes(target.attackName+" · deal "+target.attackDamage));
  for(const key of ["1","2","3","4","r","Escape"])assert.ok(a.key(key));
  a.hash("#lantern-cup");assert.equal(a.model().id,"replacement:");assert.deepEqual(clone(a.g.state.battle),before);
  const b=boot("#guard-school",a.save());assert.equal(b.model().id,"replacement:");assert.ok(b.key(row.key));
  assert.equal(b.model().id,"battle:");assert.equal(b.g.state.battle.activeId,target.id);
  assert.equal(b.g.state.battle.turn,before.turn);assert.equal(b.g.state.battle.beats,before.beats);
  assert.equal(b.g.state.battle.enemy.hp,before.enemy.hp);assert.equal(b.g.replacements(),null);
});
test("a fresh player can walk to Fern, choose an opener, see the visiting kin, and withdraw to the same desk after reload",async()=>{
  const a=boot("#second-bell"),g=a.g,offer=g.secondBell(0);
  assert.equal(a.model().title,"The Second Bell");assert.ok(offer.eligible&&!offer.atLodge);
  assert.ok(!g.pools[0].includes(offer.guest));
  assert.ok(a.model().sections.flatMap(s=>s.rows||[]).some(r=>r.badge==="GUEST"&&r.label===g.species[offer.guest].name));
  const hp=g.team().map(k=>k.hp);
  a.click("bell-lead","cindlet");a.click("bell-walk",0);a.walk();
  assert.equal(g.state.landmark,"warden");a.click("bell-ring",0);
  assert.equal(a.model().title,"Second Bell · Warden Fern");assert.equal(g.state.battle.activeId,"cindlet");
  assert.ok(a.model().sections.find(s=>s.title.startsWith("Published formation")).text.includes(g.species[offer.guest].name));
  assert.ok(!a.model().sections.flatMap(s=>s.rows||[]).some(r=>r.value==="bag"));
  const b=boot("#second-bell",a.save());assert.equal(b.model().id,"battle:");assert.ok(b.key("b"));assert.equal(b.model().id,"battle:");
  b.click("retreat");await tick();assert.equal(b.model().title,"Exhibition withdrawn");assert.equal(b.g.state.battle,null);
  b.click("view","second-bell|0");assert.equal(b.model().title,"The Second Bell");assert.deepEqual(Array.from(b.g.team(),k=>k.hp),Array.from(hp));
  assert.equal(b.g.state.crests.length,0);assert.equal(b.g.state.landmark,"warden");
});
