// Compare registered reserves against an attack the player actually saw in the previous bout.
(() => {
  "use strict";
  const lead=side=>side.team[side.active];
  function observedAttack(tape,sim) {
    const setup=tape.setup||tape;
    let p=sim.start(setup.left,setup.right,tape.first,setup.gear),example=null;
    if(!p||!Array.isArray(tape.moves))return null;
    for(const id of tape.moves) {
      const move=sim.forecast(p,id);
      if(!move?.available)return null;
      const before=p;
      p=sim.apply(p,id);
      if(before.turn!==1||move.kind!=="attack"||move.damage<=0)continue;
      if(!example||move.damage>example.damage)example={
        action:before.ply+1,attacker:lead(before.sides[1]).id,target:lead(before.sides[0]).id,
        command:id,label:move.label,damage:move.damage
      };
    }
    return example;
  }
  function notesFor(tape,roster,species,sim,number,registeredGear) {
    if(!tape||!Array.isArray(roster)||roster.length!==6)return [];
    const setup=tape.setup||tape,move=observedAttack(tape,sim);
    if(!move)return [];
    const name=id=>species[id].name;
    const right=[move.attacker,...setup.right.filter(id=>id!==move.attacker)];
    const candidates=[move.target,...roster.filter(id=>!setup.left.includes(id))];
    const rows=candidates.map(id=>{
      const left=[id,...setup.left.filter(other=>other!==id)].slice(0,3);
      const held=registeredGear||setup.gear?.left||{};
      const gear={left:Object.fromEntries(left.filter(k=>held[k]).map(k=>[k,held[k]])),right:setup.gear?.right||{}};
      const fresh=sim.start(left,right,1,gear);
      const hit=sim.forecast(fresh,move.command),after=sim.apply(fresh,move.command);
      const reply=sim.options(after).filter(m=>m.kind==="attack"&&m.available).sort((a,b)=>b.damage-a.damage)[0];
      const detail=hit.damage+" HP taken"+(reply?" · "+reply.label+" returns "+reply.damage+" damage.":" · falls before replying.");
      return {label:name(id),detail,badge:id===move.target?"FACED IT":"SAT OUT"};
    });
    return [
      {title:"From bout "+number,text:"On action "+move.action+", "+name(move.attacker)+" hit "+name(move.target)+
        " with "+move.label+" for "+move.damage+" damage. That was the captain’s hardest ordinary strike."},
      {title:"If "+name(move.attacker)+" opens with "+move.label,text:"Both teams start at full health with their registered gear. Each possible lead answers with its strongest ordinary attack."},
      {title:"Opening exchange",rows,columns:2}
    ];
  }
  function sections(series,species,sim) {
    const history=series?.rounds;
    if(!Array.isArray(history)||!history.length)return [];
    return notesFor(history.at(-1),series.roster,species,sim,history.length,series.gear);
  }
  window.WilderCupNotebook={notesFor,sections};
})();
