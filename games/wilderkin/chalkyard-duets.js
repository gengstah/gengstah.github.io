// Explore up to two opening skills on a disposable copy of the actual matchup.
// Players carry one line into the ring and perform each of its decisions.
(() => {
  "use strict";
  const command=(method,arg,label)=>({method,arg,label,value:method+"|"+arg});
  function lines(practice,setup){
    const scope=practice.preview(setup);
    if(!scope)return [];
    const lead=setup.lead,leadName=scope.kin(lead,{owned:true}).name;
    const opening=scope.state.battle.enemy.id;
    const initial=scope.duets().options.map(o=>({partner:o.partnerId,name:o.name,role:o.role,cost:o.cost}));
    const found=new Map();
    function explore(steps){
      const b=scope.state.battle;
      if(!b||b.activeId!==lead||b.enemy.id!==opening||scope.replacements())return;
      const party=scope.duets();
      for(const option of party.options){
        if(!option.available)continue;
        const other=scope.kin(option.partnerId,{owned:true}),prior=found.get(option.partnerId);
        const current=scope.state.battle,restore=scope.checkpoint(),foe=current.enemy,turn=current.turn,beats=current.beats;
        const beforeHp=foe.hp,foeName=scope.species[foe.id].name;
        const priorHp=new Map(scope.team().map(p=>[p.id,p.hp]));
        const result=scope.useDuet(option.partnerId);
        if(result.ok){
          const remaining=scope.team().reduce((sum,p)=>sum+p.hp,0);
          const foeHpAfter=foe.hp,after=scope.state.battle;
          const effects=[foeName+" "+beforeHp+" → "+foeHpAfter+" HP"];
          const recovery=foeHpAfter-(beforeHp-option.damage);
          if(recovery>0)effects.push(foeName+" recovered "+recovery+" HP after the hit");
          if(option.healLead)effects.push(leadName+" healed "+option.healLead+" HP before the reply");
          if(option.healPartner)effects.push(other.name+" healed "+option.healPartner+" HP");
          for(const member of scope.team()){
            const health=priorHp.get(member.id);
            if(health!==member.hp)effects.push(scope.kin(member.id,{owned:true}).name+" "+health+" → "+member.hp+" HP");
          }
          if(after&&after.activeId!==lead)effects.push(scope.kin(after.activeId,{owned:true}).name+" took the lead");
          if(after&&after.enemy!==foe)effects.push(scope.species[after.enemy.id].name+" took the opposing lead");
          if(after?.opening)effects.push("the foe is exposed");
          const outcome=option.damage+" damage · "+effects.join(" · ")+".";
          if(!prior||steps.length+1<prior.steps.length||steps.length+1===prior.steps.length&&
              (remaining>prior.remaining||remaining===prior.remaining&&foeHpAfter<prior.foeHp)){
            found.set(option.partnerId,{steps:[...steps,{...command("useDuet",option.partnerId,option.name),turn,beats,detail:outcome}],
              remaining,foeHp:foeHpAfter,partnerName:other.name,leadName});
          }
        }
        restore();
      }
      if(steps.length===2||initial.every(o=>found.get(o.partner)?.steps.length<=steps.length+1))return;
      for(const skill of scope.kin(lead,{owned:true}).skills){
        const f=skill.trained?scope.skillPreview(skill.id):scope.ordinaryForecast(skill.id);
        if(!f?.available)continue;
        const before=scope.checkpoint(),battle=scope.state.battle,turn=battle.turn,beats=battle.beats;
        const leadHp=scope.team().find(p=>p.id===lead).hp,foeHp=battle.enemy.hp;
        const played=scope.useSkill(skill.id);
        const after=scope.state.battle;
        if(played.ok&&after&&after.activeId===lead&&after.enemy.id===opening&&!scope.replacements()){
          const left=scope.team().find(p=>p.id===lead).hp;
          const detail=scope.species[opening].name+" "+foeHp+" → "+after.enemy.hp+" HP · "+leadName+" "+leadHp+" → "+left+" HP · "+beats+" → "+after.beats+" beats.";
          explore([...steps,{...command("useSkill",skill.id,skill.name),detail,turn,beats}]);
        }
        before();
      }
    }
    explore([]);
    return initial.map(o=>({...o,...found.get(o.partner)}));
  }
  function create({game,practice,row,image,go,notify,start,openMatchups}){
    let setup=null,plans=[],guided=null,deferred=false;
    const button=(action,label,value=null,detail="",extra={})=>row("yard-duet-"+action,label,value,detail,extra);
    function reset(options){
      const local=practice.targets().find(t=>t.kind==="wild");
      setup=options||local&&{kind:"wild",region:local.region,foe:local.foe,lead:game.state.lead,team:game.state.team.slice()};
      deferred=!!game.state.battle;
      plans=setup&&!deferred?lines(practice,setup):[];
    }
    function open(options){reset(options);go("yard-duets");}
    function model(value){
      if(deferred&&!game.state.battle)reset();
      const choice=plans.find(p=>p.partner===value),name=id=>game.kin(id,{owned:true}).name;
      if(choice?.steps){
        return {title:choice.name,kicker:"DUET PLAN   /   "+choice.role.toUpperCase(),subtitle:name(setup.lead)+" and "+name(choice.partner)+" against "+game.species[setup.foe].name+".",
          sections:[{rows:[button("play","Try this line in the ring",choice.partner,"Play each decision, or choose a different move.",{tone:"primary"})]},
            ...choice.steps.map((s,i)=>({title:"Turn "+s.turn+" · "+s.label,text:s.detail,rows:i===choice.steps.length-1?[{label:choice.cost+" beats",detail:choice.role,image:image(choice.partner,true)}]:[]})),
            {rows:[button("home","Choose another partner"),button("board","Change the lead or lineup")]}]};
      }
      return {title:"Plan a duet",kicker:"CHALKYARD   /   TEAM PRACTICE",
        subtitle:setup?name(setup.lead)+" leads against "+game.species[setup.foe].name+". Each line shows the earliest duet available within two opening skills.":"Choose an opponent at the yard.",
        sections:[{title:"Partners",rows:plans.length?plans.map(p=>{
          const steps=p.steps,caption=steps?steps.map(s=>s.label).join(" → "):"No line found before turn four using this lead’s opening skills.";
          return button("choose",name(p.partner)+" · "+p.name,p.partner,caption,{image:image(p.partner,true),badge:p.role,disabled:!steps});
        }):[{label:"Bring a second companion",detail:"A duet takes two conscious companions in your practice lineup."}]},
          {rows:[button("board","Change the lead or lineup"),row("nav","Return to the Chalkyard","practice-yard")]}]};
    }
    function act(id,value){
      switch(id){
        case "yard-duet-choose":if(plans.some(p=>p.partner===value&&p.steps))go("yard-duets",value);return true;
        case "yard-duet-home":go("yard-duets");return true;
        case "yard-duet-board":if(setup)openMatchups(setup);else go("practice-yard");return true;
        case "yard-duet-play":{
          const selected=plans.find(p=>p.partner===value&&p.steps);
          const current=selected&&lines(practice,setup).find(p=>p.partner===value&&p.steps);
          if(!current){notify("This opening has changed. Choose a new partner.");reset(setup);go("yard-duets");return true;}
          if(JSON.stringify(current.steps)!==JSON.stringify(selected.steps)){
            reset(setup);go("yard-duets",value,"replace");notify("Your party changed. Review the updated opening.");return true;
          }
          start(setup,current);return true;
        }
        default:return false;
      }
    }
    function guidance(run){
      if(!guided||!run)return null;
      const events=run.history,steps=guided.steps;
      for(let i=0;i<Math.min(events.length,steps.length);i++){
        if(events[i].turn!==steps[i].turn||events[i].method!==steps[i].method||events[i].args?.[0]!==steps[i].arg){
          return events.length===i+1?{title:guided.name+" · alternate line",text:"You chose "+events[i].label+". Replay the last decision to return to the planned line."}:null;
        }
      }
      if(events.length===steps.length)return {title:guided.name+" landed",text:guided.leadName+" and "+guided.partnerName+" finished their "+steps.length+"-turn line."};
      if(events.length>steps.length||run.phase!=="battle")return null;
      const step=steps[events.length];
      return {title:guided.name+" · step "+(events.length+1)+" of "+steps.length,rows:[
        row("rehearse-move",step.label,step.value,step.detail,{tone:"primary",image:image(step.method==="useDuet"?guided.partner:setup.lead,true)})]};
    }
    return {open,reset,model,act,guidance,setGuide:plan=>{guided=plan||null;}};
  }
  window.WilderChalkyardDuets=Object.freeze({lines,create});
})();
