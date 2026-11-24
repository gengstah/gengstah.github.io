// Three-member loan teams for the Sparring Hall. The first slot is the lead.
(() => {
  "use strict";
  const starters=["sprigkit","cindlet","dewfin"];
  const rivals=[
    {id:"bell-keepers",name:"The Bell Keepers",team:["mossbell","coalmoth","glimmeray"],plan:"Three single-affinity partners cover one another. Mossbell opens, with Coalmoth ready for Grove and Glimmeray for Ember.",counter:"Lead with Ember against Mossbell. Keep a Grove or Arc answer for the Tide reserve."},
    {id:"wind-post",name:"Wind Post Relay",team:["gustlance","arcbill","icereeve"],plan:"All three carry Vane. Gustlance can hand off to Icereeve under cover or spend three beats on Thunderhead with Arcbill.",counter:"Arc puts pressure on all three. A Loam partner can receive Arcbill’s Arc strike."},
    {id:"red-foundry",name:"Red Foundry",team:["smelteroll","boltbur","kilnclaw"],plan:"Bell Foundry pairs Ember and Alloy for a three-beat breakthrough. Kilnclaw carries a Loam reply to an Ember mirror.",counter:"A Tide attack hits all three. Smelteroll’s Ember and Alloy affinities both give way to Tide."},
    {id:"still-choir",name:"The Still Choir",team:["chordowl","opalmull","nightgob"],plan:"The two Chime leads have Restoring Round. Either can also sing Night Watch with Nightgob to recover both singers.",counter:"Vane hits all three and both of Chordowl’s affinities. Finish an injured singer before a recovery duet."},
    {id:"earth-wire",name:"Earth Wire Crew",team:["coilcrown","slateweaver","cairnwatch"],plan:"Coilcrown and Slateweaver share both affinities and can strike together under Earth Wire cover. Cairnwatch brings Gloam pressure.",counter:"Grove hits all three through their Loam affinity. Save a breakthrough for the crew’s cover."},
    {id:"ice-harbor",name:"Ice Harbor Pilots",team:["brookpeep","frostmull","creekroll"],plan:"Brookpeep and Frostmull form Ice Harbor. Creekroll supplies Alloy coverage and can replace a damaged pilot under a second ward.",counter:"Grove hits both Tide partners, but Frostmull can take the same strike neutrally. Carry Ember for the Rime reserve."},
    {id:"night-orchard",name:"Night Orchard",team:["lullprickle","leafweft","pincoil"],plan:"The orchard can switch between a Night Orchard recovery duet, an Afterimage setup and Root Telegraph. An exposed front risks a follow-up strike.",counter:"Use Vane against Lullprickle, save Loam for Pincoil, and switch an exposed front before the next ordinary attack."},
    {id:"signal-weavers",name:"Signal Weavers",team:["prismpeep","bellgryph","ironblink"],plan:"The Chime lead and Ember reserve can expose your front with Signal Flare. The Alloy anchor shares Bell Foundry with Bellgryph.",counter:"Try Alloy against Prismpeep and Tide against Bellgryph or Ironblink. The lead’s Rime affinity adds to its Alloy weakness."}
  ];
  const duetNotes={
    ward:"The lead takes one quarter of the usual damage on the next hit.",mend:"Both partners regain up to a quarter of their maximum HP.",
    relay:"The partner takes the lead and halves the next hit.",lure:"Leaves the target at 1 HP or more, pins it for a turn and halves the reply.",
    mark:"Exposes a survivor. The next ordinary strike deals 50% more damage and pierces cover.",rush:"Breaks through cover for a heavy hit."
  };
  const standard=(species,id)=>typeof id==="string"&&Object.hasOwn(species,id)&&!species[id].bonus;
  function namedCrew(id,team){
    return Array.isArray(team)&&team.length===3?rivals.find(r=>r.id===id&&r.team.every((kin,i)=>kin===team[i]))?.name||null:null;
  }
  const valid=(species,ids)=>Array.isArray(ids)&&ids.length===3&&new Set(ids).size===3&&[...ids].every(id=>standard(species,id));
  function duetPairs(species,ids){
    return ids.flatMap((lead,i)=>ids.slice(i+1).map(mate=>{
      const d=window.WilderDuets.score(species[lead].type,species[mate].type);
      return {ids:[lead,mate],name:d.name,role:d.role,cost:d.cost,label:d.label,detail:duetNotes[d.role]};
    }));
  }
  function scoutDuets(species,selected,candidate){
    const ids=candidate===undefined?selected:[...selected,candidate];
    return duetPairs(species,ids).filter(d=>candidate===undefined||d.ids.includes(candidate)).map(d=>({
      label:d.name+" · "+d.cost+" beats",
      detail:d.ids.map(id=>species[id].name).join(" + ")+". "+d.detail
    }));
  }
  function cleanKit(ids,raw) {
    return window.WilderSparringGear?.normalize({left:raw},ids,ids).left||{};
  }
  function restore(raw,{species}) {
    const left=valid(species,raw?.left)?raw.left:starters,rightOK=valid(species,raw?.right);
    const rival=rivals.find(r=>r.id===raw?.rival)||rivals[0];
    const right=rightOK?raw.right:rival.team;
    const matches=rival.team.every((id,i)=>id===right[i]);
    const setup={left:left.slice(),right:right.slice(),rival:rightOK&&["shared","custom"].includes(raw.rival)?raw.rival:matches?rival.id:"custom",
      mode:raw?.mode==="local"?"local":"cpu"};
    if(raw?.first===1&&setup.mode==="cpu")setup.first=1;
    if(raw?.gear&&typeof raw.gear==="object"&&!Array.isArray(raw.gear)){
      setup.gear={left:cleanKit(left,raw.gear.left),right:cleanKit(right,raw.gear.right)};
    }
    return setup;
  }
  function create({game,row,image,go,render,notify,read,write,onStart}) {
    const species=game.species,dex=window.WilderKinDex,duets=window.WilderDuets,affinities=Object.keys(dex.types);
    const battle=window.WilderSparringBattle?.create({species});
    const gearDesk=window.WilderSparringGear;
    const signature=id=>window.WilderSparringSignatures?.byId(id);
    const grovePair=["mossbell","fernprickle"];
    const catalog=Object.values(species).filter(k=>!k.bonus).sort((a,b)=>a.name.localeCompare(b.name));
    const pageSize=8;
    const filters={left:{query:"",affinity:"All",family:"",page:0},right:{query:"",affinity:"All",family:"",page:0}};
    const paint=id=>image?image(id,false):dex.spriteUrl(id);
    const gearArt=item=>"art/gear/"+item.id+".png";
    const stats=k=>k.types.join(" / ")+(battle?" · "+battle.maxHp(k.id)+" HP":"");
    const own=side=>side==="left"?"Your team":"Rival team";
    const action=(key,label,value,detail="",extra={})=>row("spar-team-"+key,label,value,detail,extra);
    const visit=(path,label,detail="",extra={})=>action("open",label,path,detail,extra);
    const group=(title,rows,columns=1)=>({title,rows,columns});
    const label=i=>i===0?"Lead":"Slot "+(i+1);
    const where=(side,screen,slot)=>["edit",side,screen,...(slot==null?[]:[slot])].join(":");
    const compareGrove=(side,i)=>visit(where(side,"grove",i),"Compare Grove signatures","Mossbell and Fernprickle");
    const signatureCost=s=>s.cost+" "+(s.cost===1?"beat":"beats")+(s.family?" · one team pass":" · once per match");
    function signatureDetails(id) {
      const move=signature(id),art=species[id].emberArt,sections=[];
      if(art)sections.push({title:art.name+" · once per kin",text:art.description});
      if(move)sections.push({title:move.name+" · "+signatureCost(move),text:move.effect+" "+move.tradeoff+" "+move.counter+
        (move.family?" Herons and gliders share one pass per team each match.":"")});
      return sections;
    }
    const navigate=v=>go("sparring",v);
    const kit=side=>read().gear?.[side]||{};
    const sideGear=(side,contents)=>({left:kit("left"),right:kit("right"),[side]:contents});
    function encode(ids) {return valid(species,ids)?"#spar-v1="+ids.join(","):null;}
    function encodeLoadout(ids,gear={}) {
      if(!valid(species,ids)||!gear||typeof gear!=="object"||Array.isArray(gear))return null;
      if(!Object.keys(gear).length)return encode(ids);
      const clean=gearDesk?.validate({left:gear,right:{}},ids,ids)?.left;
      return clean?"#spar-v2="+ids.map(id=>clean[id]?id+"~"+clean[id]:id).join(","):null;
    }
    function decodeLoadout(hash) {
      if(typeof hash!=="string"||hash.length>180)return null;
      const match=/^#spar-v([12])=([a-z0-9~,-]+)$/.exec(hash);
      if(!match)return null;
      const slots=match[2].split(","),ids=[],gear={};
      if(slots.length!==3)return null;
      for(const slot of slots){
        const pair=slot.split("~"),[id,piece]=pair;
        if(!standard(species,id)||pair.length>2||pair.length===2&&(match[1]==="1"||!gearDesk?.byId(piece)))return null;
        ids.push(id);if(piece)gear[id]=piece;
      }
      return encodeLoadout(ids,gear)===hash?{ids,gear}:null;
    }
    const decode=hash=>decodeLoadout(hash)?.ids||null;
    function scout(ids,gear={}) {
      if(!valid(species,ids))return null;
      const roster=ids.map(id=>species[id]);
      const attackTypes=[...new Set(roster.flatMap(k=>k.skills.filter(m=>m.kind==="attack").map(m=>m.type)))];
      const coverage=affinities.filter(type=>attackTypes.some(move=>dex.effectiveness(move,[type])>1));
      const defense=affinities.map(type=>({type,weak:ids.filter(id=>dex.effectiveness(type,species[id].types)>1),
        resists:ids.filter(id=>dex.effectiveness(type,species[id].types)<1)}));
      const clean=cleanKit(ids,gear),equipment=ids.filter(id=>clean[id]).map(id=>({holder:id,...gearDesk.byId(clean[id])}));
      return {attackTypes,coverage,uncovered:affinities.filter(t=>!coverage.includes(t)),defense,equipment,signatures:ids.map(signature).filter(Boolean),
        emberArts:roster.filter(k=>k.emberArt).map(k=>({id:k.id,art:k.emberArt})),
        holes:defense.filter(d=>d.weak.length>=2&&!d.resists.length),duets:duetPairs(species,ids)};
    }
    function answers(ids,target) {
      return ids.map(id=>{
        const k=species[id],foe=species[target];
        const options=k.skills.filter(s=>s.kind==="attack").map(s=>({name:s.name,type:s.type,power:s.power,mult:dex.effectiveness(s.type,foe.types)}));
        const hit=options.sort((a,b)=>b.mult-a.mult||b.power-a.power)[0];
        const risk=Math.max(...foe.skills.filter(s=>s.kind==="attack").map(s=>dex.effectiveness(s.type,k.types)));
        return {kin:k.name,...hit,risk};
      }).sort((a,b)=>b.mult-a.mult||a.risk-b.risk||b.power-a.power);
    }
    function teamPage(side) {
      const ids=read()[side];
      const rows=ids.map((id,i)=>{
        const k=species[id];
        const equipped=gearDesk?.byId(kit(side)[id]);
        const details=[stats(k),k.emberArt?.name,signature(id)?.name,equipped?.name].filter(Boolean);
        if(details.length===1)details.push("Change or reorder");
        return visit(where(side,"member",i),k.name,details.join(" · "),{image:paint(id),badge:label(i)});
      });
      return {title:own(side),kicker:"SPARRING HALL   /   LEVEL 20",sections:[group("Battle order",rows),
        group("Practice",[
          action("ready","Review matchup",null,"Both teams and lead order",{tone:"primary"}),
          visit("edit:scout","Scout matchup","Coverage, openings and duets"),
          ...(signature("mossbell")?[compareGrove(side,0)]:[]),
          visit("edit:rivals","Choose a rival crew"),
          ...(side==="left"?[row("spar-view","Open team case","bench","Save this build or compare it with a saved trio.")]:[]),
          visit(where(side==="left"?"right":"left","team"),side==="left"?"Edit rival team":"Edit your team"),
          action("share","Copy team challenge link",side,"Share the lead, reserves and equipped gear.")
        ])]};
    }
    function memberPage(side,i) {
      const roster=read()[side],id=roster[i],k=species[id],equipped=gearDesk?.byId(kit(side)[id]);
      return {title:k.name,kicker:own(side).toUpperCase()+"   /   "+label(i).toUpperCase()+"   /   LEVEL 20",subtitle:stats(k),art:{src:paint(id)},
        sections:[...signatureDetails(id),group("Formation",[
          ...(gearDesk?[visit(where(side,"gear",i),equipped?equipped.name:"Choose equipment",equipped?"Equipped · change or remove":"One optional slot · six free pieces")]:[]),
          visit(where(side,"pick",i),"Choose a different kin","Search all "+catalog.length+" loaners",{tone:"primary"}),
          ...roster.flatMap((other,j)=>j===i?[]:[action("swap",j===0?"Make lead":"Trade with slot "+(j+1),side+":"+i+":"+j,species[other].name)]),
          visit(where(side,"team"),"Back to team")]),
          group("Skills",k.skills.map(skill=>({label:skill.name,detail:skill.kind==="attack"?skill.type+" · "+skill.power+" power":skill.kind==="guard"?"Strike and brace":"One recovery per match"})))]};
    }
    function gearPage(side,i) {
      const ids=read()[side],id=ids[i],items=kit(side),current=gearDesk.byId(items[id]);
      return {title:"Equip "+species[id].name,kicker:own(side).toUpperCase()+"   /   "+label(i).toUpperCase(),
        subtitle:"Each piece can trigger once per match. Choose a different piece for each teammate.",
        sections:[group("Equipment",gearDesk.items.map(item=>{
          const holder=ids.find(k=>items[k]===item.id);
          return visit(where(side,"piece",i)+":"+item.id,item.name,item.role,
            {image:gearArt(item),badge:holder===id?"Equipped":holder?"On "+species[holder].name:""});
        }),2),group("Your slot",[
          ...(current?[action("equip","Remove "+current.name,side+":"+i+":none","Leave this slot empty")]:[]),
          visit(where(side,"member",i),"Back to "+species[id].name,current?"Holding "+current.name:"Empty slot")])]};
    }
    function gearExample(item,side,i) {
      const s=read(),ids=s[side],k=species[ids[i]],foes=s[side==="left"?"right":"left"];
      const move=k.skills.find(m=>m.kind==="attack"),guard=k.skills.find(m=>m.kind==="guard");
      const mate=species[ids.find(id=>id!==k.id)];
      switch(item.id) {
        case "relay-bell":return "Choose Switch to bring "+k.name+" in from the bench. With one beat and a normal switch gain of one, the bell takes your team to three.";
        case "last-stitch":return "If a hit would take "+k.name+" from 8 HP to zero, it holds at 1 HP.";
        case "seam-hook":return "Use "+move.name+" against an exposed rival with two beats. "+k.name+" spends the opening and takes both beats away.";
        case "mender-wrap":return "Use "+guard.name+" with "+k.name+" in front. If "+mate.name+" is the only injured conscious reserve, it recovers up to "+Math.ceil(battle.maxHp(mate.id)/5)+" HP.";
        case "prism-lens":{
          const target=[...foes.map(id=>species[id]),...catalog].find(foe=>dex.effectiveness(move.type,foe.types)<1);
          return "Use "+move.name+" on "+target.name+". "+k.name+" gets ×1 affinity for that strike in place of ×"+Number(dex.effectiveness(move.type,target.types).toFixed(2))+".";
        }
        case "opening-pennant":return (i===0?"Keep "+k.name+" in front":"Move "+k.name+" to the lead")+" to start with one beat toward "+duets.score(k.type,mate.type).name+".";
      }
    }
    function piecePage(side,i,item) {
      const ids=read()[side],id=ids[i],k=species[id],gear=kit(side),other=ids.find(n=>n!==id&&gear[n]===item.id),current=gearDesk.byId(gear[id]);
      const detail=[other?species[other].name+" gives up this piece.":"",current&&current.id!==item.id?"Replaces "+current.name+".":""].filter(Boolean).join(" ");
      return {title:item.name,kicker:k.name.toUpperCase()+"   /   "+item.role.toUpperCase(),art:{src:gearArt(item),height:144},sections:[
        {title:"Trigger and effect",text:item.trigger+" "+item.effect},
        {title:"On "+k.name,text:gearExample(item,side,i)},
        {title:"Trade-off",text:item.cost},
        group("Equipment slot",[action("equip",other?"Move to "+k.name:current?.id===item.id?"Keep equipped":"Equip "+k.name,
          side+":"+i+":"+item.id,detail,{tone:"primary"}),visit(where(side,"gear",i),"Back to equipment")])]};
    }
    function list(side) {
      const f=filters[side],q=f.query.trim().toLowerCase();
      return catalog.filter(k=>(f.affinity==="All"||k.types.includes(f.affinity))&&(!f.family||signature(k.id)?.familyKey===f.family)&&
        (!q||k.name.toLowerCase().includes(q)||k.id.includes(q)||k.emberArt?.name.toLowerCase().includes(q)||signature(k.id)?.name.toLowerCase().includes(q)));
    }
    function travelingParty(side,slot) {
      const state=game.state;
      const roster=Array.isArray(state?.team)?state.team:Array.isArray(state?.party)?state.party:
        typeof game.team==="function"?game.team():[];
      if(!Array.isArray(roster))return [];
      const ids=[...new Set(roster.slice(0,6).map(k=>typeof k==="string"?k:k?.id).filter(id=>standard(species,id)))];
      const lead=ids.indexOf(state?.lead);
      if(lead>0)ids.unshift(...ids.splice(lead,1));
      return ids.map(id=>{
        const k=species[id],trailName=game.kin?.(id,{owned:true})?.name;
        const detail=(trailName&&trailName!==k.name?trailName+" on the trail":k.types.join(" / "))+" · Level 20 loaner";
        return visit(where(side,"candidate",slot)+":"+id,k.name,detail,{image:paint(id),badge:id===state?.lead?"Trail lead":""});
      });
    }
    function grovePage(side,i) {
      const ids=read()[side];
      const choices=grovePair.map(id=>{
        const move=signature(id),kin=species[id];
        return visit(where(side,"candidate",i)+":"+id,kin.name+" · "+move.name,move.effect+" "+move.counter,
          {image:paint(id),badge:signatureCost(move)});
      });
      return {title:"Compare Grove signatures",kicker:own(side).toUpperCase()+"   /   "+label(i).toUpperCase(),
        subtitle:"Both Grove kin have "+battle.maxHp("mossbell")+" HP at level 20. Which job does your team need?",
        sections:[group("Choose a profile",choices),group("Team slot",ids.map((id,j)=>visit(where(side,"grove",j),
          label(j)+" · "+species[id].name,"",{disabled:i===j})),3)]};
    }
    function picker(side,i) {
      const f=filters[side],found=list(side),pages=Math.max(1,Math.ceil(found.length/pageSize));
      f.page=Math.max(0,Math.min(pages-1,f.page));
      const party=f.page===0&&f.affinity==="All"&&!f.query.trim()&&!f.family?travelingParty(side,i):[];
      const passes=["beacon-pass","slipstream-pass"].map(id=>window.WilderSparringSignatures?.byId(id)).filter(move=>move?.family);
      const arts=["charquill","kilnbeak"].map(id=>species[id]).filter(k=>k?.emberArt);
      const rows=found.slice(f.page*pageSize,(f.page+1)*pageSize).map(k=>visit(where(side,"candidate",i)+":"+k.id,k.name,[k.types.join(" / "),k.emberArt?.name,signature(k.id)?.name].filter(Boolean).join(" · "),
        {image:paint(k.id),badge:read()[side].includes(k.id)?label(read()[side].indexOf(k.id)):""}));
      return {title:"Choose a loaner",kicker:own(side).toUpperCase()+"   /   "+label(i).toUpperCase(),sections:[
        group("Find a kin",[visit(where(side,"search",i),f.query?"Search · "+f.query:"Search by name or technique"),
          visit(where(side,"affinity",i),"Affinity · "+f.affinity),...(signature("mossbell")?[compareGrove(side,i)]:[])],2),
        ...(passes.length?[group("Browse by handoff",passes.map(move=>action("family",move.name,side+":"+i+":"+(f.family===move.familyKey?"all":move.familyKey),
          f.family===move.familyKey?"Clear family filter":move.familyKey==="beacon"?"Herons · expose the rival":"Gliders · heal the incoming kin",{badge:f.family===move.familyKey?"SELECTED":""})),2)]:[]),
        ...(arts.length?[group("Browse by Ember technique",arts.map(k=>action("ember",k.emberArt.name,side+":"+i+":"+k.id,
          f.query===k.emberArt.name?"Clear technique filter":k.emberArt.summary,{badge:f.query===k.emberArt.name?"SELECTED":""})),2)]:[]),
        ...(party.length?[group("Traveling party",party,2)]:[]),
        group(found.length+" matching kin",rows.length?rows:[{label:"No matching kin",detail:"Change the name or affinity."}],2),
        ...(pages>1?[group("Page "+(f.page+1)+" of "+pages,[
          action("page","Previous",side+":-1","",{disabled:f.page===0}),action("page","Next",side+":1","",{disabled:f.page===pages-1})],2)]:[]),
        group("",[visit(where(side,"team"),"Back to team")])]};
    }
    function candidate(side,i,id) {
      const k=species[id],ids=read()[side],at=ids.indexOf(id),next=changed(ids,i,id),report=scout(next);
      const previous=scout(ids).coverage,newHits=report.coverage.filter(t=>!previous.includes(t)),lostHits=previous.filter(t=>!report.coverage.includes(t));
      const changes=(newHits.length?" Gains advantage into "+newHits.join(", ")+".":"")+(lostHits.length?" Loses advantage into "+lostHits.join(", ")+".":"");
      const choice=at<0?"Choose "+k.name:at===i?"Keep "+k.name:"Move "+k.name+" to "+label(i).toLowerCase();
      return {title:k.name,kicker:"LEVEL 20 LOANER",subtitle:stats(k),art:{src:paint(id)},
        sections:[...signatureDetails(id),group(label(i)+" · "+own(side),[action("select",choice,side+":"+i+":"+id,at>=0&&at!==i?"Exchanges with "+species[ids[i]].name:"",{tone:"primary"}),
          ...(grovePair.includes(id)&&signature(id)?[compareGrove(side,i)]:[]),visit(where(side,"pick",i),"Back to results")]),
          group("Skills",k.skills.map(s=>({label:s.name,detail:s.kind==="attack"?s.type+" · "+s.power+" power":s.kind==="guard"?"Strike and brace":"One recovery per match"}))),
          {title:"With this formation",text:"Advantage against "+report.coverage.length+" of "+affinities.length+" single affinities."+changes+" "+
            (report.holes.length?"Shared weaknesses without a resistant switch: "+report.holes.map(d=>d.type).join(", ")+".":"No shared weakness lacks a resistant switch.")},
          {title:"Field notes",text:k.description}]};
    }
    function changed(ids,slot,id) {
      const next=ids.slice(),other=next.indexOf(id);
      if(other>=0)next[other]=next[slot];
      next[slot]=id;return next;
    }
    function enemyPage() {
      const s=read(),selected=rivals.find(r=>r.id===s.rival);
      return {title:"Choose a rival crew",kicker:"SPARRING HALL",sections:[
        group("Practice crews",rivals.map(r=>visit("edit:rival:"+r.id,r.name,r.team.map(id=>species[id].name).join(" · "),
          {image:paint(r.team[0]),badge:r.id===selected?.id?"SELECTED":""}))),
        group("Custom lineup",[visit("edit:right:team","Build a rival team",s.right.map(id=>species[id].name).join(" · "))])]};
    }
    function rivalPage(r) {
      return {title:r.name,kicker:"RIVAL DOSSIER",art:{src:paint(r.team[0]),caption:"Lead · "+species[r.team[0]].name},
        sections:[{title:"Battle plan",text:r.plan},{title:"Counterplay",text:r.counter},
          group("Lineup",r.team.map((id,i)=>({label:species[id].name,detail:label(i)+" · "+species[id].types.join(" / "),image:paint(id)}))),
          group("Practice",[action("rival","Face this crew",r.id,"Review matchup",{tone:"primary"}),visit("edit:rivals","Back to rival crews")])]};
    }
    function scouting(side) {
      const data=read(),otherSide=side==="left"?"right":"left",ids=data[side],rival=data[otherSide],report=scout(ids,kit(side)),names=arr=>arr.map(id=>species[id].name).join(", ");
      const otherGear=cleanKit(rival,kit(otherSide));
      const equipment=gearDesk?[...report.equipment.map(g=>({...g,side})),
        ...rival.filter(id=>otherGear[id]).map(id=>({...gearDesk.byId(otherGear[id]),holder:id,side:otherSide}))]:[];
      const signatures=[];
      for(const [owner,moves] of [[side,report.signatures],[otherSide,rival.map(signature).filter(Boolean)]]){
        for(const move of moves){
          const existing=signatures.find(s=>s.owner===owner&&s.move.id===move.id);
          if(existing)existing.ids.push(move.speciesId);
          else signatures.push({owner,move,ids:[move.speciesId]});
        }
      }
      const arts=[[side,ids],[otherSide,rival]].flatMap(([owner,team])=>team.filter(id=>species[id].emberArt).map(id=>{
        const art=species[id].emberArt;return {label:species[id].name+" · "+art.name,detail:art.description,badge:own(owner),image:paint(id)};
      }));
      const switches=report.defense.filter(d=>d.weak.length&&d.resists.length).sort((a,b)=>b.weak.length-a.weak.length).slice(0,2);
      const defense=report.holes.length?report.holes.map(h=>h.type+" threatens "+names(h.weak)+". Nobody resists it.").join(" "):
        "No unresisted shared weakness. "+switches.map(d=>species[d.resists[0]].name+" resists "+d.type+" for "+names(d.weak)+".").join(" ");
      return {title:"Matchup scout",kicker:own(side).toUpperCase()+"   /   LEVEL 20",sections:[
        group("Against their three",rival.map(id=>{
          const k=species[id],best=answers(ids,id)[0];
          return {label:k.name,detail:best.kin+" · "+best.name+" ×"+Number(best.mult.toFixed(2))+" · incoming up to ×"+Number(best.risk.toFixed(2)),image:paint(id)};
        })),...(arts.length?[group("Ember techniques",arts)]:[]),...(signatures.length?[group("Signature moves",signatures.map(({owner,move,ids})=>({
          label:names(ids)+" · "+move.name,badge:own(owner)+" · "+signatureCost(move),detail:move.effect+" "+move.counter+
            (move.family?" Herons and gliders share this use.":""),image:paint(ids[0])
        })))]:[]),...(equipment.length?[group("Visible equipment",equipment.map(g=>({label:species[g.holder].name+" · "+g.name,
          badge:own(g.side),detail:g.trigger+" "+g.effect})))]:[]),
        {title:"Attack coverage",text:"Strong into "+report.coverage.length+" / "+affinities.length+" single affinities. "+report.coverage.join(", ")+". "+
          (report.uncovered.length?"No advantage into "+report.uncovered.join(", ")+".":"Every single affinity is covered.")},
        {title:"Defensive gaps",text:defense.trim()},
        group("Duets",report.duets.map(d=>({label:d.name+" · "+d.cost+" beats",detail:names(d.ids)+". "+d.detail}))),
        group("Formation",[visit(where(side,"team"),"Edit this team"),visit(side==="left"?"edit:scout:right":"edit:scout","Scout the other side"),action("ready","Review matchup",null,"",{tone:"primary"})])]};
    }
    function page(value) {
      const [prefix,side,screen,slot,id]=String(value).split(":");
      if(prefix!=="edit")return null;
      if(side==="scout")return scouting(screen==="right"?"right":"left");
      if(side==="rivals")return enemyPage();
      if(side==="rival")return rivalPage(rivals.find(r=>r.id===screen)||rivals[0]);
      if(!Object.hasOwn(filters,side))return null;
      if(screen==="team")return teamPage(side);
      const i=Number(slot);
      if(![0,1,2].includes(i))return teamPage(side);
      if(screen==="member")return memberPage(side,i);
      if(screen==="grove"&&grovePair.every(signature))return grovePage(side,i);
      if(screen==="gear"&&gearDesk)return gearPage(side,i);
      if(screen==="piece"&&gearDesk)return gearDesk.byId(id)?piecePage(side,i,gearDesk.byId(id)):gearPage(side,i);
      if(screen==="pick")return picker(side,i);
      if(screen==="candidate")return standard(species,id)?candidate(side,i,id):picker(side,i);
      if(screen==="affinity")return {title:"Filter by affinity",kicker:"LOANER CATALOG",sections:[group("Matches either affinity",["All",...affinities].map(t=>action("affinity",t,side+":"+i+":"+t,"",{badge:filters[side].affinity===t?"SELECTED":""})),2)]};
      if(screen==="search")return {title:"Search by name or technique",kicker:"LOANER CATALOG",subtitle:filters[side].query||"Type a kin or technique name",sections:[
        group("Search",[visit(where(side,"pick",i),"Show "+list(side).length+" matches","",{tone:"primary"}),
          action("key","Space",side+": "),action("key","Delete letter",side+":delete"),action("key","Clear",side+":clear")],2),
        {grid:{cols:6,cells:[..."ABCDEFGHIJKLMNOPQRSTUVWXYZ-"].map(c=>action("key",c,side+":"+c))}}]};
      return teamPage(side);
    }
    function setKey(side,c) {
      const f=filters[side];
      if(c==="delete")f.query=f.query.slice(0,-1);
      else if(c==="clear")f.query="";
      else if(/^[A-Z -]$/i.test(c)&&f.query.length<40)f.query+=c.toLowerCase();
      f.page=0;render();
    }
    function key(e,value) {
      const [prefix,side,view,slot]=String(value).split(":");
      if(prefix!=="edit"||!Object.hasOwn(filters,side)||view!=="search"||e.ctrlKey||e.metaKey||e.altKey)return false;
      if(e.key==="Enter")navigate(where(side,"pick",slot));
      else if(e.key==="Backspace")setKey(side,"delete");
      else if(/^[A-Z -]$/i.test(e.key))setKey(side,e.key);
      else return false;
      return true;
    }
    function share(ids,gear) {
      const fragment=encodeLoadout(ids,gear),location=window.location;
      if(!fragment||!location)return;
      const url=location.origin+location.pathname+(location.search||"")+fragment;
      const fallback=()=>{if(typeof window.prompt==="function")window.prompt("Copy this Sparring Hall challenge link",url);else notify(url);};
      const clipboard=window.navigator?.clipboard;
      if(!clipboard?.writeText){fallback();return;}
      try{clipboard.writeText(url).then(()=>notify("Team challenge link copied."),fallback);}catch{fallback();}
    }
    function act(id,value) {
      if(!id.startsWith("spar-team-"))return false;
      const command=id.slice("spar-team-".length),[side,slot,target]=String(value??"").split(":");
      if(command==="open"){navigate(value);return true;}
      if(command==="ready"){onStart();return true;}
      if(command==="rival"){
        const r=rivals.find(x=>x.id===value);
        if(r){write({right:r.team.slice(),rival:r.id,...(read().gear?{gear:sideGear("right",{})}:{})});onStart();}
        return true;
      }
      if(!Object.hasOwn(filters,side))return false;
      const i=Number(slot),team=read()[side];
      if(command==="page"){filters[side].page+=Math.sign(Number(slot))||0;render();}
      else if(command==="key")setKey(side,slot);
      else if(command==="ember"&&[0,1,2].includes(i)&&["charquill","kilnbeak"].includes(target)&&species[target].emberArt){
        const name=species[target].emberArt.name;
        Object.assign(filters[side],{family:"",query:filters[side].query===name?"":name,affinity:"All",page:0});navigate(where(side,"pick",i));
      }
      else if(command==="family"&&[0,1,2].includes(i)&&["beacon","slipstream","all"].includes(target)){
        Object.assign(filters[side],{family:target==="all"?"":target,query:"",affinity:"All",page:0});
        navigate(where(side,"pick",i));
      }
      else if(command==="affinity"&&[0,1,2].includes(i)&&["All",...affinities].includes(target)){
        filters[side].affinity=target;filters[side].page=0;navigate(where(side,"pick",i));
      }else if(command==="share")share(team,kit(side));
      else if(command==="equip"&&gearDesk&&[0,1,2].includes(i)&&(target==="none"||gearDesk.byId(target))){
        const holder=team[i],next={...kit(side)};
        for(const id of team)if(id===holder||next[id]===target)delete next[id];
        if(target!=="none")next[holder]=target;
        write({gear:sideGear(side,next)});navigate(where(side,"member",i));
      }
      else if((command==="select"||command==="swap")&&[0,1,2].includes(i)){
        const selected=command==="swap"?team[Number(target)]:target;
        if(standard(species,selected)){
          const next=changed(team,i,selected);
          if(next.some((v,j)=>v!==team[j]))write({[side]:next,...(side==="right"?{rival:"custom"}:{}),
            ...(read().gear?{gear:sideGear(side,cleanKit(next,kit(side)))}:{})});
          navigate(where(side,"team"));
        }
      }else return false;
      return true;
    }
    return {page,act,key,restore:raw=>restore(raw,{species}),decode,encode,decodeLoadout,encodeLoadout,scout,rivals};
  }
  window.WilderSparringTeams={create,restore,scoutDuets,namedCrew};
})();
