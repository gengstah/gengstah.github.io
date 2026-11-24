// The cup desk only sees Sela's public six until both formations have been chosen.
(() => {
  "use strict";
  const seats=["West lead","East lead","First reserve","Second reserve"];
  const phases={register:"signup",pick:"pick",battle:"battle",between:"score",done:"score"};
  const group=(title,rows,columns=1)=>({title,rows,columns});
  const banner={src:"ui/switchyard.png",landscape:true,height:142};
  const pageSize=8;
  function create({game,row,image,go,render,notify,series,openRing,importFour,scouting}){
    const species=game.species,kit=window.WilderSparringGear;
    const scout=scouting||window.WilderSwitchyardScout.create({game});
    const catalog=Object.values(species).filter(k=>!k.bonus).sort((a,b)=>a.name.localeCompare(b.name));
    const valid=id=>typeof id==="string"&&Object.hasOwn(species,id)&&!species[id].bonus;
    const name=id=>species[id]?.name||id;
    const names=ids=>ids.map(name).join(" · ");
    const idsOf=card=>Array.isArray(card)?card:card?.ids||[];
    const fit=(card,id)=>kit.byId(card?.gear?.[id])?.name;
    const profile=(card,id)=>[species[id].types.join(" / "),fit(card,id)].filter(Boolean).join(" · ");
    const button=(id,label,value=null,detail="",options={})=>row("yard-"+id,label,value,detail,options);
    const link=(label,to,detail="",options={})=>button("view",label,to,detail,options);
    const show=(view,mode="push")=>go("switchyard",view,mode);
    const entry=()=>phases[series.desk().phase];
    const lines=xs=>xs.map(label=>({label}));
    const seriesLine=d=>"You "+d.score[0]+" – "+d.score[1]+" "+d.captain.name;
    const gameName=d=>"Game "+d.gameNumber;
    const main=(label,view)=>link(label,view,"",{tone:"primary"});
    let query="",shown=null,confirmReset=null;
    function publicRoster(card){
      return card.ids.map(id=>({label:name(id),detail:profile(card,id),image:image(id)}));
    }
    function evidence(d){
      return {roster:d.roster.ids,picks:d.picks,rival:d.captain.ids,gear:d.roster.gear,rivalGear:d.captain.gear};
    }
    function imported(d){
      const four=importFour?.();
      if(!four||!Array.isArray(four.ids)||four.ids.length!==4||new Set(four.ids).size!==4||!four.ids.every(valid))return null;
      const ids=[...new Set([...four.ids,...d.roster.ids])].slice(0,6);
      const equipped=Object.fromEntries(ids.map(id=>[id,four.ids.includes(id)?four.gear?.[id]:d.roster.gear[id]]));
      return {name:d.roster.name,ids,gear:kit.normalize({left:equipped},ids,[]).left};
    }
    function signup(d){
      const importedTeam=imported(d);
      return {title:"Switchyard Cup",kicker:"SELA SWITCH   /   DOUBLES",art:banner,
        subtitle:"Register six kin. Choose two leads and two reserves each game. Beat Sela twice to take the cup.",sections:[
          group("",[button("register","Register these six",null,"Choose your opening four next.",{tone:"primary",key:"R"}),
            link("Scout Sela’s six","rival","See the kin and fittings on her team sheet.")]),
          group("Your six · tap to edit",d.roster.ids.map((id,i)=>link(name(id),"slot:"+i,profile(d.roster,id),{image:image(id)})),2),
          ...(importedTeam?[group("From Twinbell Grounds",[button("import","Bring my Twinbell four",null,names(importedTeam.ids.slice(0,4)))])]:[]),
          ...(d.best?[group("Cup cabinet",[link("Your Switchyard trophy","trophy",d.best.score.join("–")+" series win")])]:[]),
          ...(!d.persistent?[{text:"This browser keeps this Cup in the current session."}]:[])]};
    }
    function rival(d){
      return {title:"Sela’s team sheet",kicker:"CAPTAIN SELA SWITCH",subtitle:"All six kin and their fittings are public. Her opening pair is revealed when you lock your four.",
        sections:[group("Registered six",publicRoster(d.captain),2),{title:"How Sela picks",text:d.scoutNote},...historyGroups(d),
          group("Cup desk",[main(d.phase==="pick"?"Return to your picks":"Return to the Cup",phases[d.phase])])]};
    }
    function member(d,slot){
      const id=d.roster.ids[slot];
      return {title:name(id),kicker:"REGISTRATION   /   SLOT "+(slot+1),art:{src:image(id),height:105},
        subtitle:profile(d.roster,id),sections:[group("Change registration",[
          button("catalog","Find another kin",slot,"Search all "+catalog.length+" loaners by kin, affinity or skill.",{tone:"primary"}),
          link("Choose fitting","gear:"+slot,fit(d.roster,id)||"No fitting"),link("Back to your six","signup")])]};
    }
    function loaners(d,slot,page){
      const term=query.toLowerCase();
      const hits=catalog.filter(k=>[k.name,k.id,...k.types,...k.skills.map(s=>s.name)].some(s=>s.toLowerCase().includes(term)));
      const pages=Math.max(1,Math.ceil(hits.length/pageSize));
      page=Math.min(pages-1,Math.max(0,page));
      return {title:"Choose a Cup kin",kicker:"REGISTRATION   /   SLOT "+(slot+1),sections:[
        group("",[button("search",query?"Search · "+query:"Search names, affinities or skills",slot),...(query?[button("clear","Clear search",slot)]:[])]),
        group(hits.length+" matches",hits.slice(page*pageSize,(page+1)*pageSize).map(k=>{
          const onSheet=d.roster.ids.includes(k.id);
          return button("choose",k.name,slot+"|"+k.id,k.types.join(" / "),{image:image(k.id),badge:onSheet?"Registered":"",disabled:onSheet});
        }),2),group("Page "+(page+1)+" of "+pages,[...(page?[link("Previous","catalog:"+slot+":"+(page-1))]:[]),
          ...(page+1<pages?[link("Next","catalog:"+slot+":"+(page+1))]:[]),
          link("Back to "+name(d.roster.ids[slot]),"slot:"+slot)],2)]};
    }
    const doubGear={
      "opening-pennant":"Start with a beat if this kin opens West.",
      "mender-wrap":"Cover a lane to heal an injured reserve once.",
      "seam-hook":"Land a called or exposed strike to remove up to two opposing beats.",
      "relay-bell":"Switch this reserve in to gain an extra beat, up to three.",
      "prism-lens":"Deal neutral damage with the holder’s first resisted strike.",
      "last-stitch":"Survive a knockout hit at 1 HP when starting above 1 HP."
    };
    function fitting(d,slot){
      const card=d.roster,id=card.ids[slot],current=card.gear[id];
      return {title:name(id)+"’s fitting",kicker:"CUP REGISTRATION",sections:[group("One of each fitting per six",[
        button("fit","No fitting",slot+"|none","Leave this kin unequipped.",{badge:current?"":"Equipped"}),
        ...kit.items.map(item=>{
          const held=card.ids.find(x=>x!==id&&card.gear[x]===item.id);
          return button("fit",item.name,slot+"|"+item.id,held?"Held by "+name(held):doubGear[item.id]||item.effect,
            {image:"art/gear/"+item.id+".png",badge:current===item.id?"Equipped":"",disabled:!!held});
        })]),group("",[link("Back to "+name(id),"slot:"+slot)])]};
    }
    function lastFour(d){const team=idsOf(d.games.at(-1)?.left);return team.length===4?team:d.roster.ids.slice(0,4);}
    function pick(d){
      const n=d.picks.length,remaining=d.roster.ids.filter(id=>!d.picks.includes(id));
      const selected=d.picks.map((id,i)=>link(name(id),"pick-slot:"+id,seats[i],{image:image(id)}));
      const next=n<4?seats[n]:"Four ready",facts=scout.lines(evidence(d));
      const compact=window.matchMedia?.("(max-width: 550px)")?.matches;
      const pair=n>=2&&window.WilderDuets.score(species[d.picks[0]].type,species[d.picks[1]].type);
      const actions=n===4?[
        button("start","Lock four and battle",null,name(d.picks[0])+" and "+name(d.picks[1])+" open together.",{tone:"primary",key:"R"}),
        row("nav","Rehearse this opening","signal-box","Try both orders against two possible rival leads.")]:[];
      return {title:n===4?"Ready at the bell":"Choose your "+next.toLowerCase(),kicker:gameName(d).toUpperCase()+"   /   "+seriesLine(d),
        subtitle:pair?name(d.picks[0])+" + "+name(d.picks[1])+" · "+pair.name+" ("+pair.cost+" beats).":
          "Pick "+(n+1)+" of 4 · "+(n===0?"West can order a duet with East.":name(d.picks[0])+" opens West."),
        sections:[...(actions.length?[group("",actions)]:[]),
          ...(n<4?[group(next,remaining.map(id=>button("pick",name(id),id,profile(d.roster,id),
            {image:image(id),key:compact?undefined:String(d.roster.ids.indexOf(id)+1)})),2)]:[]),
          ...(n?[group("Your four · tap to revise",selected,2)]:[]),
          ...(facts.length?[group("Opening scout",lines(facts))]:[]),
          ...(d.games.length?[{title:"From the last game",text:d.scoutNote}]:[]),
          group("Team sheets",[
            link("Compare my six","scout","Check any kin against Sela’s published roster."),
            link("Scout Sela’s six","rival",names(d.captain.ids.slice(0,2))+" and four more."),
            ...(!n?[button("default",d.games.length?"Use my last four":"Use first four",null,names(lastFour(d)))]:[]),
            ...(n?[button("undo","Undo last pick",null,name(d.picks[n-1]))]:[]),
            link("Series desk","overview",seriesLine(d))],2)]};
    }
    function ownScout(d,id){
      const context=evidence(d);
      if(!d.roster.ids.includes(id))return {title:"Compare your six",kicker:"OPENING SCOUT",subtitle:"Choose a kin to see its opening matchups against the public six.",
        sections:[group("Your registration",d.roster.ids.map(k=>link(name(k),"scout:"+k,profile(d.roster,k),{image:image(k)})),2),group("",[main("Return to your picks","pick")])]};
      const at=d.picks.indexOf(id),available=at<0&&d.picks.length<4;
      return {title:name(id),kicker:"OPENING SCOUT",art:{src:image(id),height:95},subtitle:profile(d.roster,id),sections:[
        group("Against Sela’s six",lines(scout.kin(context,id))),
        group("Your four",[...(available?[button("pick","Choose "+name(id),id,seats[d.picks.length],{tone:"primary"})]:[]),
          ...(at>=0?[link("Revise "+seats[at].toLowerCase(),"pick-slot:"+id)]:[]),link("Compare another kin","scout"),link("Back to your four","pick")])]};
    }
    function revise(d,id){
      const at=d.picks.indexOf(id);if(at<0)return pick(d);
      const unused=d.roster.ids.filter(k=>!d.picks.includes(k));
      return {title:name(id),kicker:seats[at].toUpperCase()+"   /   "+gameName(d).toUpperCase(),
        sections:[group("Change this position",unused.map(k=>button("replace",name(k),id+"|"+k,profile(d.roster,k),{image:image(k)})),2),
          ...(d.picks.length>1?[group("Trade positions",d.picks.flatMap((k,i)=>i===at?[]:[
            button("trade",name(k),id+"|"+k,seats[i],{image:image(k)})]),2)]:[]),
          group("Your four",[link("Read "+name(id)+"’s matchups","scout:"+id),button("remove","Remove "+name(id),id),link("Keep this order","pick")])]};
    }
    function historyGroups(d){
      if(!d.games.length)return [];
      return [group("Game results",d.games.map((g,i)=>link("Game "+g.number+" · "+outcome(g.winner),"game:"+i,g.rounds+" rounds · "+g.standing.join("–")+" standing")))];
    }
    function outcome(w){return w==="draw"?"Draw":w===0?"You won":"Sela won";}
    function gameReport(d,i){
      const g=d.games[i];if(!g)return score(d);
      const run=series.read(),canRead=i===d.games.length-1&&run?.pos.phase==="done"&&run.history.length===g.rounds;
      return {title:"Game "+g.number+" · "+outcome(g.winner),kicker:seriesLine(d),subtitle:g.highlight||"",
        sections:[{title:"At the last bell",text:g.rounds+" rounds · Standing "+g.standing.join(" – ")+" · Remaining HP "+g.hp.join(" – ")+"."},
          ...[g.left,g.right].map((side,j)=>group(j===0?"Your formation":"Sela’s formation",idsOf(side).map((id,k)=>({label:name(id),detail:seats[k],image:image(id)})),2)),
          group("Series",[
            ...(canRead?[button("log","Read the final round",g.rounds,"Inspect individual orders.")]:[]),
            link("Return to the series desk",phases[d.phase])])]};
    }
    function score(d){
      const done=d.phase==="done",live=d.phase==="battle",between=d.phase==="between",draw=d.games.at(-1)?.winner==="draw";
      const title=done?(d.winner===0?"Switchyard Cup won":"Sela takes the Cup"):live?gameName(d)+" is in the ring":"Switchyard Cup";
      const actions=live?[button("resume","Resume game "+d.gameNumber,null,"Return to your two lanes.",{tone:"primary",key:"R"})]:
        between?[button("next",draw?"Choose four for the replay":"Choose four for game "+d.gameNumber,null,
          "Both captains can change their opening pair and reserves.",{tone:"primary",key:"R"})]:
        done?[button("restart","Register for a new series",null,"Keep your six for another run.",{tone:"primary",key:"R"})]:
        [main("Return to your picks","pick")];
      return {title,kicker:seriesLine(d),...(done?{art:banner}:{}),
        subtitle:done?(d.winner===0?"Two wins. Sela hands you the Switchyard Cup.":"Sela won two games with her registered six."):
          between?(draw?"The game drew. The same game number is replayed with a fresh choice of four.":"Both teams recover before the next game."):
          "First to two wins. Drawn games are replayed.",
        sections:[group("",actions),...historyGroups(d),
          group("Registration",[
            link("Your original six","sheet",names(d.roster.ids.slice(0,2))+" and four more."),link("Sela’s original six","rival"),
            ...(d.best?[link("Switchyard trophy","trophy")]:[]),...(!done?[button("abandon","Withdraw from this series")]:[])],2)]};
    }
    function trophy(d){
      const b=d.best;if(!b)return {title:"Switchyard trophy",kicker:"CUP CABINET",sections:[{text:"Win two games in one series to earn the Cup."},group("",[link("Back to the Cup",phases[d.phase])])]};
      const ids=idsOf(b.roster);
      return {title:"Switchyard trophy",kicker:"CUP CABINET",art:banner,subtitle:"Winning series · "+b.score.join("–")+" · "+b.rounds+" total rounds.",
        sections:[group("Winning six",ids.map(id=>({label:name(id),image:image(id),detail:fit(b.roster,id)||species[id].types.join(" / ")})),2),group("",[main("Back to the Cup",phases[d.phase])])]};
    }
    function sheet(d){return {title:"Your registered six",kicker:"SWITCHYARD CUP",sections:[group(d.roster.name,publicRoster(d.roster),2),group("",[main("Return to the Cup",phases[d.phase])])]};}
    function stamp(d){
      return JSON.stringify([d.id,d.phase,d.roster,d.picks,d.score,d.games.length,d.gameNumber]);
    }
    function resetStamp(d){
      const run=series.read();
      return JSON.stringify([stamp(d),run?.id,run?.history.length,run?.draft]);
    }
    function model(value){
      const d=series.desk(),[v,arg,p]=String(value||phases[d.phase]).split(":");
      shown=stamp(d);
      if(v==="rival")return rival(d);
      if(v==="game")return gameReport(d,Number(arg));
      if(v==="trophy")return trophy(d);
      if(v==="sheet")return sheet(d);
      if(v==="abandon"&&d.phase!=="register"&&d.phase!=="done")return {title:"Withdraw from the Cup?",kicker:seriesLine(d),
        subtitle:"Withdrawing ends this series and its current game. Your six and earned trophy stay on file.",sections:[group("Series desk",[
          main("Keep this series",phases[d.phase]),button("confirm","Withdraw and register again")])]};
      if(d.phase==="register"){
        const slot=Number(arg);
        if(Number.isInteger(slot)&&slot>=0&&slot<6){
          if(v==="slot")return member(d,slot);
          if(v==="catalog")return loaners(d,slot,Number(p)||0);
          if(v==="gear")return fitting(d,slot);
        }
        return signup(d);
      }
      if(d.phase==="pick"&&v!=="overview"){
        if(v==="scout")return ownScout(d,arg);
        if(v==="pick-slot")return revise(d,arg);
        return pick(d);
      }
      return score(d);
    }
    function write(res,to,mode="replace"){
      if(!res?.ok){notify(res?.message||"This Cup entry has changed. Check the current team sheet.");render();return false;}
      show(to,mode);return true;
    }
    function act(id,value,current){
      if(!id?.startsWith("yard-"))return false;
      const cmd=id.slice(5),d=series.desk(),slot=Number(String(value).split("|")[0]);
      if(cmd==="view"){show(value);return true;}
      if(cmd==="log"){
        const run=series.read();if(run?.pos.phase==="done"&&Number(value)===run.history.length)openRing("log:"+value);
        return true;
      }
      if(shown!==null&&shown!==stamp(d)){notify("Your Cup entry changed. Check the current game.");show(phases[d.phase],"replace");return true;}
      if(cmd==="resume"&&d.phase==="battle"){openRing();return true;}
      if(cmd==="next"&&d.phase==="between"){write(series.next(),"pick");return true;}
      if(cmd==="restart"&&d.phase==="done"){write(series.reset(true),"signup");return true;}
      if(cmd==="abandon"&&d.phase!=="register"&&d.phase!=="done"){confirmReset=resetStamp(d);show("abandon");return true;}
      if(cmd==="confirm"){
        if(current==="abandon"&&confirmReset&&confirmReset===resetStamp(d))write(series.reset(true),"signup");
        else{notify("Review the current series before withdrawing.");show(phases[d.phase],"replace");}
        confirmReset=null;return true;
      }
      if(d.phase==="register"){
        if(cmd==="register"){write(series.register(),"pick");return true;}
        if(cmd==="import"){const c=imported(d);if(c)write(series.setRoster(c),"signup");return true;}
        if(!Number.isInteger(slot)||slot<0||slot>=6)return true;
        if(cmd==="catalog"){query="";show("catalog:"+slot+":0");return true;}
        if(cmd==="search"||cmd==="clear"){
          const s=cmd==="clear"?"":window.prompt?.("Kin, affinity or skill",query);
          if(typeof s==="string"){query=s.trim().slice(0,64);show("catalog:"+slot+":0","replace");}
          return true;
        }
        if(cmd==="fit"||cmd==="choose"){
          const arg=String(value).split("|")[1],c=d.roster,ids=c.ids.slice(),gear={...c.gear},old=ids[slot];
          if(cmd==="fit"){
            if(arg==="none")delete gear[old];
            else if(kit.byId(arg)&&!ids.some(k=>k!==old&&gear[k]===arg))gear[old]=arg;
            else return true;
          }else{
            if(!valid(arg)||ids.includes(arg))return true;
            delete gear[old];ids[slot]=arg;
          }
          write(series.setRoster({...c,ids,gear}),cmd==="fit"?"slot:"+slot:"signup");
        }
        return true;
      }
      if(d.phase!=="pick")return true;
      if(cmd==="start"){
        const res=series.startGame();
        if(res?.ok)openRing();else{notify(res?.message||"Choose four kin before the bell.");render();}
        return true;
      }
      const picks=d.picks.slice(),[old,next]=String(value).split("|"),i=picks.indexOf(old);
      if(cmd==="pick"&&d.roster.ids.includes(value)&&!picks.includes(value)&&picks.length<4)picks.push(value);
      else if(cmd==="remove"&&i!==-1)picks.splice(i,1);
      else if(cmd==="trade"&&i!==-1&&picks.includes(next)){const j=picks.indexOf(next);[picks[i],picks[j]]=[picks[j],picks[i]];}
      else if(cmd==="replace"&&i!==-1&&d.roster.ids.includes(next)&&!picks.includes(next))picks[i]=next;
      else if(cmd==="undo"&&picks.length)picks.pop();
      else if(cmd==="default"&&!picks.length)picks.push(...lastFour(d));
      else return true;
      write(series.setPicks(picks),"pick");return true;
    }
    function key(e,current){
      if(!e||e.repeat||e.altKey||e.ctrlKey||e.metaKey)return false;
      const k=e.key.toUpperCase();
      if(!/^[1-6R]$/.test(k))return false;
      const rows=model(current).sections.flatMap(s=>s.rows||[]);
      const target=k==="R"?null:series.desk().roster.ids[Number(k)-1];
      const action=rows.find(a=>!a.disabled&&(a.key===k||(a.id==="yard-pick"&&a.value===target)));
      return !!action&&act(action.id,action.value,current);
    }
    return Object.freeze({entry,model,act,key});
  }
  window.WilderSwitchyard=Object.freeze({create});
})();
