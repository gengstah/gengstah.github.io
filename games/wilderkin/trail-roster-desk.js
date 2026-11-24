// Review a Chalkyard draft against the living trail roster before writing a party or a pennant.
(() => {
  "use strict";
  const copy=v=>JSON.parse(JSON.stringify(v)),group=(title,rows,columns=1)=>({title,rows,columns});
  const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
  const validName=s=>typeof s==="string"&&s.trim()&&[...s.normalize("NFC").trim().replace(/\s+/gu," ")].length<=32&&!/[\u0000-\u001f\u007f-\u009f<>\u202a-\u202e\u2066-\u2069]/u.test(s);
  const kit=id=>window.WilderTrailFittings?.byId(id)?.name||"No fitting";
  function create({game,row,image,go,render,notify,locate,onDraft,onField}){
    const api=game.caravan,own=id=>game.kin(id,{owned:true}).name,names=ids=>ids.map(own).join(" · ");
    const button=(id,label,value=null,detail="",extra={})=>row("roster-"+id,label,value,detail,extra);
    const show=(view=null,mode="push")=>go("trail-roster",view,mode);
    let draft=null,substitute=null,slot=null,pennantName=null,withGear=false,shown=null,receipt=null,saved=null;
    function reset(){
      draft=null;substitute=null;slot=null;pennantName=null;withGear=false;shown=null;receipt=null;saved=null;
    }
    const current=()=>draft?copy(draft):null;
    function restore(source){
      if(!source||!["wild","warden"].includes(source.kind)||!game.regions[source.region]||
        !Object.hasOwn(game.species,source.foe)||!api.previewPromotion(source))return false;
      reset();
      draft={kind:source.kind,region:source.region,foe:source.foe,team:source.team.slice(),lead:source.lead};
      const tested=source.tested;
      if(["victory","defeat"].includes(tested?.result)&&Array.isArray(tested.members)){
        const members=tested.members.filter(p=>p&&draft.team.includes(p.id)&&Number.isInteger(p.hp)&&
          Number.isInteger(p.maxHp)&&p.maxHp>0&&p.hp>=0&&p.hp<=p.maxHp&&Number.isInteger(p.level)&&p.level>0)
          .map(p=>({id:p.id,hp:p.hp,maxHp:p.maxHp,level:p.level,gear:p.gear||null}));
        if(members.length===draft.team.length&&new Set(members.map(p=>p.id)).size===members.length){
          const turns=Array.isArray(tested.turns)?tested.turns.slice(0,4).filter((t,i)=>t&&(i<3||t.method==="useTrio")&&Number.isInteger(t.turn)&&t.turn>0&&
            draft.team.includes(t.activeId)&&Object.hasOwn(game.species,t.foe)&&typeof t.method==="string"&&
            Array.isArray(t.args)&&t.args.every(a=>typeof a==="string")&&typeof t.label==="string"&&typeof t.actual==="string")
            .map(({turn,activeId,foe,method,args,label,actual})=>({turn,activeId,foe,method,args:args.slice(),label,actual})):[];
          draft.tested={result:tested.result,members,...(turns.length?{turns}:{})};
        }
      }
      return true;
    }
    function open(source){
      if(!restore(source)){notify("Choose a team of your own companions on the matchup board.");return false;}
      show();return true;
    }
    const review=(forSlot=false)=>api.previewPromotion(draft,{...(substitute?{substitute}:{}),
      ...(forSlot&&slot!==null?{slot,name:pennantName,fittings:withGear}:{})});
    const target=()=>draft.kind==="warden"?"Warden "+game.regions[draft.region].warden:game.species[draft.foe].name;
    const onTrail=r=>!!r.readyLead&&r.current.lead===r.readyLead&&same(r.team,r.current.team);
    const fieldButton=()=>button("field",draft.kind==="warden"?"Visit "+target()+"’s lodge":"Follow "+target()+" on the trail",null,
      game.regions[draft.region].name+" · continue with your traveling party.",{tone:"primary"});
    function strip(r){
      return {label:"Proposed traveling party",slots:r.members.map(p=>({id:p.id,name:p.name,src:image(p.id,true),level:p.level,hp:p.hp,maxHp:p.maxHp,
        lead:p.id===(r.readyLead||r.lead)}))};
    }
    function members(r){
      return r.members.map(p=>{
        const details=["Lv. "+p.level+" · "+p.hp+"/"+p.maxHp+" trail HP · "+kit(p.gear)];
        const tested=draft.tested?.members.find(t=>t.id===p.id);
        if(tested){
          const changes=[];
          if(p.hp!==tested.hp||p.maxHp!==tested.maxHp)changes.push(tested.hp+"/"+tested.maxHp+" HP");
          if(p.level!==tested.level)changes.push("Lv. "+tested.level);
          if((p.gear||null)!==tested.gear)changes.push(kit(tested.gear));
          if(changes.length)details.push("Finished practice with "+changes.join(", ")+".");
        }
        return {label:p.name,detail:details.join(". "),badge:!p.traveling?"JOINING":undefined};
      });
    }
    const changeText=r=>[r.joining.length?names(r.joining)+" joining.":"",
      r.leaving.length?names(r.leaving)+" returning to reserve.":""].filter(Boolean).join(" ");
    function main(r){
      const actualLead=r.readyLead||r.lead,heldLead=r.members.find(m=>m.id===r.lead),sections=[];
      const changed=changeText(r);
      if(changed)sections.push({title:"Party changes",text:changed});
      if(!heldLead.hp){
        const choices=r.leadChoices.map(id=>button("substitute",own(id),id,"Use as the trail lead.",{image:image(id,true),badge:id===substitute?"CHOSEN":undefined}));
        sections.push({title:own(r.lead)+" needs a rest",text:choices.length?"Choose a conscious lead to take this party onto the trail.":"The proposed party has no conscious companion.",
          ...(choices.length?{rows:choices,columns:2}:{})});
        if(locate&&!game.state.battle)sections.push(group("Camp",[
          button("camp",game.state.landmark==="camp"?"Visit the campfire":"Walk to camp",null,"Rest the party before setting out with "+own(r.lead)+".")]));
      }
      const actions=[];
      if(!game.state.battle&&onTrail(r))actions.push(fieldButton());
      else actions.push(button("apply","Use this traveling party",null,r.canApply?"Set the shown order with "+own(actualLead)+" in front.":r.applyReason,
        {tone:"primary",disabled:!r.canApply}));
      actions.push(button("pennants","Save on a pennant",null,"Keep a named copy of this draft for another trip.",{disabled:!!game.state.battle}),
        button("draft","Back to the matchup board",null,"Continue comparing openings for "+target()+"."));
      sections.push(group("On the trail",actions),group("Companions in travel order",members(r),2),
        {title:"Traveling now",text:names(r.current.team)+". "+own(r.current.lead)+" leads."});
      return {title:"Bring this party to the trail",kicker:"CHALKYARD   /   "+target().toUpperCase(),formationStrip:strip(r),
        subtitle:draft.tested?"Rehearsal "+(draft.tested.result==="victory"?"won.":"lost.")+" These are your companions’ current trail HP and fittings.":
          "Your companions travel with the HP and fittings they have now.",sections};
    }
    function shelf(){
      const rows=api.formations().slots.map(s=>button("slot",s.name,s.index,s.lineup?names(s.lineup.team):"Record the proposed party here.",
        {badge:s.lineup?"RECORDED":"EMPTY"}));
      return {title:"Choose a pennant",kicker:"TRAIL FORMATIONS",subtitle:"Choose where to record this draft. Your traveling party stays in place.",sections:[
        group("Pennants",rows),group("Draft",[button("review","Back to the party")])]};
    }
    function record(r){
      const p=r.pennant,old=p.existing;
      const details=[names(r.team),"Recorded lead · "+own(r.lead),withGear?r.members.map(m=>m.name+" · "+kit(m.gear)).join(" / "):"Recall with each companion’s current fitting."];
      const sections=[{title:p.name,text:details.join(". ")}];
      if(p.occupied&&old){
        const gear=old.gear?old.team.map(id=>own(id)+" · "+kit(old.gear[id])).join(" / "):"Lineup only";
        sections.push({title:"Replacing "+(old.name||api.formations().slots[slot].name),
          text:names(old.team)+". "+own(old.lead)+" leads. "+gear+"."});
      }
      sections.push(group("Record this draft",[
        button("save",p.occupied?"Replace this pennant":"Record this pennant",null,r.canSave?"Save "+p.name+" with "+own(r.lead)+" leading.":r.saveReason,
          {tone:"primary",disabled:!r.canSave}),button("name","Choose a pennant name",null,p.name),
        button("gear",withGear?"Record lineup only":"Include current fittings",null,withGear?"Currently recording the held fittings.":"Currently recording the order and leader."),
        button("pennants","Choose another pennant"),button("review","Back to the party")]));
      return {title:p.occupied?"Review the replacement":"Record a formation",kicker:"TRAIL PENNANTS",sections};
    }
    function canUndo(){
      if(!receipt||game.state.battle||!same(game.state.team,receipt.team)||game.state.lead!==receipt.lead||
        JSON.stringify(game.state.caravan?.previous)!==receipt.previous)return false;
      const prev=api.formations().previous;
      return !!prev&&!prev.reason;
    }
    function result(r,mode){
      const changed=mode==="applied",isSaved=mode==="saved",actions=[];
      if(!game.state.battle&&onTrail(r))actions.push(fieldButton());
      if(canUndo())actions.push(button("undo","Undo the party change",null,"Restore "+names(api.formations().previous.team)+"."));
      if(!isSaved)actions.push(button("pennants","Save on a pennant"));
      actions.push(button("review","Review the proposed party"),button("draft","Back to the matchup board"));
      const title=isSaved?saved+" recorded":changed?"Your party is ready":"Previous party restored";
      const message=isSaved?"The pennant records "+names(draft.team)+".":own(game.state.lead)+" leads "+names(game.state.team)+".";
      return {title,kicker:"TRAIL FORMATIONS",subtitle:message,sections:[group("Next",actions)]};
    }
    function model(value){
      const mode=value||"review";
      const r=draft&&review(mode==="record"&&slot!==null);
      shown=r?{mode,review:r}:null;
      if(!r)return {title:"Trail formations",subtitle:"Choose a party and opponent on the matchup board first.",sections:[
        group("Chalkyard",[row("nav","Compare an opening","trail-matchups")])]};
      if(mode==="pennants")return shelf();
      if(mode==="record"&&r.pennant)return record(r);
      if(mode==="applied"&&receipt||mode==="saved"&&saved||mode==="undone")return result(r,mode);
      return main(r);
    }
    function act(id,value,screen){
      if(typeof id!=="string"||!id.startsWith("roster-"))return false;
      if(!draft)return true;
      const mode=screen||"review",quoted=shown?.mode===mode?shown.review:null;
      if(id==="roster-apply"||id==="roster-save"){
        const adopt=id==="roster-apply";
        if(!quoted||(adopt?mode!=="review"||!quoted.canApply:mode!=="record"||!quoted.canSave))return true;
        const res=adopt?api.applyPromotion(quoted):api.savePromotion(quoted);
        if(!res.ok){notify(res.message);render();return true;}
        if(adopt)receipt={team:game.state.team.slice(),lead:game.state.lead,previous:JSON.stringify(game.state.caravan?.previous)};
        else saved=quoted.pennant.name;
        shown=null;show(adopt?"applied":"saved","replace");return true;
      }
      if(id==="roster-review"){show();return true;}
      if(id==="roster-pennants"){slot=null;show("pennants");return true;}
      if(id==="roster-slot"&&mode==="pennants"){
        const p=api.formations().slots.find(s=>String(s.index)===String(value));if(!p)return true;
        slot=p.index;pennantName=p.name;withGear=!!p.lineup?.gear;show("record");return true;
      }
      if(id==="roster-name"&&mode==="record"){
        const proposed=window.prompt?.("Name this pennant (1–32 characters)",pennantName);
        if(proposed!=null){if(validName(proposed))pennantName=proposed.normalize("NFC").trim().replace(/\s+/gu," ");
          else notify("Use a pennant name of 1–32 printable characters.");render();}return true;
      }
      if(id==="roster-gear"&&mode==="record"){withGear=!withGear;render();return true;}
      if(id==="roster-substitute"&&mode==="review"&&review().leadChoices.includes(value)){
        substitute=value;render();return true;
      }
      if(id==="roster-undo"&&canUndo()){
        const res=api.undoFormation();if(res.ok){receipt=null;show("undone","replace");}else{notify(res.message);render();}return true;
      }
      if(id==="roster-draft"){onDraft(current());return true;}
      if(id==="roster-field"){
        if(game.trailSaveIsCurrent?.()===false){notify("The trail changed in another tab. Reload to use the latest party.");return true;}
        if(!game.state.battle&&onTrail(review()))onField({...current(),lead:game.state.lead});
        else{notify("Review the current traveling party before following this opponent.");show(null,"replace");}
        return true;
      }
      if(id==="roster-camp"&&locate&&!game.state.battle){
        if(game.state.landmark==="camp")go("camp");else locate("camp",{name:"camp"});
      }
      return true;
    }
    return {open,restore,reset,current,model,act};
  }
  window.WilderTrailRosterDesk=Object.freeze({create});
})();
