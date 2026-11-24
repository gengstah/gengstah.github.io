// The first Opalclasp lesson uses the player's campaign party and legal battle commands.
(() => {
  "use strict";
  function create({game,row,image}){
    const battle=()=>{
      const b=game.state.battle;
      return b?.firstBattle&&b.kind==="wild"&&b.enemy.id==="opalclasp"?b:null;
    };
    const name=id=>game.kin(id,{owned:true}).name;
    const plainName=id=>game.kin(id,{owned:false}).name;
    const caller=b=>game.team().find(k=>k.id===b.activeId);
    const primary={tone:"primary"};
    function recap(last,foe){
      if(!last?.text)return null;
      const theirHp=last.outcome==="recruited"?plainName(foe)+" had "+last.foeHp+" HP at the catch":plainName(foe)+" "+last.foeHp+" HP";
      return {title:"Turn "+last.turn+" · last exchange",text:last.text+" "+name(last.activeId)+" "+last.activeHp+" HP · "+theirHp+"."};
    }
    function feedback(){
      const b=battle();
      return b?recap(b.firstBattle.last,b.enemy.id):null;
    }
    const before=battle;
    function after(s,result){
      if(!s||!result?.ok)return null;
      return feedback()||recap(result.firstBattle,s.enemy.id);
    }
    function commandSkills(id){
      return game.kin(id,{owned:true}).skills.filter(s=>!s.trained).map(s=>game.ordinaryForecast(s.id)).filter(p=>p?.available);
    }
    function skillRow(p,lead){
      const hp=lead.hp+p.healing-p.returnDamage,what=p.skill.kind==="heal"?"Recover "+p.healing+" HP":"Deal "+p.damage+" damage";
      return row("skill",p.skill.name,p.skill.id,what+" · "+(p.finishes?"win before the reply":"take "+p.returnDamage+" · "+hp+"/"+lead.maxHp+" HP"),
        {badge:p.skill.kind==="attack"?"STRIKE":p.skill.kind==="heal"?"RECOVER":"GUARD",...(p.finishes?primary:{})});
    }
    function capture(foe){
      return row("capture","Befriend "+foe,null,"Offer 1 Kinweave · "+game.state.bag.kinweave+" in your satchel.",primary);
    }
    function duetRows(b,lead,d){
      const team=game.team();
      return d.options.filter(o=>o.available).map(o=>{
        const partner=team.find(p=>p.id===o.partnerId),receiver=o.switchLead?partner:lead;
        const hp=receiver.hp+(o.switchLead?o.healPartner:o.healLead)-o.returnDamage;
        const third=team.find(p=>p.hp>0&&p.id!==lead.id&&p.id!==partner.id);
        return {o,partner,follow:!!third&&hp>0&&o.damage<b.enemy.hp,third,receiver,hp};
      }).sort((a,z)=>Number(z.follow)-Number(a.follow)||Number(z.hp>0)-Number(a.hp>0)||a.o.cost-z.o.cost);
    }
    function duetRow(p){
      const {o,partner,receiver,hp}=p,notes=[o.cost+" beats",o.damage+" damage"];
      if(o.healLead||o.healPartner)notes.push("heal "+o.healLead+" / "+o.healPartner+" HP");
      if(o.switchLead)notes.push(name(partner.id)+" takes the lead");
      notes.push(name(receiver.id)+" takes "+o.returnDamage+" → "+hp+"/"+receiver.maxHp+" HP");
      return row("duet",o.name+" with "+name(partner.id),partner.id,notes.join(" · "),{image:image(partner.id)});
    }
    function trioRow(o){
      const effect=o.role==="heal"?"Recover "+o.healing+" HP":"Deal "+o.damage+" damage";
      return row("trio",o.kinName+" · "+o.name,o.id+"|"+o.skill,effect+" · "+
        (o.finishes?"win before the reply":"take "+o.returnDamage+" · "+o.hpAfter+"/"+o.maxHp+" HP"),
        {image:image(o.id),badge:o.role.toUpperCase()+" · 0 BEATS"});
    }
    function safeSwitch(lead){
      const safe=game.team().filter(p=>p.id!==lead.id&&p.hp>0)
        .map(p=>({p,f:game.switchForecast(p.id)})).filter(o=>o.f.available&&o.f.hpAfter>0)
        .sort((a,z)=>z.f.hpAfter-a.f.hpAfter)[0];
      return safe?row("swap","Switch to "+name(safe.p.id),safe.p.id,"Take "+safe.f.damage+" on entry · "+safe.f.hpAfter+"/"+safe.p.maxHp+" HP",{image:image(safe.p.id)}):null;
    }
    function medicine(lead){
      for(const id of ["balm","tonic"]){
        const f=game.itemForecast(id,lead.id);
        if(f.available&&f.activeHpAfter>0)return row("use-item",game.items[id].name,id+"|"+lead.id,
          "Restore "+f.gain+" HP · take "+f.returnDamage+" · "+f.activeHpAfter+"/"+f.activeMaxHp+" HP",{badge:game.state.bag[id]+" PACKED"});
      }
      return null;
    }
    function section(){
      const b=battle();if(!b||b.pendingFallen||b.wildCall?.answered)return null;
      const lead=caller(b),me=name(lead.id),foe=plainName(b.enemy.id),intent=game.foeIntent(),d=game.duets(),canCatch=game.captureStatus().available;
      const section=(title,text,rows)=>({title,text,rows,columns:1,lastExchange:feedback()?.text||null});
      const t=game.trio?.();
      if(t){
        const available=t.options.filter(o=>o.available);
        const strike=available.filter(o=>o.role==="attack").sort((a,z)=>z.damage-a.damage)[0];
        const safe=available.filter(o=>o!==strike).sort((a,z)=>z.hpAfter/z.maxHp-a.hpAfter/a.maxHp||z.damage-a.damage)[0];
        const moves=[strike,safe].filter(Boolean);
        if(moves.length)return section("Pass the lead",name(t.source)+" and "+name(t.partner)+" opened a trio. Send in a third kin"+
          (intent.charged?" against a charged "+intent.skill.name: " to use a skill this turn")+".",
          [...moves.map(trioRow),...(canCatch?[capture(foe)]:[])]);
      }
      const options=commandSkills(lead.id),attack=options.filter(o=>o.skill.kind==="attack").sort((a,z)=>z.damage-a.damage)[0];
      const guard=options.find(o=>o.skill.kind==="guard"),heal=options.find(o=>o.skill.kind==="heal");
      const pairs=duetRows(b,lead,d),next=pairs.find(p=>p.follow);
      if(b.turn>1&&!b.trioUsed&&next){
        return section("Call a duet",d.beats+" of "+d.max+" beats. "+name(next.third.id)+" can take the next turn after "+next.o.name+".",
          [...pairs.slice(0,2).map(duetRow),...(canCatch?[capture(foe)]:[])]);
      }
      const danger=!options.some(o=>o.skill.kind!=="heal"&&(o.finishes||lead.hp>o.returnDamage));
      if(danger){
        const escape=safeSwitch(lead),recovery=medicine(lead)||(heal&&lead.hp+heal.healing>heal.returnDamage?skillRow(heal,lead):null);
        const safe=[escape,recovery,canCatch?capture(foe):null].filter(Boolean);
        if(safe.length)return section("Keep the party standing",me+" has "+lead.hp+" HP. Even a guarding hit would leave it fainted after "+intent.skill.name+".",safe);
      }
      if(canCatch){
        const strike=options.filter(o=>o.skill.kind!=="heal").sort((a,z)=>Number(z.finishes)-Number(a.finishes)||z.damage-a.damage)[0];
        return section("Invite "+foe+" or keep battling",foe+" is at "+b.enemy.hp+"/"+b.enemy.maxHp+" HP. A Kinweave will bring it into your "+(game.team().length<6?"traveling party.":"reserve."),
          [capture(foe),...(strike?[skillRow(strike,lead)]:[])]);
      }
      const basic=[attack,guard].filter(Boolean);
      if(heal&&(!guard||lead.hp<=(guard?.returnDamage||0)))basic.push(heal);
      const call=game.wildCall?.(),answer=call?.options?.find(o=>o.actor===lead.id&&o.available);
      const prompt=foe+" is preparing "+(intent.charged?"a charged ":"")+intent.skill.name+". ";
      const why=basic.some(o=>o.finishes)?"A finishing hit ends the encounter.":b.trioUsed?"Choose how hard to hit and how much of the reply to take.":
        b.lastPart&&b.beats<3?"Change between striking and guarding to earn another duet beat.":
        b.turn===1&&b.beats<3?"Strike or guard to earn a beat for a duet.":"A guard reduces the reply while dealing damage.";
      return section(b.turn===1?me+"’s opening":"Choose your next move",prompt+why,[
        ...basic.slice(0,answer?2:3).map(o=>skillRow(o,lead)),...(answer?[row("answer-call",answer.name+" · answer the call",answer.skill+(answer.partner?"|"+answer.partner:""),"Let "+foe+" approach without a hit.")]:[])]);
    }
    return {section,feedback,before,after};
  }
  window.WilderFirstBattleCoach=Object.freeze({create});
})();
