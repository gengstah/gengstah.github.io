// A practice invitation belongs to the region and species printed on it.
window.WilderPracticeYard = {
  create({game,practice,row,image,go,notify,openMatchups,openDuets,start}){
    const name=id=>game.kin(id,{owned:false}).name;
    const tag=t=>[t.region,t.kind,t.foe].join("/");
    const currentTargets=()=>practice.targets(game.state.region);
    function find(value){
      if(typeof value!=="string")return null;
      const [region,kind,foe,...extra]=value.split("/");
      const index=Number(region);
      if(extra.length||!/^\d{1,3}$/.test(region)||String(index)!==region||!game.state.visited.includes(index))return null;
      return practice.targets(index).find(t=>t.kind===kind&&t.foe===foe)||null;
    }
    function model(value){
      const target=find(value),r=game.regions[game.state.region],targets=currentTargets();
      const selected=target||targets.find(t=>t.kind==="wild")||targets[0];
      const b=game.state.battle,team=game.team();
      const sections=[];
      if(b){
        sections.push({rows:[row("root","Return to the trail battle",null,"Finish this encounter to enter the yard.",{tone:"primary"})]});
      }else if(selected){
        const lead=game.kin(game.state.lead,{owned:true}).name;
        const opponent=selected.kind==="wild"?name(selected.foe):selected.name;
        sections.push({title:target?"Selected opponent":"First bout",rows:[
          row("yard-play","Face "+opponent,tag(selected),lead+" leads your party at full HP. Opponent Lv. "+selected.level+".",{tone:"primary",image:image(selected.foe,false)}),
          row("yard-compare","Compare openings",tag(selected),"Choose a lead or try a reserve against "+opponent+"."),
          ...(team.length>1?[row("yard-pair","Plan a duet",tag(selected),"Find a path to a shared move with "+lead+".")]:[])
        ]});
      }
      if(target?.kind==="warden")sections.push({title:"Warden lineup",text:target.roster.map(name).join(" → ")});
      const wild=targets.filter(t=>t.kind==="wild");
      if(wild.length)sections.push({title:"Local opponents · "+r.name,columns:2,rows:wild.map(t=>
        row("yard-select",name(t.foe),tag(t),game.kin(t.foe,{owned:false}).types.join(" / ")+" · Lv. "+t.level,
          {image:image(t.foe,false),badge:target&&tag(target)===tag(t)?"SELECTED":""}))});
      const wardenRows=[];
      const known=[...new Set([game.state.region,...game.state.met,...game.state.crests])];
      for(const region of known){
        const t=(region===game.state.region?targets:practice.targets(region)).find(o=>o.kind==="warden");
        if(t)wardenRows.push(row("yard-select",t.name,tag(t),game.regions[region].lodge+" · "+t.roster.map(name).join(" → ")+" · Lv. "+t.level,
          {image:image(t.foe,false),badge:target&&tag(target)===tag(t)?"SELECTED":""}));
      }
      if(r.warden&&!targets.some(t=>t.kind==="warden")&&!b){
        if(game.state.landmark==="warden")wardenRows.unshift(row("yard-invite","Ask "+r.warden+" for a practice bout",null,"Meet the Warden and see the trial lineup."));
        else wardenRows.unshift(row("walk-kind","Meet Warden "+r.warden,"warden|warden","Walk to "+r.lodge+" for a practice invitation."));
      }
      if(wardenRows.length)sections.push({title:"Warden invitations",rows:wardenRows});
      sections.push({title:"Traveling party",text:team.map(p=>game.kin(p.id,{owned:true}).name).join(" · "),rows:[
        row("nav","Manage field fittings","kit-bench","Change the gear your companions will bring into the next bout."),
        row("nav","Trail formations","formations","Recall a saved party and its fittings.")
      ]});
      return {title:"The Chalkyard",kicker:"CAMP PRACTICE   /   "+(target?game.regions[target.region].name:r.name),
        subtitle:"Battle at full HP with a copy of your party, field gear and satchel. Earn crests and XP on the trail. Refreshing ends practice.",
        art:{src:"ui/chalkyard.png",landscape:true,height:132},sections};
    }
    function invite(){
      const i=game.state.region;
      if(!game.regions[i].warden||game.state.landmark!=="warden"||game.state.battle)return notify("Speak with the Warden at the lodge between encounters.");
      if(!game.state.met.includes(i)&&!game.state.crests.includes(i)){
        const res=game.meetWarden();
        if(!res.ok){if(res.code!=="changed")notify(res.message);return;}
      }
      const t=currentTargets().find(t=>t.kind==="warden");
      if(t)go("practice-yard",tag(t));
    }
    function act(id,value){
      if(id==="yard-invite"){invite();return true;}
      if(!["yard-select","yard-play","yard-compare","yard-pair"].includes(id))return false;
      const t=find(value);
      if(!t){notify("Choose an opponent from the yard’s invitations.");return true;}
      if(id==="yard-select"){go("practice-yard",tag(t));return true;}
      const options={kind:t.kind,foe:t.foe,region:t.region,lead:game.state.lead,team:game.state.team.slice()};
      if(id==="yard-compare")openMatchups(options);
      else if(id==="yard-pair")openDuets(options);
      else start(options);
      return true;
    }
    function address(value){
      const t=find(value);
      return "#chalkyard"+(t?"/"+tag(t):"");
    }
    return {find,tag,model,act,invite,address};
  }
};
