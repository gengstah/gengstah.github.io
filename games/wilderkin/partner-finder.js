// Pick a duet around a favorite. Only the originating roster editor can apply a change.
(() => {
  "use strict";
  const route="partner-finder",pageSize=5;
  const jobs={mend:"Heal together",rush:"Pierce cover",ward:"Guard the lead",relay:"Hand off",mark:"Expose a foe",lure:"Pin a foe"};
  const group=(title,rows,columns=1)=>({title,rows,columns});
  function create({game,row,image,go,notify,openDrill,defaultContext,fieldGuide}){
    const search=window.WilderPartnerSearch.create({game}),species=game.species;
    const standard=id=>typeof id==="string"&&Object.hasOwn(species,id)&&!species[id].bonus;
    const catalog=Object.values(species).filter(k=>standard(k.id)).sort((a,b)=>a.name.localeCompare(b.name));
    const name=id=>species[id]?.name||"";
    const gearName=(id,kit)=>window.WilderSparringGear?.byId(kit[id])?.name;
    const button=(id,label,value,detail,extra)=>row("finder-"+id,label,value,detail,extra);
    const link=(label,value,detail,extra)=>button("view",label,value,detail,extra);
    const show=(value=null,mode="push")=>go(route,value,mode);
    let context,anchor,foe,role,query,opponentQuery,page,pin,shortcuts,scope;
    let searchCache=null;
    function init(input){
      const source=input||defaultContext?.()||{};
      const team=Array.isArray(source.team)&&source.team.length>=2&&source.team.every(standard)?source.team.slice():["dewfin","sprigkit","cindlet"];
      anchor=team.includes(source.anchor)?source.anchor:team[0];
      let slot=Number.isInteger(source.slot)&&source.slot>=0&&source.slot<team.length?source.slot:team.findIndex(id=>id!==anchor);
      if(team[slot]===anchor)slot=team.findIndex(id=>id!==anchor);
      const foes=Array.isArray(source.foes)?source.foes.filter(standard):[];
      const catalog=Array.isArray(source.catalog)?[...new Set(source.catalog.filter(standard))]:null;
      context={...source,team,slot,foes,catalog,gear:{...source.gear},foeGear:{...source.foeGear}};
      scope="all";
      foe=standard(source.foe)?source.foe:foes[0]||(Array.isArray(source.foes)?null:"pincoil");
      const currentPair=window.WilderDuets.score(species[anchor].type,species[team[slot]].type);
      role=Object.hasOwn(jobs,source.role)?source.role:source.role===""||source.role==="all"?null:currentPair.role;
      const text=String(source.duet||source.query||"").trim();
      const seed=text?window.WilderPartnerSearch.searchSeed(text):null;
      if(seed)role=seed.role||null;
      page=0;pin=null;query=seed?.query||"";opponentQuery="";searchCache=null;
    }
    function open(source,view){init(source);show(view);}
    function scopeLabel(){return scope==="owned"?"Befriended":scope==="local"?"Local habitat":context.catalog?(context.catalogLabel||"Guide selection"):"All loaners";}
    function scopeIds(){
      const permitted=context.catalog;
      if(scope==="all")return permitted;
      const ids=scope==="owned"?(game.state?.party||[]).map(p=>p.id):game.pools?.[game.state?.region]||[];
      return ids.filter(id=>standard(id)&&(!permitted||permitted.includes(id)));
    }
    function scopes(){
      return {title:"Where should we look?",subtitle:context.catalog?"Your field guide selection still applies.":"Choose which kin can fill the partner slot.",sections:[group("Eligible partners",[
        button("scope",context.catalog?context.catalogLabel||"Guide selection":"All loaners","all",context.catalog?"Search every kin in this guide selection.":"All 500 standard kin."),
        button("scope","Befriended","owned","Your traveling party and reserve."),
        button("scope","Local habitat","local",game.regions?.[game.state?.region]?.name||"Your current region.")]),group("Partners",[link("Back to partners",null)])]};
    }
    function options(overrides={}){
      return {anchor,catalog:scopeIds(),team:context.team.filter((id,i)=>i!==context.slot),rivals:context.foes,reserved:context.team.filter((id,i)=>i!==context.slot&&id!==anchor),role,foe,query,gear:context.gear,foeGear:context.foeGear,...overrides};
    }
    function results(){
      const opts=options(),key=JSON.stringify(opts);
      if(searchCache?.key!==key)searchCache={key,rows:search.search(opts)};
      return searchCache.rows;
    }
    function allowed(id){const permitted=scopeIds();return standard(id)&&id!==anchor&&(!permitted||permitted.includes(id))&&!context.team.some((member,i)=>i!==context.slot&&member===id);}
    function preview(id){return allowed(id)?search.preview(options({role:null,query:""}),id):null;}
    const duetTitle=r=>r.duet.name+" · "+r.duet.cost+" beats";
    function holders(id){
      return [anchor,id].map(kin=>name(kin)+(gearName(kin,context.gear)?" holds "+gearName(kin,context.gear):"")).join(" + ");
    }
    function matchup(r){
      if(!r.fit||!foe)return "";
      const {outgoing,incoming}=r.fit;
      return outgoing.name+" ×"+outgoing.multiplier+" into "+name(foe)+". "+incoming.name+" ×"+incoming.multiplier+" back.";
    }
    function readout(r){
      if(!r.ordinary||!r.reply)return "";
      return (r.ordinary.label||r.ordinary.name)+" deals "+r.ordinary.damage+" to "+name(foe)+". "+(r.reply.label||r.reply.name)+" deals "+r.reply.damage+" to "+r.name+" ("+r.candidateHp+" HP).";
    }
    function drillButton(r,key=false){
      return button("drill","Try "+r.duet.name,r.id,"Play "+name(anchor)+" + "+r.name+(foe?" against "+name(foe):" against a practice opponent")+".",{image:image(r.id),tone:"primary",...(key?{key:"1"}:{})});
    }
    function applyButton(r){
      const current=context.team[context.slot],same=current===r.id;
      return button("apply",same?"Keep "+r.name+" in slot "+(context.slot+1):"Choose "+r.name+" for slot "+(context.slot+1),r.id,
        (same?"Keep the current lineup.":"Replace "+name(current)+".")+(context.label?" "+context.label+".":""),{tone:"primary"});
    }
    function topCandidate(rows){
      const example=context.example||context.team[context.slot];
      return rows.find(r=>r.id===example)||rows[0];
    }
    function home(){
      const rows=results(),top=topCandidate(rows),pages=Math.max(1,Math.ceil(rows.length/pageSize));
      page=Math.max(0,Math.min(page,pages-1));
      const shortlist=rows.slice(page*pageSize,(page+1)*pageSize);
      const work=[link("Duet job · "+(jobs[role]||"Any job"),"jobs"),link("Opponent · "+(name(foe)||"Any"),"foes"),
        button("search",query?"Search · "+query:"Find a move or kin",null,"Search all jobs for a partner, duet or move."),...(context.team.length>2?[link("Change favorite · "+name(anchor),"anchors")]:[]),link("Look in · "+scopeLabel(),"scopes")];
      if(query)work.push(button("clear","Clear search"));
      const sections=[];
      const actions=[];
      if(pin){sections.push(group("Pick a second partner",[button("unpin","Cancel comparison with "+name(pin))]));}
      else if(top&&openDrill)actions.push(drillButton(top,true));
      if(rows.length>1&&!pin){
        const example=anchor==="dewfin"&&foe==="pincoil"&&role==="mend"&&!query&&["marshcurl","thicketowl"].map(id=>rows.find(r=>r.id===id));
        const natural=rows.find(r=>r.id!==top.id&&r.duet.name!==top.duet.name)||rows.find(r=>r.id!==top.id);
        const [first,second]=example&&example.every(Boolean)?example:[top,natural];
        actions.push(button("compare","Compare "+(example&&example.every(Boolean)?"two healing partners":first.name+" and "+second.name),first.id+"|"+second.id,
          first.name+" or "+second.name+"? Compare their opening hits"+(foe?" against "+name(foe):"")+"."));

      }
      if(actions.length)sections.push(group("Try a pairing",actions));
      sections.push(group("Narrow your partners",work,2));
      sections.push(group((query?"Search results":"Partners")+" · "+rows.length,shortlist.map(r=>button("kin",r.name,r.id,
        duetTitle(r)+(r.fit?". "+matchup(r):". "+r.duet.effect),{image:image(r.id),disabled:r.id===pin}))));
      if(!rows.length)sections.push({title:"No matching partner",text:"Try another duet job, search term or group of kin for "+name(anchor)+"."});
      if(pages>1)sections.push(group("Page "+(page+1)+" of "+pages,[...(page?[button("page","Previous",page-1)]:[]),...(page<pages-1?[button("page","Next",page+1)]:[])],2));
      if(context.back)sections.push(group("Roster",[button("back","Back to "+(context.label||"team"))]));
      return {title:"Partner Finder",kicker:context.label?"DUET WORKSHOP  /  "+context.label.toUpperCase():"DUET WORKSHOP",subtitle:"Keep "+name(anchor)+". "+(context.apply?"Slot "+(context.slot+1)+" currently holds "+name(context.team[context.slot])+".":"Find a partner for its next duet."),sections};
    }
    function jobPage(){
      const available=new Set(search.search(options({role:null,query:""})).map(r=>r.duet.role));
      return {title:"What should the duet do?",kicker:name(anchor).toUpperCase()+"  /  DUET JOB",sections:[group("Choose a job",[
        button("role","Any job","all"),...Object.entries(jobs).map(([id,label])=>button("role",label,id,
          available.has(id)?"":name(anchor)+" has no duet for this job.",{disabled:!available.has(id),badge:id===role?"Selected":""}))]),
        group("Favorite",[...(context.team.length>2?[link("Change favorite","anchors")]:[]),link("Back to partners",null)])]};
    }
    function anchors(){
      return {title:"Choose your favorite",subtitle:"Slot "+(context.slot+1)+" stays open for a partner.",sections:[group("From your lineup",context.team.flatMap((id,i)=>i===context.slot?[]:[button("anchor",name(id),id,
        species[id].types.join(" / "),{image:image(id),badge:id===anchor?"Current favorite":""})])),group("Partners",[link("Back to partners",null)])]};
    }
    function foes(value){
      const n=Number(value?.split(":")[1])||0, hits=catalog.filter(k=>k.name.toLowerCase().includes(opponentQuery));
      const pages=Math.max(1,Math.ceil(hits.length/pageSize)),p=Math.min(Math.max(0,n),pages-1);
      const choice=id=>button("foe",name(id),id,species[id].types.join(" / ")+(gearName(id,context.foeGear)?" · "+gearName(id,context.foeGear):""),
        {image:image(id),badge:id===foe?"Selected":""});
      return {title:"Choose an opponent",subtitle:"Inspect both sides of the opening matchup at level 20.",sections:[
        group("Opponent",[button("foe","Any opponent","all","Browse duets without a matchup."),button("foe-search",opponentQuery?"Search · "+opponentQuery:"Search by kin name"),...(opponentQuery?[button("foe-clear","Clear opponent search")]:[])]),
        ...(context.foes.length&&!opponentQuery?[group(context.foeLabel||"Their roster",context.foes.map(choice),2)]:[]),
        group("Loaners · "+hits.length,hits.slice(p*pageSize,(p+1)*pageSize).map(k=>choice(k.id)),2),
        group("Page "+(p+1)+" of "+pages,[...(p?[link("Previous","foes:"+(p-1))]:[]),...(p+1<pages?[link("Next","foes:"+(p+1))]:[]),link("Back to partners",null)],2)]};
    }
    function evidence(r){
      const pairPrefix=name(anchor)+" + "+r.name+". ",effect=r.duet.effect;
      const rows=[{label:duetTitle(r),image:image(r.id),detail:holders(r.id)+". "+(effect.startsWith(pairPrefix)?effect.slice(pairPrefix.length):effect)}];
      if(foe&&r.fit){
        rows.push({label:r.name+" leads against "+name(foe),detail:readout(r)||matchup(r)});
        if(r.duetMove)rows.push({label:name(anchor)+" leads the duet",detail:r.duetMove.damage+" damage at full health against "+name(foe)+". "+(r.duetMove.reason||"Ready at the opening bell.")});
      }
      return rows;
    }
    function detail(id){
      const r=preview(id);if(!r)return home();
      return {title:r.name,kicker:name(anchor).toUpperCase()+"  /  PARTNER CARD",subtitle:r.types.join(" / ")+(gearName(id,context.gear)?" · "+gearName(id,context.gear):""),
        sections:[group("Pairing",evidence(r)),group("Play or choose",[...(context.apply?[applyButton(r)]:[]),...(openDrill?[drillButton(r)]:[]),
          button("pin","Compare with another partner",id),...(fieldGuide?[button("guide","Field guide & habitat",id,"Discover where "+r.name+" lives.")]:[]),link("Back to partners",null)]),
          group(r.name+"’s own moves",r.skills.map(s=>({label:s.name,detail:s.type+" · "+s.kind})).concat([r.emberArt,r.signature].filter(Boolean).map(s=>({label:s.name,detail:s.effect||s.description}))))]};
    }
    function comparison(ids){
      const [a,b]=ids.map(preview);if(!a||!b||a.id===b.id)return home();
      return {title:"Compare partners",kicker:name(anchor).toUpperCase()+"  /  "+(foe?"VS "+name(foe).toUpperCase():"DUET JOBS"),
        sections:[a,b].map(r=>group(r.name,[...evidence(r),...(context.apply?[applyButton(r)]:[]),...(openDrill?[drillButton(r)]:[])])).concat(group("Compare again",[link("Return to partners",null)]))};
    }
    function model(value){
      if(!context)init();
      let pageModel;
      if(value==="jobs")pageModel=jobPage();else if(value==="anchors")pageModel=anchors();else if(value==="scopes")pageModel=scopes();
      else if(value==="foes"||value?.startsWith("foes:"))pageModel=foes(value);
      else if(value?.startsWith("kin:"))pageModel=detail(value.slice(4));
      else if(value?.startsWith("compare:"))pageModel=comparison(value.slice(8).split("|"));else pageModel=home();
      shortcuts=new Map(pageModel.sections.flatMap(s=>s.rows||[]).filter(r=>r.key&&!r.disabled).map(r=>[r.key,r]));return pageModel;
    }
    function act(action,value){
      if(typeof action!=="string"||!action.startsWith("finder-"))return false;
      if(!context)init();const id=action.slice(7);
      if(id==="view")show(value);
      else if(id==="back")context.back?.();
      else if(id==="guide"&&allowed(value))fieldGuide?.(value);
      else if(id==="kin"&&allowed(value)){
        if(pin&&pin!==value){const first=pin;pin=null;show("compare:"+first+"|"+value);}else show("kin:"+value);
      }else if(id==="compare"){
        const ids=String(value).split("|");if(ids.length===2&&ids[0]!==ids[1]&&ids.every(allowed)){pin=null;show("compare:"+value);}
      }else if(id==="pin"&&allowed(value)){pin=value;show();}
      else if(id==="unpin"){pin=null;show(null,"replace");}
      else if(id==="page"){page=Math.max(0,Number(value)||0);show(null,"replace");}
      else if(id==="role"&&(value==="all"||Object.hasOwn(jobs,value))){
        role=value==="all"?null:value;
        const named=query&&window.WilderPartnerSearch.searchSeed(query);
        if(named?.role&&named.role!==role)query="";
        page=0;show();
      }
      else if(id==="anchor"&&context.team.includes(value)&&value!==context.team[context.slot]){anchor=value;pin=null;page=0;show();}
      else if(id==="foe"&&(value==="all"||standard(value))){foe=value==="all"?null:value;page=0;show();}
      else if(id==="foe-clear"){opponentQuery="";show("foes","replace");}
      else if(id==="scope"&&["all","owned","local"].includes(value)){scope=value;pin=null;page=0;show();}
      else if(id==="clear"){query="";page=0;show(null,"replace");}
      else if(id==="search"||id==="foe-search"){
        const who=id==="search",answer=window.prompt?.(who?"Search by partner, duet or move name":"Search for an opponent",who?query:opponentQuery);
        if(typeof answer==="string"){const text=answer.trim().slice(0,70).toLowerCase();if(who){const seed=window.WilderPartnerSearch.searchSeed(text);query=seed.query||"";role=seed.role||null;page=0;show(null,"replace");}else{opponentQuery=text;show("foes","replace");}}
      }else if(id==="drill"&&allowed(value)){
        const r=preview(value),team=context.team.map((id,i)=>i===context.slot?value:id);
        const gear=Object.fromEntries(team.filter(id=>context.gear[id]).map(id=>[id,context.gear[id]]));
        if(r)openDrill?.({anchor,partner:value,role:r.duet.role,cost:r.duet.cost,foe,team,gear,foes:context.foes.slice(),foeGear:{...context.foeGear},returnToFinder:()=>show("kin:"+value)});
      }else if(id==="apply"&&allowed(value)){
        if(context.apply?.(value)===false)notify?.("The lineup changed. Reopen the editor, or reload this page if another tab changed it.");
      }
      return true;
    }
    function key(e){const choice=!e.repeat&&shortcuts?.get(e.key);if(!choice)return false;return act(choice.id,choice.value);}
    return {open,model,act,key,reset:()=>{init();shortcuts=null;}};
  }
  window.WilderPartnerFinder={create};
})();
