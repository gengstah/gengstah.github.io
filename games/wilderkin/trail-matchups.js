// The board compares owned companions. Its draft is independent of the traveling party.
(() => {
  "use strict";
  const group=(title,rows,columns=1)=>({title,rows,columns});
  const pageSize=6;
  function create({game,row,image,go,render,notify,play,practice,openDuets,openTrail,openTrios}) {
    const state=()=>game.state,owned=id=>state().party.find(k=>k.id===id);
    const myKin=id=>game.kin(id,{owned:true}),myName=id=>myKin(id).name,foeName=id=>game.species[id].name;
    const portrait=id=>image(id,true);
    const btn=(id,label,value=null,detail="",extra={})=>row("matchup-"+id,label,value,detail,extra);
    const link=(label,page,detail="",extra={})=>btn("view",label,page,detail,extra);
    const show=(view=null,mode="push")=>go("trail-matchups",view,mode);
    const kit=id=>window.WilderTrailFittings?.byId(state().trailFittings?.gear[id])?.name;
    let draft={},edits=[],reserveQuery="",pending=null,anchorPending=false,replaceSeat=null;
    const validTeam=ids=>Array.isArray(ids)&&ids.length>0&&ids.length<=6&&new Set(ids).size===ids.length&&ids.every(owned);
    function targets(kind,region=state().region) {
      const cards=practice.targets(region).filter(c=>c.region===region&&c.kind===kind);
      return kind==="warden"?(cards[0]?.roster.slice()||[]):[...new Set(cards.map(c=>c.foe))];
    }
    const sameIds=(a,b)=>a.length===b.length&&a.every((id,i)=>b[i]===id);
    const names=ids=>ids.map(myName).join(" · ");
    function choices(options) {
      const s=state(),base=s.team.slice(),team=(validTeam(options.team)?options.team:base).slice();
      const region=Number.isInteger(options.region)&&(options.region===s.region||s.visited.includes(options.region))?options.region:s.region;
      const kind=options.kind==="warden"&&targets("warden",region).length?"warden":"wild";
      const opponents=targets(kind,region),foe=opponents.includes(options.foe)?options.foe:opponents[0];
      const requested=options.anchor||options.lead;
      let anchor=requested||s.lead;
      // Also accept the original one-seat input from a companion's profile.
      if(owned(options.reserve)&&!team.includes(options.reserve)){
        const at=typeof options.slot==="number"?options.slot:team.indexOf(options.slot);
        if(options.slot==="add"&&team.length<6)team.push(options.reserve);
        else if(Number.isInteger(at)&&at>=0&&at<team.length){if(anchor===team[at])anchor=options.reserve;team[at]=options.reserve;}
      }
      if(!team.includes(anchor))anchor=team.includes(s.lead)?s.lead:team[0];
      const joined=team.filter(id=>!base.includes(id)),left=base.filter(id=>!team.includes(id));
      const newOrder=team.filter(id=>base.includes(id)),oldOrder=base.filter(id=>team.includes(id));
      const reordered=!sameIds(oldOrder,newOrder);
      const single=joined.length===1&&left.length<=1&&!reordered&&(left.length===0||base.indexOf(left[0])===team.indexOf(joined[0]));
      return {region,kind,foe,opponents,base,team,anchor,baseLead:s.lead,joined,left,reordered,
        changed:!sameIds(team,base)||anchor!==s.lead,reserve:single?joined[0]:null,slot:single?(left[0]||"add"):null};
    }
    function reset(options={}) {
      const s=state(),requested=options.anchor||options.lead;
      const d=choices(options);
      // When a completed practice brings the same team back, its edit history
      // still belongs to this draft. A fresh visit starts from today's travelers.
      const returning=validTeam(options.team)&&draft.origin===s.region&&validTeam(draft.team)&&
        sameIds(draft.team,d.team)&&draft.anchor===d.anchor;
      if(!returning)edits=d.changed?[{team:s.team.slice(),anchor:s.lead,label:"Imported team"}]:[];
      draft={origin:s.region,region:d.region,kind:d.kind,foe:d.foe,team:d.team,anchor:d.anchor};
      pending=null;anchorPending=false;replaceSeat=null;reserveQuery="";
      if(requested&&owned(requested)&&!d.team.includes(requested)){
        if(d.team.length<6)edit(d,[...d.team,requested],requested,"Added "+myName(requested));
        else{pending=requested;anchorPending=true;}
      }
    }
    function open(options={}){reset(options);show(pending?"slot":null);}
    function current(){if(draft.origin!==state().region)reset();checkCache();return choices(draft);}
    function edit(d,team,anchor,label){
      if(!validTeam(team)||!team.includes(anchor)||sameIds(team,d.team)&&anchor===d.anchor)return;
      edits.push({team:d.team.slice(),anchor:d.anchor,label});draft.team=team.slice();draft.anchor=anchor;
    }
    function place(d,id,slot,makeLead=false){
      if(!owned(id)||d.team.includes(id)||(slot==="add"?d.team.length>=6:!d.team.includes(slot)))return false;
      const team=slot==="add"?[...d.team,id]:d.team.map(k=>k===slot?id:k);
      edit(d,team,makeLead||slot===d.anchor?id:d.anchor,slot==="add"?"Added "+myName(id):myName(slot)+" → "+myName(id));
      return true;
    }
    function summary(d){
      const parts=[];
      if(d.reserve)parts.push(d.slot==="add"?myName(d.reserve)+" joins the party":myName(d.reserve)+" takes "+myName(d.slot)+"’s place");
      else{
        if(d.joined.length)parts.push("Add "+names(d.joined));
        if(d.left.length)parts.push("Move "+names(d.left)+" to reserve");
      }
      if(d.reordered)parts.push("Travel order changed");
      if(d.anchor!==d.baseLead)parts.push(myName(d.anchor)+" leads");
      return parts.join(". ")+(parts.length?".":"");
    }
    const trailButton=()=>btn("trail","Take this team onto the trail",null,"Review the traveling party and its lead before applying.");
    function editControls(d,destination){
      const rows=[];
      if(edits.length)rows.push(btn("undo","Undo last edit",destination,edits.at(-1).label));
      if(d.changed)rows.push(btn("clear","Return to my traveling lineup",destination,"Restore "+names(d.base)+" · "+myName(d.baseLead)+" leads."));
      return rows;
    }
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
      if(!d.changed)return [];
      return selectedFirst(d).map(foe=>{
        const cells=ids=>Object.fromEntries(ids.map(id=>[id,facts(id,foe,d.kind,ids,d.region)]));
        const before=cells(d.base),after=cells(d.team);
        return {id:foe,before:bestTeam(d.base,before),after:bestTeam(d.team,after),
          seatBefore:before[d.slot],seatAfter:after[d.reserve],formerLead:before[d.baseLead],newLead:after[d.anchor]};
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
      const plan=d.changed||edits.length?group("Proposed party",[
        ...(d.changed?[link("Compare coverage","coverage",summary(d))]:[]),...editControls(d,null)],2):null;
      const rec=r.best,canPlay=typeof play==="function";
      const actions=[btn("play",warden?"Practice against Warden "+region.warden:"Practice with "+myName(d.anchor),null,
        warden?"Face all "+d.opponents.length+" in order. "+foeName(first)+" opens.":"Lead with "+myName(d.anchor)+" against "+f.name+".",{tone:"primary",disabled:!canPlay})];
      const hint=rec.id===d.anchor?"Your chosen lead":myName(rec.id)+" as lead";
      return {title:"Trail matchups",kicker:region.name+"   /   CAMP PRACTICE",subtitle,sections:[
        group(k.hypothetical?"If this foe is charging":"Your opening",[link(k.move.name,"kin:"+k.id,k.move.damage+" of "+k.foeHp+" HP · "+replyLine(k),{image:portrait(k.id)})]),
        group("",[...actions,...(openTrail?[trailButton()]:[])]),group("Team desk",[link("Build your team","lineup",d.team.length+"/6 companions · "+myName(d.anchor)+" leads."),link("Choose opponent","opponents",warden?"Warden "+region.warden:f.name),
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
    function lineup(d){
      const slots=d.team.map((id,i)=>({id,name:myName(id),src:portrait(id),level:owned(id).level,lead:id===d.anchor,
        action:link(myName(id),"seat:"+id,"Edit seat "+(i+1)+" · "+describeMember(id))}));
      return {title:"Build your practice team",kicker:"CHALKYARD   /   "+d.team.length+" OF 6",
        formationStrip:{label:"Practice lineup",slots},subtitle:"Tap a companion to change its position, replace it or make it the lead.",sections:[
          group("Team desk",[link(d.team.length<6?"Add or swap a companion":"Swap a companion","reserves:0","Browse the rest of your owned kin."),
            ...(openTrios?[btn("trios","Build around "+myName(d.anchor),null,"Choose its duet partner and a third kin’s follow-up skill.")]:[]),
            link("Compare coverage","coverage",summary(d)||"Compare your options on this trail."),...(openTrail?[trailButton()]:[]),link("Return to opening",null)],2),
          {title:"Traveling now",text:names(d.base)+". "+myName(d.baseLead)+" leads."},
          ...(edits.length||d.changed?[group("Draft edits",editControls(d,"lineup"),2)]:[])]};
    }
    function seat(d,id){
      const i=d.team.indexOf(id);if(i<0)return lineup(d);
      const nextLead=id===d.anchor?d.team.find(k=>k!==id):d.anchor;
      return {title:myName(id),kicker:"PRACTICE TEAM   /   SEAT "+(i+1),subtitle:describeMember(id),sections:[
        group("This companion",[
          btn("captain","Make "+myName(id)+" the lead",id,id===d.anchor?"Already leading.":"Open the practice encounter with this kin.",{disabled:id===d.anchor,image:portrait(id)}),
          btn("change-seat","Choose a replacement",id,"Compare your other owned companions."),
          btn("remove","Remove from this draft",id,d.team.length===1?"The team needs one companion.":id===d.anchor?myName(nextLead)+" will lead.":"Free this seat in the practice team.",{disabled:d.team.length===1})]),
        ...(d.team.length>1?[group("Move to position",d.team.map((k,j)=>btn("move",String(j+1)+" · "+myName(k),id+"|"+j,
          j===i?"Current position":"Shift the other seats in order.",{disabled:j===i})),2)]:[]),
        group("",[link("Back to the team","lineup")])]};
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
      if(d.changed){
        for(const e of differences(d)){
          if(!e.before.strike||!e.after.strike)continue;
          const prior=d.reserve?e.seatBefore:e.formerLead,after=d.reserve?e.seatAfter:e.newLead;
          const details=[];
          if(after){
            const attacker=prior?myName(prior.id)+"’s "+prior.move.name+" → "+myName(after.id)+"’s "+after.move.name:myName(after.id)+"’s "+after.move.name;
            const offense=(prior?prior.move.damage+" → ":"")+after.move.damage;
            const defense=(prior?prior.threat.damage+" → ":"")+after.threat.damage;
            details.push({label:attacker,detail:(d.reserve?"Strike damage ":"Lead damage ")+offense+" HP. "+after.threat.name+" into this seat deals "+defense+" HP."});
          }
          const a=e.before.strike,b=e.after.strike,front=e.before.shield,back=e.after.shield;
          const best=myName(a.id)+" "+a.move.damage+" → "+myName(b.id)+" "+b.move.damage+" HP.";
          const shelter=front.id===back.id?myName(back.id)+" stays the safest receiver ("+hpLeft(back)+" left).":
            "Safest receiver "+myName(front.id)+" ("+hpLeft(front)+") → "+myName(back.id)+" ("+hpLeft(back)+") after the hit.";
          details.push({label:"Whole party",detail:"Best strike "+best+" "+shelter});
          rows.push(group(foeName(e.id),details));
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
      const change=d.changed,subject=change?"TRAVELING PARTY → PRACTICE DRAFT":"YOUR TRAVELING LINEUP";
      return {title:change?"Coverage changes":"Team coverage",kicker:subject,
        subtitle:(d.kind==="warden"?"Later Warden kin are shown at their charged reference turn. ":"")+"Compare a full-health strike and an unguarded charged hit. The safest receiver keeps the largest share of its HP.",sections:[
          group("Practice party",[link("Return to opening",null,"Review the chosen lead.",{tone:"primary"}),link("Compare another reserve","reserves:0"),link("Build your team","lineup"),...(openTrail?[trailButton()]:[])],2),
          ...(change?[{title:"Before and after",text:names(d.base)+" → "+names(d.team)+". "+(d.baseLead===d.anchor?myName(d.anchor)+" leads both.":"Lead changes from "+myName(d.baseLead)+" to "+myName(d.anchor)+".")}]:[]),...rows,
          ...(edits.length||change?[group("Draft edits",editControls(d,"coverage"),2)]:[])]};
    }
    function reserves(d,page) {
      const term=reserveQuery.toLocaleLowerCase(),ownedReserves=state().party.filter(p=>!d.team.includes(p.id));
      const hits=ownedReserves.filter(p=>[myName(p.id),p.id,...myKin(p.id).types].some(t=>t.toLocaleLowerCase().includes(term)))
        .sort((a,b)=>myName(a.id).localeCompare(myName(b.id)));
      const count=Math.max(1,Math.ceil(hits.length/pageSize)),n=Math.max(0,Math.min(count-1,page));
      return {title:replaceSeat?"Replace "+myName(replaceSeat):"Try an owned companion",kicker:"PRACTICE PARTY",subtitle:replaceSeat?"Choose who takes this seat.":"Pick a companion, then choose its place in your draft.",sections:[
        ...(ownedReserves.length?[group("",[btn("search",term?"Search · "+reserveQuery:"Find a reserve",null,"Name or affinity"),
          ...(term?[btn("clear-search","Clear search")]:[])],2)]:[]),
        group("Outside this draft",hits.length?hits.slice(pageSize*n,pageSize*(n+1)).map(k=>btn("reserve",myName(k.id),k.id,describeMember(k.id),{image:portrait(k.id)})):
          [{label:ownedReserves.length?"No matching companions":"Every owned companion is in this draft.",detail:ownedReserves.length?"Try another name or affinity.":"Befriend another kin on the trail to expand your choices."}],2),
        group("Page "+(n+1)+" of "+count,[...(n?[link("Previous","reserves:"+(n-1))]:[]),...(n+1<count?[link("Next","reserves:"+(n+1))]:[]),
          link("Return to matchups",null)],2)]};
    }
    function slot(d){
      if(!pending||!owned(pending)||d.team.includes(pending))return reserves(d,0);
      const id=pending;
      return {title:"Where will "+myName(id)+" travel?",kicker:"COMPARE A PRACTICE PARTY",sections:[
        group("Choose a slot",[...(d.team.length<6?[btn("slot","Add to an empty slot","add",myName(id)+" joins as companion "+(d.team.length+1)+".",{tone:"primary"})]:[]),
          ...d.team.map(k=>btn("slot","Replace "+myName(k),k,describeMember(k),{image:portrait(k),badge:k===d.anchor?"Current favorite":""}))]),
        group("",[link("Choose a different reserve","reserves:0")])]};
    }
    function model(view) {
      if(state().battle)return {title:"Trail matchups",kicker:"CAMP PRACTICE",sections:[
        {text:"Finish your trail encounter to compare a fresh practice opening."},
        group("On the trail",[row("root","Return to the encounter",null,"",{tone:"primary"})])]};
      const d=current(),[page,arg]=String(view||"home").split(":");
      if(page==="team")return roster(d);
      if(page==="lineup")return lineup(d);
      if(page==="seat")return seat(d,arg);
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
      if(cmd==="view"){if(value==="reserves:0")replaceSeat=null;show(value);return true;}
      if((cmd==="anchor"||cmd==="captain")&&d.team.includes(value)){edit(d,d.team,value,myName(value)+" took the lead");show(cmd==="captain"?"lineup":null,"replace");return true;}
      if(cmd==="change-seat"&&d.team.includes(value)){replaceSeat=value;reserveQuery="";show("reserves:0");return true;}
      if(cmd==="move"){
        const [id,j]=String(value).split("|"),i=d.team.indexOf(id),to=Number(j);
        if(i>=0&&/^[0-5]$/.test(j)&&to<d.team.length&&i!==to){
          const next=d.team.slice();next.splice(i,1);next.splice(to,0,id);edit(d,next,d.anchor,myName(id)+" moved to seat "+(to+1));show("lineup","replace");
        }
        return true;
      }
      if(cmd==="remove"&&d.team.length>1&&d.team.includes(value)){
        const next=d.team.filter(id=>id!==value);edit(d,next,value===d.anchor?next[0]:d.anchor,"Removed "+myName(value));show("lineup","replace");return true;
      }
      if(cmd==="foe"){
        const [kind,foe]=String(value).split(":");
        if(["wild","warden"].includes(kind)&&targets(kind,d.region).includes(foe)){draft.kind=kind;draft.foe=foe;show(null,"replace");}
        return true;
      }
      if(cmd==="reserve"&&owned(value)&&!d.team.includes(value)){
        if(replaceSeat&&place(d,value,replaceSeat)){replaceSeat=null;show("lineup","replace");}
        else{pending=value;replaceSeat=null;anchorPending=false;show("slot");}
        return true;
      }
      if(cmd==="slot"&&place(d,pending,value,anchorPending)){
        pending=null;anchorPending=false;show("coverage","replace");return true;
      }
      if(cmd==="undo"){
        const last=edits.pop();if(last&&validTeam(last.team)){draft.team=last.team;draft.anchor=last.anchor;}
        pending=null;replaceSeat=null;show(value||null,"replace");return true;
      }
      if(cmd==="clear"){
        edit(d,d.base,d.baseLead,"Restored traveling lineup");pending=null;replaceSeat=null;show(value||null,"replace");return true;
      }
      if(cmd==="search"||cmd==="clear-search"){
        const text=cmd==="clear-search"?"":window.prompt?.("Find an owned reserve by name or affinity",reserveQuery);
        if(typeof text==="string"){reserveQuery=text.trim().slice(0,72);show("reserves:0","replace");}return true;
      }
      if(cmd==="play"||cmd==="duet-plan"||cmd==="trail"||cmd==="trios"){
        const start=cmd==="trail"?openTrail:cmd==="play"?play:cmd==="trios"?openTrios:openDuets;
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
