// An invitation to one ordinary campaign encounter in Clover Clearing.
(() => {
  "use strict";
  const foe="opalclasp",site="wild",region=0;
  const starters=["sprigkit","cindlet","dewfin"];
  const endings=["victory","recruited","defeat","escaped"];
  const error=message=>({ok:false,kind:"error",message});
  const living=(state,id)=>state.team.includes(id)&&state.party.some(p=>p.id===id&&p.hp>0);
  const complete=note=>note?.receipt?.outcome==="victory"||note?.receipt?.outcome==="recruited";
  const positive=n=>Number.isSafeInteger(n)&&n>=1;
  const bounded=(n,max)=>Number.isSafeInteger(n)&&n>=0&&n<=max;

  function snapshot(state,battle,turn,message){
    const partyHp=Object.fromEntries(state.team.map(id=>[id,state.party.find(p=>p.id===id).hp]));
    return {turn,activeId:battle.activeId,activeHp:partyHp[battle.activeId],partyHp,
      foeHp:battle.enemy.hp,beats:battle.beats,text:message.slice(0,1600)};
  }
  function marked(state){
    const b=state.battle,note=state.firstBattle;
    return state.region===region&&b?.kind==="wild"&&b.enemy.id===foe&&note?.stage==="battle"&&
      starters.includes(note.lead)&&b.firstBattle?.lead===note.lead;
  }
  function turn(state,message){
    if(marked(state))state.battle.firstBattle.last=snapshot(state,state.battle,state.battle.turn-1,message);
  }
  function finish(state,outcome,message){
    if(!marked(state))return null;
    const b=state.battle,lead=b.firstBattle.lead;
    const receipt={lead,foe,outcome,...snapshot(state,b,b.turn,message)};
    state.firstBattle={stage:"done",lead,receipt};
    return receipt;
  }
  // A receipt describes the party on that turn, even after later training,
  // party changes, a rescue at the trailhead or the invitation of the quarry.
  function readSnapshot(raw,state,foeMax){
    if(!raw||!positive(raw.turn)||!bounded(raw.foeHp,foeMax)||!bounded(raw.beats,3)||
      typeof raw.text!=="string"||!raw.text.length||raw.text.length>1600||
      !raw.partyHp||typeof raw.partyHp!=="object"||Array.isArray(raw.partyHp))return null;
    const ids=Object.keys(raw.partyHp);
    if(ids.length<1||ids.length>6||!ids.includes(raw.activeId)||raw.activeHp!==raw.partyHp[raw.activeId]||
      !ids.every(id=>state.party.some(p=>p.id===id&&bounded(raw.partyHp[id],p.maxHp))))return null;
    return {turn:raw.turn,activeId:raw.activeId,activeHp:raw.activeHp,partyHp:{...raw.partyHp},foeHp:raw.foeHp,beats:raw.beats,text:raw.text};
  }
  function restore(raw,state,rawBattle,foeMax,foeLevel){
    if(!starters.includes(raw?.lead))return null;
    const lead=raw.lead;
    if(raw.stage==="walk")return {stage:"walk",lead};
    if(raw.stage==="battle"){
      const b=state.battle,tag=rawBattle?.firstBattle;
      if(state.region!==region||state.landmark!==site||b?.kind!=="wild"||b.enemy.id!==foe||b.enemy.level!==foeLevel||
        tag?.lead!==lead||!state.team.includes(lead)||state.lead!==lead||(b.turn===1&&b.activeId!==lead))return null;
      b.firstBattle={lead};
      const last=readSnapshot(tag.last,state,foeMax);
      if(last&&last.turn===b.turn-1&&last.foeHp===b.enemy.hp&&last.beats===b.beats&&
        state.team.length===Object.keys(last.partyHp).length&&state.team.every(id=>last.partyHp[id]===state.party.find(p=>p.id===id).hp))b.firstBattle.last=last;
      return {stage:"battle",lead};
    }
    const r=raw.receipt,snap=readSnapshot(r,state,foeMax);
    if(raw.stage!=="done"||!snap||r.lead!==lead||r.foe!==foe||!Object.hasOwn(snap.partyHp,lead)||!endings.includes(r.outcome)||
      !state.seen.includes(foe)||(r.outcome==="victory")!==(snap.foeHp===0)||
      (r.outcome==="defeat")!==Object.values(snap.partyHp).every(hp=>hp===0)||
      (r.outcome==="recruited"&&!state.party.some(p=>p.id===foe)))return null;
    return {stage:"done",lead,receipt:{lead,foe,outcome:r.outcome,...snap}};
  }
  function create({state,blocked,nearTracks,name,commit,begin}){
    function read(){
      const s=state(),n=s.firstBattle,lead=n?.lead||null,stage=n?.stage||"choose";
      const atTracks=s.region===region&&s.landmark===site&&nearTracks();
      const block=blocked()?"Return to your campaign party first.":s.battle?"Finish the current encounter first.":
        complete(n)?"Your first battle is recorded. Follow the local tracks for another wild encounter.":
        s.region!==region?"Travel to Mossbrook Vale to find the Clover Clearing tracks.":"";
      const choices=starters.map(id=>{
        const p=s.party.find(m=>m.id===id),onTeam=s.team.includes(id);
        const reason=block||(!onTeam?"Add this companion to your traveling party.":!p?.hp?"Rest this companion at camp.":"");
        return {id,name:name(id),hp:p?.hp||0,maxHp:p?.maxHp||0,available:!reason,reason};
      });
      const reason=block||(stage!=="walk"?"Choose a starter to lead the walk.":
        !living(s,lead)||s.lead!==lead?"Choose a conscious starter to lead this outing again.":
        !atTracks?"Walk to the wild tracks at Clover Clearing.":"");
      const receipt=n?.receipt?{...n.receipt,partyHp:{...n.receipt.partyHp}}:null;
      return {stage,lead,site,region,foe,atTracks,choices,canStart:!reason,reason,outcome:receipt?.outcome||null,receipt};
    }
    function choose(id){
      const choice=read().choices.find(p=>p.id===id);
      if(!choice?.available)return error(choice?.reason||"Choose one of the three trail starters.");
      const s=state();s.lead=id;s.firstBattle={stage:"walk",lead:id};
      const res=commit("lead",choice.name+" will lead the walk to Clover Clearing.");
      return res.ok?{...res,site}:res;
    }
    function enter(){
      const view=read();
      if(!view.canStart)return error(view.reason);
      const s=state();s.firstBattle={stage:"battle",lead:view.lead};
      return begin(foe,{lead:view.lead});
    }
    return {read,choose,begin:enter};
  }
  window.WilderFirstBattle={create,restore,turn,finish,foe};
})();
