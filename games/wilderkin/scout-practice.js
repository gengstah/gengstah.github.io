// Scout Table practice registers four in public, then seals two independent trios before the opening draw.
(() => {
  "use strict";
  const route="scout-practice",saveKey="wilderkin.scout-practice.v1",pageSize=8;
  const starters=["sprigkit","cindlet","dewfin","gustlance"];
  const coaches=[
    {id:"weir",name:"Nell Weir",team:["mossbell","coalmoth","glimmeray","pincoil"],
      gear:{mossbell:"opening-pennant",coalmoth:"prism-lens",glimmeray:"mender-wrap",pincoil:"relay-bell"},
      plan:"Nell covers the river crossing with Grove, Ember, Tide and Arc. Pincoil can punish the Tide kin you bring for Coalmoth."},
    {id:"pike",name:"Kit Pike",team:["gustlance","arcbill","icereeve","kilnbeak"],
      gear:{gustlance:"opening-pennant",arcbill:"relay-bell",icereeve:"last-stitch",kilnbeak:"prism-lens"},
      plan:"Kit’s herons share Beacon Pass. One can expose a target and hand off to an attacker. An Arc strike can reach several of the four."}
  ];
  const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((x,i)=>x===b[i]);
  const group=(title,rows,columns=1)=>({title,rows,columns});
  const matches=v=>typeof v==="string"&&(v===route||v.startsWith(route+":"));
  const empty=()=>({v:1,ids:starters.slice(),gear:{gustlance:"opening-pennant"},coach:"weir",phase:"register",picks:[]});
  const rosterGear=(ids,gear)=>Object.fromEntries(ids.filter(id=>gear[id]).map(id=>[id,gear[id]]));
  function rollBell(){
    const value=new Uint8Array(1);
    if(!window.crypto?.getRandomValues)return 1+Math.floor(Math.random()*6);
    do{window.crypto.getRandomValues(value);}while(value[0]>=252);
    return 1+value[0]%6;
  }
  function measure(sim,ours,rival){
    // Every pairing uses a real level-20 forecast on a fresh battlefield, with its published gear.
    // Bench identities do not affect ordinary opening strikes. Retain both sides of each pairing.
    function readPair(a,b){
      const left=[a,...ours.ids.filter(x=>x!==a).slice(0,2)],right=[b,...rival.team.filter(x=>x!==b).slice(0,2)];
      const gear={left:rosterGear(left,ours.gear),right:rosterGear(right,rival.gear)};
      const best=first=>{
        const moves=sim.options(sim.start(left,right,first,gear)).filter(m=>m.kind==="attack"&&m.available);
        return moves.reduce((max,m)=>m.damage>max.damage?m:max);
      };
      return {us:best(0),them:best(1)};
    }
    const matrix=Object.fromEntries(ours.ids.map(a=>[a,Object.fromEntries(rival.team.map(b=>[b,readPair(a,b)]))]));
    const edge=(a,b)=>{
      const m=matrix[a][b];
      return m.them.damage/sim.maxHp(a)-m.us.damage/sim.maxHp(b);
    };
    const leadScore=b=>ours.ids.reduce((n,a)=>n+edge(a,b),0)/4+(rival.gear[b]==="opening-pennant"?.025:0);
    let bestTeam=null,bestScore=-Infinity;
    for(const omitted of rival.team){
      const three=rival.team.filter(id=>id!==omitted);
      const coverage=ours.ids.map(a=>Math.max(...three.map(b=>edge(a,b))));
      const lead=three.reduce((best,id)=>leadScore(id)>leadScore(best)?id:best);
      const score=coverage.reduce((n,v)=>n+v,0)+Math.min(...coverage)+leadScore(lead);
      if(score>bestScore){
        bestScore=score;
        bestTeam=[lead,...three.filter(id=>id!==lead)];
      }
    }
    return {matrix,order:bestTeam};
  }
  const coachName=id=>coaches.find(c=>c.id===id)?.name;
  function checkCard(raw,setup,first,species,sim){
    const rival=coaches.find(c=>c.id===raw?.coach),ids=raw?.ids;
    if(!rival || raw.v!==1 || setup.mode!=="cpu" || setup.rival!=="custom" ||
      !Number.isInteger(raw.die) || raw.die<1 || raw.die>6 || raw.die%2!==first ||
      !Array.isArray(ids) || ids.length!==4 || new Set(ids).size!==4 ||
      ![...ids].every(id=>typeof id==="string" && Object.hasOwn(species,id) && !species[id].bonus) ||
      !same(raw.picks,setup.left) || !setup.left.every(id=>ids.includes(id)))return null;
    const fitting=window.WilderSparringGear.validate({left:raw.gear},ids,[]);
    if(!fitting || !setup.left.every(id=>setup.gear?.left?.[id]===fitting.left[id]) ||
      !setup.right.every(id=>setup.gear?.right?.[id]===rival.gear[id]))return null;
    const card={v:1,coach:rival.id,ids:ids.slice(),gear:fitting.left,picks:setup.left.slice(),die:raw.die};
    return same(measure(sim,card,rival).order,setup.right)?card:null;
  }
  function filmRosters(raw,setup,first,species,sim){
    const card=checkCard(raw,setup,first,species,sim);
    if(!card)return null;
    const rival=coaches.find(c=>c.id===card.coach);
    return {card,name:rival.name,rosters:[{ids:card.ids,gear:card.gear},{ids:rival.team.slice(),gear:{...rival.gear}}]};
  }
  function create({game,sim,row,image,show,live,playFromPractice,readSetup}){
    const species=game.species,kit=window.WilderSparringGear;
    const catalog=Object.values(species).filter(k=>!k.bonus).sort((a,b)=>a.name.localeCompare(b.name));
    const standard=id=>typeof id==="string"&&Object.hasOwn(species,id)&&!species[id].bonus;
    const validFour=ids=>Array.isArray(ids)&&ids.length===4&&new Set(ids).size===4&&[...ids].every(standard);
    const name=id=>species[id].name;
    const select=(id,label,value,detail="",extra={})=>row("scout-pr-"+id,label,value,detail,extra);
    const link=(label,path,detail="",extra={})=>select("view",label,path,detail,extra);
    const coach=()=>coaches.find(c=>c.id===draft.coach);
    const gearLabel=(id,gear)=>kit.byId(gear[id])?.name||"No gear";
    const kinCard=(id,gear,badge)=>({label:name(id),detail:species[id].types.join(" / ")+" · "+gearLabel(id,gear),image:image(id),badge});
    const path=part=>part?route+":"+part:route;
    const mark=()=>{try{window.localStorage.setItem(saveKey,JSON.stringify(draft));}catch{/* Session-only play. */}};
    let cache=null;
    function report(){
      const key=JSON.stringify([draft.coach,draft.ids,draft.gear]);
      if(cache?.key!==key)cache={key,...measure(sim,draft,coach())};
      return cache;
    }
    function load(){
      let raw;try{raw=JSON.parse(window.localStorage.getItem(saveKey));}catch{/* A new card works without storage. */}
      if(raw?.v!==1||!validFour(raw.ids)||!coaches.some(c=>c.id===raw.coach)||
        !kit.validate({left:raw.gear},raw.ids,[]))return empty();
      const clean={...empty(),ids:raw.ids.slice(),gear:{...raw.gear},coach:raw.coach};
      if(!["pick","reveal","played"].includes(raw.phase)||!Array.isArray(raw.picks)||raw.picks.length>3||
        !raw.picks.every(id=>clean.ids.includes(id))||new Set(raw.picks).size!==raw.picks.length)return clean;
      clean.phase="pick";clean.picks=raw.picks.slice();
      if(["reveal","played"].includes(raw.phase)&&clean.picks.length===3&&Number.isInteger(raw.die)&&raw.die>=1&&raw.die<=6){
        clean.phase=raw.phase;clean.die=raw.die;
      }
      return clean;
    }
    let draft=load(),query="";
    function resetPicks(){draft.phase="register";draft.picks=[];delete draft.die;mark();show(route);}
    function withFour(ids,gear){
      if(!validFour(ids))return;
      draft.ids=ids.slice();draft.gear=kit.normalize({left:gear},ids,[]).left;resetPicks();
    }
    function register(){
      const rival=coach(),mine=draft.ids;
      return {title:"Scout Table practice",kicker:"FOUR REGISTERED  /  THREE FIGHT",subtitle:"Register four level-20 kin with their gear. Both coaches see the two rosters before choosing a lead and two reserves.",
        sections:[group("At the table",[
          select("register","Register these four",null,"Scout "+rival.name+" and privately pick your trio.",{tone:"primary"}),
          ...(live()?[row("spar-view","Resume your Hall match","match","Your current fight is saved.")]:[])]),
          group("Your registered four",mine.map((id,i)=>select("view",name(id),path("member:"+i),species[id].types.join(" / ")+" · "+gearLabel(id,draft.gear),{image:image(id)})),2),
          group("Choose a coach",coaches.map(c=>select("coach",c.name,c.id,c.plan,{image:image(c.team[0]),badge:c.id===rival.id?"Selected":""}))),
          group("Borrow a roster",[
            select("borrow","Bring my Hall trio","hall","Keeps your three and their gear. Fills the fourth place."),
            ...(game.state.team?.length?[select("borrow","Bring my travelers","trail","Your trail leader comes first. The Hall supplies level-20 copies.")]:[]),
            select("borrow","Use the starter four","starter","Sprigkit, Cindlet, Dewfin and Gustlance.")])]};
    }
    function member(slot){
      const id=draft.ids[slot],k=species[id];
      return {title:k.name,kicker:"SCOUT TABLE   /   REGISTRATION",art:{src:image(id)},subtitle:k.types.join(" / ")+" · "+sim.maxHp(id)+" HP at level 20.",
        sections:[group("Registration slot",[
          link("Choose a different kin",path("catalog:"+slot+":0"),"Browse all "+catalog.length+" loaners.",{tone:"primary"}),
          link("Choose gear",path("gear:"+slot),gearLabel(id,draft.gear)),link("Back to your four",route)]),
          group("Ordinary moves",k.skills.filter(s=>!s.trained).map(s=>({label:s.name,detail:s.description}))),
          ...(k.emberArt?[{title:k.emberArt.name,text:k.emberArt.description}]:[])]};
    }
    function catalogPage(slot,page){
      const hits=catalog.filter(k=>k.name.toLowerCase().includes(query));const pages=Math.max(1,Math.ceil(hits.length/pageSize));
      page=Math.max(0,Math.min(page,pages-1));
      const move=n=>path("catalog:"+slot+":"+n);
      return {title:"Choose a registered kin",kicker:"LOANER CATALOG   /   "+(page+1)+" OF "+pages,sections:[group("Find a kin",[
        select("search",query?"Search · "+query:"Search by name",slot,"Enter all or part of a name."),...(query?[select("clear","Clear search",slot)]:[])]),
        group(hits.length+(hits.length===1?" loaner":" loaners"),hits.slice(page*pageSize,(page+1)*pageSize).map(k=>select("choose",k.name,slot+"|"+k.id,k.types.join(" / "),
          {image:image(k.id),badge:draft.ids.includes(k.id)?"Registered":"",disabled:draft.ids.includes(k.id)})),2),
        group("Catalog pages",[...(page?[link("Previous",move(page-1))]:[]),...(page+1<pages?[link("Next",move(page+1))]:[]),link("Back to "+name(draft.ids[slot]),path("member:"+slot))],2)]};
    }
    function gearPage(slot){
      const id=draft.ids[slot];
      return {title:"Equip "+name(id),kicker:"PUBLIC GEAR   /   ONE OF EACH PER FOUR",sections:[group("Choose one piece",kit.items.map(item=>{
        const holder=draft.ids.find(k=>draft.gear[k]===item.id);
        return select("equip",item.name,slot+"|"+item.id,item.effect,{image:"art/gear/"+item.id+".png",
          badge:holder===id?"Equipped":holder?"On "+name(holder):"",disabled:!!holder});
      })),group("Equipment slot",[...(draft.gear[id]?[select("equip","Remove gear",slot+"|none")]:[]),link("Back to your four",route)])]};
    }
    const pct=(val,hp)=>val/hp;
    function prospect(id){
      const matrix=report().matrix[id],ids=coach().team;
      const prey=ids.reduce((best,k)=>pct(matrix[k].us.damage,sim.maxHp(k))>pct(matrix[best].us.damage,sim.maxHp(best))?k:best);
      const danger=ids.reduce((best,k)=>matrix[k].them.damage>matrix[best].them.damage?k:best);
      return matrix[prey].us.label+" hits "+name(prey)+" for "+matrix[prey].us.damage+". "+name(danger)+" threatens "+name(id)+" for "+matrix[danger].them.damage+".";
    }
    function pick(){
      const rival=coach(),p=draft.picks;
      return {title:"Pick your three",kicker:"SCOUT TABLE   /   "+rival.name.toUpperCase(),subtitle:rival.plan,
        sections:[group("Your order · "+p.length+" / 3",[
          ...(p.length?[{label:p.map(name).join(" → "),detail:"First kin leads. Tap a selected kin below to remove it."}]:[]),
          ...(p.length>=2?[link(p.length===2?"Compare both third picks":"Your trio’s duets",path("duets"),
            p.length===2?"Read the moves each candidate can make with your first two kin.":"See the moves and beat costs available to these three.")]:[]),
          select("lock","Lock trio and roll for first",null,"The coach has picked from your public four. Reveal both orders.",{disabled:p.length!==3,tone:"primary"}),
          link("Scout all four rivals",path("scout"),"Their gear, likely duets and individual opening matchups.")]),
          group("Choose in battle order",draft.ids.map(id=>select("pick",name(id),id,prospect(id),{image:image(id),badge:p.includes(id)?(p.indexOf(id)===0?"Lead":"Reserve "+p.indexOf(id)):"",
            disabled:p.length===3&&!p.includes(id)}))),
          group(rival.name+" registered",rival.team.map(id=>kinCard(id,rival.gear)),2),
          group("Registration",[select("restart","Reopen registration",null,"Return all four to the table and clear the picks.")])]};
    }
    function privateDuets(){
      const picks=draft.picks,duets=id=>window.WilderSparringTeams.scoutDuets(species,picks,id);
      const comparing=picks.length===2;
      const sections=comparing?draft.ids.filter(id=>!picks.includes(id)).map(id=>
        group(name(id)+" as third",[
          ...duets(id),
          select("pick","Choose "+name(id)+" as third",id,"Keep "+name(picks[0])+" in the lead.",{image:image(id),tone:"primary"})
        ])):[];
      sections.push(group(comparing?"Your existing pair":"Your trio’s three pairs",duets()),
        group("Your order",[link(comparing?"Back to the picks":"Review and lock your trio",route)]));
      return {title:comparing?"Compare both third picks":"Your trio’s duets",kicker:"SCOUT TABLE   /   PRIVATE PICKS",
        subtitle:picks.map(name).join(" → "),sections};
    }
    function scouting(){
      const rival=coach(),m=report().matrix;
      const rows=rival.team.map(b=>{
        const read=draft.ids.reduce((best,a)=>m[a][b].us.damage>m[best][b].us.damage?a:best),pair=m[read][b];
        return link(name(b)+" · "+gearLabel(b,rival.gear),path("rival:"+b),species[b].types.join(" / ")+". "+name(read)+"’s "+pair.us.label+" deals "+pair.us.damage+". "+name(b)+"’s "+pair.them.label+" deals "+pair.them.damage+".",{image:image(b)});
      });
      const duets=[];
      for(let i=0;i<rival.team.length;i++)for(const other of rival.team.slice(i+1)){
        const a=rival.team[i],pair=window.WilderDuets.score(species[a].type,species[other].type);
        duets.push({label:pair.name,detail:name(a)+" + "+name(other)+" · "+pair.label+" · "+pair.cost+" beats",image:image(a)});
      }
      return {title:rival.name+"’s scouting card",kicker:"FOUR PUBLIC KIN   /   LEVEL 20",subtitle:"Damage is the strongest ordinary opening strike from full HP before either side moves.",
        sections:[group("Back to your order",[link("Choose your three",route)]),group("Read their four",rows),group("Possible duets",duets,2)]};
    }
    function rivalCard(id){
      const rival=coach(),matrix=report().matrix,item=kit.byId(rival.gear[id]);
      return {title:name(id),kicker:rival.name.toUpperCase()+"   /   PUBLIC REGISTRATION",art:{src:image(id)},
        subtitle:species[id].types.join(" / ")+" · "+sim.maxHp(id)+" HP. "+item.name+" · "+item.effect,
        sections:[group("Against your four",draft.ids.map(a=>{
          const m=matrix[a][id];
          return {label:name(a),image:image(a),detail:name(a)+"’s "+m.us.label+" deals "+m.us.damage+". "+name(id)+"’s "+m.them.label+" deals "+m.them.damage+"."};
        })),group("At the table",[link("Choose your three",route),link("Return to scouting",path("scout"))])]};
    }
    function setup(){
      const left=draft.picks.slice(),right=report().order.slice();
      return {mode:"cpu",rival:"custom",left,right,gear:{left:rosterGear(left,draft.gear),right:rosterGear(right,coach().gear)}};
    }
    function reveal(){
      const s=setup(),rival=coach(),first=draft.die%2,v=report().matrix[s.left[0]][s.right[0]],played=draft.phase==="played";
      const hallRecord=game.state.sparring?.match;
      const recorded=hallRecord?.scout;
      const sameMatch=recorded && recorded.coach===draft.coach && recorded.die===draft.die && same(recorded.ids,draft.ids) &&
        same(recorded.picks,draft.picks) && draft.ids.every(id=>draft.gear[id]===recorded.gear[id]);
      const result=played&&sameMatch&&!live();
      return {title:"Both trios revealed",kicker:"SCOUT TABLE   /   "+rival.name.toUpperCase(),
        subtitle:"The bell die showed "+draft.die+". "+(first?rival.name+" opens.":"You open.")+" Odd rolls go to the coach, even rolls to you.",
        sections:[group("At the bell",[
          ...(live()?[row("spar-view",sameMatch?"Resume this match":"Resume your Hall match","match","Your current fight is saved.",{tone:"primary"})]:
            result?[row("spar-view","View match result","result","Open the action log or replay a decision.",{tone:"primary"})]:
            !played?[select("play","Play the match",null,"Both teams start at full health with their selected gear.",{tone:"primary"})]:[]),
          select("restart",played?"Register for another match":"Start another registration",null,"Keep these four and choose a new lineup.")]),
          {title:name(s.left[0])+" faces "+name(s.right[0]),text:name(s.left[0])+"’s "+v.us.label+" deals "+v.us.damage+". "+name(s.right[0])+"’s "+v.them.label+" deals "+v.them.damage+" from full HP."},
          ...[[s.left,draft.gear,"Your trio",draft.ids],[s.right,rival.gear,rival.name+"’s trio",rival.team]].map(([ids,gear,title,four])=>group(title,[
            ...ids.map((id,i)=>kinCard(id,gear,i?"Reserve "+i:"Lead")),kinCard(four.find(k=>!ids.includes(k)),gear,"Sits out")],2))]};
    }
    function model(v=route){
      const [,page,rawSlot,n]=v.split(":"),slot=Number(rawSlot);
      if(draft.phase==="register"){
        if(Number.isInteger(slot)&&slot>=0&&slot<4){
          if(page==="member")return member(slot);if(page==="gear")return gearPage(slot);
          if(page==="catalog")return catalogPage(slot,Number.isInteger(Number(n))?Number(n):0);
        }
        return register();
      }
      if(draft.phase==="pick"){
        if(page==="rival"&&coach().team.includes(rawSlot))return rivalCard(rawSlot);
        if(page==="duets"&&draft.picks.length>=2)return privateDuets();
        return page==="scout"?scouting():pick();
      }
      return reveal();
    }
    function act(action,value){
      if(typeof action!=="string"||!action.startsWith("scout-pr-"))return false;
      const id=action.slice(9);
      if(id==="view"){if(matches(value))show(value);return true;}
      if(id==="restart"){resetPicks();return true;}
      if(draft.phase==="register"){
        if(id==="register"){report();draft.phase="pick";mark();show(route);return true;}
        if(id==="coach"&&coaches.some(c=>c.id===value)){draft.coach=value;mark();show(route);return true;}
        if(id==="borrow"){
          if(value==="starter"){const base=empty();withFour(base.ids,base.gear);}
          else if(value==="hall"||value==="trail"){
            const hall=readSetup?.(),incoming=value==="hall"?hall?.left:[game.state.lead,...(game.state.team||[])];
            const ids=[...new Set([...(incoming||[]),...draft.ids,...starters].filter(standard))].slice(0,4);
            const imported=value==="hall"?hall?.gear?.left||{}:{};
            withFour(ids,{...rosterGear(ids.filter(k=>!incoming?.includes(k)),draft.gear),...imported});
          }
          return true;
        }
        const [index,speciesId]=String(value).split("|"),slot=Number(index);
        if(!Number.isInteger(slot)||slot<0||slot>3)return true;
        if(id==="search"||id==="clear"){
          if(id==="clear")query="";
          else {const text=window.prompt?.("Search the loaner catalog",query);if(typeof text!=="string")return true;query=text.trim().toLowerCase().slice(0,80);}
          show(path("catalog:"+slot+":0"));return true;
        }
        if(id==="choose"&&standard(speciesId)&&!draft.ids.includes(speciesId)){
          delete draft.gear[draft.ids[slot]];draft.ids[slot]=speciesId;mark();show(route);
        }
        if(id==="equip"){
          const who=draft.ids[slot];
          if(speciesId==="none")delete draft.gear[who];
          else if(kit.byId(speciesId)&&!Object.values(draft.gear).includes(speciesId))draft.gear[who]=speciesId;
          mark();show(path("member:"+slot));
        }
      }else if(draft.phase==="pick"){
        if(id==="pick"&&draft.ids.includes(value)){
          if(draft.picks.includes(value))draft.picks=draft.picks.filter(k=>k!==value);
          else if(draft.picks.length<3)draft.picks.push(value);
          mark();show(route);
        }
        if(id==="lock"&&draft.picks.length===3){
          draft.die=rollBell();draft.phase="reveal";mark();show(route);
        }
      }else if(id==="play"&&draft.phase==="reveal"&&!live()){
        const card={v:1,coach:draft.coach,ids:draft.ids.slice(),gear:{...draft.gear},picks:draft.picks.slice(),die:draft.die};
        if(playFromPractice(setup(),[],0,draft.die%2,card)){draft.phase="played";mark();}
      }
      return true;
    }
    return {matches,model,act};
  }
  window.WilderScoutPractice={create,checkCard,coachName,filmRosters};
})();
