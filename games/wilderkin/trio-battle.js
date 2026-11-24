// Campaign and Chalkyard use the same hands-on trio choices and field forecasts.
(() => {
  "use strict";
  const teaching="Use a duet with two companions. On the next turn, a third can take the lead and use one of its own skills.";
  const group=(title,rows)=>({title,rows});
  function create({row,image}){
    const kin=(g,id)=>g.kin(id,{owned:true});
    const portrait=(g,id)=>{
      const k=kin(g,id);
      return k.appearanceId&&k.appearanceId!==id?"art/growth/"+k.appearanceId+".png":image(id,false);
    };
    function offer(g){
      const b=g.state.battle;
      return typeof g.trio==="function"&&b&&["wild","warden","expedition"].includes(b.kind)&&!b.secondBell&&
        !b.trioUsed&&!b.pendingFallen&&!b.wildCall?.answered&&g.team().filter(k=>k.hp>0).length>=3;
    }
    function forecast(g,o){
      if(!o.available)return o.reason||"This skill is unavailable.";
      const b=g.state.battle,foe=g.kin(b.enemy.id,{owned:false}).name;
      const parts=[o.role==="heal"?"Heal "+o.healing+" HP":"Deal "+o.damage+" damage"];
      if(o.finishes)parts.push(foe+" falls before replying");
      else{
        parts.push(foe+" "+o.foeHpAfter+"/"+b.enemy.maxHp+" HP");
        parts.push("take "+o.returnDamage+" in reply");
      }
      parts.push(o.kinName+" "+o.hpAfter+"/"+o.maxHp+" HP");
      if(o.foeAfter&&o.foeAfter!==b.enemy.id)parts.push(g.kin(o.foeAfter,{owned:false}).name+" comes forward");
      if(o.activeAfter&&o.activeAfter!==o.id)parts.push(kin(g,o.activeAfter).name+" takes the lead");
      const fittings=(o.fittingEvents||[]).map(e=>e.preview||e.text).filter(Boolean);
      return parts.join(" · ")+(fittings.length?". "+fittings.join(" "):"");
    }
    function choices(g,t=g.trio?.()){
      if(!t)return [];
      return t.options.map(o=>({id:o.id,skillId:o.skill,skillName:o.name,label:o.kinName+" · "+o.name,role:o.role,type:o.type,
        available:o.available,reason:o.reason,detail:forecast(g,o),image:portrait(g,o.id),
        source:t.source,partner:t.partner,beatsAfter:o.beatsAfter,outcome:o.outcome}));
    }
    function choice(g,value){
      if(typeof value!=="string")return null;
      return choices(g).find(o=>o.available&&value===o.id+"|"+o.skillId)||null;
    }
    function entry(g,scope="campaign",t=g.trio?.()){
      if(!t&&!offer(g))return null;
      const available=t?.options.filter(o=>o.available)||[],actors=[...new Set(available.map(o=>o.kinName))];
      const detail=t?(actors.length?"Choose "+actors.join(" or ")+" to take the lead and use a skill this turn.":"Check the third companion’s available skills."):teaching;
      return row(scope==="practice"?"rehearse-view":"nav",t?"Finish the trio":"How to use a trio","trios",detail,
        {key:"T",...(t?{tone:"primary"}:{})});
    }
    function model(g,scope="campaign",t=g.trio?.()){
      const practice=scope==="practice",nav=practice?"rehearse-view":"nav",back=row(nav,"Back to the battle","battle");
      if(!t){
        const allowed=offer(g);
        return {title:"Trail trios",kicker:"TEAM COMMAND",subtitle:allowed?teaching:"There is no trio opening this turn.",
          sections:[group("On the field",[...(allowed?[row(nav,"Choose a duet","duets","The third companion must be conscious and outside the duet.",{tone:"primary"})]:[]),back])]};
      }
      const source=kin(g,t.source).name,partner=kin(g,t.partner).name,groups=new Map();
      for(const o of choices(g,t)){
        if(!groups.has(o.id))groups.set(o.id,[]);
        const value=o.id+"|"+o.skillId;
        const meter=o.outcome==="victory"?" · wins the battle":o.available?" · "+o.beatsAfter+(o.beatsAfter===1?" beat":" beats")+" after":"";
        groups.get(o.id).push(row(practice?"rehearse-move":"trio",o.label,practice?"useTrio|"+value:value,o.detail,
          {image:o.image,disabled:!o.available,badge:o.type+" "+o.role+meter}));
      }
      return {title:"Finish the trio",kicker:"TURN "+t.turn+"   /   "+t.cost+" BEATS TO USE   /   ONCE PER BATTLE",
        subtitle:source+" and "+partner+" used "+t.duet+". Choose a third companion’s skill this turn to bring it into the lead.",
        sections:[...Array.from(groups,([id,rows])=>group(kin(g,id).name+" takes the lead",rows)),group("Other moves",[back])]};
    }
    function effect(g,o){
      const p=g.team().find(k=>k.id===o.id),k=kin(g,o.id),src=portrait(g,o.id);
      return {kind:"trio",side:"ally",name:o.label,skillName:o.skillName,type:o.type,role:o.role,source:portrait(g,o.source),partner:portrait(g,o.partner),incoming:src,
        incomingKin:{species:o.id,name:k.name,types:k.types,src,hp:p.hp,maxHp:p.maxHp,level:p.level},
        announce:kin(g,o.source).name+" and "+kin(g,o.partner).name+" hand the lead to "+k.name+", who uses "+o.skillName+"."};
    }
    return {entry,model,choices,choice,forecast,effect};
  }
  window.WilderTrioBattle=Object.freeze({create});
})();
