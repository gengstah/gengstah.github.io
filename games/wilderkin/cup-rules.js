// Captains seal their ordered three before the player drafts. Only completed bout tapes affect the next seal.
(() => {
  "use strict";
  const defaultRoster=Object.freeze(["sprigkit","cindlet","dewfin","mossbell","fernprickle","pincoil"]);
  function captain(id,name,title,roster,gear,plan){
    return Object.freeze({id,name,title,roster:Object.freeze(roster),gear:Object.freeze(gear),plan});
  }
  const captains=Object.freeze([
    captain("orin","Orin Bellfern","The Lantern Tender",["mossbell","gustlance","glimmeray","fernprickle","opalmull","pincoil"],
      {mossbell:"opening-pennant",gustlance:"relay-bell",fernprickle:"seam-hook"},
      "Mossbell carries the Opening Pennant. It can spend that beat on Shelter Call, or save toward Rain Garden with Glimmeray."),
    captain("nessa","Nessa Flintcoil","The Foundry Engineer",["smelteroll","boltbur","kilnclaw","icereeve","creekroll","arcbill"],
      {smelteroll:"last-stitch",boltbur:"prism-lens",kilnclaw:"mender-wrap"},
      "Smelteroll and Boltbur can spend three beats on Bell Foundry to pierce cover. Kilnclaw’s guard can repair an injured reserve."),
    captain("ilda","Ilda Nightglass","The Night Navigator",["chordowl","nightgob","rimefalch","stormweft","ironblink","hushdisc"],
      {chordowl:"mender-wrap",nightgob:"relay-bell",stormweft:"seam-hook"},
      "Chordowl and Nightgob can restore both singers with Night Watch. Rimefalch adds a breakthrough duet with Chordowl.")
  ]);
  const sameOrder=(a,b)=>a.length===b.length&&a.every((id,i)=>id===b[i]);
  const sideNames=["left","right"];
  const first=roundIndex=>Number.isInteger(roundIndex)&&roundIndex>=0&&roundIndex<3?roundIndex%2:null;
  const selectGear=(ids,gear={})=>Object.fromEntries(ids.filter(id=>Object.hasOwn(gear,id)).map(id=>[id,gear[id]]));
  function score(rounds) {
    if(!Array.isArray(rounds)||rounds.length>3)return null;
    let home=0,away=0;
    for(const tape of rounds){
      if(home>=2||away>=2)return null;
      if(tape?.winner===0)home++;
      else if(tape?.winner===1)away++;
      else if(tape?.winner==="draw"){home+=.5;away+=.5;}
      else return null;
    }
    const done=home>=2||away>=2||rounds.length===3;
    return {home,away,done,winner:done?(home===away?"draw":home>away?0:1):null};
  }
  function create({game,species=game?.species,sim=window.WilderSparringBattle.create({species})}) {
    const gearDesk=window.WilderSparringGear,dex=window.WilderKinDex,duets=window.WilderDuets;
    const known=id=>typeof id==="string"&&Object.hasOwn(species,id)&&!species[id].bonus;
    const rosterOK=(ids,size,allowed)=>Array.isArray(ids)&&ids.length===size&&new Set(ids).size===size&&
      [...ids].every(id=>known(id)&&(!allowed||allowed.includes(id)));
    const name=id=>species[id].name;
    function register(roster,gear={}) {
      if(!rosterOK(roster,6))return null;
      const kit=gearDesk.validate({left:gear},roster,[]);
      return kit?{roster:roster.slice(),gear:kit.left}:null;
    }
    // Matchup ratings use actual ordinary attack affinities. Equal ratings favor the captain's published roster order.
    function reach(id,target) {
      const attacks=species[id].skills.filter(m=>m.kind==="attack");
      return attacks.map(move=>({move,mult:dex.effectiveness(move.type,species[target].types)}))
        .sort((a,b)=>b.mult-a.mult||b.move.power-a.move.power)[0];
    }
    function seal(c,history) {
      const last=history.at(-1),round=history.length+1;
      let team=c.roster.slice(0,3),reason=c.plan;
      if(last){
        const shown=last.left,prior=last.right,win=last.winner===1,loss=last.winner===0;
        const matchup=c.roster.map(id=>shown.map(foe=>reach(id,foe).mult));
        const incoming=c.roster.map(id=>reach(shown[0],id).mult);
        let best=-Infinity;
        for(let a=0;a<6;a++)for(let b=0;b<5;b++)for(let d=b+1;d<6;d++){
          if(a===b||a===d)continue;
          const candidate=[c.roster[a],c.roster[b],c.roster[d]];
          if(win&&candidate[0]!==prior[0]||loss&&candidate[0]===prior[0])continue;
          const reused=candidate.filter(id=>prior.includes(id)).length;
          if(win?reused!==2:reused===3)continue;
          const coverage=shown.reduce((n,_,i)=>n+Math.max(matchup[a][i],matchup[b][i],matchup[d][i]),0);
          const rating=coverage+2*matchup[a][0]-incoming[a];
          if(rating>best){best=rating;team=candidate;}
        }
        const newFace=team.find(id=>!prior.includes(id)),hit=reach(newFace,shown[0]);
        const target=shown.reduce((best,id)=>reach(newFace,id).mult>reach(newFace,best).mult?id:best,shown[0]);
        const answer=target===shown[0]?hit:reach(newFace,target);
        reason=win?"After winning, "+c.name+" keeps "+name(prior[0])+" in front and changes one reserve.":
          loss?"After losing to your "+name(shown[0])+" lead, "+c.name+" moves "+name(team[0])+" to the front.":
          "After the draw, "+c.name+" changes the lineup that faced your "+name(shown[0])+".";
        reason+=" New arrival "+name(newFace)+" has "+answer.move.name+" at "+answer.mult+"× against the "+name(target)+" you showed.";
      }
      return {team,gear:selectGear(team,c.gear),round,reason};
    }
    function checkTape(c,reg,history,tape,completed) {
      if(!tape||history.length>=3||score(history).done||!rosterOK(tape.left,3,reg.roster)||!rosterOK(tape.right,3,c.roster)||
        tape.first!==first(history.length)||tape.human!==undefined&&tape.human!==0||
        tape.conceded!==undefined&&typeof tape.conceded!=="boolean"||
        !Array.isArray(tape.moves)||tape.moves.length>66)return null;
      const planned=seal(c,history);
      if(!sameOrder(tape.right,planned.team))return null;
      const kit=gearDesk.validate(tape.gear,tape.left,tape.right);
      if(!kit)return null;
      const expected={left:reg.gear,right:c.gear};
      if(sideNames.some(side=>tape[side].some(id=>kit[side][id]!==expected[side][id])))return null;
      let pos=sim.start(tape.left,tape.right,tape.first,kit);
      if(!pos)return null;
      for(const move of tape.moves){
        if(typeof move!=="string"||move.length>80)return null;
        pos=sim.apply(pos,move);if(!pos)return null;
      }
      const conceded=tape.conceded===true,winner=conceded?1:pos.winner;
      if(conceded&&pos.phase==="done"||completed&&(winner===null||tape.winner!==winner)||
        tape.winner!==undefined&&tape.winner!==winner)return null;
      return {pos,tape:{left:tape.left.slice(),right:tape.right.slice(),first:tape.first,human:0,gear:kit,moves:tape.moves.slice(),winner,conceded}};
    }
    function checked(captainId,roster,gear,rounds) {
      const c=captains.find(c=>c.id===captainId),reg=register(roster,gear);
      if(!c||!reg||!Array.isArray(rounds)||rounds.length>3)return null;
      const history=[];
      for(const tape of rounds){
        const result=checkTape(c,reg,history,tape,true);
        if(!result)return null;
        history.push(result.tape);
      }
      return {c,reg,history};
    }
    function validateHistory(id,roster,gear,rounds){
      return checked(id,roster,gear,rounds)?.history||null;
    }
    function validateMatch(id,roster,gear,rounds,tape) {
      const ctx=checked(id,roster,gear,rounds);
      return ctx?checkTape(ctx.c,ctx.reg,ctx.history,tape,false):null;
    }
    function commit(id,roster,rounds,gear={}) {
      const ctx=checked(id,roster,gear,rounds);
      return ctx&&!score(ctx.history).done?seal(ctx.c,ctx.history):null;
    }
    function scout(id,roster,rounds,gear={}) {
      const ctx=checked(id,roster,gear,rounds);
      if(!ctx||score(ctx.history).done)return null;
      const plan=seal(ctx.c,ctx.history),team=plan.team,affinities=Object.keys(dex.types);
      const attacks=team.flatMap(id=>species[id].skills.filter(m=>m.kind==="attack"));
      const coverage=affinities.filter(type=>attacks.some(m=>dex.effectiveness(m.type,[type])>1));
      const weaknesses=affinities.filter(type=>team.filter(id=>dex.effectiveness(type,species[id].types)>1).length>=2);
      const pairs=[];
      for(let i=0;i<2;i++)for(let j=i+1;j<3;j++){
        const ids=[team[i],team[j]],pair=duets.score(species[ids[0]].type,species[ids[1]].type);
        pairs.push({ids,name:pair.name,cost:pair.cost,role:pair.role,label:pair.label});
      }
      const lead=team[0],opening=first(ctx.history.length);
      const strongest=pos=>sim.options(pos).filter(m=>m.kind==="attack"&&m.available).sort((a,b)=>b.damage-a.damage)[0];
      const choices=roster.map(id=>{
        const left=[id,...roster.filter(other=>other!==id)].slice(0,3);
        const start=sim.start(left,team,opening,{left:selectGear(left,ctx.reg.gear),right:plan.gear});
        const opener=strongest(start),after=sim.apply(start,opener.id),reply=after.phase==="move"?strongest(after):null;
        const player=opening===0?opener:reply,rival=opening===1?opener:reply;
        const playerDamage=player?.damage||0,rivalDamage=rival?.damage||0;
        return {id,first:opening,playerMove:player?.label||"",rivalMove:rival?.label||"",playerDamage,rivalDamage,
          rating:playerDamage/start.sides[1].team[0].maxHp-rivalDamage/start.sides[0].team[0].maxHp};
      }).sort((a,b)=>b.rating-a.rating||b.playerDamage-a.playerDamage);
      const projection=choices[0],playerLine=name(projection.id)+"’s "+projection.playerMove+" deals "+projection.playerDamage+" HP",
        rivalLine=name(lead)+"’s "+projection.rivalMove+" deals "+projection.rivalDamage+" HP";
      const counter="With full HP and registered gear, "+(opening===0?playerLine+" first, then "+rivalLine:rivalLine+" first, then "+playerLine)+
        ". Both use their strongest ordinary strike.";
      return {...plan,bench:ctx.c.roster.filter(id=>!team.includes(id)),coverage,weaknesses,duets:pairs,counter,projection};
    }
    return {defaultRoster,captains,register,selectGear,first,score,commit,scout,validateHistory,validateMatch};
  }
  window.WilderCupRules=Object.freeze({create});
})();
