// Explore a chosen three on a disposable campaign battle. Only the participant's
// own decisions advance the separate rehearsal started from a resulting line.
(() => {
  "use strict";
  const jobs=["lead","partner","finisher"],jobName={lead:"Favorite lead",partner:"Duet partner",finisher:"Third companion"};
  const step=(method,args,label,actor,turn,detail)=>({method,args,value:[method,...args].join("|"),label,actor,turn,detail});
  function lines(practice,setup,partner,finisher){
    if(!Array.isArray(setup?.team))return [];
    const lead=setup.lead;
    if(![lead,partner,finisher].every(id=>setup.team.includes(id))||new Set([lead,partner,finisher]).size!==3)return [];
    const scope=practice.preview(setup);
    if(!scope?.trio)return [];
    const name=id=>scope.kin(id,{owned:true}).name,member=id=>scope.team().find(k=>k.id===id);
    const results=new Map(),opening=scope.state.battle.enemy.id;
    function explore(prior){
      const b=scope.state.battle;
      if(!b||b.activeId!==lead||b.enemy.id!==opening||scope.replacements())return;
      const duet=scope.duets().options.find(o=>o.partnerId===partner);
      if(!duet)return;
      if(duet.available){
        const restore=scope.checkpoint(),turn=b.turn,foe=b.enemy,foeName=scope.species[foe.id].name,from=foe.hp;
        if(scope.useDuet(partner).ok){
          const duetStep=step("useDuet",[partner],duet.name,partner,turn,
            name(lead)+" + "+name(partner)+" · "+duet.cost+" beats. "+duet.preview+". "+foeName+" "+from+" → "+foe.hp+" HP.");
          const openingMoves=scope.trio()?.options.filter(o=>o.id===finisher&&o.available)||[];
          for(const option of openingMoves){
            const hp=option.hpAfter,remaining=option.foeHpAfter,finishName=option.kinName,foeHP=scope.state.battle.enemy.hp;
            const detail=finishName+" takes the lead. "+option.detail+". "+foeName+" "+foeHP+" → "+remaining+" HP.";
            const decision=step("useTrio",[finisher,option.skill],option.name,finisher,scope.state.battle.turn,detail);
            const steps=[...prior,duetStep,decision],old=results.get(option.skill);
            const outcome={kind:"trio",name:duet.name+" → "+option.name,lead,partner,finisher,leadName:name(lead),partnerName:name(partner),
              finisherName:finishName,duet:duet.name,cost:duet.cost,role:option.role,skill:option.skill,skillName:option.name,
              damage:option.damage,healing:option.healing,returnDamage:option.returnDamage,hpAfter:hp,maxHp:option.maxHp,
              foeName,foeBefore:foeHP,foeHp:remaining,finishes:option.finishes,steps};
            // For equal-length lines, attacking looks for a weaker foe while a
            // guard prioritizes the incoming companion's remaining health.
            const better=old&&(option.role==="attack"?
              remaining<old.foeHp||remaining===old.foeHp&&hp>old.hpAfter:
              hp>old.hpAfter||hp===old.hpAfter&&remaining<old.foeHp);
            if(!old||steps.length<old.steps.length||steps.length===old.steps.length&&better)results.set(option.skill,outcome);
          }
        }
        restore();
      }
      if(prior.length===2)return;
      // If a successful finish already exists, deeper branches can still reveal
      // an injured finisher's recovery or a different move requirement.
      for(const skill of scope.kin(lead,{owned:true}).skills){
        const forecast=skill.trained?scope.skillPreview(skill.id):scope.ordinaryForecast(skill.id);
        if(!forecast?.available)continue;
        const restore=scope.checkpoint(),battle=scope.state.battle,turn=battle.turn,beats=battle.beats;
        const hp=member(lead).hp,enemy=battle.enemy,foeHP=enemy.hp;
        if(scope.useSkill(skill.id).ok&&scope.state.battle?.activeId===lead&&scope.state.battle.enemy.id===opening&&!scope.replacements()){
          const detail=scope.species[opening].name+" "+foeHP+" → "+enemy.hp+" HP · "+name(lead)+" "+hp+" → "+member(lead).hp+" HP · "+beats+" → "+scope.state.battle.beats+" beats.";
          explore([...prior,step("useSkill",[skill.id],skill.name,lead,turn,detail)]);
        }
        restore();
      }
    }
    explore([]);
    return [...results.values()].sort((a,b)=>a.steps.length-b.steps.length||Number(b.finishes)-Number(a.finishes)||b.damage-a.damage||b.hpAfter-a.hpAfter);
  }

  function create({game,practice,row,image,go,notify,start,openMatchups}){
    let draft=null,pending=null,selecting="lead",query="",targetQuery="",guided=null,lastStamp="";
    const cache=new Map();
    const state=()=>game.state,owned=id=>state().party.some(k=>k.id===id),name=id=>game.kin(id,{owned:true})?.name||"Choose a companion";
    const level=id=>state().party.find(k=>k.id===id)?.level,show=(page=null,mode="push")=>go("trio-planner",page,mode);
    const btn=(id,label,value=null,detail="",extra={})=>row("trio-"+id,label,value,detail,extra);
    const current=()=>draft?{...draft,team:draft.team.slice(),...(pending?.job==="lead"?{requestedLead:pending.id}:{})}:null;
    const setupOf=d=>({kind:d.kind,region:d.region,foe:d.foe,lead:d.lead,team:d.team.slice()});
    const score=d=>d?.partner&&d.lead?game.duetPair(d.lead,d.partner):null;
    function refreshCache(){
      const s=state(),stamp=JSON.stringify([s.region,s.party.map(k=>[k.id,k.level,k.maxHp]),s.growth,s.trainedGuards,s.wardenLessons,s.trailFittings,s.seen,s.met,s.crests,!!s.battle]);
      if(stamp!==lastStamp){lastStamp=stamp;cache.clear();}
    }
    function plans(d){
      if(!d?.foe||!d.lead||!d.partner||!d.finisher||state().battle)return [];
      const key=JSON.stringify(d);
      if(!cache.has(key)){
        if(cache.size>=64)cache.delete(cache.keys().next().value);
        cache.set(key,lines(practice,setupOf(d),d.partner,d.finisher));
      }
      return cache.get(key);
    }
    function assign(d,job,id,remove=null){
      if(!jobs.includes(job)||!owned(id))return null;
      const team=d.team.slice(),slot=team.indexOf(remove);
      if(!team.includes(id)){
        if(slot>=0)team[slot]=id;
        else if(team.length<6)team.push(id);
        else return null;
      }
      const next={...d,team,[job]:id},used=new Set([id]);
      for(const key of jobs.filter(j=>j!==job)){
        const holder=[d[key],d[job]].find(k=>team.includes(k)&&!used.has(k));
        if(holder){next[key]=holder;used.add(holder);}else next[key]=null;
      }
      for(const key of jobs)if(!next[key]){next[key]=team.find(k=>!used.has(k))||null;used.add(next[key]);}
      return next;
    }
    function reset(options={}){
      const s=state(),team=Array.isArray(options.team)&&options.team.length&&options.team.length<=6&&
        new Set(options.team).size===options.team.length&&options.team.every(owned)?options.team.slice():s.team.slice();
      const lead=options.lead||options.anchor||s.lead;
      const region=Number.isInteger(options.region)&&practice.targets(options.region).length?options.region:s.region;
      const targets=practice.targets(region),target=targets.find(t=>t.kind===options.kind&&(!options.foe||t.roster.includes(options.foe)))||
        targets.find(t=>t.foe===options.foe)||targets.find(t=>t.kind==="wild"&&t.foe==="opalclasp")||targets[0];
      const head=team.includes(lead)?lead:team.includes(s.lead)?s.lead:team[0];
      draft={region,kind:target?.kind||"wild",foe:target?.foe,team,lead:head,partner:null,finisher:null};
      for(const job of ["partner","finisher"]){
        const inUse=[draft.lead,draft.partner,draft.finisher];
        draft[job]=team.find(k=>k===options[job]&&!inUse.includes(k))||team.find(k=>!inUse.includes(k))||null;
      }
      pending=null;query="";targetQuery="";selecting="lead";
      if(owned(lead)&&!team.includes(lead)){
        if(team.length<6)draft=assign(draft,"lead",lead);
        else pending={job:"lead",id:lead};
      }
      refreshCache();
    }
    function open(options={}){reset(options);show(pending?"slot":null);}
    function outcome(line){
      return line.damage+" damage"+(line.healing?" · restore "+line.healing+" HP":"")+" · "+line.finisherName+" ends at "+line.hpAfter+"/"+line.maxHp+" HP · "+line.foeName+" "+line.foeHp+" HP.";
    }
    function home(){
      const d=draft,list=plans(d),duet=score(d);
      const slots=jobs.filter(j=>d[j]).map(j=>({id:d[j],name:name(d[j]),src:image(d[j],true),lead:j==="lead",level:level(d[j]),
        action:btn("role","Change "+jobName[j].toLowerCase(),j)}));
      const title=game.species[d.foe]?.name||"Select an opponent";
      return {title:"Build a Trio",kicker:"CHALKYARD   /   TEAM PRACTICE",formationStrip:{label:"Favorite · Partner · Third",slots},
        subtitle:duet&&d.finisher?name(d.lead)+" + "+name(d.partner)+" play "+duet.name+". "+name(d.finisher)+" can take the very next turn.":"Choose three owned companions for a duet and its follow-up.",
        sections:[{title:"Finish against "+title,rows:list.length?list.map(l=>btn("line",l.skillName,l.skill,outcome(l),{badge:l.role,image:image(l.finisher,true)})):
          [{label:state().battle?"Finish your trail encounter first":jobs.some(j=>!d[j])?"Choose three different companions":"No opening within two setup moves",
            detail:state().battle?"The Chalkyard opens after the encounter.":jobs.some(j=>!d[j])?"Use the team controls below to bring in an owned reserve.":"Try another opponent or pair. The foe and lead must survive the duet to pass the turn."}]},
          {title:"Build around a favorite",rows:[...jobs.map(j=>btn("role",jobName[j]+" · "+name(d[j]),j,"Compare owned companions for this place.")),
            btn("targets","Change opponent",null,title+" · "+game.regions[d.region].name),
            ...(openMatchups?[btn("board","Compare the full lineup")]:[]),row("nav","Back to the Chalkyard","practice-yard")]}]};
    }
    function picker(page=0){
      const role=selecting,ids=[...new Set([draft[role],...draft.team,...state().party.map(p=>p.id)].filter(Boolean))]
        .filter(id=>!query||[name(id),game.species[id]?.name,...(game.species[id]?.types||[])].join(" ").toLowerCase().includes(query.toLowerCase()));
      const size=4,last=Math.max(0,Math.ceil(ids.length/size)-1),index=Math.min(last,Math.max(0,parseInt(page,10)||0));
      const rows=ids.slice(index*size,(index+1)*size).map(id=>{
        const d=assign(draft,role,id),spec=game.kin(id,{owned:true}),duet=score(d),leadName=d?name(d.lead):name(draft.lead);
        let detail=spec.types.join(" / ")+" · Lv. "+level(id)+". ";
        if(d){
          const best=plans(d)[0];
          detail+=(duet?leadName+" + "+name(d.partner)+": "+duet.name+" ("+duet.cost+" beats). ":"");
          detail+=best?name(d.finisher)+"’s "+best.skillName+" · "+best.damage+" damage · "+best.hpAfter+"/"+best.maxHp+" HP.":"No complete line in two setup moves.";
        }else detail+="Choose which practice seat to replace before comparing this companion.";
        return btn("choose",name(id),id,detail,{image:image(id,true),badge:draft[role]===id?"Chosen":draft.team.includes(id)?"Lineup":"Reserve"});
      });
      return {title:"Choose "+jobName[role].toLowerCase(),kicker:"TRIO   /   OWNED COMPANIONS",subtitle:"Compare each choice with your other two companions against "+(game.species[draft.foe]?.name||"the selected opponent")+".",
        sections:[{title:"Companions · "+(index+1)+"/"+(last+1),rows},{rows:[btn("search",query?"Search · "+query:"Find a companion",null,"Search name or affinity."),
          ...(index?[btn("page","Previous companions",index-1)]:[]),...(index<last?[btn("page","Next companions",index+1)]:[]),btn("home","Back to Trio")]}]};
    }
    function linePage(l){
      return {title:l.name,kicker:"TRIO   /   "+l.steps.length+" DECISIONS",
        subtitle:l.leadName+" and "+l.partnerName+" spend "+l.cost+" beats. "+l.finisherName+"’s follow-up costs zero.",
        sections:[{rows:[btn("play","Play this line",l.skill,"Choose each move in the practice ring.",{tone:"primary",image:image(l.finisher,true)})]},
          ...l.steps.map((s,i)=>({title:"Turn "+s.turn+" · "+name(s.actor),rows:[{label:s.label,detail:s.detail,image:image(s.actor,true),
            badge:i===l.steps.length-1?"Trio":s.method==="useDuet"?"Duet":"Setup"}]})),
          {rows:[btn("home","Compare other finishes")]}]};
    }
    function validateDraft(){
      if(!draft||!draft.team.every(owned)||!practice.targets(draft.region).some(t=>t.kind===draft.kind&&t.foe===draft.foe))reset();
      if(pending&&!owned(pending.id))pending=null;
    }
    function model(view){
      validateDraft();refreshCache();
      if(pending&&(view==="slot"||!view))return {title:"Make room for "+name(pending.id),kicker:"TRIO   /   FULL PRACTICE LINEUP",
        subtitle:"Choose a practice seat. Your traveling party stays as it is.",sections:[{rows:draft.team.map(id=>{
          const next=assign(draft,pending.job,pending.id,id);
          return btn("slot","Replace "+name(id),id,"New trio: "+jobs.map(j=>name(next[j])).join(" → ")+".",{image:image(id,true)});
        })},{rows:[btn("cancel","Keep my lineup")]}]};
      if(String(view).startsWith("pick:")){
        const [,job,page]=String(view).split(":");
        if(jobs.includes(job))selecting=job;
        return picker(page);
      }
      if(String(view).split(":")[0]==="targets"){
        const regions=[...new Set([draft.region,state().region,...state().visited])];
        const all=regions.flatMap(i=>practice.targets(i)).filter(t=>[t.name,game.regions[t.region].name,...t.roster.map(id=>game.species[id].name)]
          .join(" ").toLowerCase().includes(targetQuery.toLowerCase()));
        const size=6,last=Math.max(0,Math.ceil(all.length/size)-1),page=Math.min(last,Math.max(0,parseInt(String(view).split(":")[1],10)||0));
        const picks=all.slice(page*size,(page+1)*size);
        return {title:"Choose a matchup",kicker:"TRIO   /   OPPONENT",sections:[{title:"Opponents · "+(page+1)+"/"+(last+1),
          rows:picks.map(t=>btn("target",t.name,[t.region,t.kind,t.foe].join("|"),game.regions[t.region].name+" · Lv. "+t.level+" · "+
            (t.kind==="warden"?t.roster.map(id=>game.species[id].name).join(" → "):"Wild track"),{image:image(t.foe,false)}))},
          {rows:[btn("target-search",targetQuery?"Search · "+targetQuery:"Find an opponent",null,"Search for a kin, region or Warden."),
            ...(page?[btn("target-page","Previous opponents",page-1)]:[]),...(page<last?[btn("target-page","Next opponents",page+1)]:[]),btn("home","Back to Trio")]}]};
      }
      if(String(view).startsWith("line:")){const l=plans(draft).find(p=>p.skill===String(view).slice(5));if(l)return linePage(l);}
      return home();
    }
    function act(id,value){
      validateDraft();
      switch(id){
        case "trio-role":if(jobs.includes(value)){query="";selecting=value;pending=null;show("pick:"+selecting+":0");}return true;
        case "trio-page":show("pick:"+selecting+":"+(parseInt(value,10)||0));return true;
        case "trio-search":{const next=window.prompt("Find an owned companion by name or affinity",query);if(next!==null){query=next.trim().slice(0,60);show("pick:"+selecting+":0","replace");}return true;}
        case "trio-choose":{
          if(!owned(value))return true;const next=assign(draft,selecting,value);
          if(next){draft=next;pending=null;show();}else{pending={job:selecting,id:value};show("slot");}return true;
        }
        case "trio-slot":if(pending&&draft.team.includes(value)){draft=assign(draft,pending.job,pending.id,value);pending=null;show();}return true;
        case "trio-cancel":case "trio-home":pending=null;show();return true;
        case "trio-targets":targetQuery="";show("targets");return true;
        case "trio-target-page":show("targets:"+(parseInt(value,10)||0));return true;
        case "trio-target-search":{
          const next=window.prompt("Find an opponent by kin, region or Warden",targetQuery);
          if(next!==null){targetQuery=next.trim().slice(0,60);show("targets","replace");}
          return true;
        }
        case "trio-target":{const [region,kind,foe]=String(value).split("|"),target=practice.targets(Number(region)).find(t=>t.kind===kind&&t.foe===foe);
          if(target){draft={...draft,region:target.region,kind,foe};show();}return true;}
        case "trio-board":if(openMatchups)openMatchups(setupOf(draft));return true;
        case "trio-line":if(plans(draft).some(l=>l.skill===value))show("line:"+value);return true;
        case "trio-play":{
          const prior=plans(draft).find(l=>l.skill===value);
          const next=lines(practice,setupOf(draft),draft.partner,draft.finisher).find(l=>l.skill===value);
          if(!next||JSON.stringify(prior?.steps)!==JSON.stringify(next.steps)){cache.clear();notify("This matchup changed. Review the current Trio.");show();return true;}
          start(setupOf(draft),next);return true;
        }
        default:return false;
      }
    }
    function guidance(run){
      if(!guided||guided.kind!=="trio"||!run)return null;
      const events=run.history,steps=guided.steps;
      for(let i=0;i<Math.min(events.length,steps.length);i++){
        const s=steps[i],e=events[i];
        if(e.turn!==s.turn||e.method!==s.method||e.args.length!==s.args.length||e.args.some((a,j)=>a!==s.args[j]))
          return events.length===i+1?{title:"Alternate line",text:"You chose "+e.label+". Replay that decision to return to the Trio."}:null;
      }
      if(events.length===steps.length)return {title:"Trio completed",text:guided.leadName+" + "+guided.partnerName+" → "+guided.finisherName+"’s "+guided.skillName+". "+outcome(guided)};
      if(events.length>steps.length||run.phase!=="battle")return null;
      const s=steps[events.length];
      return {title:"Trio · step "+(events.length+1)+" of "+steps.length,rows:[row("rehearse-move",s.label,s.value,s.detail,{tone:"primary",image:image(s.actor,true)})]};
    }
    return {open,reset,current,model,act,guidance,setGuide:l=>{guided=l||null;}};
  }
  window.WilderTrioPlanner=Object.freeze({create,lines});
})();
