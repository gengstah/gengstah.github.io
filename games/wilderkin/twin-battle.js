// Two active kin on each side commit their orders before either side moves.
(() => {
  "use strict";
  const limit=24,lanes=[0,1];
  const lead=(side,lane)=>side.active[lane]==null?null:side.team[side.active[lane]];
  const reserve=(side,p,i)=>p.hp>0&&!side.active.includes(i);
  const ready=(p,id)=>p.gear===id&&!p.spent;
  const laneName=i=>i===0?"West":"East";
  const gain=(side,n=1)=>{side.beats=Math.min(3,side.beats+n);};
  const roundHeal=(p,fraction)=>Math.min(p.maxHp-p.hp,Math.ceil(p.maxHp*fraction));
  const byPriority={swap:0,cover:1,call:2,attack:3,duet:3};
  function copyPosition(pos){
    return {...pos,sides:pos.sides.map(s=>({...s,active:s.active.slice(),team:s.team.map(k=>({...k}))}))};
  }
  function create({game}){
    const species=game.species,gear=window.WilderSparringGear,dex=window.WilderKinDex,pairs=window.WilderDuets;
    const known=id=>typeof id==="string"&&Object.hasOwn(species,id)&&!species[id].bonus;
    const valid=c=>Array.isArray(c?.ids)&&c.ids.length===4&&new Set(c.ids).size===4&&[...c.ids].every(known);
    const name=p=>species[p.id].name;
    const moves=p=>species[p.id].skills.filter(s=>s.kind==="attack"&&!s.trained);
    const native=p=>moves(p).find(s=>s.type===species[p.id].type)||moves(p)[0];
    const power=(skill,foe,neutral=false)=>Math.max(1,Math.round((skill.power+7.05)*(neutral?1:dex.effectiveness(skill.type,species[foe.id].types))));
    function start(left,right){
      if(!valid(left)||!valid(right))return null;
      const fitted=gear.validate({left:left.gear===undefined?{}:left.gear,right:right.gear===undefined?{}:right.gear},left.ids,right.ids);
      if(!fitted)return null;
      return {round:1,phase:"plan",winner:null,sides:[left,right].map((card,side)=>{
        const items=side?fitted.right:fitted.left;
        const team=card.ids.map(id=>{
          const maxHp=species[id].baseHp+45;
          return {id,hp:maxHp,maxHp,...(items[id]?{gear:items[id],spent:false}:{})};
        });
        const pennant=ready(team[0],"opening-pennant");
        if(pennant)team[0].spent=true;
        return {active:[0,1],team,beats:pennant?1:0};
      })};
    }
    const reduceHit=(foe,damage,lure=false)=>{
      const hit=Math.min(foe.hp-(lure?1:0),damage);
      return hit===foe.hp&&foe.hp>1&&ready(foe,"last-stitch")?hit-1:hit;
    };
    function ordinary(actor,skill,foe,cover,open){
      const affinity=dex.effectiveness(skill.type,species[foe.id].types),lens=affinity<1&&ready(actor,"prism-lens");
      const raw=Math.max(1,Math.round(power(skill,foe,lens)*(open?1.5:cover)));
      return {raw,damage:reduceHit(foe,raw),affinity,lens};
    }
    function combined(first,mate,foe,pair,cover){
      const sum=power(native(first),foe)+power(native(mate),foe);
      return Math.max(1,Math.round(sum*.82*pair.strength*(pair.role==="rush"?1:cover)));
    }
    function options(pos,seat,lane,draft=[null,null]){
      if(pos?.phase!=="plan"||!lanes.includes(seat)||!lanes.includes(lane)||!Array.isArray(draft))return [];
      const side=pos.sides[seat],foes=pos.sides[1-seat],p=lead(side,lane);
      if(!p?.hp)return [];
      const mate=lead(side,1-lane),partner=typeof draft[1-lane]==="string"?draft[1-lane]:"",rows=[];
      const add=(item,reason="")=>rows.push({...item,available:!reason,reason});
      for(const target of lanes){
        const foe=lead(foes,target);
        if(!foe?.hp)continue;
        const dest=laneName(target)+" · "+name(foe);
        for(const skill of moves(p)){
          const partnerFirst=lane===1,westStrikesHere=partnerFirst&&partner.startsWith("attack:")&&partner.endsWith(":"+target);
          const westMarksHere=partnerFirst&&mate&&partner==="duet:"+target&&
            pairs.score(species[mate.id].type,species[p.id].type).role==="mark";
          const open=partner==="call:"+target||westMarksHere||!!foe.exposed&&!westStrikesHere;
          const {damage,affinity,lens}=ordinary(p,skill,foe,1,open);
          add({id:"attack:"+skill.id+":"+target,label:skill.name+" → "+dest,skillId:skill.id,type:skill.type,
            detail:damage+" damage projected against the current target"+(open?" · exposed ×1.5":"")+(lens?" · Prism Lens ignores resistance":affinity>1?" · strong":affinity<1?" · resisted":""),
            kind:"attack",target,targetId:foe.id,damage});
        }
        add({id:"call:"+target,label:"Call the line → "+dest,detail:"After switches, your partner’s next ordinary strike on this target gets +50% and ignores cover this round. Gain up to 1 beat.",
          kind:"call",target,targetId:foe.id},mate?.hp?"":"A partner must be standing in the other lane.");
        if(lane===0&&mate?.hp){
          const pair=pairs.score(species[p.id].type,species[mate.id].type);
          const damage=reduceHit(foe,combined(p,mate,foe,pair,1),pair.role==="lure");
          const effect={ward:"Your lane takes quarter damage from later unpierced hits.",mend:"Both active kin recover up to 25% HP.",
            relay:"Trade lanes. Your partner takes half damage from later unpierced hits in your former lane.",lure:"Leave at least 1 HP and pin this foe through next round. Halve later unpierced hits on your lane.",
            mark:"A survivor is exposed for the next ordinary strike, even after a switch.",rush:"Pierce cover."}[pair.role];
          add({id:"duet:"+target,label:pair.name+" → "+dest,detail:pair.cost+" beats · "+damage+" damage projected against the current target. "+effect,
            kind:"duet",target,targetId:foe.id,role:pair.role,cost:pair.cost,damage},
          side.beats<pair.cost?"Needs "+pair.cost+" beats at the start of the round.":
            partner?.startsWith("swap:")?"Both duet partners must stay in the ring.":"");
        }
      }
      for(const target of lanes){
        const ally=lead(side,target);if(!ally?.hp)continue;
        add({id:"cover:"+target,label:"Cover "+laneName(target)+" · "+name(ally),detail:"Halve incoming hits to this lane for the round. Exposed strikes and breakthrough duets pierce cover. Gain up to 1 beat.",
          kind:"cover",target,targetId:ally.id});
      }
      side.team.forEach((incoming,i)=>{
        if(!reserve(side,incoming,i))return;
        const reason=p.pinnedUntil>=pos.round?"A lure pins this kin for this round.":
          partner==="swap:"+incoming.id?"Your other lane already chose this reserve.":
          partner?.startsWith("duet:")?"Both duet partners must stay in the ring.":"";
        add({id:"swap:"+incoming.id,label:"Switch to "+name(incoming),kind:"swap",targetId:incoming.id,
          detail:incoming.hp+"/"+incoming.maxHp+" HP · takes this lane before calls and strikes. Gain up to 1 beat."},reason);
      });
      return rows;
    }
    function selected(pos,seat,ids){
      if(!Array.isArray(ids)||ids.length!==2)return null;
      const found=[];
      for(const lane of lanes){
        if(!lead(pos.sides[seat],lane)?.hp){if(ids[lane]!==null)return null;continue;}
        if(typeof ids[lane]!=="string"||ids[lane].length>100)return null;
        const candidate=options(pos,seat,lane,ids).find(m=>m.id===ids[lane]&&m.available);
        if(!candidate)return null;
        found.push({seat,lane,move:candidate,index:pos.sides[seat].active[lane]});
      }
      return found;
    }
    function verdict(sides,round){
      const living=sides.map(s=>s.team.filter(p=>p.hp>0).length);
      if(living.every(Boolean)&&round<limit)return null;
      if(living[0]!==living[1])return living[0]>living[1]?0:1;
      const values=sides.map(s=>s.team.reduce((sum,p)=>sum+p.hp/p.maxHp,0));
      return Math.abs(values[0]-values[1])<1e-12?"draw":values[0]>values[1]?0:1;
    }
    function resolve(pos,orders0,orders1,settings){
      if(pos?.phase!=="plan")return null;
      const left=selected(pos,0,orders0),right=selected(pos,1,orders1);
      if(!left||!right)return null;
      const next=copyPosition(pos),frames=settings?.frames===true?[]:null;
      const sides=next.sides,round=pos.round,first=round%2?0:1,events=[];
      const cover=[[1,1],[1,1]],calls=[new Map(),new Map()];
      const emit=(side,lane,kind,text,extra={})=>{
        const event={side,lane,kind,text,...extra};
        events.push(event);
        if(frames)frames.push({event:{...event},pos:copyPosition(next)});
      };
      const spend=(side,lane,p,effect)=>{
        p.spent=true;
        emit(side,lane,"gear",name(p)+" · "+gear.byId(p.gear).name+" · "+effect,{gearId:p.gear,actor:p.id});
      };
      const hurt=(side,lane,foe,raw,lure)=>{
        const hit=reduceHit(foe,raw,lure);
        const stitched=!lure&&raw>=foe.hp&&foe.hp>1&&ready(foe,"last-stitch");
        foe.hp-=hit;
        if(stitched)spend(side,lane,foe,"held at 1 HP.");
        return hit;
      };
      const heal=(p,side,lane,n)=>{
        if(!n)return;
        p.hp+=n;emit(side,lane,"heal",name(p)+" recovered "+n+" HP.",{heal:n,targetId:p.id});
      };
      // A duet is purchased from opening beats. Later support can refill the meter.
      for(const orders of [left,right]){
        const duet=orders.find(e=>e.move.kind==="duet");
        if(duet)sides[duet.seat].beats-=duet.move.cost;
      }
      const sequence=left.concat(right).sort((a,b)=>byPriority[a.move.kind]-byPriority[b.move.kind]||a.lane-b.lane||(a.seat===first?-1:1));
      for(const {seat,lane:orderedLane,index,move} of sequence){
        const side=sides[seat],away=1-seat,other=sides[away],p=side.team[index],lane=side.active.indexOf(index),target=move.target;
        const prefix=name(p)+" · ",kind=move.kind;
        if(!p.hp||lane===-1){
          emit(seat,orderedLane,"miss",prefix+"could not act after leaving the ring.",{actor:p.id});continue;
        }
        if(kind==="swap"){
          const n=side.team.findIndex(k=>k.id===move.targetId),incoming=side.team[n];
          side.active[lane]=n;gain(side);
          emit(seat,lane,kind,name(incoming)+" switched into the "+laneName(lane)+" lane"+" for "+name(p)+".",{actor:p.id,targetId:incoming.id});
          if(side.beats<3&&ready(incoming,"relay-bell")){gain(side);spend(seat,lane,incoming,"gained an extra beat.");}
          continue;
        }
        if(kind==="cover"){
          const before=side.beats;
          cover[seat][target]=Math.min(.5,cover[seat][target]);gain(side);
          emit(seat,lane,kind,prefix+"covered the "+laneName(target)+" lane"+(side.beats>before?" and gained a beat.":"."),{actor:p.id,target,beatsGained:side.beats-before});
          if(ready(p,"mender-wrap")){
            const hurtReserve=side.team.filter((k,i)=>reserve(side,k,i)&&k.hp<k.maxHp)
              .sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
            if(hurtReserve){spend(seat,lane,p,"mended a reserve.");heal(hurtReserve,seat,lane,roundHeal(hurtReserve,.2));}
          }
          continue;
        }
        const foe=lead(other,target);
        if(!foe?.hp){
          emit(seat,lane,"miss",prefix+"found no standing foe in the "+laneName(target)+" lane.",{actor:p.id,target});continue;
        }
        if(kind==="call"){
          const mate=lead(side,1-lane);
          if(mate?.hp){
            calls[seat].set(mate.id,foe.id);gain(side);
            emit(seat,lane,kind,prefix+"called "+name(foe)+" for "+name(mate)+"’s strike.",{actor:p.id,target,targetId:foe.id});
          }
          continue;
        }
        let hit;
        if(kind==="attack"){
          const open=!!foe.exposed||calls[seat].get(p.id)===foe.id;
          const skill=moves(p).find(s=>s.id===move.skillId);
          const {raw,lens}=ordinary(p,skill,foe,cover[away][target],open);
          if(lens)spend(seat,lane,p,"struck through resistance.");
          hit=hurt(away,target,foe,raw,false);
          if(open){
            delete foe.exposed;calls[seat].delete(p.id);
            if(other.beats&&ready(p,"seam-hook")){
              const take=Math.min(2,other.beats);other.beats-=take;spend(seat,lane,p,"removed "+take+" opposing beats.");
            }
          }
          emit(seat,lane,kind,prefix+skill.name+" hit "+name(foe)+" for "+hit+" HP"+(open?" through the opening.":"."),
            {actor:p.id,target,targetId:foe.id,damage:hit,exposed:open});
        }else{
          const mate=lead(side,1-lane);
          if(!mate?.hp){
            emit(seat,lane,"miss",prefix+"lost its duet partner before the strike.",{actor:p.id,target});continue;
          }
          const pair=pairs.score(species[p.id].type,species[mate.id].type),role=pair.role;
          hit=hurt(away,target,foe,combined(p,mate,foe,pair,cover[away][target]),role==="lure");
          emit(seat,lane,kind,prefix+pair.name+" hit "+name(foe)+" for "+hit+" HP.",{actor:p.id,target,targetId:foe.id,damage:hit,role});
          if(role==="ward"||role==="relay"||role==="lure")cover[seat][lane]=Math.min(cover[seat][lane],pair.counter);
          if(role==="mend"){
            heal(p,seat,lane,roundHeal(p,.25));
            heal(mate,seat,1-lane,roundHeal(mate,.25));
          }
          if(role==="relay"){
            side.active.reverse();
            emit(seat,lane,"relay",name(mate)+" took the "+laneName(lane)+" lane under cover. "+name(p)+" crossed to the other lane.",{actor:mate.id});
          }
          if(foe.hp&&role==="mark"){foe.exposed=true;emit(away,target,"mark",name(foe)+" is exposed for the next ordinary strike.",{targetId:foe.id});}
          if(foe.hp&&role==="lure"){foe.pinnedUntil=round+1;emit(away,target,"pin",name(foe)+" cannot switch next round.",{targetId:foe.id});}
        }
        if(!foe.hp)emit(away,target,"fall",name(foe)+" fell in the "+laneName(target)+" lane.",{targetId:foe.id});
      }
      for(const seat of lanes){
        const side=sides[seat];
        for(const lane of lanes)if(!lead(side,lane)?.hp)side.active[lane]=null;
        for(const lane of lanes){
          if(side.active[lane]!==null)continue;
          const i=side.team.findIndex((k,n)=>reserve(side,k,n));
          if(i>=0){
            side.active[lane]=i;emit(seat,lane,"promote",name(side.team[i])+" filled the "+laneName(lane)+" lane from the bench.",{targetId:side.team[i].id});
          }
        }
        for(const k of side.team)if(k.pinnedUntil<=round)delete k.pinnedUntil;
      }
      next.winner=verdict(sides,round);
      if(next.winner===null)next.round++;
      else next.phase="done";
      // Every frame follows one public event. The last also includes end-of-round adjudication.
      if(frames&&frames.length)frames[frames.length-1].pos=copyPosition(next);
      return frames?{pos:next,events,frames}:{pos:next,events};
    }
    function coach(pos,seat){
      if(pos?.phase!=="plan"||!lanes.includes(seat))return [null,null];
      const side=pos.sides[seat],other=pos.sides[1-seat];
      const allies=lanes.map(i=>lead(side,i)),foes=lanes.map(i=>lead(other,i));
      const threats=p=>foes.filter(k=>k?.hp).reduce((sum,k)=>sum+Math.max(...moves(k).map(s=>ordinary(k,s,p,1,false).damage)),0);
      const danger=allies.map(p=>p?threats(p):0);
      const threatOnEntry=new Map(side.team.filter((k,i)=>reserve(side,k,i)).map(k=>[k.id,threats(k)]));
      const choices=lanes.map(i=>allies[i]?options(pos,seat,i).filter(m=>m.available):[null]);
      let best=-Infinity,orders=[null,null];
      for(const a of choices[0])for(const b of choices[1]){
        if(a?.kind==="swap"&&b?.kind==="swap"&&a.targetId===b.targetId||a?.kind==="duet"&&b?.kind==="swap")continue;
        // The coach scores its two orders together. It has no access to the opponent's draft.
        const pair=[a,b],hits=[0,0],braced=new Set();let score=0,support=0;
        for(const lane of lanes){
          const m=pair[lane];if(!m)continue;
          const actor=allies[lane],foe=foes[m.target],friend=pair[1-lane];
          switch(m.kind){
            case "attack":{
              const opened=friend?.kind==="call"&&friend.target===m.target&&!foe.exposed;
              const quantity=opened?ordinary(actor,moves(actor).find(s=>s.id===m.skillId),foe,1,true).damage:m.damage;
              hits[m.target]+=quantity;
              if(opened&&ready(actor,"seam-hook"))score+=Math.min(2,other.beats)*4;
              break;
            }
            case "duet":
              hits[m.target]+=m.damage;
              if(m.role==="mend")score+=allies.reduce((n,k)=>n+roundHeal(k,.25),0)*.85;
              if(m.role==="mark"&&m.damage<foe.hp)score+=5;
              if(m.role==="ward"||m.role==="relay"||m.role==="lure")score+=4;
              score-=m.cost*2;break;
            case "cover":
              if(!braced.has(m.target)){
                // Protect a vulnerable ally once. Repeating cover on both lanes cannot advance a bout.
                const k=allies[m.target];
                const weight=k.hp<=danger[m.target] ? .36 : .13;
                score+=danger[m.target]*weight;
                if(ready(actor,"mender-wrap"))score+=Math.max(0,...side.team.map((k,i)=>reserve(side,k,i)?roundHeal(k,.2):0))*.75;
                braced.add(m.target);
              }
              support++;break;
            case "swap":{
              const incoming=side.team.find(k=>k.id===m.targetId);
              const remaining=threatOnEntry.get(incoming.id);
              score+=(danger[lane]-remaining)*.48+(actor.hp<danger[lane]&&incoming.hp>remaining?5:0);
              if(ready(incoming,"relay-bell")&&side.beats<2)score+=2;
              support++;break;
            }
            case "call":support++;break;
          }
        }
        for(const i of lanes){
          if(!foes[i]||!hits[i])continue;
          score+=Math.min(foes[i].hp,hits[i])+(hits[i]>=foes[i].hp?18:4*hits[i]/foes[i].maxHp);
        }
        score+=Math.min(3-side.beats,support)*3;
        if(!hits.some(Boolean))score-=28;
        if(score>best){best=score;orders=[a?.id??null,b?.id??null];}
      }
      return orders;
    }
    return Object.freeze({start,options,coach,resolve,limit});
  }
  window.WilderTwinBattle=Object.freeze({create});
})();
