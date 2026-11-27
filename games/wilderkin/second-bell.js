// Wardens publish their exhibition team before the courier picks an opening kin.
(() => {
  "use strict";
  function card({region,regions,wardens,pools,species,dex,party}){
    const lodge=regions[region],home=pools[region];
    if(!lodge?.warden || !home?.length || !party.length)return null;
    const ace=home[0],opener=home[1]||ace;
    const nearby=wardens.filter(i=>i!==region).sort((a,b)=>Math.abs(a-region)-Math.abs(b-region)||a-b);
    const guests=[...new Set(nearby.slice(0,2).flatMap(i=>pools[i]))].filter(id=>!home.includes(id));
    const crew=party.map(k=>species[k.id]);
    function judge(id){
      const kin=species[id],type=kin.type;
      const scores=crew.map(k=>dex.effectiveness(type,k.types));
      const weaknesses=scores.filter(s=>s>1).length;
      const coverage=scores.reduce((sum,s)=>sum+s,0);
      // A secondary tie favors a guest with a different attack from the home ace.
      return {id,weaknesses,coverage,variety:Number(type!==species[ace].type)};
    }
    const ranks=guests.map(judge).sort((a,b)=>b.weaknesses-a.weaknesses||b.coverage-a.coverage||b.variety-a.variety||a.id.localeCompare(b.id));
    const guest=ranks[0].id,visitor=species[guest];
    const exposed=crew.filter(k=>dex.effectiveness(visitor.type,k.types)>1).map(k=>k.name).sort();
    const guestReason=exposed.length?visitor.type+" threatens "+exposed.join(", ")+".":"None of your kin is weak to "+visitor.type+". It gives this guest the best available coverage.";
    const count=Math.min(6,Math.max(3,party.length));
    const support=[...new Set([guest,...home,...ranks.map(r=>r.id)])].filter(id=>id!==opener && id!==ace);
    const roster=[opener,...support.slice(0,count-2),ace];
    const level=Math.max(lodge.wardenLevel,...party.map(k=>k.level));
    return {level,roster,opener,ace,guest,guestReason};
  }

  function create({game,row,image,go,locate,travel,fight,render}){
    let nominee=null;
    const profile=id=>game.kin(id,{owned:true});
    const link=(label,place,detail,extra)=>row("view",label,"second-bell|"+place,detail,extra);
    const actRow=(key,label,value,detail,extra)=>row("bell-"+key,label,value,detail,extra);
    const group=(title,rows,columns=1)=>({title,rows,columns});
    function regionFor(value){
      const index=(typeof value==="number" || (typeof value==="string" && /^\d+$/.test(value)))?Number(value):game.state.region;
      if(game.wardens.includes(index))return index;
      return game.state.crests.at(-1)??game.wardens[0];
    }
    function book(){
      const hosts=game.wardens.filter(i=>i===0||game.state.crests.includes(i)||i===game.state.region);
      return {title:"Second Bell lodges",kicker:"EXHIBITION RECORD",sections:[group("Choose a lodge",hosts.map(i=>{
        const r=game.regions[i],m=game.state.bellMarks[i];
        return link("Warden "+r.warden,i,r.lodge+" · "+r.name,{badge:m?"SEAL · LV "+m.level:undefined});
      }),2)]};
    }
    function model(value){
      if(value==="book")return book();
      const i=regionFor(value),r=game.regions[i],offer=game.secondBell(i),here=game.state.region===i;
      const crew=game.team(),id=crew.some(k=>nominee===k.id)?nominee:game.state.lead;
      const lead=profile(id),mark=offer.mark,controls=[];
      if(game.state.battle)controls.push(row("root","Resume your battle",null,"Your match is in progress.",{tone:"primary"}));
      else if(!offer.eligible)controls.push(here?row("nav","Prepare for the crest trial","warden",offer.reason):
        row("view","Locate the crest trial","region|"+i,offer.reason));
      else if(!here)controls.push(actRow("travel","Travel to "+r.name,i,"Visit "+r.lodge+" for the exhibition.",{tone:"primary",disabled:!game.access(i).open}));
      else if(!offer.atLodge)controls.push(actRow("walk","Walk to "+r.lodge,i,"Meet Warden "+r.warden+" at the bell.",{tone:"primary"}));
      else controls.push(actRow("ring","Ring the Second Bell",i,"Open with "+lead.name+" against "+game.species[offer.opener].name+".",{tone:"primary",disabled:!offer.available}));
      const lineup=offer.roster.map(k=>{
        const rival=game.species[k],role=k===offer.opener?"OPENER":k===offer.ace?"ACE":k===offer.guest?"GUEST":"RESERVE";
        const charge=rival.skills.find(s=>s.kind==="attack");
        return {label:rival.name,detail:rival.types.join(" / ")+" · "+charge.name,badge:role,image:image(k)};
      });
      const sections=[group(r.lodge,controls),group("Warden "+r.warden+"’s team · Lv "+offer.level,lineup,2),
        {title:"Why "+game.species[offer.guest].name+" is visiting",text:offer.guestReason+" The Warden scouts your traveling party before you choose the lead."},
        group("Choose your opening kin",crew.map(p=>{
          const k=profile(p.id),mult=window.WilderKinDex.effectiveness(k.type,game.species[offer.opener].types);
          return actRow("lead",k.name,p.id,"Lv "+p.level+" · "+k.types.join(" / ")+(mult>1?" · Opening advantage":mult<1?" · Opening strike resisted":""),
            {image:image(p.id,true),badge:p.id===id?"OPENS":undefined,disabled:!!game.state.battle});
        }),2)];
      if(!game.state.battle)sections.push(group("Traveling party",[
        row("nav","Review party and reserves","party","Inspect skills or change the lineup. Return here to see who the Warden invites.")
      ]));
      if(mark)sections.push({title:"Your return seal · Lv "+mark.level,text:mark.team.map(k=>profile(k).name).join(", ")+". "+mark.standing+" of "+mark.team.length+" still standing at the final bell."});
      sections.push(group("Lodge register",[link("Other lodges","book","Visit an earned crest for its return match.")]));
      return {title:"The Second Bell",kicker:r.name+"   /   WARDEN "+r.warden,
        art:{src:"art/story/second-bell.png",landscape:true},
        subtitle:"Win a return seal here. The official Warden trial awards the "+r.crest+". Both teams enter at full health. The Warden matches your strongest traveler, with a minimum set by the lodge. Your kin keep their trained moves. Leave your satchel at the door. After the bout, everyone returns to their trail HP.",sections};
    }
    function act(id,value){
      if(!id.startsWith("bell-"))return false;
      if(game.state.battle)return true;
      if(id==="bell-preview"){
        if(game.state.team.includes(value)&&game.secondBell()?.eligible){
          nominee=value;go("second-bell",game.state.region);
        }
        return true;
      }
      if(id==="bell-lead"){
        if(game.state.team.includes(value)){nominee=value;render();}
        return true;
      }
      const i=Number(value);
      if(!game.wardens.includes(i))return true;
      const offer=game.secondBell(i);
      if(id==="bell-travel" && offer.eligible && game.access(i).open){travel(i);go("second-bell",i,"replace");}
      else if(id==="bell-walk" && offer.eligible && game.state.region===i)locate("warden",{name:"second-bell",value:i});
      else if(id==="bell-ring" && offer.available)fight("second-bell",game.state.team.includes(nominee)?nominee:game.state.lead);
      return true;
    }
    return {model,act};
  }

  window.WilderSecondBell={card,create};
})();
