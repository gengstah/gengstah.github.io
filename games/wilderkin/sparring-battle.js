// Two public teams take alternating turns. Forecasting, local play and the coach use the same moves.
(() => {
  "use strict";
  const level=20,limit=60;
  const rules=Object.freeze({level,limit,
    description:"Both teams fight at level 20. Change between strike, guard, care and switch to earn beats (up to 3). Each kin can use its recovery skill once. A guard breaks an opposing brace. Replacing a fallen leader is free.",
    tiebreak:"At 60 actions, the side with more standing kin wins. Then compare each team’s sum of remaining HP percentages. An exact tie is a draw."});
  const active=s=>s.team[s.active];
  const standing=s=>s.team.filter(p=>p.hp>0).length;
  const hpShare=s=>s.team.reduce((total,p)=>total+p.hp/p.maxHp,0);
  const partFor={attack:"strike",guard:"guard",heal:"care",swap:"switch"};
  const integer=(n,lo,hi)=>Number.isInteger(n)&&n>=lo&&n<=hi;
  function create({species,game}) {
    species=species||game.species;
    const dex=window.WilderKinDex,pairs=window.WilderDuets,kit=window.WilderSparringGear;
    const signatures=window.WilderSparringSignatures;
    const valid=id=>typeof id==="string"&&Object.hasOwn(species,id);
    const validTeam=ids=>Array.isArray(ids)&&ids.length===3&&new Set(ids).size===3&&[...ids].every(valid);
    const maxHp=id=>species[id].baseHp+3*(level-5);
    const label=id=>species[id].name;
    const ready=(fighter,gearId)=>fighter.gear===gearId&&!fighter.spent;
    function start(left,right,first=0,gear) {
      if(!validTeam(left)||!validTeam(right)||!integer(first,0,1))return null;
      const fitting=kit?kit.validate(gear,left,right):undefined;
      if(fitting===null||(!kit&&gear!==undefined))return null;
      const log=[];
      const sides=[left,right].map((ids,i)=>{
        const held=fitting?.[i===0?"left":"right"];
        const team=ids.map(id=>({id,level,hp:maxHp(id),maxHp:maxHp(id),recovery:1,exposed:false,
          ...(held?.[id]?{gear:held[id],spent:false}:{})}));
        const pennant=ready(team[0],"opening-pennant");
        if(pennant){team[0].spent=true;log.push("Side "+(i+1)+" · "+label(team[0].id)+" raised its Opening Pennant for 1 beat.");}
        return {active:0,beats:pennant?1:0,lastPart:null,cover:1,braced:false,pinned:false,team};
      });
      return {v:1,first,turn:first,ply:0,limit,phase:"move",winner:null,sides,log};
    }
    function verdict(p) {
      const [a,b]=p.sides,alive=standing(a)-standing(b);
      if(standing(a)&&standing(b)&&p.ply<limit)return null;
      if(alive)return alive>0?0:1;
      const share=hpShare(a)-hpShare(b);
      return Math.abs(share)<1e-12?"draw":share>0?0:1;
    }
    function restore(raw) {
      if(raw?.v!==1||raw.limit!==limit||!integer(raw.ply,0,limit)||!integer(raw.first,0,1)||
        raw.turn!==(raw.first+raw.ply)%2||!Array.isArray(raw.sides)||raw.sides.length!==2||
        !Array.isArray(raw.log)||raw.log.length>8||raw.log.some(line=>typeof line!=="string"||line.length>400))return null;
      const sides=[];
      for(const s of raw.sides) {
        if(!Array.isArray(s?.team)||!validTeam(s.team.map(p=>p?.id))||!integer(s.active,0,2)||!integer(s.beats,0,3)||
          ![null,...Object.values(partFor)].includes(s.lastPart)||![1,.5,.25].includes(s.cover)||
          typeof s.braced!=="boolean"||typeof s.pinned!=="boolean")return null;
        const team=[],held=new Set();
        for(const {id,hp,maxHp:cap,level:lv,recovery,exposed,gear,spent} of s.team) {
          if(cap!==maxHp(id)||lv!==level||!integer(hp,0,cap)||!integer(recovery,0,1)||typeof exposed!=="boolean")return null;
          const fighter={id,hp,maxHp:cap,level,recovery,exposed};
          if(gear!==undefined){
            if(!kit?.byId(gear)||held.has(gear)||typeof spent!=="boolean")return null;
            if(gear==="opening-pennant"?spent!==(team.length===0):raw.ply===0&&spent)return null;
            held.add(gear);fighter.gear=gear;fighter.spent=spent;
          } else if(spent!==undefined)return null;
          team.push(fighter);
        }
        const side={active:s.active,beats:s.beats,lastPart:s.lastPart,cover:s.cover,braced:s.braced,pinned:s.pinned,team};
        if(s.thornRead!==undefined||s.team.some(p=>p.signatureSpent!==undefined)){
          if(!signatures?.restoreSide(s,side,sides.length,raw))return null;
        }
        sides.push(side);
      }
      const p={v:1,first:raw.first,turn:raw.turn,ply:raw.ply,limit,sides,log:raw.log.slice()};
      if(!standing(sides[1-p.turn])||!active(sides[1-p.turn]).hp)return null;
      p.winner=verdict(p);p.phase=p.winner!==null?"done":active(sides[p.turn]).hp?"move":"replace";
      return p.phase===raw.phase&&p.winner===raw.winner?p:null;
    }
    function power(skill,foe,neutral=false) {
      const affinity=neutral?1:dex.effectiveness(skill.type,species[foe.id].types);
      return Math.max(1,Math.round((skill.power+(level-5)*.47)*affinity));
    }
    function trigger(move,side,holder,effect) {
      const text=kit.byId(holder.gear).name+" · "+effect;
      (move.gearEvents||=[]).push({side,holderId:holder.id,gearId:holder.gear,text});
    }
    function incoming(move,seat,foe,damage) {
      if(damage===foe.hp&&foe.hp>1&&ready(foe,"last-stitch")) {
        trigger(move,seat,foe,label(foe.id)+" holds at 1 HP");
        return foe.hp-1;
      }
      return damage;
    }
    const trait=p=>species[p.id].skills.find(s=>s.kind==="attack"&&s.type===species[p.id].type);
    const recover=(p,fraction)=>Math.min(p.maxHp-p.hp,Math.ceil(p.maxHp*fraction));
    function forecastMoves(p) {
      if(!p||p.phase==="done")return [];
      const side=p.sides[p.turn],other=p.sides[1-p.turn],lead=active(side),foe=active(other);
      const bench=side.team.filter(a=>a.id!==lead.id&&a.hp);
      if(p.phase==="replace")return bench.map(a=>({id:"replace:"+a.id,kind:"replace",targetId:a.id,label:"Send "+label(a.id),
        detail:"Free replacement. "+label(a.id)+" takes your turn immediately.",available:true,reason:""}));
      const moves=species[lead.id].skills.filter(s=>!s.trained).map(skill=>{
        const m={id:"skill:"+skill.id,kind:skill.kind,label:skill.name,type:skill.type,available:true,reason:""};
        if(skill.kind==="heal") {
          m.heal=m.healLead=recover(lead,1/3);
          m.reason=!lead.recovery?"Recovery used this match.":!m.heal?"Already at full HP.":"";
          m.detail="Restore "+m.heal+" HP · "+lead.recovery+" personal recovery left";
        } else {
          const guard=skill.kind==="guard",exploit=foe.exposed&&!guard,breaks=guard&&other.braced;
          const multiplier=exploit?1.5:breaks?1.4:other.cover;
          const lens=!guard&&ready(lead,"prism-lens")&&dex.effectiveness(skill.type,species[foe.id].types)<1;
          if(lens)trigger(m,p.turn,lead,"strike ignores resistance");
          const hit=Math.min(foe.hp,Math.max(1,Math.round(power(skill,foe,lens)*multiplier)));
          m.damage=incoming(m,1-p.turn,foe,hit);
          m.consumeMark=exploit;m.cover=guard?.5:1;
          m.detail=m.damage+" damage"+(exploit?" · uses exposure":breaks?" · breaks brace":other.cover<1?" · into cover":"")+
            (guard?" · halve the next hit":"");
        }
        m.available=!m.reason;
        return m;
      });
      for(const mate of bench) {
        moves.push({id:"swap:"+mate.id,kind:"swap",targetId:mate.id,label:"Switch to "+label(mate.id),
          detail:mate.hp+"/"+mate.maxHp+" HP · takes the lead",available:!side.pinned,reason:side.pinned?"A lure pins your lead this turn.":""});
        const pair=pairs.score(species[lead.id].type,species[mate.id].type),role=pair.role;
        const factor=role==="rush"?1:other.cover;
        const sum=power(trait(lead),foe)+power(trait(mate),foe);
        const m={};
        const hit=incoming(m,1-p.turn,foe,Math.min(foe.hp-(role==="lure"?1:0),Math.max(1,Math.round(sum*.82*pair.strength*factor))));
        const healLead=role==="mend"?recover(lead,.25):0,healPartner=role==="mend"?recover(mate,.25):0;
        const effects=[hit+" damage"];
        if(role==="mend")effects.push("recover "+healLead+" / "+healPartner+" HP");
        if(role==="relay")effects.push(label(mate.id)+" takes the lead");
        if(role==="mark")effects.push("expose the target for +50% on its next incoming strike");
        if(role==="rush")effects.push("pierce cover");
        if(role==="lure")effects.push("leave 1 HP or more and block direct switches for a turn");
        if(pair.counter<1)effects.push(pair.counter===.25?"quarter the next hit":"halve the next hit");
        const reason=side.beats<pair.cost?"Needs "+(pair.cost-side.beats)+" more "+(pair.cost-side.beats===1?"beat.":"beats."):"";
        moves.push({...m,id:"duet:"+mate.id,kind:"duet",label:pair.name,targetId:mate.id,role,roleLabel:pair.label,type:species[mate.id].type,
          available:!reason,reason,cost:pair.cost,damage:hit,heal:healLead+healPartner,healLead,healPartner,cover:pair.counter,
          detail:label(mate.id)+" · "+effects.join(" · ")});
      }
      for(const m of moves) {
        const part=partFor[m.kind];
        m.beatsAfter=m.kind==="duet"?Math.max(0,side.beats-m.cost):Math.min(3,side.beats+(side.lastPart!==part?1:0));
        if(m.available&&m.kind==="swap"&&m.beatsAfter<3){
          const next=bench.find(a=>a.id===m.targetId);
          if(ready(next,"relay-bell")){
            m.beatsAfter++;trigger(m,p.turn,next,"+1 switch beat");
          }
        }
        if(m.consumeMark&&ready(lead,"seam-hook")&&other.beats>0){
          const drain=Math.min(2,other.beats);
          m.rivalBeatsAfter=other.beats-drain;
          trigger(m,p.turn,lead,"remove "+drain+" rival "+(drain===1?"beat":"beats")+" ("+m.rivalBeatsAfter+"/3 left)");
        }
        if(m.kind==="guard"&&ready(lead,"mender-wrap")){
          const injured=bench.filter(a=>a.hp<a.maxHp);
          const ally=injured.reduce((best,a)=>!best||a.hp*best.maxHp<best.hp*a.maxHp?a:best,null);
          if(ally){
            const amount=recover(ally,.2);
            m.reserveHeal={id:ally.id,amount};m.heal=amount;
            trigger(m,p.turn,lead,label(ally.id)+" recovers "+amount+" HP");
          }
        }
        if(m.available&&m.beatsAfter!==side.beats)m.detail+=" · "+m.beatsAfter+"/3 beats after";
        if(m.gearEvents)m.detail+=" · "+m.gearEvents.map(event=>event.text).join(" · ");
      }
      if(signatures){
        moves.push(...signatures.options(side,bench,label));
        if(other.thornRead)for(const move of moves)signatures.forecastResponse(move,side,other,label);
      }
      return moves;
    }
    function step(p,m,keepLog) {
      const sides=p.sides.map(s=>({...s,team:s.team.map(a=>({...a}))}));
      const next={...p,sides},side=sides[p.turn],other=sides[1-p.turn],lead=active(side),foe=active(other);
      const slot=side.team.findIndex(a=>a.id===m.targetId);
      if(m.kind==="replace") {
        side.active=slot;next.phase="move";
      } else {
        side.pinned=false;
        side.cover=m.cover||1;side.braced=m.kind==="guard";
        other.cover=1;other.braced=false;
        if(m.damage)foe.hp-=m.damage;
        if(m.consumeMark)foe.exposed=false;
        if(m.role==="lure")other.pinned=true;
        if(m.role==="mark"&&foe.hp)foe.exposed=true;
        if(m.kind==="heal")lead.recovery=0;
        if(m.healLead)lead.hp+=m.healLead;
        if(m.healPartner)side.team[slot].hp+=m.healPartner;
        if(m.reserveHeal)side.team.find(a=>a.id===m.reserveHeal.id).hp+=m.reserveHeal.amount;
        if(m.rivalBeatsAfter!==undefined)other.beats=m.rivalBeatsAfter;
        if(m.gearEvents)for(const e of m.gearEvents)sides[e.side].team.find(a=>a.id===e.holderId).spent=true;
        if(m.kind==="swap"||m.role==="relay")side.active=slot;
        side.beats=m.beatsAfter;side.lastPart=partFor[m.kind]||null;
        if(m.signatureId||other.thornRead)signatures.resolve(m,lead,side,other,slot);
        next.ply++;next.turn=1-p.turn;
        next.winner=verdict(next);next.phase=next.winner!==null?"done":foe.hp?"move":"replace";
        if(next.phase==="done"&&side.thornRead)delete side.thornRead;
      }
      if(keepLog) {
        const drop=m.damage&&!foe.hp?" · "+label(foe.id)+" falls":"";
        const line="Side "+(p.turn+1)+" · "+label(lead.id)+" · "+m.label+" · "+m.detail+drop;
        next.log=[...p.log.slice(-7),line];
      }
      return next;
    }
    const forecast=(p,id)=>forecastMoves(p).find(m=>m.id===id)||null;
    function apply(p,id) {
      const m=forecast(p,id);
      return m?.available?step(p,m,true):null;
    }

    // Three actual actions, including the opponent's strongest visible reply. Replacements cost no depth.
    function value(p,root) {
      if(p.winner!==null)return p.winner==="draw"?0:(p.winner===root?1:-1)*(10000-p.ply);
      function quality(s,foe) {
        const leader=active(s),target=active(foe);
        const health=hpShare(s),alive=standing(s);
        const tempo=leader.hp&&target.hp?Math.max(...species[leader.id].skills.filter(k=>k.kind==="attack").map(k=>power(k,target))):0;
        const reserves=s.team.reduce((n,a)=>n+(a.hp&&a.recovery?Math.min(.33,a.hp/a.maxHp)*10:0)-(a.hp&&a.exposed?4:0),0);
        // The judges count remaining kin before health when the final bell is close.
        const countWeight=p.ply<limit-5?28:100;
        return 100*health+alive*countWeight+tempo*.48+s.beats*4.4+reserves+(1-s.cover)*4-(s.pinned?2:0);
      }
      return quality(p.sides[root],p.sides[1-root])-quality(p.sides[1-root],p.sides[root]);
    }
    function search(p,depth,root,alpha,beta) {
      if(p.phase==="done"||depth===0&&p.phase!=="replace")return {score:value(p,root)};
      const maximize=p.turn===root;
      const options=forecastMoves(p).filter(m=>m.available);
      let best={score:maximize?-Infinity:Infinity};
      for(const move of options) {
        const child=step(p,move,false);
        const line=search(child,depth-(move.kind==="replace"?0:1),root,alpha,beta);
        if(maximize?line.score>best.score:line.score<best.score)best={score:line.score,move,reply:line.move,follow:line.reply};
        if(maximize)alpha=Math.max(alpha,best.score);else beta=Math.min(beta,best.score);
        if(beta<=alpha)break;
      }
      return best;
    }
    function recommend(p) {
      if(!p||p.phase==="done")return null;
      const line=search(p,3,p.turn,-Infinity,Infinity),m=line.move;
      let why="This settles the match.";
      if(m.kind==="replace")why="Take the free replacement, then try "+line.reply.label+".";
      else if(line.reply?.kind==="replace")why="The coach expects "+line.reply.label+" in response"+(line.follow?", followed by "+line.follow.label:"")+".";
      else if(line.reply)why="If they use "+line.reply.label+(line.follow?", answer with "+line.follow.label: ", the match ends")+".";
      return {...m,why};
    }
    return {rules,start,restore,maxHp:id=>valid(id)?maxHp(id):null,options:forecastMoves,forecast,apply,recommend};
  }
  window.WilderSparringBattle={create,rules};
})();
