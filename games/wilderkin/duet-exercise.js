// A practice exchange starts at the opening bell. Its displayed positions and exportable film
// are obtained by playing the same legal commands as the Sparring Hall.
(() => {
  "use strict";
  const lead=(p,side)=>p.sides[side].team[p.sides[side].active];
  function create({game,sim=window.WilderSparringBattle.create({game})}) {
    const known=id=>typeof id==="string"&&Object.hasOwn(game.species,id)&&!game.species[id].bonus;
    const validTeam=ids=>Array.isArray(ids)&&ids.length===3&&new Set(ids).size===3&&[...ids].every(known);
    const kit=window.WilderSparringGear;
    function choose(pos,kind,strong,safe=false) {
      const target=lead(pos,1-pos.turn);
      let best=null;
      for(const m of sim.options(pos)){
        if(!m.available||m.kind!==kind||safe&&m.damage>=target.hp)continue;
        if(!best||(strong?m.damage>best.damage:m.damage<best.damage))best=m;
      }
      return best;
    }
    function apply(events,pos,move) {
      if(!move?.available)return null;
      const after=sim.apply(pos,move.id);
      if(after)events.push({before:pos,move,after});
      return after;
    }
    function prepare(seed) {
      const s=seed?.setup;
      if(!s||s.mode!=="cpu"||!validTeam(s.left)||!validTeam(s.right)||
          seed.first!==undefined&&seed.first!==0||seed.moves!==undefined&&(!Array.isArray(seed.moves)||seed.moves.length))return null;
      const [anchor,partner]=s.left,foe=s.right[0];
      if(seed.anchor!==anchor||seed.partner!==partner||seed.foe!==foe)return null;
      const gear=kit.validate(s.gear,s.left,s.right);
      if(!gear)return null;
      const setup={left:s.left.slice(),right:s.right.slice(),gear,mode:"cpu",rival:"custom"};
      const opening=sim.start(setup.left,setup.right,0,gear),warmup=[];
      const duetId="duet:"+partner;
      let p=opening;
      for(const action of ["out","tap","guard","tap","back","guard"]){
        let move;
        if(action==="out"||action==="back")move=sim.forecast(p,"swap:"+(action==="out"?partner:anchor));
        else if(action==="guard")move=choose(p,"guard",false,true);
        else {
          // Both fighters must be standing for the comparison. If all ordinary strikes would
          // knock the partner out, a lighter guard or recovery keeps the drill playable.
          move=choose(p,"attack",false,true)||choose(p,"guard",false,true)||choose(p,"heal",false);
        }
        p=apply(warmup,p,move);
        if(!p||p.phase!=="move")return null;
      }
      const duetMove=sim.forecast(p,duetId),strikeMove=choose(p,"attack",true);
      if(!duetMove?.available||!strikeMove||p.turn!==0||lead(p,0).id!==anchor||lead(p,1).id!==foe||
          !p.sides[1].braced||p.sides[0].team[1].hp===0)return null;
      if(seed.role!==undefined&&seed.role!==duetMove.role||seed.cost!==undefined&&seed.cost!==duetMove.cost||
          seed.duetId!==undefined&&seed.duetId!==duetId)return null;
      return {setup,first:0,anchor,partner,foe,duet:duetMove.label,duetId,role:duetMove.role,cost:duetMove.cost,
        opening,warmup,ready:p,duetMove,strikeMove};
    }
    function exchange(lesson,kind) {
      if(kind!=="duet"&&kind!=="strike")return null;
      const events=[],move=kind==="duet"?lesson.duetMove:lesson.strikeMove;
      let p=apply(events,lesson.ready,move);
      if(!p)return null;
      if(p.phase==="replace"&&p.turn===1){
        p=apply(events,p,sim.recommend(p));
        if(!p)return null;
      }
      if(p.phase!=="done"&&p.turn===1){
        p=apply(events,p,choose(p,"attack",true));
        if(!p)return null;
      }
      return {kind,move,events,pos:p};
    }
    function tryMove(lesson,kind) {
      // Reconstruct from the lineup so restored bookmarks or edited result objects cannot inject HP or beats.
      const fresh=prepare(lesson);
      return fresh?exchange(fresh,kind):null;
    }
    function film(lesson,attempt) {
      const fresh=prepare(lesson);
      if(!fresh)return null;
      const moves=fresh.warmup.map(e=>e.move.id);
      let p=fresh.ready;
      if(attempt!=null){
        const same=exchange(fresh,attempt.kind);
        if(!same||attempt.move?.id!==same.move.id||!Array.isArray(attempt.events)||
            attempt.events.length!==same.events.length||same.events.some((e,i)=>e.move.id!==attempt.events[i]?.move?.id)||
            JSON.stringify(attempt.pos)!==JSON.stringify(same.pos))return null;
        moves.push(...same.events.map(e=>e.move.id));p=same.pos;
      }
      const pivot=p.phase==="done"?moves.length-1:moves.length;
      while(p.phase!=="done"&&moves.length<64){
        const move=sim.recommend(p);
        p=move?.available&&sim.apply(p,move.id);
        if(!p)return null;
        moves.push(move.id);
      }
      if(p.phase!=="done")return null;
      const {left,right,gear}=fresh.setup;
      return {tape:{left,right,gear,first:0,human:0,moves},pivot};
    }
    return {prepare,tryMove,film};
  }
  window.WilderDuetExercise=Object.freeze({create});
})();
