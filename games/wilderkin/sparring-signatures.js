// These two loaners can spend a turn on a signature instead of using their shared Grove tactics.
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
  const byId=id=>catalog.get(id)||null;
  function options(side,bench,label) {
    const lead=side.team[side.active],signature=byId(lead.id);
    if(!signature)return [];
    const reason=lead.signatureSpent?"Already used this match.":side.beats<signature.cost?"Needs 1 beat.":"";
    const move={kind:"signature",signatureId:signature.id,cost:signature.cost,type:"Grove",cover:.25,
      beatsAfter:Math.max(0,side.beats-signature.cost),available:!reason,reason};
    if(signature===thorns)return [{...move,id:"stance:thorn-read",label:signature.name,
      detail:"Quarter cover · a damaging reply exposes its attacker and earns 1 beat (up to 3). Healing or switching ends the read."}];
    return bench.map(kin=>{
      const blocked=side.pinned?"A lure pins Mossbell this turn.":reason;
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
    lead.signatureSpent=true;
    if(move.signatureId===shelter.id)side.active=targetSlot;
    if(move.signatureId===thorns.id)side.thornRead=true;
  }
  function restoreSide(raw,side,index,pos) {
    let spent=0;
    for(const [i,kin] of raw.team.entries()){
      if(kin.signatureSpent===undefined)continue;
      if(kin.signatureSpent!==true||!byId(kin.id))return false;
      side.team[i].signatureSpent=true;spent++;
    }
    const actions=Math.floor((pos.ply+(index===pos.first?1:0))/2);
    if(spent>actions)return false;
    if(raw.thornRead===undefined)return true;
    const lead=side.team[side.active];
    if(raw.thornRead!==true||index===pos.turn||pos.phase!=="move"||lead.id!==thorns.speciesId||!lead.hp||
      !lead.signatureSpent||side.cover!==.25||side.braced||side.pinned)return false;
    side.thornRead=true;return true;
  }
  window.WilderSparringSignatures=Object.freeze({byId,options,forecastResponse,resolve,restoreSide});
})();
