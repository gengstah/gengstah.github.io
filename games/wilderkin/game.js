// Game screens live inside the canvas. The engine owns all persistent campaign state.
(() => {
  "use strict";
  const game=window.WilderGame, world=window.WilderWorld, dex=window.WilderKinDex;
  const scene=()=>game.regions[game.state.region], area=()=>world.regions[game.state.region];
  const spec=(id,owned=true)=>game.kin(id,{owned});
  const image=(id,owned=true)=>{
    const skin=spec(id,owned)?.appearanceId;
    return skin&&skin!==id?"art/growth/"+skin+".png":dex.spriteUrl(id);
  };
  const row=(id,label,value,detail="",extra={})=>({id,label,value,detail,...extra});
  const member=id=>game.state.party.find(p=>p.id===id);
  const dirs={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
  const keys={w:"up",s:"down",a:"left",d:"right",ArrowUp:"up",ArrowDown:"down",ArrowLeft:"left",ArrowRight:"right"};
  const shortcuts=[
    ["world","Explore","E"],["expedition","Expedition","X"],["quests","Quests","Q"],["chronicle","Story","C"],
    ["bag","Satchel","B"],["guide","Field guide","G"],["party","Party","P"],["atlas","Atlas","M"],["games","Field games","F"],
    ["notebook","Field notebook","N"],["sparring","Sparring Hall","V"],["circuit","Loaner Circuit","L"],["walker","Walking partner","T"],["hollows","Hidden hollows","H"],["station","Field station",""],["landmarks","Landmarks",""],["settings","Settings","?"]
  ];
  let screen={name:"world",value:null}, history=[], player, route=[], arrival=null, tween=null, lastStep=0;
  let outcome=null, soundCtx, resolving=false, startingMove=false;
  const motion=matchMedia("(prefers-reduced-motion: reduce)");
  const ui=window.WilderCanvas.create(document.getElementById("game-canvas"),{
    action, key:keydown, tile:clickTile,
    shortcuts:()=>screen.name==="replacement"?[{id:"nav",value:"battle",label:"Battle"}]:
      shortcuts.filter(([id])=>id!=="bag"||!game.state.battle?.secondBell).map(([id,label,key])=>({id:"nav",value:id,label,key}))
  });
  const notify=text=>ui.toast(text);
  const audioContext=()=>{
    const Audio=window.AudioContext||window.webkitAudioContext;
    return Audio?(soundCtx ||= new Audio()):null;
  };
  const score=window.WilderScore.create({context:audioContext});
  const fair=window.WilderCanvasGames.create({game,row,notify,go,render});
  const rentalControls={game,row,image:id=>image(id,false),go,render,notify,playTone,
    animate:fx=>{if(fx.kind==="duet")score.answer();return ui.animate(fx);}};
  const circuit=window.WilderTrials.create({...rentalControls,active:()=>screen.name==="circuit"});
  const reedbank=window.WilderReedbank.create({...rentalControls,active:()=>screen.name==="reedbank"});
  const guardSchool=window.WilderGuardLessons.create({...rentalControls,locate,travel,fight,active:()=>screen.name==="guard-school"});
  const bell=window.WilderSecondBell.create({...rentalControls,image:(id,owned=false)=>image(id,owned),locate,travel,fight});
  const hall=window.WilderSparring.create({...rentalControls,active:()=>screen.name==="sparring"});
  const replay=window.WilderSparringReview.create({...rentalControls,read:()=>hall.reviewRecord()});
  const pages=window.WilderPages.create({game,world,dex,row,member,image,go,back,render,notify,locate,root,
    fight,playTone,resolveBattle,travel,reset,atSite:nearestSite});
  function playTone(kind="click") {
    if (!game.state.sound) return;
    try {
      if (!audioContext()) return;
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
    if(game.state.battle?.secondBell&&["bag","item"].includes(name))return notify("Your satchel stays at the lodge during the exhibition.");
    stopWalk();
    if (["world","guard-school","second-bell"].includes(name) && game.state.battle) name="battle";
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
    const replacement=game.replacements?.();
    if(replacement&&screen.name!=="replacement"){
      screen={name:"replacement",value:null};history=[];
    }else if(!replacement&&screen.name==="replacement"){
      screen={name:game.state.battle?"battle":"world",value:null};
    }
    switch (screen.name) {
      case "world":model=worldModel();break;
      case "battle":model=battleModel();break;
      case "replacement":model=replacementModel(replacement);break;
      case "outcome":model=outcomeModel();break;
      case "play":model=fair.model(screen.value);break;
      case "circuit":model=circuit.model();break;
      case "reedbank":model=reedbank.model(screen.value);break;
      case "guard-school":model=guardSchool.model(screen.value);break;
      case "second-bell":model=bell.model(screen.value);break;
      case "sparring":model=hall.model(screen.value);break;
      case "sparring-review":model=replay.model(screen.value);break;
      default:model=pages.model(screen.name,screen.value);break;
    }
    if (!model) throw new Error("Unknown game screen: "+screen.name);
    score.scene(scene().biome,model.kind==="battle" || !!game.state.battle,game.state.music);
    ui.show({kind:"page", ...model, id:model.viewId||screen.name+":"+(screen.value??""),back:["world","battle","replacement"].includes(screen.name)?null:{id:"back",label:"Back"}});
  }
  function partyDisplay(p,owned=true) {
    const k=spec(p.id,owned);
    return {id:"open-kin",value:p.id,species:p.id,name:k.name,src:image(p.id,owned),hp:p.hp,maxHp:p.maxHp,level:p.level,types:k.types};
  }
  function replacementModel(pick) {
    const b=game.state.battle,foe=partyDisplay(b.enemy,false),fallen=partyDisplay(member(pick.fallen));
    const intent=game.foeIntent(),call=game.wardenForecast?.(),log=[];
    if(call?.active)log.push(call.title+" · "+call.description);
    else log.push(foe.name+" is preparing "+intent.skill.name+" · "+intent.skill.type+(intent.charged?" · charged":"")+".");
    if(intent.guarding)log.push(foe.name+" is braced.");
    const choices=pick.options.map((p,i)=>{
      const key=String.fromCharCode(65+i),reply=p.attackFinishes?"KO before reply":"take "+p.attackReplyDamage;
      const detail=p.attackName+" · deal "+p.attackDamage+" · "+reply;
      return row("replace-fainted",p.name,p.id,detail,{key,image:image(p.id),badge:p.hp+"/"+p.maxHp+" HP",
        aria:"Send in "+p.name+", "+p.types.join(" and ")+". Key "+key});
    });
    const location=b.secondBell?"Second Bell · Warden "+scene().warden:scene().name;
    return {kind:"battle",theme:scene().theme,title:"Choose your next kin",kicker:location+"   /   TURN "+b.turn,
      ally:fallen,foe,subtitle:fallen.name+" fell. Send a reserve in for free. Your next move comes before the rival’s reply.",log,
      sections:[{title:"Best ordinary attack after entry",rows:choices}]};
  }
  function worldModel() {
    const state=game.state,r=scene(),obj=game.objective(),near=nearestSite();
    const outing=game.firstOuting.offer();
    const firstQuest=outing&&{...outing,illustrations:["sprigkit","cindlet","dewfin"].map(id=>image(id,false))};
    const opening=state.region===0 && !state.crests.length && !window.WilderStory.chapterDone(state,0);
    const mill=state.region===0?area().sites.findIndex(site=>site.label==="Brookside Mill"):-1;
    const mentor=area().sites.findIndex(site=>(site.kind||site.id)==="guard-school");
    const destination=state.destination,localHollow=game.hollows?.at(state.region);
    const pinned=destination===null?null:{kicker:"ATLAS PIN",title:game.regions[destination].name,description:destination===state.region?"You are here. Open the pin for the region’s landmarks.":game.access(destination).reason,id:"view",value:"region|"+destination};
    return {kind:"world",title:r.name,kicker:"THE MISSING BEAT   /   "+r.district+"   /   REGION "+String(state.region+1).padStart(3,"0")+" OF 150",
      subtitle:r.description,region:state.region,player:samplePlayer,party:game.team().map(p=>partyDisplay(p)),
      objective:pinned||firstQuest||(opening?{title:"Open Finch’s first dispatch",description:"The Mossbrook bell has skipped a beat. Read the note Finch carried during the flood.",id:"view",value:"scene|chapter-1"}
        :{title:obj.title,description:obj.description,id:"nav",value:"objective"}),
      status:game.canSave?"Saved on this device":"Session only · browser storage unavailable",
      sections:[{title:"On the trail",columns:2,rows:[
        row("interact",near ? near.label : "Local landmarks",null,near?"Interact here":"Walk to a place",{key:"E"}),
        row("nav","Expedition","expedition","Regional commission",{key:"X"}),
        row("nav","The Missing Beat","chronicle","Finch’s journal",{key:"C"}),
        row("nav","Wildlife nearby","notebook","Follow a Wilderkin’s behavior",{key:"N"}),
        ...(mentor>=0?[row("walk-site","Meet Neri Pike",mentor,"Learn a field guard with a local kin.")]:[]),
        ...(r.warden?[row("nav","Second Bell exhibition","second-bell","Scout Warden "+r.warden+"’s exhibition team at "+r.lodge+".")]:[]),
        row("nav","Sparring Hall","sparring","Build a trio and battle",{key:"V"}),
        ...(mill>=0?[row("walk-site","Reedbank Relay",mill,"Walk to Brookside Mill for a practice handoff.")]:[]),
        ...(localHollow?[row("view",localHollow.title,"hollow|"+localHollow.id,"Side trail at the trailpost")]:[]),
        row("nav","Field station","station","Requests and local games"),
      ]}]};
  }
  function battleModel() {
    const b=game.state.battle;
    if (!b) return worldModel();
    const p=member(b.activeId),kin=spec(p.id),enemy=spec(b.enemy.id,false),intent=game.foeIntent(),wild=b.kind==="wild";
    const lesson=game.guardTraining(b.activeId),chargedHit=intent.charged&&!intent.support&&intent.power>0;
    const escort=b.shellGuard===b.activeId;
    function exchangeLine(f,heals=false) {
      return (heals?"Heal "+f.healing+" HP":"Deal "+f.damage)+(f.finishes?" · KO before reply":" · take "+f.returnDamage);
    }
    const skills=kin.skills.map((s,i)=>{
      const mult=dex.effectiveness(s.type,enemy.types);
      const special=game.skillPreview(s.id),f=game.ordinaryForecast?.(s.id);
      let detail=f?(f.reason||exchangeLine(f,s.kind==="heal")):s.kind==="heal"?"Recover health":s.kind==="guard"?"Strike and brace":s.type;
      if(s.kind==="attack"&&!special)detail+=mult>1?" · Advantage":mult<1?" · Resisted":"";
      if(lesson?.guard===s.name){
        const survivesReply=chargedHit&&f&&!f.finishes&&f.returnDamage>0&&f.returnDamage<p.hp;
        let effect;
        if(!lesson.learned){
          effect=survivesReply?"Learns "+lesson.name:"Learning "+lesson.name;
          if(chargedHit&&f?.finishes)effect="No training on a knockout";
          else if(chargedHit&&f?.returnDamage>=p.hp)effect="Faints before learning";
        }
        else if(lesson.id==="shell")effect=escort?"Escort ready":"Prepares Shell Escort";
        else if(!f?.finishes&&intent.call==="relay"&&b.remaining.length)effect="Stops Reserve relay";
        else effect=survivesReply?"Exposes "+enemy.name:"Pincer Hold learned";
        detail+=" · "+effect;
      }
      return row("skill",s.name,s.id,special?(special.reason||special.detail):detail,{tone:s.kind==="attack"?"primary":undefined,disabled:special?!special.available:f?!f.available:s.kind==="heal"&&p.hp>=p.maxHp,key:String(i+1)});
    });
    const duet=game.duets();
    const actions=[row("nav","Trail duets","duets",duet.beats+" / "+duet.max+" beats",{key:"R",tone:duet.options.some(o=>o.available)?"primary":undefined}),row("nav","Switch kin","switch",escort?"Shell Escort ready · preview protected entries":"Preview each incoming kin’s HP"),
      ...(!b.secondBell?[row("nav","Satchel","bag")]:[]),row("retreat",b.secondBell?"Withdraw from exhibition":"Retreat")];
    const pass=game.familyTechnique();
    if(pass)actions.unshift(row("nav",pass.name,"family-pass",pass.reason||"Choose a reserve · 1 beat",{disabled:!pass.available,tone:pass.available?"primary":undefined}));
    if (wild && !member(enemy.id)) {
      const available=game.state.bag.kinweave || 0,f=game.ordinaryForecast?.("trail-feint");
      actions.unshift(row("skill","Hold back","trail-feint",f?(f.reason||exchangeLine(f)+" · leaves at least 1 HP"):"Leave at least 1 HP",{disabled:f?!f.available:false}),
        row("capture","Cast Kinweave",null,b.enemy.hp>b.enemy.maxHp/2?"Weaken to half health":available+" in satchel",
          {disabled:!available || b.enemy.hp>b.enemy.maxHp/2}));
    }
    const title=b.secondBell?"Second Bell · Warden "+scene().warden:wild?"Wild encounter":b.kind==="expedition"?"Expedition patrol":"Warden "+scene().warden+"’s trial";
    const health=partyDisplay(b.enemy,false),conditions=game.conditions[b.condition];
    const warnings=[];
    if (intent?.charged) warnings.push(enemy.name+" is preparing "+intent.skill.name+".");
    if (intent?.guarding) warnings.push(enemy.name+" is braced. A guarding strike breaks through.");
    if (b.enemy.beaconMarked) warnings.push("Beacon mark · your next ordinary attack pierces guard and deals 50% extra damage.");
    if (b.enemy.pincerOpening) warnings.push("Pincer Hold exposed "+enemy.name+". Your next ordinary attack breaks its guard and deals 50% more damage.");
    if (b.cover) warnings.push("Wattle cover · "+b.cover+" incoming "+(b.cover===1?"hit":"hits")+".");
    const tactic=game.wardenForecast?.();
    if(tactic?.active)warnings.push(tactic.title+" · "+tactic.counter);
    return {kind:"battle",title,kicker:scene().name+"   /   TURN "+b.turn,theme:scene().theme,ally:partyDisplay(p),foe:health,
      subtitle: b.remaining?.length ? (b.remaining.length+1)+" opponents remain" : scene().name,
      log:b.log.slice(b.turn>1?-2:-1).concat(warnings),
      sections:[{title:"Choose a skill",columns:2,rows:skills},{title:"Field commands",columns:3,rows:actions},
        ...(b.secondBell?[{title:"Published formation · Lv. "+b.secondBell.level,text:b.secondBell.roster.map(id=>spec(id,false).name).join(" → ")}]:[]),
        ...(conditions?[{title:conditions.name,text:conditions.description+(b.weather?" "+b.weather+" skills gain 20% damage.":"")}]:[]),
        ...(tactic?[{title:tactic.title,text:tactic.description+" "+tactic.counter}]:[])]};
  }
  function outcomeModel() {
    if(outcome.secondBell)return {title:outcome.title,kicker:scene().lodge+"   /   SECOND BELL",subtitle:outcome.message,
      art:{src:world.wardenArt(game.state.region),caption:"Warden "+scene().warden},
      sections:[{title:"At the lodge",rows:[row("view","Return to the Second Bell desk","second-bell|"+game.state.region,"See your record at "+scene().lodge+".",{tone:"primary"}),
        row("root","Back to the trail")]}]};
    return {title:outcome.title,kicker:scene().name,subtitle:outcome.message,art:outcome.src?{src:outcome.src,caption:outcome.caption}:undefined,
      sections:[{rows:[row("root","Back to the trail",null,"",{tone:"primary"}),
        ...(outcome.guardPupil?[row("view","Train with Neri Pike","guard-school|"+outcome.guardPupil,"Read the charged-hit lesson for "+spec(outcome.guardPupil).name+".")]:[]),
        ...(game.team().some(p=>p.hp<p.maxHp)?[row("walk-kind","Walk to camp","camp|camp","Rest the traveling party.")]:[]),
        ...(game.state.bag.broth&&game.team().some(p=>p.hp>0&&p.hp<p.maxHp)?[row("share-broth","Share Trailpot broth",null,game.state.bag.broth+" packed")]:[]),
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
    const b=game.state.battle, originalFoe=b.enemy, oldEnemy=originalFoe.id, activeId=b.activeId, kind=b.kind,secondBell=!!b.secondBell;
    const intent=game.foeIntent(),oldTurn=b.turn,oldCrests=game.state.crests.length;
    // Show the original arena even if a throw, item, or swap was chosen from the satchel.
    ui.show({...battleModel(),id:"battle:"});
    resolving=true;
    try {
      const res=fn();
      if (!res.ok) {render();notify(res.message);return;}
      if (fx) {
        if (fx.kind==="duet")score.answer();
        playTone(fx.kind==="heal"||fx.kind==="item"?"care":"strike");
        await ui.animate({...fx,side:"ally"});
      }
      const now=game.state.battle;
      if(res.foeShifted && now){
        ui.show({...battleModel(),id:"battle:"});
        await ui.animate({type:spec(now.enemy.id,false).type,kind:"swap",side:"foe",name:spec(now.enemy.id,false).name});
      }
      if (!res.skipCounterFx && ((now && now.turn>oldTurn && (now.enemy===originalFoe||res.foeShifted)) || res.kind==="defeat")) {
        const reply=res.replySkill||intent?.skill;
        await ui.animate({type:reply?.type||"Neutral",kind:"attack",side:"foe",name:reply?.name});
      }
      if(res.learnedGuard){
        playTone("reward");
        await ui.animate({kind:"learn",side:"ally",type:spec(activeId).type,name:res.learnedGuard+" learned"});
      }
      if ((now && now.enemy!==originalFoe && !res.foeShifted) || res.kind==="victory" || res.kind==="defeat") {
        await ui.animate({type:"Neutral",kind:"defeat",side:res.kind==="defeat"?"ally":"foe",name:res.kind==="defeat"?spec(activeId).name:spec(oldEnemy,false).name});
      }
      const pick=game.replacements?.();
      if(pick){
        ui.show({...replacementModel(pick),id:"replacement:"});
        await ui.animate({kind:"defeat",side:"ally",type:spec(pick.fallen).type,name:spec(pick.fallen).name});
      }
      if (now) {screen={name:"battle",value:null};history=[];render();return;}
      const crest=game.state.crests.length>oldCrests;
      const titles={victory:"Battle won",defeat:"Back at camp",recruited:"A bond is formed",escaped:"Safe retreat"};
      const exhibition={victory:"Exhibition won",defeat:"Exhibition lost",escaped:"Exhibition withdrawn"};
      outcome={title:secondBell?(exhibition[res.kind]||"Exhibition complete"):crest?scene().crest+" earned":titles[res.kind]||"Encounter complete",message:res.message,secondBell,crest,expedition:kind==="expedition",
        guardPupil:res.kind==="recruited"&&["opalclasp","cragroll"].includes(oldEnemy)?oldEnemy:null,
        src:crest?world.crestArt(game.state.region,true):res.kind==="recruited"?image(oldEnemy):null,
        caption:crest?scene().lodge:spec(oldEnemy,false).name};
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
    const follower=game.walkerPose(performance.now(),motion.matches);
    if(follower)follower.src=image(follower.id);
    const pos={...player,sightings:game.sightings(),follower,questActive:!!scene().warden&&!game.state.crests.includes(game.state.region)};
    if (tween && !motion.matches) {
      const ratio=Math.min(1,Math.max(0,(performance.now()-tween.time)/115));
      pos.x=tween.x+(player.x-tween.x)*ratio;pos.y=tween.y+(player.y-tween.y)*ratio;
    }
    return pos;
  }
  function nearestSite() {
    if (!player) return null;
    return [...area().sites,...game.sightings()].map(site=>({site,d:Math.abs(site.x-player.x)+Math.abs(site.y-player.y)})).filter(s=>s.d<=1).sort((a,b)=>a.d-b.d)[0]?.site;
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
    if(kind==="sighting") return go("study",site.species);
    if(kind==="lantern-cup")return go("sparring","cup");
    if(kind==="guard-school")return go("guard-school");
    game.visitSite(kind);
    if(next&&typeof next==="object")return go(next.name,next.value);
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
    const site=typeof kind==="number"?area().sites[kind]:area().sites.find(s=>(s.kind||s.id)===kind)||game.sightings().find(s=>s.id===kind);
    if (site) walk(site,site,next);
  }
  function clickTile(x,y) {
    if (resolving || screen.name!=="world") return;
    const site=world.sightingAt(game.sightings(),x,y)||world.siteAt(game.state.region,x,y);
    if(!site && window.WilderWalkingPartner.hit(game.walkerPose(performance.now(),true),x,y))return go("walker");
    walk(site||{x,y},site);
  }
  function travel(i) {
    const res=game.travel(i);
    if (!res.ok) return notify(res.message);
    restorePlayer();playTone("battle");root();notify(res.message);
  }
  function keydown(e) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.type==="keyup") return false;
    if (resolving || ui.busy) return true;
    if(screen.name==="replacement"){
      const options=game.replacements()?.options;
      const slot=e.key.length===1?e.key.toUpperCase().charCodeAt(0)-65:-1;
      if(options?.[slot]&&!e.repeat)action("replace-fainted",options[slot].id);
      return !["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","PageUp","PageDown","F1"].includes(e.key);
    }
    if (screen.name==="circuit" && circuit.key(e)) return true;
    if (screen.name==="sparring" && hall.key(e,screen.value)) return true;
    if (screen.name==="hollow" && pages.hollowKey(e,screen.value)) return true;
    if (screen.name==="search" && pages.typeKey(e)) return true;
    const key=e.key.length===1?e.key.toLowerCase():e.key;
    if (screen.name==="world" && keys[key]) {
      const t=performance.now();
      if (!e.repeat || t-lastStep>=105) {stopWalk();move(keys[key],t);lastStep=t;}
      return true;
    }
    if (screen.name==="world" && key==="e") {if (!e.repeat) action("interact");return true;}
    if (screen.name==="battle" && key==="r") {if(!e.repeat) go("duets");return true;}
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
    if(screen.name==="replacement"){
      if(id!=="replace-fainted"){render();return;}
      const chosen=game.replaceFainted(value);
      if(!chosen.ok){notify(chosen.message);render();return;}
      root();playTone("care");
      void ui.animate({kind:"swap",side:"ally",type:spec(value).type,name:spec(value).name});
      return;
    }
    switch (id) {
      case "nav":
        if (value==="world") return root();
        if (game.state.battle && ["station","landmarks","expedition"].includes(value)) return notify("Finish the encounter before returning to the trail.");
        return go(value);
      case "root":return root();
      case "reedbank-hall":{
        const [course,id]=String(value).split("|");
        if(!hall.prepareReedbank(id,course))notify("Finish or retire your current Hall match before borrowing a new trio.");
        return;
      }
      case "back":return back();
      case "interact":{const site=nearestSite();return site?visit(site):go("landmarks");}
      case "walk-site":return locate(Number(value));
      case "open-kin":return go("kin",value);
      case "skill":return useSkill(value);
      case "family-pass":{
        const pass=game.familyTechnique();
        const target=pass?.targets.find(p=>p.id===value);
        if(!pass?.available||!target)return notify(pass?.reason||"Choose a reserve for this pass.");
        const incomingKin=partyDisplay({...member(value),hp:target.hpAfter+target.returnDamage});
        return resolveBattle(()=>game.useFamilyTechnique(value),{type:spec(value).type,kind:"swap",name:pass.name,
          pass:pass.id,incoming:incomingKin.src,incomingKin});
      }
      case "duet":{
        const option=game.duets().options.find(o=>o.partnerId===value);
        if(!option?.available)return notify(option?.reason);
        const lead=spec(game.state.battle.activeId);
        return resolveBattle(()=>game.useDuet(value),{type:lead.type,partnerType:spec(value).type,partner:image(value),kind:"duet",name:option.name});
      }
      case "capture":return resolveBattle(()=>game.recruit(),{type:"Chime",kind:"capture",name:"Kinweave"});
      case "retreat":return resolveBattle(()=>game.flee(),null);
      case "swap":return resolveBattle(()=>game.swap(value),{type:spec(value).type,kind:"swap",name:spec(value).name});
      default:
        if (screen.name==="second-bell"&&bell.act(id,value))return;
        if (screen.name==="guard-school" && guardSchool.act(id,value)) return;
        if (screen.name==="reedbank" && reedbank.act(id,value)) return;
        if (screen.name==="circuit" && circuit.act(id,value)) return;
        if (screen.name==="sparring" && hall.act(id,value)) return;
        if (screen.name==="sparring-review" && replay.act(id,value)) return;
        if (fair.act(id,value)) return;
        return pages.act(id,value);
    }
  }
  function sharedScreen(hash) {
    if(game.replacements?.())return {name:"replacement",value:null};
    if(hash==="#second-bell")return {name:game.state.battle?"battle":"second-bell",value:null};
    if(hash==="#guard-school")return {name:game.state.battle?"battle":"guard-school",value:null};
    if(hash==="#reedbank")return {name:"reedbank",value:null};
    if(hash==="#lantern-cup")return {name:"sparring",value:"cup"};
    if(hash==="#updates")return {name:"updates",value:null};
    if(hash==="#grove")return {name:"sparring",value:"bench:grove"};
    if(hash==="#workshop")return {name:"sparring",value:"bench:workshop"};
    return hall.loadFragment(hash)?{name:"sparring",value:null}:null;
  }
  restorePlayer();
  const destination=sharedScreen(window.location.hash);
  if(destination)screen=destination;
  else if(game.state.battle)screen={name:"battle",value:null};
  else if(circuit.hasInvitation())screen={name:"circuit",value:null};
  window.addEventListener("hashchange",()=>{
    const dest=sharedScreen(window.location.hash);if(dest)go(dest.name,dest.value);
  });
  render();
})();
