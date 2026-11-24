// Both rival orders are public. Picking an order edits the draft. Ringing the bell resolves it.
(() => {
  "use strict";
  const lanes=["West","East"],tactics={cover:"Cover a lane",call:"Call a target",duet:"Use a duet",swap:"Switch kin"};
  const group=(title,rows,columns=1)=>({title,rows,columns});
  const tacticKeys={cover:"C",call:"L",duet:"D",swap:"S"};
  const belongs=n=>n===0||n===1;
  const front=(p,side,lane)=>p.sides[side].team[p.sides[side].active[lane]]||null;
  function create({game,row,image,go,notify,read,commit,onSetup,onRematch,active,venue={}}){
    const sim=window.WilderTwinBattle.create({game}),species=game.species,kit=window.WilderSparringGear;
    const name=id=>species[id]?.name||id;
    const button=(id,label,value=null,detail="",extra={})=>row("twin-"+id,label,value,detail,extra);
    const show=(value,mode="push")=>go(venue.route||"twinbell",value,mode);
    const deskLabel=venue.deskLabel||"Back to the grounds",venueName=venue.name||"Twinbell";
    const kicker=()=>typeof venue.kicker==="function"?venue.kicker():venueName.toUpperCase();
    const root=()=>button("ring","Back to orders");
    let shortcuts=new Map(),stamp="",playback=null,timer=null;
    const reduced=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)").matches===true;
    function stopTimer(){if(timer!==null)window.clearTimeout(timer);timer=null;}
    function leavePlayback(){stopTimer();playback=null;}
    const version=r=>JSON.stringify([r.id,r.left,r.right,r.keeper,r.history,r.draft]);
    function field(r,focus,targets){
      const p=r.pos,portraits=s=>[0,1].map(lane=>{
        const k=front(p,s,lane);if(!k)return null;
        let action;
        if(!focus&&s===0)action=button("lane","Order "+name(k.id),lane,"Choose the "+lanes[lane].toLowerCase()+" lane order.");
        if(focus&&targets?.side===s){
          const m=targets.moves.find(o=>o.target===lane&&o.available);
          if(m)action=button("pick","Target "+lanes[lane]+" · "+name(k.id),focus.lane+"|"+m.id,m.detail);
        }
        return {id:k.id,name:name(k.id),src:image(k.id),hp:k.hp,maxHp:k.maxHp,...(action?{action}:{})};
      });
      return {background:venue.background||"ui/twinbell-grounds.png",left:portraits(0),right:portraits(1),leftName:r.left.name,rightName:r.right.name,
        leftBeats:p.sides[0].beats,rightBeats:p.sides[1].beats,...(focus?{focus}:{})};
    }
    function moves(r,s,lane){
      return belongs(lane)&&front(r.pos,s,lane)?sim.options(r.pos,s,lane,s?r.rivalOrders:r.draft):[];
    }
    function chosen(r,s,lane){
      const id=(s?r.rivalOrders:r.draft)[lane];return id?moves(r,s,lane).find(o=>o.id===id):null;
    }
    function moveName(r,s,lane,m){
      if(m.kind==="attack"){
        const skill=m.id.split(":")[1],k=front(r.pos,s,lane);return species[k.id].skills.find(v=>v.id===skill)?.name||m.label;
      }
      if(m.kind==="duet"){
        const pair=r.pos.sides[s].active.map(i=>r.pos.sides[s].team[i]);
        return pair.every(Boolean)?window.WilderDuets.score(species[pair[0].id].type,species[pair[1].id].type).name:m.label;
      }
      return {cover:"Cover",call:"Call the line",swap:"Switch"}[m.kind]||m.label;
    }
    function target(r,s,m){
      if(m.kind==="swap")return name(m.targetId||m.id.split(":")[1]);
      if(!belongs(m.target))return "";
      const k=front(r.pos,m.kind==="cover"?s:1-s,m.target);
      return lanes[m.target]+(k?" · "+name(k.id):" lane");
    }
    function orderText(r,s,lane,m){
      const t=target(r,s,m);return moveName(r,s,lane,m)+(t?" → "+t:"")+(Number.isFinite(m.damage)?" · "+m.damage+" projected":"");
    }
    function announcements(r){
      return [0,1].flatMap(i=>{
        const k=front(r.pos,1,i);if(!k)return [];
        const m=chosen(r,1,i);
        return [{label:name(k.id),detail:m?orderText(r,1,i,m):"No announced order.",badge:lanes[i]}];
      });
    }
    function legalRound(r){
      return r.draft.every((id,i)=>!front(r.pos,0,i)?id===null:!!id&&chosen(r,0,i)?.available);
    }
    function incoming(r,lane){
      const calls=[0,1].flatMap(i=>{
        const m=chosen(r,1,i),k=front(r.pos,1,i);
        return m&&["attack","duet","call"].includes(m.kind)&&m.target===lane?[name(k.id)+" · "+moveName(r,1,i,m)]:[];
      });
      return calls.length?calls.join(" and ")+" target"+(calls.length===1?"s":"")+" this lane.":"Neither rival has announced an attack or call on this lane.";
    }
    function ring(r){
      const p=r.pos,ready=legalRound(r),lines=announcements(r);
      const orders=[0,1].flatMap(i=>{
        const k=front(p,0,i);if(!k)return [];
        const m=chosen(r,0,i);
        return [button("lane",lanes[i]+" · "+name(k.id),i,m?orderText(r,0,i,m):"Choose an order.",{key:String(i+1),tone:m?undefined:"primary"})];
      });
      const sections=[group(r.right.name+"’s announced orders",lines,2),group("Your orders",orders,2),
        group("Resolve the round",[button("round","Ring the bell",null,ready?"Play both sides’ orders.":"Give each standing lead an order.",{disabled:!ready,tone:"primary",key:"R"})])];
      if(r.lastEvents?.length)sections.push(group("Previous bell",[button("log","Read round "+r.history.length,r.history.length,r.lastEvents.at(-1).text)]));
      sections.push(group("Ring desk",[button("team","Inspect both teams"),...(venue.rules===false?[]:[venue.rules||row("grounds-view","Doubles rules","rules")]),button("setup",deskLabel,null,venue.deskDetail??"This bout is saved.")],2));
      return {title:"Round "+p.round,kicker:kicker()+"   /   "+r.left.name+" VS "+r.right.name,twinField:field(r),sections};
    }
    function pick(r,lane,m,detail,shortcut){
      return button("pick",target(r,0,m)||m.label,lane+"|"+m.id,m.available?detail||m.detail:m.reason||m.detail,
        {aria:orderText(r,0,lane,m),disabled:!m.available,badge:r.draft[lane]===m.id?"Ordered":"",...(shortcut?{key:shortcut}:{})});
    }
    function laneMoves(r,i){
      const k=front(r.pos,0,i);if(!k)return ring(r);
      const opts=moves(r,0,i),groups=new Map();
      for(const m of opts.filter(o=>o.kind==="attack")){
        const label=moveName(r,0,i,m);if(!groups.has(label))groups.set(label,[]);groups.get(label).push(m);
      }
      const sections=[];let index=0;
      for(const [label,choices] of groups){
        sections.push(group(label,choices.map(m=>{
          const matchup=m.detail.split(" · ").slice(1);
          return pick(r,i,m,[m.damage+" damage",...matchup,front(r.pos,1,m.target).hp+" HP now"].join(" · "),String(++index));
        }),2));
      }
      const techniques=Object.entries(tactics).flatMap(([kind,label])=>{
        const choices=opts.filter(o=>o.kind===kind);if(!choices.length)return [];
        const available=choices.some(o=>o.available),m=choices[0],n=kind==="duet"?moveName(r,0,i,m):label;
        return [button("tactic",n,i+"|"+kind,available?(kind==="duet"?m.cost+" beats · select a rival lane.":{cover:"Protect a friendly lane.",call:"Expose a rival for your other lead.",swap:"Bring a conscious reserve into this lane."}[kind]):m.reason||m.detail,
          {disabled:!available,key:tacticKeys[kind]})];
      });
      if(techniques.length)sections.push(group("Team orders · "+r.pos.sides[0].beats+(r.pos.sides[0].beats===1?" beat":" beats"),techniques,2));
      sections.push(group("Draft",[...(r.draft[i]?[button("clear","Clear "+name(k.id)+"’s order",i,"",{key:"X"})]:[]),root()],2));
      return {title:"Order "+name(k.id),kicker:"ROUND "+r.pos.round+"   /   YOUR "+lanes[i].toUpperCase()+" LANE",
        subtitle:incoming(r,i)+" Damage estimates come before rival orders.",sections};
    }
    function targets(r,i,kind){
      const k=front(r.pos,0,i);if(!k)return ring(r);
      const opts=moves(r,0,i).filter(m=>m.kind===kind);if(!opts.length)return laneMoves(r,i);
      const chosenName=kind==="duet"?moveName(r,0,i,opts[0]):tactics[kind];
      return {title:chosenName,kicker:name(k.id)+"   /   ROUND "+r.pos.round,
        ...(kind!=="swap"?{twinField:field(r,{side:"left",lane:i},{side:kind==="cover"?0:1,moves:opts})}:{}),
        subtitle:kind==="cover"?"Pick the friendly lane to protect.":kind==="call"?"Choose the rival lane for your partner to hit.":kind==="swap"?"The incoming kin takes over this lane before attacks.":"Choose the rival lane for your opening pair’s duet.",
        sections:[group(kind==="swap"?"Healthy reserves":kind==="cover"?"Your lanes":"Rival lanes",opts.map((m,j)=>pick(r,i,m,m.detail,String(j+1)))),
          group("Draft",[button("lane","Other orders for "+name(k.id),i),root()],2)]};
    }
    function teams(r){
      const p=r.pos;
      return {title:"Both fours",kicker:"TWINBELL   /   ROUND "+p.round,sections:[0,1].map(s=>group((s?r.right:r.left).name,p.sides[s].team.map((k,i)=>{
        const lane=p.sides[s].active.indexOf(i),piece=kit?.byId(k.gear);
        return {label:name(k.id),image:image(k.id),badge:k.hp===0?"Down":lane<0?"Reserve":lanes[lane]+" lane",
          detail:k.hp+"/"+k.maxHp+" HP"+(piece?" · "+piece.name+(k.spent?" (used)":""):" · No gear")};
      }),2)).concat(group("Ring desk",[root()]))};
    }
    function roundStep(r,round,frames){
      let p=sim.start(r.left,r.right),step;
      for(let n=0;n<round;n++){
        const [ours,theirs]=r.history[n];step=sim.resolve(p,ours,theirs,frames&&n===round-1?{frames:true}:undefined);
        if(!step)return null;p=step.pos;
      }
      return step;
    }
    function eventPage(r,n){
      const total=r.history.length;if(!total)return ring(r);
      const round=Math.max(1,Math.min(total,Number(n)||total));
      const events=round===total?r.lastEvents:roundStep(r,round,false)?.events||[];
      return {title:"Round "+round+" report",kicker:r.left.name+" VS "+r.right.name,sections:[
        group("Replay",[button("watch","Watch this round",round,"See the moves and HP changes in order.",{key:"W"})]),
        group("In order",events.map(e=>({label:e.text}))),
        group("Other rounds",[...(round>1?[button("log","Earlier round",round-1)]:[]),...(round<total?[button("log","Next round",round+1)]:[]),root()],2)]};
    }
    function startPlayback(r,frames,round,back,manual){
      if(!Array.isArray(frames)||!frames.length)return false;
      leavePlayback();
      playback={frames,round,back,manual,at:0,stamp:version(r)};
      show("reveal",back.startsWith("log:")?"push":"replace");return true;
    }
    function finishPlayback(){
      const back=playback.back;leavePlayback();show(back,"replace");
    }
    function advance(){
      if(!playback)return;
      stopTimer();if(playback.at+1>=playback.frames.length)return finishPlayback();
      playback.at++;show("reveal","replace");
    }
    function schedule(){
      if(!playback||playback.manual||!active||!window.setTimeout||timer!==null)return;
      const current=playback,frame=current.frames[current.at],main=["attack","duet","swap","call","cover"].includes(frame.event.kind);
      const multiplier=Math.min(1,10/current.frames.length),speed=game.state.animationSpeed||1;
      timer=window.setTimeout(()=>{
        timer=null;
        if(playback!==current)return;
        if(!active("reveal")){leavePlayback();return;}
        const latest=read();
        if(!latest||version(latest)!==current.stamp){leavePlayback();return;}
        advance();
      },Math.max(270,(main?680:490)*multiplier)/speed);
    }
    function revealPage(r){
      const {frames,at,round,manual}=playback,{event,pos}=frames[at];
      const side=event.side===0?"left":"right",other=event.side===0?"right":"left";
      const focus=belongs(event.lane)?{side,lane:event.lane}:null;
      const board=field({...r,pos},focus);
      if(belongs(event.target))board.target={side:event.kind==="cover"?side:other,lane:event.target};
      const last=at===frames.length-1,returning=playback.back.startsWith("log:");
      const end=returning?"Return to report":r.pos.phase==="done"?"See the result":venue.nextLabel||"Plan the next round";
      const choices=[button("next",last?end:"Next action",null,"",{tone:"primary",key:"1"})];
      if(!last)choices.push(button("skip",returning?"Back to report":"Skip playback",null,"",{key:"2"}));
      if(!reduced())choices.push(button("pause",manual?"Play automatically":"Pause",null,"",{key:"P"}));
      schedule();
      return {title:"Round "+round+" · at the bell",kicker:"ACTION "+(at+1)+" OF "+frames.length,subtitle:event.text,twinField:board,
        sections:[group("Round playback",choices,2)]};
    }
    function result(r){
      const p=r.pos,winner=p.winner,keeper=window.WilderTwinMatch?.wardens.find(w=>w.id===r.keeper),mark=r.marks?.[r.keeper];
      const title=winner===0?"You won the bout":winner===1?r.right.name+" won":"The bout was drawn";
      const sections=[group("Final standings",[0,1].map(s=>{
        const team=p.sides[s].team,standing=team.filter(k=>k.hp>0);return {label:(s?r.right:r.left).name,detail:standing.length+" standing · "+team.reduce((v,k)=>v+k.hp,0)+" HP"};
      }),2)];
      if(winner===0&&keeper&&mark)sections.push({title:keeper.bell,text:"On your bell cord · best win in "+mark.rounds+" rounds."});
      sections.push(group("After the bell",[...(onRematch?[button("rematch","Rematch "+r.right.name,null,"Both fours start at full health.",{tone:"primary",key:"R"})]:[]),
        button("setup",venue.resultLabel||"Return to the grounds",null,"",onRematch?{}:{tone:"primary",key:"1"}),button("log","Read the closing round",r.history.length),button("team","Inspect final HP")],2));
      return {title,kicker:kicker()+"   /   FINAL BELL",subtitle:r.history.length+" rounds played.",sections};
    }
    function model(view){
      const r=read();shortcuts.clear();if(view!=="reveal")leavePlayback();if(!r)return {title:venue.name||"Twinbell Grounds",sections:[group("Ring desk",[button("setup",deskLabel)])]};
      stamp=version(r);if(playback&&playback.stamp!==stamp)leavePlayback();
      const [part,i,kind]=String(view||"ring").split(":"),lane=Number(i);let page;
      if(part==="reveal"&&playback&&playback.stamp===stamp)page=revealPage(r);
      else if(part==="log")page=eventPage(r,i);else if(part==="rosters")page=teams(r);else if(r.pos.phase==="done")page=result(r);
      else if(part==="moves"&&belongs(lane))page=laneMoves(r,lane);
      else if(part==="target"&&belongs(lane)&&Object.hasOwn(tactics,kind))page=targets(r,lane,kind);else page=ring(r);
      for(const s of page.sections)for(const b of s.rows||[])if(b.key&&!b.disabled)shortcuts.set(b.key.toLowerCase(),b);
      return page;
    }
    function act(action,value,current){
      if(typeof action!=="string"||!action.startsWith("twin-"))return false;
      const id=action.slice(5);if(id==="setup"){leavePlayback();onSetup();return true;}
      const r=read();if(!r){onSetup();return true;}
      if(["pick","clear","round","rematch"].includes(id)&&version(r)!==stamp){
        notify("The bout changed. Review the current round before ordering.");show(r.pos.phase==="done"?"result":"ring","replace");return true;
      }
      if(id==="next"||id==="skip"||id==="pause"){
        if(!playback||(active&&!active("reveal"))||version(r)!==playback.stamp)return true;
        if(id==="next")advance();else if(id==="skip")finishPlayback();else{stopTimer();playback.manual=!playback.manual;show("reveal","replace");}
        return true;
      }
      if(id==="watch"){
        const round=Number(value);if(!Number.isInteger(round)||round<1||round>r.history.length)return true;
        const step=roundStep(r,round,true);if(step)startPlayback(r,step.frames,round,"log:"+round,reduced()||!active);
        return true;
      }
      const [raw,move]=String(value??"").split("|"),lane=Number(raw);
      if(id==="ring"){show(r.pos.phase==="done"?"result":"ring","replace");return true;}
      if(id==="log"){show("log:"+Number(value));return true;}if(id==="team"){show("rosters");return true;}
      if(r.pos.phase==="done"){if(id==="rematch")onRematch?.();return true;}
      if(id==="lane"&&belongs(lane)&&front(r.pos,0,lane)){show("moves:"+lane);return true;}
      if(id==="tactic"&&belongs(lane)&&Object.hasOwn(tactics,move)){show("target:"+lane+":"+move);return true;}
      if(!["pick","clear","round"].includes(id))return true;
      if(id==="round"&&!legalRound(r))return true;
      if(id!=="round"&&(!belongs(lane)||!front(r.pos,0,lane)))return true;
      const reply=commit(id,lane,move);
      if(!reply?.ok){notify(reply?.message||"These orders could not be played.");show("ring","replace");return true;}
      const next=read(),other=1-lane;
      if(id==="round"&&!reduced()&&active&&window.setTimeout&&startPlayback(next,reply.frames,next.history.length,next.pos.phase==="done"?"result":"ring",false))return true;
      if(next.pos.phase==="done")show("result","replace");
      else if(id==="pick"&&!next.draft[other]&&front(next.pos,0,other))show("moves:"+other,"replace");else show("ring","replace");
      return true;
    }
    function key(e,current){
      const b=!e.repeat&&shortcuts.get(String(e.key).toLowerCase());return b?act(b.id,b.value,current):false;
    }
    return {model,act,key};
  }
  window.WilderTwinRing=Object.freeze({create});
})();
