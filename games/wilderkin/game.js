// Game screens live inside the canvas. The engine owns all persistent campaign state.
(() => {
  "use strict";
  const game=window.WilderGame, world=window.WilderWorld, dex=window.WilderKinDex;
  const scene=()=>game.regions[game.state.region], area=()=>world.regions[game.state.region];
  const spec=id=>game.species[id], image=id=>dex.spriteUrl(id);
  const row=(id,label,value,detail="",extra={})=>({id,label,value,detail,...extra});
  const member=id=>game.state.party.find(p=>p.id===id);
  const dirs={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
  const keys={w:"up",s:"down",a:"left",d:"right",ArrowUp:"up",ArrowDown:"down",ArrowLeft:"left",ArrowRight:"right"};
  const shortcuts=[
    ["world","Explore","E"],["expedition","Expedition","X"],["quests","Quests","Q"],["chronicle","Story","C"],
    ["bag","Satchel","B"],["guide","Field guide","G"],["party","Party","P"],["atlas","Atlas","M"],["games","Field games","F"],
    ["station","Field station",""],["landmarks","Landmarks",""],["settings","Settings","?"]
  ];
  let screen={name:"world",value:null}, history=[], player, route=[], arrival=null, tween=null, lastStep=0;
  let outcome=null, soundCtx, resolving=false, startingMove=false;
  const motion=matchMedia("(prefers-reduced-motion: reduce)");
  const ui=window.WilderCanvas.create(document.getElementById("game-canvas"),{
    action, key:keydown, tile:clickTile,
    shortcuts:()=>shortcuts.map(([id,label,key])=>({id:"nav",value:id,label,key}))
  });
  const notify=text=>ui.toast(text);
  const fair=window.WilderCanvasGames.create({game,row,notify,go,render});
  const pages=window.WilderPages.create({game,world,dex,row,member,image,go,back,render,notify,locate,root,
    fight,playTone,resolveBattle,travel,reset,atSite:nearestSite});
  function playTone(kind="click") {
    if (!game.state.sound) return;
    try {
      const Audio=window.AudioContext||window.webkitAudioContext;
      if (!Audio) return;
      soundCtx ||= new Audio();
      if (soundCtx.state==="suspended") soundCtx.resume().catch(()=>{});
      const notes={click:[523],battle:[349,466,587],strike:[220,165],care:[440,554,659],reward:[392,494,587,784],step:[330]};
      (notes[kind]||notes.click).forEach((f,i)=>{
        const osc=soundCtx.createOscillator(),gain=soundCtx.createGain(),start=soundCtx.currentTime+i*.075;
        osc.type="triangle";osc.frequency.value=f;gain.gain.setValueAtTime(.001,start);gain.gain.linearRampToValueAtTime(.065,start+.009);
        gain.gain.exponentialRampToValueAtTime(.001,start+.13);osc.connect(gain).connect(soundCtx.destination);osc.start(start);osc.stop(start+.14);
      });
    } catch { /* Audio output is optional. */ }
  }
  function stopWalk(){route=[];arrival=null;}
  function go(name,value=null,mode="push") {
    if (resolving) return;
    stopWalk();
    if (name==="world" && game.state.battle) name="battle";
    if (mode==="root") history=[];
    else if (mode==="push" && (name!==screen.name || value!==screen.value)) history.push(screen);
    screen={name,value};render();
  }
  function root(){go(game.state.battle?"battle":"world",null,"root");}
  function back() {
    if (resolving) return;
    const dest=history.pop();
    if (!dest || screen.name==="outcome") return root();
    if ((dest.name==="battle" && !game.state.battle) || (dest.name==="world" && game.state.battle)) return root();
    screen=dest;render();
  }
  function reset() {
    game.reset();pages.reset();fair.reset();outcome=null;restorePlayer();root();
    notify("A new ledger opens in Mossbrook Vale.");
  }
  function render() {
    let model;
    switch (screen.name) {
      case "world":model=worldModel();break;
      case "battle":model=battleModel();break;
      case "outcome":model=outcomeModel();break;
      case "play":model=fair.model(screen.value);break;
      default:model=pages.model(screen.name,screen.value);break;
    }
    if (!model) throw new Error("Unknown game screen: "+screen.name);
    ui.show({kind:"page", ...model, id:screen.name+":"+(screen.value??""),back:screen.name==="world"||screen.name==="battle"?null:{id:"back",label:"Back"}});
  }
  function partyDisplay(p) {
    const k=spec(p.id);
    return {id:"open-kin",value:p.id,species:p.id,name:k.name,src:image(p.id),hp:p.hp,maxHp:p.maxHp,level:p.level,types:k.types};
  }
  function worldModel() {
    const state=game.state,r=scene(),obj=game.objective(),near=nearestSite();
    const opening=state.region===0 && !state.crests.length && !window.WilderStory.chapterDone(state,0);
    return {kind:"world",title:r.name,kicker:"THE MISSING BEAT   /   "+r.district+"   /   REGION "+String(state.region+1).padStart(3,"0")+" OF 150",
      subtitle:r.description,region:state.region,player:samplePlayer,party:game.team().map(partyDisplay),
      objective:opening?{title:"Open Finch’s first dispatch",description:"The Mossbrook bell has skipped a beat. Read the note Finch carried during the flood.",id:"view",value:"scene|chapter-1"}
        :{title:obj.title,description:obj.description,id:"nav",value:"objective"},
      status:game.canSave?"Saved on this device":"Session only · browser storage unavailable",
      sections:[{title:"On the trail",columns:2,rows:[
        row("interact",near ? near.label : "Local landmarks",null,near?"Interact here":"Walk to a place",{key:"E"}),
        row("nav","Expedition","expedition","Regional commission",{key:"X"}),
        row("nav","The Missing Beat","chronicle","Finch’s journal",{key:"C"}),
        row("nav","Field station","station","Requests and local games"),
      ]}]};
  }
  function battleModel() {
    const b=game.state.battle;
    if (!b) return worldModel();
    const p=member(b.activeId),kin=spec(p.id),enemy=spec(b.enemy.id),intent=game.foeIntent(),wild=b.kind==="wild";
    const skills=kin.skills.map((s,i)=>{
      const mult=dex.effectiveness(s.type,enemy.types);
      const detail=s.kind==="heal"?"Recover health":s.kind==="guard"?"Strike and brace":s.type+(mult>1?" · Advantage":mult<1?" · Resisted":"");
      return row("skill",s.name,s.id,detail,{tone:s.kind==="attack"?"primary":undefined,disabled:s.kind==="heal" && p.hp>=p.maxHp,key:String(i+1)});
    });
    const actions=[row("nav","Switch kin","switch"),row("nav","Satchel","bag"),row("retreat","Retreat")];
    if (wild && !member(enemy.id)) {
      const available=game.state.bag.kinweave || 0;
      actions.unshift(row("skill","Hold back","trail-feint","Leave at least 1 HP"),
        row("capture","Cast Kinweave",null,b.enemy.hp>b.enemy.maxHp/2?"Weaken to half health":available+" in satchel",
          {disabled:!available || b.enemy.hp>b.enemy.maxHp/2}));
    }
    const title=wild?"Wild encounter":b.kind==="expedition"?"Expedition patrol":"Warden "+scene().warden+"’s trial";
    const health=partyDisplay(b.enemy),conditions=game.conditions[b.condition];
    const warnings=[];
    if (intent?.charged) warnings.push(enemy.name+" is preparing "+intent.skill.name+".");
    if (intent?.guarding) warnings.push(enemy.name+" is braced. A guarding strike breaks through.");
    return {kind:"battle",title,kicker:scene().name+"   /   TURN "+b.turn,theme:scene().theme,ally:partyDisplay(p),foe:health,
      subtitle: b.remaining?.length ? (b.remaining.length+1)+" opponents remain" : scene().name,
      log:b.log.slice(b.turn>1?-2:-1).concat(warnings),
      sections:[{title:"Choose a skill",columns:2,rows:skills},{title:"Field commands",columns:3,rows:actions},
        ...(conditions?[{title:conditions.name,text:conditions.description+(b.weather?" "+b.weather+" skills gain 20% damage.":"")}]:[])]};
  }
  function outcomeModel() {
    return {title:outcome.title,kicker:scene().name,subtitle:outcome.message,art:outcome.src?{src:outcome.src,caption:outcome.caption}:undefined,
      sections:[{rows:[row("root","Back to the trail",null,"",{tone:"primary"}),
        row("nav",outcome.expedition?"Check commission":"Open journal",outcome.expedition?"expedition":"quests"),
        ...(outcome.crest?[row("nav","Read the chronicle","chronicle"),row("nav","Consult the atlas","atlas")]:[])]}]};
  }
  function fight(kind,id) {
    const res=game.startBattle(kind,id);
    if (!res.ok) return notify(res.message);
    if (game.state.battle) {playTone("battle");go("battle",null,"root");}
    else {go("warden");notify(res.message);}
  }
  async function resolveBattle(fn,fx) {
    if (resolving || !game.state.battle) return;
    const b=game.state.battle, originalFoe=b.enemy, oldEnemy=originalFoe.id, activeId=b.activeId, kind=b.kind;
    const intent=game.foeIntent(),oldTurn=b.turn,oldCrests=game.state.crests.length;
    // Show the original arena even if a throw, item, or swap was chosen from the satchel.
    ui.show({...battleModel(),id:"battle:"});
    resolving=true;
    try {
      const res=fn();
      if (!res.ok) {render();notify(res.message);return;}
      if (fx) {
        playTone(fx.kind==="heal"||fx.kind==="item"?"care":"strike");
        await ui.animate({...fx,side:"ally"});
      }
      const now=game.state.battle;
      if ((now && now.turn>oldTurn && now.enemy===originalFoe) || res.kind==="defeat") {
        await ui.animate({type:intent?.skill.type||"Neutral",kind:"attack",side:"foe",name:intent?.skill.name});
      }
      if ((now && now.enemy!==originalFoe) || res.kind==="victory" || res.kind==="defeat") {
        await ui.animate({type:"Neutral",kind:"defeat",side:res.kind==="defeat"?"ally":"foe",name:res.kind==="defeat"?spec(activeId).name:spec(oldEnemy).name});
      }
      if (now) {screen={name:"battle",value:null};history=[];render();return;}
      const crest=game.state.crests.length>oldCrests;
      const titles={victory:"Battle won",defeat:"Back at camp",recruited:"A bond is formed",escaped:"Safe retreat"};
      outcome={title:crest?scene().crest+" earned":titles[res.kind]||"Encounter complete",message:res.message,crest,expedition:kind==="expedition",
        src:crest?world.crestArt(game.state.region,true):res.kind==="recruited"?image(oldEnemy):null,
        caption:crest?scene().lodge:spec(oldEnemy).name};
      playTone(res.kind==="escaped"?"click":"reward");restorePlayer();
      screen={name:"outcome",value:null};history=[];render();
    } finally {resolving=false;}
  }
  function useSkill(id) {
    const b=game.state.battle;
    if (!b) return;
    const skill=spec(b.activeId).skills.find(s=>s.id===id);
    return resolveBattle(()=>game.useSkill(id),{kind:skill?.kind||"attack",type:skill?.type||"Neutral",name:skill?.name||"Hold back"});
  }
  function restorePlayer() {
    stopWalk();tween=null;
    const s=game.state, saved=s.positions[s.region],p=saved && world.walkable(s.region,saved.x,saved.y)?saved:area().spawn;
    player={x:p.x,y:p.y,facing:"down"};game.setPosition(p.x,p.y);
  }
  function samplePlayer() {
    const pos={...player,questActive:!!scene().warden&&!game.state.crests.includes(game.state.region)};
    if (tween && !motion.matches) {
      const ratio=Math.min(1,Math.max(0,(performance.now()-tween.time)/115));
      pos.x=tween.x+(player.x-tween.x)*ratio;pos.y=tween.y+(player.y-tween.y)*ratio;
    }
    return pos;
  }
  function nearestSite() {
    if (!player) return null;
    return area().sites.map(site=>({site,d:Math.abs(site.x-player.x)+Math.abs(site.y-player.y)})).filter(s=>s.d<=1).sort((a,b)=>a.d-b.d)[0]?.site;
  }
  function move(dir,now) {
    if (!dir || game.state.battle || screen.name!=="world") return false;
    const [dx,dy]=dirs[dir],x=player.x+dx,y=player.y+dy;
    player.facing=dir;
    if (!world.walkable(game.state.region,x,y)) return false;
    const old=nearestSite();tween={x:player.x,y:player.y,time:now};player.x=x;player.y=y;
    game.setPosition(x,y);
    if (old!==nearestSite()) render();
    ui.invalidate();return true;
  }
  function routeTo(x,y) {
    const queue=[{x:player.x,y:player.y,steps:[]}],visited=new Set([player.x+","+player.y]);
    for (let i=0;i<queue.length;i++) {
      const tile=queue[i];
      if (tile.x===x && tile.y===y) return tile.steps;
      for (const [dir,[dx,dy]] of Object.entries(dirs)) {
        const nx=tile.x+dx,ny=tile.y+dy,key=nx+","+ny;
        if (visited.has(key)||!world.walkable(game.state.region,nx,ny)) continue;
        visited.add(key);queue.push({x:nx,y:ny,steps:[...tile.steps,dir]});
      }
    }
    return null;
  }
  function visit(site,next) {
    const kind=site.kind||site.id;
    game.visitSite(kind);
    if (next) return go(next);
    const view={warden:"warden",camp:"camp",wild:"tracks",travel:"atlas",activities:"station"}[kind];
    go(view||"landmarks");
  }
  function walk(target,site,next) {
    if (game.state.battle) return root();
    const steps=routeTo(target.x,target.y);
    if (!steps) return notify("That spot is blocked. Pick open ground or a landmark.");
    if (screen.name!=="world") go("world",null,"root");
    stopWalk();route=steps;arrival=site?{site,next}:null;
    if (!startingMove) {startingMove=true;requestAnimationFrame(walkTick);}
  }
  function walkTick(now) {
    if (screen.name==="world" && !document.hidden && now-lastStep>=125) {
      if (route.length) {move(route.shift(),now);lastStep=now;}
      else if (arrival) {const {site,next}=arrival;arrival=null;visit(site,next);}
    }
    if (!route.length && !arrival) {startingMove=false;return;}
    requestAnimationFrame(walkTick);
  }
  function locate(kind,next) {
    const site=typeof kind==="number"?area().sites[kind]:area().sites.find(s=>(s.kind||s.id)===kind);
    if (site) walk(site,site,next);
  }
  function clickTile(x,y) {
    if (resolving || screen.name!=="world") return;
    const site=world.siteAt(game.state.region,x,y);walk(site||{x,y},site);
  }
  function travel(i) {
    const res=game.travel(i);
    if (!res.ok) return notify(res.message);
    restorePlayer();playTone("battle");root();notify(res.message);
  }
  function keydown(e) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.type==="keyup") return false;
    if (resolving || ui.busy) return true;
    if (screen.name==="search" && pages.typeKey(e)) return true;
    const key=e.key.length===1?e.key.toLowerCase():e.key;
    if (screen.name==="world" && keys[key]) {
      const t=performance.now();
      if (!e.repeat || t-lastStep>=105) {stopWalk();move(keys[key],t);lastStep=t;}
      return true;
    }
    if (screen.name==="world" && key==="e") {if (!e.repeat) action("interact");return true;}
    if (screen.name==="battle" && /^[1-4]$/.test(key)) {
      const skill=spec(game.state.battle.activeId).skills[Number(key)-1];if (skill && !e.repeat) useSkill(skill.id);return true;
    }
    if (key==="Escape" && screen.name!=="world" && screen.name!=="battle") {back();return true;}
    const shortcut=shortcuts.find(s=>s[2] && s[2].toLowerCase()===key);
    if (shortcut) {if (!e.repeat) action("nav",shortcut[0]);return true;}
    return false;
  }
  function action(id,value) {
    if (resolving || ui.busy) return;
    switch (id) {
      case "nav":
        if (value==="world") return root();
        if (game.state.battle && ["station","landmarks","expedition"].includes(value)) return notify("Finish the encounter before returning to the trail.");
        return go(value);
      case "root":return root();
      case "back":return back();
      case "interact":{const site=nearestSite();return site?visit(site):go("landmarks");}
      case "walk-site":return locate(Number(value));
      case "open-kin":return go("kin",value);
      case "skill":return useSkill(value);
      case "capture":return resolveBattle(()=>game.recruit(),{type:"Chime",kind:"capture",name:"Kinweave"});
      case "retreat":return resolveBattle(()=>game.flee(),null);
      case "swap":return resolveBattle(()=>game.swap(value),{type:spec(value).type,kind:"swap",name:spec(value).name});
      default:
        if (fair.act(id,value)) return;
        return pages.act(id,value);
    }
  }
  restorePlayer();
  if (game.state.battle) screen={name:"battle",value:null};
  render();
})();
