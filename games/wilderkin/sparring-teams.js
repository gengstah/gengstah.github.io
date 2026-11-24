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
    ward:"Takes a quarter reply under cover.",mend:"Both partners regain up to a quarter of their health.",
    relay:"The partner takes the lead under half cover.",lure:"Leaves at least 1 HP, blocks the next direct switch and halves the reply.",
    mark:"Exposes a survivor to a stronger ordinary strike through cover.",rush:"Breaks through cover for a heavy hit."
  };
  const standard=(species,id)=>typeof id==="string"&&Object.hasOwn(species,id)&&!species[id].bonus;
  const valid=(species,ids)=>Array.isArray(ids)&&ids.length===3&&new Set(ids).size===3&&[...ids].every(id=>standard(species,id));
  function restore(raw,{species}) {
    const left=valid(species,raw?.left)?raw.left:starters,rightOK=valid(species,raw?.right);
    const rival=rivals.find(r=>r.id===raw?.rival)||rivals[0];
    const right=rightOK?raw.right:rival.team;
    const matches=rival.team.every((id,i)=>id===right[i]);
    return {left:left.slice(),right:right.slice(),rival:rightOK&&["shared","custom"].includes(raw.rival)?raw.rival:matches?rival.id:"custom",
      mode:raw?.mode==="local"?"local":"cpu"};
  }
  function create({game,row,image,go,render,notify,read,write,onStart}) {
    const species=game.species,dex=window.WilderKinDex,duets=window.WilderDuets,affinities=Object.keys(dex.types);
    const battle=window.WilderSparringBattle?.create({species});
    const catalog=Object.values(species).filter(k=>!k.bonus).sort((a,b)=>a.name.localeCompare(b.name));
    const pageSize=8;
    const filters={left:{query:"",affinity:"All",page:0},right:{query:"",affinity:"All",page:0}};
    const paint=id=>image?image(id,false):dex.spriteUrl(id);
    const stats=k=>k.types.join(" / ")+(battle?" · "+battle.maxHp(k.id)+" HP":"");
    const own=side=>side==="left"?"Your team":"Rival team";
    const action=(key,label,value,detail="",extra={})=>row("spar-team-"+key,label,value,detail,extra);
    const visit=(path,label,detail="",extra={})=>action("open",label,path,detail,extra);
    const group=(title,rows,columns=1)=>({title,rows,columns});
    const label=i=>i===0?"Lead":"Slot "+(i+1);
    const where=(side,screen,slot)=>["edit",side,screen,...(slot==null?[]:[slot])].join(":");
    const navigate=v=>go("sparring",v);
    function encode(ids) {return valid(species,ids)?"#spar-v1="+ids.join(","):null;}
    function decode(hash) {
      if(typeof hash!=="string"||hash.length>150||!/^#spar-v1=[a-z0-9-]+,[a-z0-9-]+,[a-z0-9-]+$/.test(hash))return null;
      const ids=hash.slice(9).split(",");
      return valid(species,ids)?ids:null;
    }
    function scout(ids) {
      if(!valid(species,ids))return null;
      const roster=ids.map(id=>species[id]);
      const attackTypes=[...new Set(roster.flatMap(k=>k.skills.filter(m=>m.kind==="attack").map(m=>m.type)))];
      const coverage=affinities.filter(type=>attackTypes.some(move=>dex.effectiveness(move,[type])>1));
      const defense=affinities.map(type=>({type,weak:ids.filter(id=>dex.effectiveness(type,species[id].types)>1),
        resists:ids.filter(id=>dex.effectiveness(type,species[id].types)<1)}));
      const pairs=[];
      for(let a=0;a<2;a++)for(let b=a+1;b<3;b++) {
        const d=duets.score(roster[a].type,roster[b].type);
        pairs.push({ids:[ids[a],ids[b]],name:d.name,role:d.role,cost:d.cost,label:d.label,detail:duetNotes[d.role]});
      }
      return {attackTypes,coverage,uncovered:affinities.filter(t=>!coverage.includes(t)),defense,
        holes:defense.filter(d=>d.weak.length>=2&&!d.resists.length),duets:pairs};
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
        return visit(where(side,"member",i),k.name,stats(k)+" · Change or reorder",{image:paint(id),badge:label(i)});
      });
      return {title:own(side),kicker:"SPARRING HALL   /   LEVEL 20",sections:[group("Battle order",rows),
        group("Practice",[
          action("ready","Review matchup",null,"Both teams and lead order",{tone:"primary"}),
          visit("edit:scout","Scout matchup","Coverage, openings and duets"),
          visit("edit:rivals","Choose a rival crew"),
          visit(where(side==="left"?"right":"left","team"),side==="left"?"Edit rival team":"Edit your team"),
          action("share","Copy team challenge link",side,"A friend can face this exact lineup and lead.")
        ])]};
    }
    function memberPage(side,i) {
      const roster=read()[side],id=roster[i],k=species[id];
      return {title:k.name,kicker:own(side).toUpperCase()+"   /   "+label(i).toUpperCase()+"   /   LEVEL 20",subtitle:stats(k),art:{src:paint(id)},
        sections:[group("Formation",[
          visit(where(side,"pick",i),"Choose a different kin","Search all "+catalog.length+" loaners",{tone:"primary"}),
          ...roster.flatMap((other,j)=>j===i?[]:[action("swap",j===0?"Make lead":"Trade with slot "+(j+1),side+":"+i+":"+j,species[other].name)]),
          visit(where(side,"team"),"Back to team")]),
          group("Skills",k.skills.map(skill=>({label:skill.name,detail:skill.kind==="attack"?skill.type+" · "+skill.power+" power":skill.kind==="guard"?"Strike and brace":"One recovery per match"})))]};
    }
    function list(side) {
      const f=filters[side],q=f.query.trim().toLowerCase();
      return catalog.filter(k=>(f.affinity==="All"||k.types.includes(f.affinity))&&(!q||k.name.toLowerCase().includes(q)||k.id.includes(q)));
    }
    function picker(side,i) {
      const f=filters[side],found=list(side),pages=Math.max(1,Math.ceil(found.length/pageSize));
      f.page=Math.max(0,Math.min(pages-1,f.page));
      const rows=found.slice(f.page*pageSize,(f.page+1)*pageSize).map(k=>visit(where(side,"candidate",i)+":"+k.id,k.name,k.types.join(" / "),
        {image:paint(k.id),badge:read()[side].includes(k.id)?label(read()[side].indexOf(k.id)):""}));
      return {title:"Choose a loaner",kicker:own(side).toUpperCase()+"   /   "+label(i).toUpperCase(),sections:[
        group("Find a kin",[visit(where(side,"search",i),f.query?"Name · "+f.query:"Search by name"),
          visit(where(side,"affinity",i),"Affinity · "+f.affinity)],2),
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
        sections:[group(label(i)+" · "+own(side),[action("select",choice,side+":"+i+":"+id,at>=0&&at!==i?"Exchanges with "+species[ids[i]].name:"",{tone:"primary"}),
          visit(where(side,"pick",i),"Back to results")]),
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
      const data=read(),ids=data[side],rival=data[side==="left"?"right":"left"],report=scout(ids),names=arr=>arr.map(id=>species[id].name).join(", ");
      const switches=report.defense.filter(d=>d.weak.length&&d.resists.length).sort((a,b)=>b.weak.length-a.weak.length).slice(0,2);
      const defense=report.holes.length?report.holes.map(h=>h.type+" threatens "+names(h.weak)+". Nobody resists it.").join(" "):
        "No unresisted shared weakness. "+switches.map(d=>species[d.resists[0]].name+" resists "+d.type+" for "+names(d.weak)+".").join(" ");
      return {title:"Matchup scout",kicker:own(side).toUpperCase()+"   /   LEVEL 20",sections:[
        group("Against their three",rival.map(id=>{
          const k=species[id],best=answers(ids,id)[0];
          return {label:k.name,detail:best.kin+" · "+best.name+" ×"+Number(best.mult.toFixed(2))+" · incoming up to ×"+Number(best.risk.toFixed(2)),image:paint(id)};
        })),{title:"Attack coverage",text:"Strong into "+report.coverage.length+" / "+affinities.length+" single affinities. "+report.coverage.join(", ")+". "+
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
      if(screen==="pick")return picker(side,i);
      if(screen==="candidate")return standard(species,id)?candidate(side,i,id):picker(side,i);
      if(screen==="affinity")return {title:"Filter by affinity",kicker:"LOANER CATALOG",sections:[group("Matches either affinity",["All",...affinities].map(t=>action("affinity",t,side+":"+i+":"+t,"",{badge:filters[side].affinity===t?"SELECTED":""})),2)]};
      if(screen==="search")return {title:"Search by name",kicker:"LOANER CATALOG",subtitle:filters[side].query||"Enter a name",sections:[
        group("Search",[visit(where(side,"pick",i),"Show "+list(side).length+" matches","",{tone:"primary"}),
          action("key","Delete letter",side+":delete"),action("key","Clear",side+":clear")],2),
        {grid:{cols:6,cells:[..."ABCDEFGHIJKLMNOPQRSTUVWXYZ-"].map(c=>action("key",c,side+":"+c))}}]};
      return teamPage(side);
    }
    function setKey(side,c) {
      const f=filters[side];
      if(c==="delete")f.query=f.query.slice(0,-1);
      else if(c==="clear")f.query="";
      else if(/^[A-Z-]$/i.test(c)&&f.query.length<40)f.query+=c.toLowerCase();
      f.page=0;render();
    }
    function key(e,value) {
      const [prefix,side,view,slot]=String(value).split(":");
      if(prefix!=="edit"||!Object.hasOwn(filters,side)||view!=="search"||e.ctrlKey||e.metaKey||e.altKey)return false;
      if(e.key==="Enter")navigate(where(side,"pick",slot));
      else if(e.key==="Backspace")setKey(side,"delete");
      else if(/^[A-Z-]$/i.test(e.key))setKey(side,e.key);
      else return false;
      return true;
    }
    function share(ids) {
      const fragment=encode(ids),location=window.location;
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
      if(command==="rival"){const r=rivals.find(x=>x.id===value);if(r){write({right:r.team.slice(),rival:r.id});onStart();}return true;}
      if(!Object.hasOwn(filters,side))return false;
      const i=Number(slot),team=read()[side];
      if(command==="page"){filters[side].page+=Math.sign(Number(slot))||0;render();}
      else if(command==="key")setKey(side,slot);
      else if(command==="affinity"&&[0,1,2].includes(i)&&["All",...affinities].includes(target)){
        filters[side].affinity=target;filters[side].page=0;navigate(where(side,"pick",i));
      }else if(command==="share")share(team);
      else if((command==="select"||command==="swap")&&[0,1,2].includes(i)){
        const selected=command==="swap"?team[Number(target)]:target;
        if(standard(species,selected)){
          const next=changed(team,i,selected);
          if(next.some((v,j)=>v!==team[j]))write(side==="left"?{left:next}:{right:next,rival:"custom"});
          navigate(where(side,"team"));
        }
      }else return false;
      return true;
    }
    return {page,act,key,restore:raw=>restore(raw,{species}),decode,encode,scout,rivals};
  }
  window.WilderSparringTeams={create,restore};
})();
