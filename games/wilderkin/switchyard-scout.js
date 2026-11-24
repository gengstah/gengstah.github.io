// A public team sheet gives possible matchups. Only the player's four are ordered here.
(() => {
  "use strict";
  function create({game,sim=window.WilderTwinBattle.create({game})}){
    const species=game.species,name=id=>species[id].name;
    const known=id=>typeof id==="string"&&Object.hasOwn(species,id)&&!species[id].bonus;
    const six=ids=>Array.isArray(ids)&&ids.length===6&&new Set(ids).size===6&&ids.every(known);
    const best=(list,score)=>list.reduce((top,next)=>!top||score(next)>score(top)?next:top,null);
    let cachedKey="",cachedSheet=null;

    // Three pairs per side cover all 36 crossings in nine genuine opening positions.
    function card(ids,gear,start){
      const ordered=[...ids.slice(start),...ids.slice(0,start)].slice(0,4);
      return {ids:ordered,gear:Object.fromEntries(ordered.filter(id=>gear?.[id]).map(id=>[id,gear[id]]))};
    }
    function sheet(ctx){
      if(!six(ctx?.roster)||!six(ctx.rival))return null;
      const {roster,rival,gear,rivalGear}=ctx;
      const key=JSON.stringify([roster,rival,roster.map(id=>gear?.[id]),rival.map(id=>rivalGear?.[id])]);
      if(key===cachedKey)return cachedSheet;
      const outgoing=new Map(roster.map(id=>[id,[]])),incoming=new Map(roster.map(id=>[id,new Map()]));
      for(let i=0;i<6;i+=2)for(let j=0;j<6;j+=2){
        const pos=sim.start(card(roster,gear,i),card(rival,rivalGear,j));
        if(!pos)return null;
        for(const seat of [0,1])for(const lane of [0,1]){
          const actor=pos.sides[seat].team[lane].id;
          for(const m of sim.options(pos,seat,lane)){
            if(m.kind!=="attack"||!m.available)continue;
            const skill=species[actor].skills.find(s=>s.id===m.skillId);
            const hit={actor,foe:m.targetId,skill:skill.name,type:m.type,damage:m.damage};
            if(seat===0)outgoing.get(actor).push(hit);
            else incoming.get(hit.foe).set(actor+"/"+m.skillId,hit);
          }
        }
      }
      cachedKey=key;cachedSheet={outgoing,incoming};return cachedSheet;
    }

    function selected(ctx){
      const ids=ctx.picks??[];
      return Array.isArray(ids)&&ids.length<=4&&new Set(ids).size===ids.length&&ids.every(id=>ctx.roster.includes(id))?ids:null;
    }
    function pairNote(leads,possible){
      const [a,b]=leads,pair=window.WilderDuets.score(species[a].type,species[b].type);
      const effect={
        ward:"Both strike. West takes quarter damage from later hits unless they pierce cover",
        mend:"Both strike and recover up to a quarter of their maximum HP",
        relay:"Trade lanes after striking. West halves later hits unless they pierce cover",
        lure:"Leave at least 1 HP and pin the foe through next round. West halves later hits unless they pierce cover",
        mark:"Expose a survivor for the next ordinary hit, which ignores cover and deals 50% more damage",
        rush:"Pierce cover for a heavy hit"
      }[pair.role];
      return (possible?"Possible leads · ":"")+name(a)+" + "+name(b)+" · "+pair.name+" ("+pair.cost+" beats). "+effect+".";
    }
    function bestHit(data,id){return best(data.outgoing.get(id),hit=>hit.damage);}
    function shot(hit){return name(hit.actor)+"’s "+hit.skill+" → "+name(hit.foe)+" for "+hit.damage+" HP";}
    function shots(data,leads){return "Before calls or cover · "+leads.map(id=>shot(bestHit(data,id))).join(" / ")+".";}

    // Compare the SAME opposing move on each potential switch-in. Give the second
    // reserve credit for options its bench partner does not already cover.
    function pivot(data,leads,candidates,other){
      const already=other?pivot(data,leads,[other]):null;
      let result=null;
      for(const id of candidates)for(const lead of leads)for(const [key,againstLead] of data.incoming.get(lead)){
        const againstReserve=data.incoming.get(id).get(key);
        const covered=other?Math.min(againstLead.damage,data.incoming.get(other).get(key).damage):againstLead.damage;
        const saving=covered-againstReserve.damage;
        if(saving<=0)continue;
        const newThreat=already?.key!==key,leadSaving=againstLead.damage-againstReserve.damage;
        if(!result||newThreat>result.newThreat||newThreat===result.newThreat&&(saving>result.saving||saving===result.saving&&leadSaving>result.leadSaving))
          result={id,lead,againstLead,againstReserve,saving,key,newThreat,leadSaving};
      }
      return result;
    }
    function pivotNote({id,lead,againstLead:a,againstReserve:b}){
      return "If "+name(a.actor)+" uses "+a.skill+" ("+a.type+"), "+name(id)+" loses "+b.damage+" HP on entry versus "+a.damage+" for "+name(lead)+", before calls or cover.";
    }
    function backup(data,leads,candidates,other){
      const answer=pivot(data,leads,candidates,other);
      if(answer)return pivotNote(answer);
      const hit=best(candidates.map(id=>bestHit(data,id)),m=>m.damage);
      return "From the bench · "+shot(hit)+" before calls or cover.";
    }
    function preview(ctx,candidate){
      const data=sheet(ctx);
      if(!data)return [];
      const picks=selected(ctx);
      if(!picks||(candidate!==undefined&&!ctx.roster.includes(candidate)))return [];
      const leads=picks.slice(0,2);
      if(leads.length<2&&candidate!==undefined&&!leads.includes(candidate))leads.push(candidate);
      for(const id of ctx.roster)if(leads.length<2&&!leads.includes(id))leads.push(id);
      const bench=ctx.roster.filter(id=>!leads.includes(id));
      if(candidate!==undefined&&picks.length>=2&&!leads.includes(candidate)){
        const other=picks.slice(2).find(id=>id!==candidate);
        const answer=pivot(data,leads,[candidate],other);
        return [...(answer?[pivotNote(answer)]:[]),shots(data,[candidate]),pairNote([leads[0],candidate],true)];
      }
      const pair=pairNote(leads,picks.length<2);
      if(picks.length<3||candidate!==undefined)return [pair,shots(data,leads),backup(data,leads,bench)];
      const chosen=picks[2],rest=picks.length===4?[picks[3]]:bench.filter(id=>id!==chosen);
      return [pair,backup(data,leads,[chosen]),backup(data,leads,rest,chosen)];
    }
    return {lines:ctx=>preview(ctx),kin:(ctx,id)=>preview(ctx,id)};
  }
  window.WilderSwitchyardScout=Object.freeze({create});
})();
