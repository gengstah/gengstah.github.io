// The ring presents only the recorded practice encounter and its legal commands.
(() => {
  "use strict";
  const group=(title,rows,columns=1)=>({title,rows,columns});
  const meta=id=>window.WilderTrailFittings?.byId(id);
  function create({game,practice,row,image,go,render,notify,animate,playTone,onExit,onCompare,onTrail,active=()=>true}){
    const btn=(id,label,value,detail="",extra={})=>row("rehearse-"+id,label,value,detail,extra);
    const link=(label,to,detail="",extra={})=>btn("view",label,to,detail,extra);
    const show=(v="battle",mode="push")=>go("rehearsal-ring",v,mode);
    const desk=()=>onExit?onExit():go("practice-yard");
    const back=()=>link("Back to the ring","battle");
    const warn=msg=>{if(msg)notify(msg);};
    const trios=window.WilderTrioBattle?.create({row,image});
    const suffix=(events,forecast=false)=>(events||[]).map(e=>forecast?(e.preview||e.text):e.text).filter(Boolean).join(" ");
    const missing=()=>({title:"The practice ring",kicker:"CAMPAIGN PRACTICE",sections:[group("At the gate",[
      btn("desk","Choose an opponent",null,"Take your traveling party into a friendly battle.",{tone:"primary"})])]});
    function fighter(p,owned){
      const gear=meta(p.gear);
      const src=owned&&p.appearanceId&&p.appearanceId!==p.id?"art/growth/"+p.appearanceId+".png":image(p.id,false);
      return {species:p.id,name:p.name||game.species[p.id].name,types:p.types||game.species[p.id].types,
        src,hp:p.hp,maxHp:p.maxHp,level:p.level,...(gear?{gear:{id:gear.id,name:gear.name,spent:!!p.spent,
          action:link("Inspect "+gear.name,"team")}}:{})};
    }
    function partyPanel(v){
      return {title:"Your practice party",kicker:"FIELD REHEARSAL",sections:[
        group("Companions",v.team.map(p=>{
          const k=fighter(p,true),item=meta(p.gear),tag=!p.hp?"Fainted":p.id===v.ally.id?"In front":"Reserve";
          return {label:k.name,detail:"Lv. "+p.level+" · "+p.hp+"/"+p.maxHp+" HP"+(item?" · "+item.name+" · "+(p.spent?"used":"ready"):""),badge:tag,image:k.src};
        }),2),group("Practice ring",[back()])]};
    }
    function effect(m,v){
      const partner=v.team.find(p=>p.id===m.targetId),shown=partner&&fighter(partner,true);
      const kind=m.kind==="replace"||m.kind==="switch"?"swap":m.kind==="medicine"?"item":m.kind;
      return {side:"ally",kind,name:m.label,type:m.type||v.ally.types[0]||"Neutral",...(m.pass?{pass:m.pass}:{}),...(kind==="duet"&&shown?{partner:shown.src,partnerType:game.species[partner.id].type}:{}),
        ...(kind==="swap"&&shown?{incoming:shown.src,incomingKin:shown}:{})};
    }
    let tracked=null,tape=[],firstDecisions=[],decisions=0,busy=false,openingEffects="";
    function read(){
      const r=practice.read();
      if(tracked!==r?.game){clear();tracked=r?.game;
        if(r&&!r.history.length)openingEffects=suffix(r.result.fittingEvents);
      }
      return r;
    }
    const heading=r=>r.target.name;
    function view(r){
      const g=r.game,b=g.state.battle;
      const profile=(p,owned)=>{
        const k=g.kin(p.id,{owned}),gear=owned?b?.trailFittings?.gear[p.id]:null;
        return {...p,name:k.name,types:k.types,appearanceId:k.appearanceId,gear,spent:!!gear&&b.trailFittings.spent.includes(gear)};
      };
      const team=g.team().map(p=>profile(p,true)),replacements=g.replacements();
      const ally=team.find(p=>p.id===(replacements?.fallen||b.activeId)),foe=profile(b.enemy,false);
      const intent=g.foeIntent(),tactic=g.wardenForecast(),duet=g.duets();
      return {g,b,r,turn:b.turn,team,ally,foe,intent,tactic,duet,trio:trios?g.trio?.():null,replacements,opponent:heading(r),theme:g.regions[r.setup.region].theme};
    }
    const move=(method,args,label,kind,detail,f={},extra={})=>({id:[method,...args].join("|"),method,args,label,kind,
      available:f.available!==false,detail:f.reason||[detail,suffix(f.fittingEvents,true)].filter(Boolean).join(" "),...extra});
    const exchange=(f,heals)=>!f?"":(heals?"Heal "+f.healing+" HP":"Deal "+f.damage)+(f.finishes?" · KO before reply":" · take "+f.returnDamage);
    function choices(v){
      const {g,b,ally}=v;
      if(v.replacements)return {replacement:v.replacements.options.map((p,i)=>move("replaceFainted",[p.id],p.name,"replace",
        p.attackName+" deals "+p.attackDamage+(p.attackFinishes?" · KO before reply":" · take "+p.attackReplyDamage+" after that strike"),p,
        {targetId:p.id,image:fighter(v.team.find(k=>k.id===p.id),true).src,badge:p.hp+"/"+p.maxHp+" HP",key:String.fromCharCode(65+i)}))};
      const skills=g.kin(ally.id,{owned:true}).skills.map((s,i)=>{
        const f=s.trained?g.skillPreview(s.id):g.ordinaryForecast(s.id);
        return move("useSkill",[s.id],s.name,s.kind,s.trained?f?.detail:exchange(f,s.kind==="heal"),f||{},
          {type:s.type,key:String(i+1)});
      });
      const duets=v.duet.options.map(d=>move("useDuet",[d.partnerId],d.name+" · "+g.kin(d.partnerId,{owned:true}).name,"duet",
        d.cost+" beats · "+d.preview,d,{targetId:d.partnerId,type:ally.types[0],image:fighter(v.team.find(k=>k.id===d.partnerId),true).src}));
      const switches=v.team.filter(p=>p.id!==ally.id).map(p=>{
        const f=g.switchForecast(p.id);
        return move("swap",[p.id],p.name,"switch",f.damage+" damage on entry · "+f.hpAfter+"/"+p.maxHp+" HP"+
          (f.protected?" · Shell Escort":""),f,{targetId:p.id,image:fighter(p,true).src});
      });
      const tactics=[],pass=g.familyTechnique(),ember=g.emberTechnique();
      for(const t of pass?.targets||[])tactics.push(move("useFamilyTechnique",[t.id],pass.name+" to "+t.name,"switch",
        "1 beat · "+(t.heal?"restore "+t.heal+" HP · ":"")+t.returnDamage+" damage on entry",{
          ...pass,fittingEvents:t.fittingEvents},{type:pass.type,targetId:t.id,pass:pass.id}));
      if(ember?.id==="backdraft")skills.push(move("useEmberTechnique",[],ember.name,"attack",
        exchange(ember,false)+" · heal "+ember.healing+" HP",ember,{type:"Ember"}));
      if(ember?.id==="banked-warmth")for(const t of ember.targets)tactics.push(move("useEmberTechnique",[t.id],ember.name+" · "+t.name,"heal",
        "Heal "+t.heal+" HP · stay in front and take "+ember.returnDamage,{...ember,available:ember.available&&t.available,
          reason:ember.reason||t.reason},{type:"Ember",targetId:t.id}));
      const medicine=[];
      for(const id of ["balm","tonic","sparkseed"]){
        const n=g.state.bag[id];if(!n)continue;
        for(const p of v.team){
          const f=g.itemForecast(id,p.id);
          medicine.push(move("useItem",[id,p.id],g.items[id].name+" · "+p.name,"medicine",
            "Restore "+f.gain+" HP · "+f.activeName+" takes "+f.returnDamage+" in reply",f,{badge:n+" packed",targetId:p.id}));
        }
      }
      const trioMoves=(trios?.choices(g,v.trio)||[]).map(o=>move("useTrio",[o.id,o.skillId],o.label,"trio",o.detail,o,
        {targetId:o.id,type:o.type,image:o.image,trioChoice:o}));
      return {skills,duets,switches,tactics,medicine,trios:trioMoves};
    }
    const action=m=>btn("move",m.label,m.id,m.detail,{disabled:!m.available,key:m.key,image:m.image,badge:m.badge,
      tone:m.available&&m.kind==="attack"?"primary":undefined});
    function intentLine(v){
      if(v.tactic?.active)return v.tactic.title+" · "+v.tactic.counter;
      const {foe,intent}=v;
      return foe.name+" prepares "+intent.skill.name+(intent.charged?" · charged":"")+(intent.guarding?" · braced":"")+".";
    }
    function hud(v,title,subtitle,sections,log){
      return {kind:"battle",title,kicker:"PRACTICE   /   TURN "+v.turn+"   /   "+v.duet.beats+" OF "+v.duet.max+" BEATS",
        ally:fighter(v.ally,true),foe:fighter(v.foe,false),theme:v.theme,background:"ui/chalkyard.png",subtitle,log,sections};
    }
    function arena(v,opts){
      const support=[link("Trail duets","duets",v.duet.beats+" / "+v.duet.max+" beats",{key:"R"}),
        link("Switch kin","switches","See the damage on entry.",{key:"S"})];
      if(opts.tactics?.length)support.push(link("Partner techniques","tactics"));
      if(opts.medicine?.length)support.push(link("Practice satchel","medicine","Use a copy of your packed supplies.",{key:"M"}));
      const trioEntry=trios?.entry(v.g,"practice",v.trio);
      if(trioEntry&&!v.trio)support.push(trioEntry);
      const more=[link("Party and fittings","team"),...(tape.length?[link("Review turns","log")]:[]),link("Leave the ring","exit")];
      const sections=opts.replacement?[group("Free replacement",opts.replacement.map(action),2),group("Practice ring",more,2)]:
        [group("Choose a skill",opts.skills.map(action),2),group("Field commands",support,2),group("Practice ring",more,2)];
      if(v.trio&&trioEntry&&!opts.replacement)sections.unshift(group("Duet follow-up",[trioEntry]));
      const title=opts.replacement?"Choose the next kin":"Facing "+v.opponent;
      const last=tape.at(-1),logs=[intentLine(v)];
      if(v.duet.opening)logs.push(v.foe.name+" is exposed.");
      if(last?.actual)logs.push(last.actual);
      return hud(v,title,opts.replacement?v.ally.name+" fell. Send in a companion for free.":
        (v.b.remaining.length?v.b.remaining.length+" more waiting · ":"")+v.ally.name+" is in front.",sections,logs);
    }
    const panels={duets:"Trail duets",switches:"Switch kin",tactics:"Partner techniques",medicine:"Practice satchel"};
    function panel(v,opts,key){
      const options=opts[key];if(!options?.length)return arena(v,opts);
      const text=key==="duets"?v.duet.hint:key==="medicine"?"Only the practice copy of your satchel is used.":key==="switches"?"Switching gives the opponent its announced reply.":"Choose a companion for this technique.";
      return {title:panels[key],kicker:"PRACTICE   /   TURN "+v.turn,subtitle:text,sections:[
        group(key==="duets"?v.duet.beats+" of "+v.duet.max+" beats":v.ally.name,options.map(action),key==="medicine"?2:1),group("Ring",[back()])]};
    }
    function timeline(r,index){
      const step=tape[index];
      if(!step)return {title:"Practice turns",kicker:heading(r),sections:[group("Decisions",tape.slice().reverse().map((t,i)=>
        link("Turn "+t.turn+" · "+t.label,"log:"+String(tape.length-1-i),t.actual))),group("Practice ring",[back()])]};
      const links=[...(index>0?[link("Previous","log:"+(index-1))]:[]),...(index+1<tape.length?[link("Next","log:"+(index+1))]:[])];
      return {kind:"battle",title:step.label,kicker:"BEFORE THE MOVE   /   TURN "+step.turn,ally:step.ally,foe:step.foe,
        background:"ui/chalkyard.png",log:[step.forecast],sections:[{title:"What happened",text:step.actual},
          ...(step.effects?[{title:"Fittings used",text:step.effects}]:[]),group("Review",links.concat(link("All turns","log"),back()),2)]};
    }
    let previous=null,revised=null,rewindTurn=null;
    function measure(v,m,after,res){
      const parts=[],now=after.game.state.battle;
      if(now){
        if(v.foe.id!==now.enemy.id)parts.push(game.species[now.enemy.id].name+" took the opposing lead");
        else if(v.foe.hp!==now.enemy.hp)parts.push(v.foe.name+" "+v.foe.hp+" → "+now.enemy.hp+" HP");
      }else if(res.kind==="victory")parts.push(v.foe.name+" fell");
      else if(res.kind==="defeat")parts.push("Your last companion fell");
      for(const old of v.team){
        const next=after.game.team().find(k=>k.id===old.id);
        if(next&&old.hp!==next.hp&&next.maxHp===old.maxHp)
          parts.push(old.name+" "+old.hp+" → "+next.hp+" HP");
      }
      if(now&&v.ally.id!==now.activeId)parts.push(after.game.kin(now.activeId,{owned:true}).name+" took the lead");
      if(now&&v.duet.beats!==now.beats)parts.push("Beats "+v.duet.beats+" → "+now.beats);
      return parts.length?parts.join(" · ")+".":after.history?.at(-1)?.message||res.message||m.label;
    }
    function comparison(){
      if(!previous)return [];
      const rows=[{label:"Previous · "+previous.label,detail:[previous.actual,previous.effects].filter(Boolean).join(" ")}];
      if(revised)rows.push({label:"Revised · "+revised.label,detail:[revised.actual,revised.effects].filter(Boolean).join(" ")});
      return [group("Same decision · turn "+previous.turn,rows)];
    }
    function rewindRow(r){
      return r.canRewind?btn("rewind","Replay last decision",null,r.rewindLabel||"Try a different command from the same position.",{key:"Z"}):null;
    }
    function fieldSetup(r){
      const team=r.game.team(),turns=firstDecisions.map(entry=>entry.turn);
      return {...r.setup,team:[...r.setup.team],tested:{result:r.result.kind,turns,members:team.map(p=>({
        id:p.id,name:r.game.kin(p.id,{owned:true}).name,level:p.level,hp:p.hp,maxHp:p.maxHp,gear:r.game.state.trailFittings?.gear[p.id]||null}))}};
    }
    function finished(r){
      const native=r.result.kind;
      const title=native==="victory"?"Practice won":native==="defeat"?"Practice lost":"Practice complete";
      const last=tape.at(-1),used=tape.filter(t=>t.effects).map(t=>({label:"Turn "+t.turn+" · "+t.label,detail:t.effects})),retry=btn("retry","Rehearse the same opening",null,"Reset the kin, fittings and practice satchel.",{tone:"primary"});
      if(openingEffects)used.unshift({label:"Opening bell",detail:openingEffects});
      const remaining=r.game.team().map(k=>r.game.kin(k.id,{owned:true}).name+" "+k.hp+"/"+k.maxHp).join(" · ");
      return {title,kicker:"FIELD REHEARSAL   /   "+heading(r).toUpperCase(),subtitle:last?.actual||r.result?.message||"The rehearsal is over.",
        sections:[...(onTrail?[group("Campaign",[btn("trail","Take this team onto the trail",null,"Review the party’s real HP and follow this opponent.",{tone:"primary"})])]:[]),
          ...comparison(),group("Try the matchup again",[rewindRow(r),retry,
          ...(onCompare?[btn("compare","Compare another opening",null,"Change your lead or try a different setup.")]:[]),
          btn("desk","Return to the yard")].filter(Boolean)),
          {title:"Party at the last bell",text:remaining+" HP."},...(used.length?[group("Fittings in action",used)]:[]),
          ...(tape.length?[group(decisions+" decisions",[link("Review the turns","log","See the forecasts and actual exchanges.")])]:[])]};
    }
    function model(value){
      const r=read();if(!r)return missing();
      const [screen,index]=String(value||"battle").split(":");
      if(screen==="log")return timeline(r,index===undefined?-1:Number(index));
      if(r.phase==="done")return finished(r);
      const v=view(r),opts=choices(v);
      if(screen==="team")return partyPanel(v);
      if(screen==="trios"&&trios&&!opts.replacement)return trios.model(v.g,"practice",v.trio);
      if(screen==="exit")return {title:"Leave this rehearsal?",kicker:"PRACTICE YARD",subtitle:"The next rehearsal will start at its opening turn.",
        sections:[group("Practice ring",[link("Keep battling","battle","Return to turn "+v.turn+".",{tone:"primary"}),btn("leave","Leave this rehearsal")])]};
      if(Object.hasOwn(panels,screen)&&!opts.replacement)return panel(v,opts,screen);
      const m=arena(v,opts),rewind=rewindRow(r);
      m.sections.splice(1,0,...(rewind?[group("",[rewind])]:[]),...comparison());
      return m;
    }
    async function play(r,command){
      if(busy||r.phase==="done")return;
      const v=view(r),opts=choices(v),m=Object.values(opts).flat().find(x=>x.id===command&&x.available);
      if(!m)return;
      // Render the old HP and both sprites even when a duet or a switch was chosen in a submenu.
      const fx=m.trioChoice?trios.effect(v.g,m.trioChoice):effect(m,v);
      show("battle","replace");busy=true;
      try{
        const res=practice.act(m.method,...m.args);
        if(!res?.ok){warn(res?.message);return;}
        const after=practice.read();
        if(!after)return;
        const step={turn:v.turn,ally:fighter(v.ally,true),foe:fighter(v.foe,false),label:m.kind==="switch"||m.kind==="replace"?after.history.at(-1).label:m.label,forecast:m.detail,
          actual:measure(v,m,after,res),effects:suffix(res.fittingEvents)};
        tape.push(step);decisions++;
        const event=after.history.at(-1);
        if(event&&m.kind!=="replace"&&event.turn===firstDecisions.length+1&&
          (firstDecisions.length<3||firstDecisions.length===3&&event.method==="useTrio")){
          firstDecisions.push({decision:decisions,turn:{turn:event.turn,activeId:event.activeId,foe:event.foe,method:event.method,args:event.args.slice(),
            label:event.label,actual:[step.actual,step.effects].filter(Boolean).join(" ")}});
        }
        if(tape.length>80)tape.shift();
        if(previous&&!revised&&rewindTurn===decisions)revised=step;
        if(!active())return;
        playTone?.(m.kind==="heal"||m.kind==="medicine"?"care":"strike");
        if(animate){
          await animate(fx);
          for(const e of (res.fittingEvents||[]).filter(e=>e.id!=="last-stitch")){
            if(!active())break;
            await animate({side:"ally",kind:"fitting",item:e.id,name:meta(e.id)?.name||"Fitting"});
          }
          if(active()&&m.kind!=="replace"&&!res.skipCounterFx&&((after.game.state.battle&&after.game.state.battle.turn!==v.turn&&
            after.game.state.battle.enemy.id===v.foe.id)||res.kind==="defeat")){
            const skill=res.replySkill||v.intent.skill;
            await animate({side:"foe",kind:"attack",name:skill.name,type:skill.type});
          }
          if(active()&&res.fittingEvents?.some(e=>e.id==="last-stitch"))
            await animate({side:"ally",kind:"fitting",item:"last-stitch",name:meta("last-stitch").name});
        }
      }finally{
        busy=false;if(active())render();
      }
    }
    function clear(){tracked=null;tape=[];firstDecisions=[];decisions=0;openingEffects="";previous=null;revised=null;rewindTurn=null;}
    function backFrom(current){
      if(busy)return true;
      const r=read(),page=String(current||"battle");
      if(!r){desk();return true;}
      if(page.startsWith("log:"))show("log","replace");
      else if(page!=="battle")show("battle","replace");
      else if(r.phase==="done"){practice.leave();clear();desk();}
      else show("exit");
      return true;
    }
    function act(id,value,current){
      if(typeof id!=="string"||!id.startsWith("rehearse-"))return false;
      if(busy)return true;
      const r=read();
      if(id==="rehearse-back")return backFrom(current);
      if(!r){desk();return true;}
      switch(id){
        case "rehearse-view":show(value);break;
        case "rehearse-move":void play(r,value);break;
        case "rehearse-rewind":{
          if(!r.canRewind)break;
          const result=practice.rewind();
          if(result?.ok===false){warn(result.message);break;}
          if(firstDecisions.at(-1)?.decision===decisions)firstDecisions.pop();
          const prior=tape.pop();decisions=Math.max(0,decisions-1);
          previous=prior||null;rewindTurn=decisions+1;revised=null;tracked=practice.read()?.game;
          show("battle","replace");break;
        }
        case "rehearse-retry":{
          if(r.phase!=="done")break;
          const result=practice.retry();
          if(result?.ok===false){warn(result.message);break;}
          clear();show("battle","replace");break;
        }
        case "rehearse-trail":{
          if(!onTrail||r.phase!=="done")break;
          const setup=fieldSetup(r);practice.leave();clear();onTrail(setup);break;
        }
        case "rehearse-compare":{
          if(!onCompare||r.phase!=="done")break;
          const setup=JSON.parse(JSON.stringify(r.setup));practice.leave();clear();onCompare(setup);break;
        }
        case "rehearse-desk":
          if(r.phase!=="done"){show("exit");break;}
          practice.leave();clear();desk();break;
        case "rehearse-leave":
          if(current==="exit"){practice.leave();clear();desk();}break;
      }
      return true;
    }
    function key(e,current){
      if(e.repeat||e.altKey||e.metaKey||e.ctrlKey)return false;
      const code=String(e.key).toLowerCase();
      if(code==="escape")return backFrom(current);
      if(!code||code.length!==1)return false;
      const match=model(current).sections.flatMap(s=>s.rows||[]).find(r=>r.key&&String(r.key).toLowerCase()===code&&!r.disabled);
      return match?act(match.id,match.value,current):false;
    }
    return {model,act,key,back:backFrom};
  }
  window.WilderRehearsalRing=Object.freeze({create});
})();
