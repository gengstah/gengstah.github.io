// Personal signatures and the two families' shared pass use the same public move forecasts.
(() => {
  "use strict";
  const shelter=Object.freeze({id:"shelter-call",speciesId:"mossbell",name:"Shelter Call",role:"Protected handoff",cost:1,uses:1,
    effect:"Pass the lead to a chosen conscious reserve. The incoming kin takes one quarter of the next hit.",
    tradeoff:"Spend 1 beat and a full turn. The handoff deals no damage and earns no switch beat.",
    counter:"A lure pins Mossbell and blocks the call. A breakthrough duet or a strike on an exposed reserve can pierce cover."});
  const thorns=Object.freeze({id:"thorn-read",speciesId:"fernprickle",name:"Thorn Read",role:"Read an attack",cost:0,uses:1,
    effect:"Take one quarter of the next hit. If the rival deals damage, expose the kin that led its attack and gain 1 team beat, up to 3.",
    tradeoff:"Spend your turn and your one read. A heal or switch ends the stance without earning a beat.",
    counter:"Recover or change leads to waste the read. A breakthrough hits through cover, but contact still exposes its attacker."});
  const catalog=new Map([shelter,thorns].flatMap(s=>[[s.id,s],[s.speciesId,s]]));
  const passRules={
    beacon:{role:"Mark and hand off",counter:"Switch the marked kin to the bench to deny the boosted strike. The incoming reserve takes your full reply."},
    slipstream:{role:"Recover and hand off",counter:"Hit the incoming reserve at full strength. A healthy reserve gains no HP."}
  };
  const familyCatalog=new Map();
  function byId(id) {
    if(catalog.has(id))return catalog.get(id);
    if(familyCatalog.has(id))return familyCatalog.get(id);
    const book=window.WilderFamilyTechniques;
    const family=book?.forKin(id),tech=family||book?.byId(typeof id==="string"?id.replace(/-pass$/,""):"");
    if(!tech||!Object.hasOwn(passRules,tech.id))return null;
    const signature=Object.freeze({id:tech.id+"-pass",speciesId:family?id:null,familyKey:tech.id,family:tech.family,
      name:tech.name,cost:1,uses:1,effect:tech.summary,...passRules[tech.id],
      tradeoff:"Spend 1 beat, a turn and your team’s single family pass. A lure blocks the handoff. You gain no switch beat or cover."});
    familyCatalog.set(id,signature);return signature;
  }
  function used(side,id) {
    const signature=byId(id);
    if(!signature)return false;
    return signature.familyKey?!!side.familyPassUsed:!!side.team.find(k=>k.id===signature.speciesId)?.signatureSpent;
  }
  function options(side,bench,label,foe,type) {
    const lead=side.team[side.active],signature=byId(lead.id);
    if(!signature)return [];
    const pass=signature.familyKey;
    const reason=used(side,lead.id)?(pass?"Team family pass used this match.":"Already used this match."):side.beats<signature.cost?"Needs 1 beat.":"";
    const move={kind:"signature",signatureId:signature.id,cost:signature.cost,type:type||"Grove",cover:pass?1:.25,
      beatsAfter:Math.max(0,side.beats-signature.cost),available:!reason,reason};
    if(signature===thorns)return [{...move,id:"stance:thorn-read",label:signature.name,
      detail:"Quarter cover · a damaging reply exposes its attacker and earns 1 beat (up to 3). Healing or switching ends the read."}];
    return bench.map(kin=>{
      const blocked=side.pinned?"A lure pins "+label(lead.id)+" this turn.":reason;
      if(pass){
        const heal=Math.min(kin.maxHp-kin.hp,Math.floor(kin.maxHp/4)),beacon=pass==="beacon";
        const effect=beacon?(foe.exposed?label(foe.id)+" already marked":label(foe.id)+" marked for +50% through cover on next ordinary strike"):
          "restore "+heal+" HP ("+(kin.hp+heal)+"/"+kin.maxHp+")";
        return {...move,id:pass+":"+kin.id,targetId:kin.id,label:signature.name+" · "+label(kin.id),available:!blocked,reason:blocked,
          ...(beacon?{markFoe:true}:{heal,healPartner:heal}),
          detail:label(kin.id)+" takes the lead · "+effect+" · full rival reply · "+move.beatsAfter+"/3 beats after"};
      }
      return {...move,id:"shelter:"+kin.id,targetId:kin.id,label:signature.name+" · "+label(kin.id),available:!blocked,reason:blocked,
        detail:"Spend 1 beat · "+label(kin.id)+" takes the lead under quarter cover · "+move.beatsAfter+"/3 beats after"};
    });
  }
  function forecastResponse(move,side,other,label) {
    if(!other.thornRead||!move.available)return;
    if(!(move.damage>0)){
      move.detail+=" · Thorn Read expires without contact";return;
    }
    const attacker=side.team[side.active],holder=other.team[other.active],beats=move.rivalBeatsAfter??other.beats;
    const beatsAfter=Math.min(3,beats+1);
    move.rivalBeatsAfter=beatsAfter;
    move.thornResponse={holderId:holder.id,attackerId:attacker.id,beatsAfter};
    move.detail+=" · Thorn Read exposes "+label(attacker.id)+" · rival "+beatsAfter+"/3 beats";
  }
  function resolve(move,lead,side,other,targetSlot) {
    if(other.thornRead)delete other.thornRead;
    if(move.thornResponse)lead.exposed=true;
    if(!move.signatureId)return;
    if(move.signatureId==="beacon-pass"||move.signatureId==="slipstream-pass"){
      side.familyPassUsed=move.signatureId;side.active=targetSlot;
      if(move.markFoe)other.team[other.active].exposed=true;
      return;
    }
    lead.signatureSpent=true;
    if(move.signatureId===shelter.id)side.active=targetSlot;
    if(move.signatureId===thorns.id)side.thornRead=true;
  }
  function restoreSide(raw,side,index,pos) {
    const actions=Math.floor((pos.ply+(index===pos.first?1:0))/2);
    let spent=0;
    for(const [i,kin] of raw.team.entries()){
      if(kin.signatureSpent===undefined)continue;
      if(kin.signatureSpent!==true||!catalog.has(kin.id))return false;
      side.team[i].signatureSpent=true;spent++;
    }
    if(raw.familyPassUsed!==undefined){
      const id=raw.familyPassUsed;
      if((id!=="beacon-pass"&&id!=="slipstream-pass")||!side.team.some(kin=>byId(kin.id)?.id===id))return false;
      const opener=side.team[0];
      if(actions===1&&(opener.gear!=="opening-pennant"||byId(opener.id)?.id!==id))return false;
      side.familyPassUsed=id;spent++;
    }
    if(spent>actions)return false;
    if(raw.thornRead===undefined)return true;
    const lead=side.team[side.active];
    if(raw.thornRead!==true||index===pos.turn||pos.phase!=="move"||lead.id!==thorns.speciesId||!lead.hp||
      !lead.signatureSpent||side.cover!==.25||side.braced||side.pinned)return false;
    side.thornRead=true;return true;
  }
  window.WilderSparringSignatures=Object.freeze({byId,used,options,forecastResponse,resolve,restoreSide});
})();
