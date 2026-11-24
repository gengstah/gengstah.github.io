// The board compares owned companions. Its draft is independent of the traveling party.
(() => {
  "use strict";
  const group=(title,rows,columns=1)=>({title,rows,columns});
  const pageSize=6;
  function create({game,row,image,go,render,notify,play,practice,openDuets}) {
    const state=()=>game.state,owned=id=>state().party.find(k=>k.id===id);
    const myKin=id=>game.kin(id,{owned:true}),myName=id=>myKin(id).name,foeName=id=>game.species[id].name;
    const portrait=id=>image(id,true);
    const btn=(id,label,value=null,detail="",extra={})=>row("matchup-"+id,label,value,detail,extra);
    const link=(label,page,detail="",extra={})=>btn("view",label,page,detail,extra);
    const show=(view=null,mode="push")=>go("trail-matchups",view,mode);
    const kit=id=>window.WilderTrailFittings?.byId(state().trailFittings?.gear[id])?.name;
    let draft={},reserveQuery="",pending=null,anchorPending=false;
    const validTeam=ids=>Array.isArray(ids)&&ids.length>0&&ids.length<=6&&new Set(ids).size===ids.length&&ids.every(owned);
    function targets(kind,region=state().region) {
      const cards=practice.targets(region).filter(c=>c.region===region&&c.kind===kind);
      return kind==="warden"?(cards[0]?.roster.slice()||[]):[...new Set(cards.map(c=>c.foe))];
    }
    function choices(options) {
      const s=state(),base=(validTeam(options.base)?options.base:validTeam(options.team)?options.team:s.team).filter(id=>owned(id)),team=base.slice();
      const region=Number.isInteger(options.region)&&(options.region===s.region||s.visited.includes(options.region))?options.region:s.region;
      const kind=options.kind==="warden"&&targets("warden",region).length?"warden":"wild";
      const opponents=targets(kind,region),foe=opponents.includes(options.foe)?options.foe:opponents[0];
      const reserve=owned(options.reserve)&&!base.includes(options.reserve)?options.reserve:null;
      let slot=typeof options.slot==="number"?base[options.slot]:options.slot;
      if(!base.includes(slot)&&!(slot==="add"&&team.length<6))slot=null;
      if(reserve&&slot){if(slot==="add")team.push(reserve);else team[team.indexOf(slot)]=reserve;}
      const anchor=team.includes(options.anchor)?options.anchor:reserve&&slot===options.anchor?reserve:team.includes(s.lead)?s.lead:team[0];
      return {region,kind,foe,opponents,base,team,anchor,reserve,slot};
    }
    function reset(options={}) {
      const s=state(),requested=options.anchor||options.lead,team=s.team;
      draft={origin:s.region,region:options.region??s.region,kind:options.kind,foe:options.foe,anchor:requested||s.lead,slot:options.slot,reserve:options.reserve};
      pending=null;anchorPending=false;reserveQuery="";
      if(validTeam(options.team)&&!options.reserve){
        const diff=options.team.map((id,i)=>id===team[i]?null:i).filter(i=>i!==null);
        if(diff.length===1&&options.team.length>=team.length&&!team.includes(options.team[diff[0]])){
          draft.slot=team[diff[0]]||"add";draft.reserve=options.team[diff[0]];
        }else if(options.team.length!==team.length||diff.length)draft.base=options.team.slice();
      }
      const base=draft.base||team;
      if(requested&&owned(requested)&&!base.includes(requested)&&!draft.reserve){
        if(base.length<6){draft.reserve=requested;draft.slot="add";}
        else{pending=requested;anchorPending=true;}
      }
    }
    function open(options={}){reset(options);show(pending?"slot":null);}
    function current(){if(draft.origin!==state().region)reset();checkCache();return choices(draft);}
    function describeMember(id){
      const k=myKin(id),m=owned(id);
      return [k.types.join(" / "),"Lv. "+m.level,kit(id)].filter(Boolean).join(" · ");
    }
    let snapshot="",cache=new Map();
    function checkCache(){
      const s=state();
      const next=JSON.stringify([s.region,s.team,s.party.map(k=>[k.id,k.level,k.maxHp]),s.trailFittings,s.growth,s.trainedGuards,s.crests,s.met,s.visited,!!s.battle]);
      if(snapshot!==next){cache.clear();snapshot=next;}
    }
    function facts(lead,foe,kind,team,region) {
      const key=JSON.stringify([lead,foe,kind,team,region]);
      if(!cache.has(key))cache.set(key,opening(lead,foe,kind,team,region));
      return cache.get(key);
    }
    function opening(lead,foe,kind,team,region) {
      if(!foe)return null;
      const first=kind==="warden"?targets("warden",region)[0]:foe,options={region,kind,foe:first,lead,team};
      const late=foe!==first,ref=practice.reference(options,foe);
      const scope=late?ref:practice.preview(options);
      if(!scope?.state.battle)return null;
      const b=scope.state.battle,kin=scope.kin(lead,{owned:true}),actor=scope.state.party.find(p=>p.id===lead);
      const moves=kin.skills.filter(skill=>!skill.trained&&(skill.kind==="attack"||skill.kind==="guard")).map(skill=>{
        const f=scope.ordinaryForecast(skill.id);
        return f?.available?{id:skill.id,name:skill.name,type:skill.type,kind:skill.kind,damage:f.damage,
          reply:f.returnDamage,finishes:f.finishes,events:f.fittingEvents||[]}:null;
      }).filter(Boolean);
      if(!moves.length)return null;
      const move=moves.reduce((a,m)=>m.damage>a.damage||m.damage===a.damage&&m.reply<a.reply?m:a);
      const threatScope=ref||scope,threat=threatScope.incomingForecast(lead);
      const intent=scope.foeIntent(),trained=kin.skills.filter(skill=>skill.trained).map(skill=>{
        const p=scope.skillPreview(skill.id);
        return {name:skill.name,available:!!p?.available,detail:p?.reason||p?.detail||skill.description};
      });
      return {id:lead,level:actor.level,hp:actor.maxHp,foeHp:b.enemy.maxHp,foeLevel:b.enemy.level,
        intent:intent.skill.name,support:!!intent.support,move,moves,trained,hypothetical:late,
        threat:{name:threat.name,type:threat.type,damage:threat.damage,hpAfter:threat.hpAfter,maxHp:threat.maxHp,charged:!!threat.charged,turn:threatScope.state.battle.turn}};
    }
    function bestTeam(ids,table) {
      return {
        strike:ids.map(id=>table[id]).filter(Boolean).sort((a,b)=>b.move.damage-a.move.damage||a.move.reply-b.move.reply)[0],
        shield:ids.map(id=>table[id]).filter(Boolean).sort((a,b)=>b.threat.hpAfter/b.threat.maxHp-a.threat.hpAfter/a.threat.maxHp||a.threat.damage-b.threat.damage||b.move.damage-a.move.damage)[0]
      };
    }
    function recommendation(members,anchor) {
      const eligible=members.filter(Boolean);
      return eligible.sort((a,b)=>Number(b.move.finishes)-Number(a.move.finishes)||
        Number(b.move.reply<b.hp)-Number(a.move.reply<a.hp)||
        (b.move.damage/b.foeHp-b.move.reply/b.hp)-(a.move.damage/a.foeHp-a.move.reply/a.hp)||
        Number(b.id===anchor)-Number(a.id===anchor))[0];
    }
    function report(options={}) {
      checkCache();
      const d=choices(options),table={};
      for(const id of d.team)table[id]=facts(id,d.foe,d.kind,d.team,d.region);
      const members=d.team.map(id=>table[id]).filter(Boolean);
      return {...d,members,active:table[d.anchor],best:recommendation(members,d.anchor)};
    }
    const selectedFirst=d=>[d.foe,...d.opponents.filter(id=>id!==d.foe)].filter(Boolean);
    const hpLeft=k=>k.threat.hpAfter+"/"+k.threat.maxHp+" HP";
    function differences(d) {
      if(!d.reserve||!d.slot)return [];
      return selectedFirst(d).map(foe=>{
        const table={};
        for(const id of new Set([...d.base,...d.team]))table[id]=facts(id,foe,d.kind,d.team.includes(id)?d.team:d.base,d.region);
        return {id:foe,before:bestTeam(d.base,table),after:bestTeam(d.team,table),seatBefore:table[d.slot],seatAfter:table[d.reserve]};
      });
    }
    const hitLine=(c)=>c.move.name+" · "+c.move.damage+" damage"+(c.move.finishes?" · knockout":"");
    const replyLine=c=>c.move.finishes?"KO before the reply.":c.support?c.intent+" · no return hit.":c.intent+" replies for "+c.move.reply+" HP.";
    const threatLine=c=>(c.threat.charged?"Charged ":"Opening ")+c.threat.name+" deals "+c.threat.damage+" HP without guard";
    const leadRow=(m,detail)=>link(myName(m.id),"kin:"+m.id,detail,{image:portrait(m.id)});
    function home(d) {
      const r=report(d),k=r.active,f=game.species[d.foe],region=game.regions[d.region];
      if(!k)return {title:"Trail matchups",kicker:region.name,sections:[{text:"No opening forecast is available for this selection."},
        group("Opponents",[link("Choose a local opponent","opponents")])]};
      const warden=d.kind==="warden",roster=d.opponents.map(foeName),first=d.opponents[0];
      const subtitle=myName(d.anchor)+" (Lv. "+k.level+") against "+f.name+" (Lv. "+k.foeLevel+").";
      const plan=d.reserve&&d.slot?group("Proposed party",[
        link("Compare coverage","coverage",(d.slot==="add"?myName(d.reserve)+" joins the party.":myName(d.reserve)+" takes "+myName(d.slot)+"’s place.")),
        btn("clear","Return to my traveling lineup")],2):null;
      const rec=r.best,canPlay=typeof play==="function";
      const actions=[btn("play",warden?"Practice against Warden "+region.warden:"Practice with "+myName(d.anchor),null,
        warden?"Face all "+d.opponents.length+" in order. "+foeName(first)+" opens.":"Lead with "+myName(d.anchor)+" against "+f.name+".",{tone:"primary",disabled:!canPlay})];
      const hint=rec.id===d.anchor?"Your chosen lead":myName(rec.id)+" as lead";
      return {title:"Trail matchups",kicker:region.name+"   /   CAMP PRACTICE",subtitle,sections:[
        group(k.hypothetical?"If this foe is charging":"Your opening",[link(k.move.name,"kin:"+k.id,k.move.damage+" of "+k.foeHp+" HP · "+replyLine(k),{image:portrait(k.id)})]),
        group("",actions),group("Team desk",[link("Choose opponent","opponents",warden?"Warden "+region.warden:f.name),
          link("Choose a lead","team",myName(d.anchor)),link("Try an owned reserve","reserves:0","Compare a different lineup."),
          ...(openDuets?[btn("duet-plan","Plan a duet",null,"Choose a partner for "+myName(d.anchor)+".")]:[]),link("Read all matchups","coverage","Compare the party across this "+(warden?"lodge.":"trail."))],2),
        ...(plan?[plan]:[]),{title:k.hypothetical?"Lead for this reference":"Opening suggestion",text:"Favors a knockout, surviving the reply, then the larger swing in both kin’s health.",
          rows:[leadRow(rec,hint+" · "+hitLine(rec)+". "+replyLine(rec))]},
        ...(warden?[{title:"Published formation",text:roster.join(" → ")}]:[])]};
    }
    function roster(d) {
      const r=report(d);
      return {title:"Choose a practice lead",kicker:"TEAM DESK   /   "+foeName(d.foe).toUpperCase(),
        subtitle:"Compare each move and its reply with both kin at full health."+(r.active?.hypothetical?" This later Warden foe is shown at its charged reference turn.":""),
        sections:[group("Proposed order",r.members.map(k=>btn("anchor",myName(k.id),k.id,hitLine(k)+" · take "+k.move.reply+" HP",
          {image:portrait(k.id),badge:k.id===d.anchor?"Selected lead":""}))),group("",[link("Back to matchups",null)])]};
    }
    function opponents(d){
      const region=game.regions[d.region],homeWild=targets("wild",d.region),warden=targets("warden",d.region);
      const target=(id,i,kind)=>btn("foe",foeName(id),kind+":"+id,game.species[id].types.join(" / ")+" · Lv. "+(kind==="wild"?region.wildLevel:region.wardenLevel),
        {image:image(id,false),badge:kind==="warden"?(i===0?"Opener":"#"+(i+1)):undefined});
      return {title:"Choose an opponent",kicker:region.name,sections:[
        group("Local wildlife",homeWild.map((id,i)=>target(id,i,"wild")),2),
        ...(warden.length?[group("Warden "+region.warden,warden.map((id,i)=>target(id,i,"warden")),2)]:[]),
        group("",[link("Return to matchups",null)])]};
    }
    function member(d,id){
      if(!d.team.includes(id))return roster(d);
      const k=facts(id,d.foe,d.kind,d.team,d.region);
      if(!k)return roster(d);
      const data=myKin(id),rows=k.moves.map(m=>({label:m.name+" · "+m.damage+" damage",
        detail:(m.kind==="guard"?"Guarding strike":"Strike")+" · "+(m.finishes?"knocks out the target":"take "+m.reply+" HP back"),badge:m.id===k.move.id?"Most damage":""}));
      return {title:data.name,kicker:"AGAINST "+foeName(d.foe).toUpperCase(),subtitle:describeMember(id),art:{src:portrait(id),height:86},sections:[
        group("Ordinary moves",rows),
        {title:"Defensive check",text:threatLine(k)+" at turn "+k.threat.turn+". "+(k.hypothetical?"This is a possible later exchange.":"The first cue is "+k.intent+".")},
        ...(k.move.events.length?[{title:"Fitting at this exchange",text:k.move.events.map(e=>e.preview||e.text).join(" ")}]:[]),
        ...(k.trained.length?[group("Trained skills",k.trained.map(m=>({label:m.name,detail:m.detail,badge:m.available?"Available":"Conditional"})))]:[]),
        {text:"Forecasts include equipped fittings that trigger in this exchange."},
        group("Practice party",[btn("anchor","Choose "+data.name+" as lead",id,"Return to the opening preview.",{tone:"primary"}),link("Compare other travelers","team")])]};
    }
    function coverage(d){
      const rows=[];
      if(d.reserve&&d.slot){
        const deltas=differences(d);
        for(const e of deltas){
          const prior=e.seatBefore,after=e.seatAfter;
          if(!after||!e.before.strike||!e.after.strike)continue;
          const offense=(prior?prior.move.damage+" → ":"")+after.move.damage;
          const defense=(prior?prior.threat.damage+" → ":"")+after.threat.damage;
          const attacker=prior?myName(prior.id)+"’s "+prior.move.name+" → "+myName(after.id)+"’s "+after.move.name:myName(after.id)+"’s "+after.move.name;
          const best=e.before.strike.move.damage+" → "+e.after.strike.move.damage;
          const front=e.before.shield,back=e.after.shield;
          const shelter=front.id===back.id?myName(back.id)+" stays the safest receiver ("+hpLeft(back)+" left).":
            "Safest receiver "+myName(front.id)+" ("+hpLeft(front)+") → "+myName(back.id)+" ("+hpLeft(back)+") after the hit.";
          rows.push(group(foeName(e.id),[
            {label:attacker,detail:"Strike damage "+offense+" HP. "+after.threat.name+" into this seat deals "+defense+" HP."},
            {label:"Whole party",detail:"Best strike "+best+" damage. "+shelter}]));
        }
      }else{
        for(const foe of selectedFirst(d)){
          const table={};
          for(const id of d.team)table[id]=facts(id,foe,d.kind,d.team,d.region);
          const best=bestTeam(d.team,table);
          if(!best.strike||!best.shield)continue;
          rows.push(group(foeName(foe),[
            btn("foe",myName(best.strike.id)+" · "+best.strike.move.name,d.kind+":"+foe,
              best.strike.move.damage+" damage · "+myName(best.shield.id)+" takes "+best.shield.threat.damage+" HP from "+best.shield.threat.name+" ("+hpLeft(best.shield)+" left).",{image:portrait(best.strike.id)})]));
        }
      }
      const change=d.reserve&&d.slot,subject=change?(d.slot==="add"?"Adding "+myName(d.reserve):myName(d.slot)+" → "+myName(d.reserve)):"Your traveling lineup";
      return {title:change?"Coverage changes":"Team coverage",kicker:subject,
        subtitle:(d.kind==="warden"?"Later Warden kin are shown at their charged reference turn. ":"")+"Compare a full-health strike and an unguarded charged hit. The safest receiver keeps the largest share of its HP.",sections:[
          group("Practice party",[link("Return to opening",null,"Review the chosen lead.",{tone:"primary"}),link("Compare another reserve","reserves:0")],2),...rows]};
    }
    function reserves(d,page) {
      const term=reserveQuery.toLocaleLowerCase(),ownedReserves=state().party.filter(p=>!d.base.includes(p.id));
      const hits=ownedReserves.filter(p=>[myName(p.id),p.id,...myKin(p.id).types].some(t=>t.toLocaleLowerCase().includes(term)))
        .sort((a,b)=>myName(a.id).localeCompare(myName(b.id)));
      const count=Math.max(1,Math.ceil(hits.length/pageSize)),n=Math.max(0,Math.min(count-1,page));
      return {title:"Try an owned reserve",kicker:"PRACTICE PARTY",subtitle:"Pick a companion, then choose its place in your draft.",sections:[
        ...(ownedReserves.length?[group("",[btn("search",term?"Search · "+reserveQuery:"Find a reserve",null,"Name or affinity"),
          ...(term?[btn("clear-search","Clear search")]:[])],2)]:[]),
        group("Camp reserves",hits.length?hits.slice(pageSize*n,pageSize*(n+1)).map(k=>btn("reserve",myName(k.id),k.id,describeMember(k.id),{image:portrait(k.id)})):
          [{label:ownedReserves.length?"No matching companions":"All your companions are traveling.",detail:ownedReserves.length?"Try another name or affinity.":"Befriend another kin, or recall a smaller trail formation to leave someone in reserve."}],2),
        group("Page "+(n+1)+" of "+count,[...(n?[link("Previous","reserves:"+(n-1))]:[]),...(n+1<count?[link("Next","reserves:"+(n+1))]:[]),
          link("Return to matchups",null)],2)]};
    }
    function slot(d){
      if(!pending||!owned(pending)||d.base.includes(pending))return reserves(d,0);
      const id=pending;
      return {title:"Where will "+myName(id)+" travel?",kicker:"COMPARE A PRACTICE PARTY",sections:[
        group("Choose a slot",[...(d.base.length<6?[btn("slot","Add to an empty slot","add",myName(id)+" joins as companion "+(d.base.length+1)+".",{tone:"primary"})]:[]),
          ...d.base.map(k=>btn("slot","Replace "+myName(k),k,describeMember(k),{image:portrait(k),badge:k===d.anchor?"Current favorite":""}))]),
        group("",[link("Choose a different reserve","reserves:0")])]};
    }
    function model(view) {
      if(state().battle)return {title:"Trail matchups",kicker:"CAMP PRACTICE",sections:[
        {text:"Finish your trail encounter to compare a fresh practice opening."},
        group("On the trail",[row("root","Return to the encounter",null,"",{tone:"primary"})])]};
      const d=current(),[page,arg]=String(view||"home").split(":");
      if(page==="team")return roster(d);
      if(page==="opponents")return opponents(d);
      if(page==="kin")return member(d,arg);
      if(page==="coverage")return coverage(d);
      if(page==="reserves")return reserves(d,Number(arg)||0);
      if(page==="slot")return slot(d);
      return home(d);
    }
    function act(id,value){
      if(!id?.startsWith("matchup-"))return false;
      const cmd=id.slice(8),d=current();
      if(cmd==="view"){show(value);return true;}
      if(cmd==="anchor"&&d.team.includes(value)){draft.anchor=value;show(null,"replace");return true;}
      if(cmd==="foe"){
        const [kind,foe]=String(value).split(":");
        if(["wild","warden"].includes(kind)&&targets(kind,d.region).includes(foe)){draft.kind=kind;draft.foe=foe;show(null,"replace");}
        return true;
      }
      if(cmd==="reserve"&&owned(value)&&!d.base.includes(value)){pending=value;anchorPending=false;show("slot");return true;}
      if(cmd==="slot"&&owned(pending)&&!d.base.includes(pending)&&(d.base.includes(value)||value==="add"&&d.base.length<6)){
        draft.slot=value;draft.reserve=pending;if(anchorPending||d.anchor===value)draft.anchor=pending;
        pending=null;anchorPending=false;show("coverage","replace");return true;
      }
      if(cmd==="clear"){draft.reserve=null;draft.slot=null;pending=null;show(null,"replace");return true;}
      if(cmd==="search"||cmd==="clear-search"){
        const text=cmd==="clear-search"?"":window.prompt?.("Find an owned reserve by name or affinity",reserveQuery);
        if(typeof text==="string"){reserveQuery=text.trim().slice(0,72);show("reserves:0","replace");}return true;
      }
      if(cmd==="play"||cmd==="duet-plan"){
        const start=cmd==="play"?play:openDuets;
        const result=start?.({region:d.region,kind:d.kind,foe:d.kind==="warden"?d.opponents[0]:d.foe,lead:d.anchor,team:d.team.slice()});
        if(result===false||result?.ok===false){notify(result?.message||"This opening could not be started.");render?.();}
        return true;
      }
      return true;
    }
    return Object.freeze({model,act,open,reset,report});
  }
  window.WilderTrailMatchups=Object.freeze({create});
})();
