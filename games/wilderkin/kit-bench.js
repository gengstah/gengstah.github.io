// Campaign fittings stay with their owners, including companions resting in reserve.
(() => {
  "use strict";
  const pageSize=6,group=(title,rows,columns=1)=>({title,rows,columns});
  const art=id=>"art/gear/"+id+".png";
  function create({game,row,image,go,render,notify}){
    const stock=()=>game.trailFittings(),member=id=>game.state.party.find(k=>k.id===id);
    const kin=id=>game.kin(id,{owned:true}),name=id=>kin(id).name;
    const item=(s,id)=>s.items.find(x=>x.id===id);
    const btn=(id,label,value,detail="",extra={})=>row("kit-"+id,label,value,detail,extra);
    const show=(view,mode="push")=>go("kit-bench",view,mode);
    const link=(label,view,detail="",extra={})=>btn("view",label,view,detail,extra);
    const groupFor=(s,it)=>s.groups.find(g=>g.id===it.group);
    const position=id=>id===game.state.lead?"Trail lead":game.state.team.includes(id)?"Traveling party":"Camp reserve";
    const held=(s,id)=>item(s,s.gear[id])?.name||"No fitting";
    const ownerStatus=it=>it.holder?"Held by "+name(it.holder):it.claimed?"In your case":"Unclaimed";
    const campWalk=()=>row("walk-kind","Walk to camp","camp|kit-bench","Open the fitting case at the campfire.",{tone:"primary"});
    const localFoe=id=>game.pools[game.state.region].includes(id);
    let query="",searchItem=null,pending=null;

    function claimRow(s,g){
      const names=g.ids.map(id=>item(s,id).name).join(" · ");
      return btn("claim","Collect "+g.name,g.id,names,{image:art(g.ids[0]),tone:"primary",disabled:!g.available});
    }
    function opening(s){
      const rows=s.groups.filter(g=>!g.claimed&&g.available).map(g=>claimRow(s,g));
      if(s.inBattle)return [row("root","Return to the battle",null,"Fittings can be moved after this encounter.",{tone:"primary"})];
      if(!s.atCamp&&s.groups.some(g=>!g.claimed&&g.eligible))rows.push(campWalk());
      return rows;
    }
    function home(s){
      const ready=opening(s),sections=ready.length?[group("Pella Hem’s field bench",ready)]:[];
      for(const g of s.groups){
        const badge=g.claimed?"":g.eligible?"AT CAMP":"FIRST CREST";
        sections.push(group(g.name,g.ids.map(id=>{
          const it=item(s,id);
          return link(it.name,"item:"+id,ownerStatus(it),{image:art(id),badge});
        }),2));
      }
      sections.push(group("Companions",[...game.team().map(k=>link(name(k.id),"kin:"+k.id,held(s,k.id),{image:image(k.id)})),
        row("nav","Fitting notebook","kit-notes","Read the first field use of each fitting.")],2));
      return {title:"Field fittings",kicker:"CAMPAIGN   /   EQUIPMENT",subtitle:"Choose a fitting to see who holds it or lend it to another companion. Each piece works once per wild, Warden or expedition battle.",sections};
    }

    function who(s,id){
      const p=member(id),heldId=s.gear[id],sections=[];
      sections.push(group("Choose a fitting",s.items.map(it=>{
        const detail=it.claimed?ownerStatus(it):groupFor(s,it).reason||"Collect at camp.";
        return btn("try",it.name,it.id+"|"+id,detail,{image:art(it.id),badge:it.id===heldId?"EQUIPPED":""});
      }),2));
      if(heldId&&!s.inBattle)sections.push(group("Current fitting",[btn("remove","Put "+held(s,id)+" back in the case",id,position(id))]));
      sections.push(group("Field case",[link("View all fittings","home")]));
      return {title:name(id),kicker:"FIELD FITTINGS   /   "+position(id).toUpperCase(),art:{src:image(id),height:72},
        subtitle:"Level "+p.level+" · "+p.hp+"/"+p.maxHp+" HP · "+held(s,id),sections};
    }
    function holderList(s,it,page){
      const term=searchItem===it.id?query:"",needle=term.toLocaleLowerCase();
      const team=game.state.team,collection=[...game.team(),...game.state.party.filter(k=>!team.includes(k.id))];
      const matches=collection.filter(k=>[name(k.id),game.species[k.id].name,k.id,...kin(k.id).types,position(k.id)].some(label=>label.toLocaleLowerCase().includes(needle)));
      const pages=Math.max(1,Math.ceil(matches.length/pageSize));
      const n=Math.min(pages-1,Math.max(0,Number.isInteger(page)?page:0));
      const rows=matches.slice(n*pageSize,(n+1)*pageSize).map(k=>btn("try",name(k.id),it.id+"|"+k.id,
        position(k.id)+" · "+held(s,k.id),{image:image(k.id),badge:it.holder===k.id?"HOLDER":""}));
      const controls=[btn("search",term?"Search · "+term:"Search companions",it.id,"Name, affinity, or “reserve”.",{key:"/"})];
      if(term)controls.push(btn("clear","Clear search",it.id));
      if(n>0)controls.push(link("Previous six","item:"+it.id+":"+(n-1)));
      if(n+1<pages)controls.push(link("Next six","item:"+it.id+":"+(n+1)));
      return [group(term?matches.length+" matching companions":"Choose a companion",rows,2),
        ...(!rows.length?[{text:"No owned companions match this search."}]:[]),group("Page "+(n+1)+" of "+pages,controls,2)];
    }
    function detail(s,it,page){
      const g=groupFor(s,it),sections=[{title:"When it triggers",text:it.trigger+" "+it.effect}];
      if(!it.claimed){
        sections.push({title:g.name,text:g.reason||"Collect this case at a trail camp."});
        if(g.available)sections.push(group("At camp",[claimRow(s,g)]));
        else if(!s.atCamp&&g.eligible&&!s.inBattle)sections.push(group("Trail camp",[campWalk()]));
      }else{
        if(it.holder&&!s.inBattle)sections.push(group("Current holder",[btn("remove","Return "+it.name+" to the case",it.holder,name(it.holder)+" will travel without it.")]));
        sections.push(...holderList(s,it,page));
      }
      sections.push(group("Field case",[link("View all fittings","home")]));
      return {title:it.name,kicker:"FIELD FITTING   /   "+ownerStatus(it).toUpperCase(),art:{src:art(it.id),height:66},sections};
    }

    function tactical(it,id,foe){
      const p=member(id),lead=game.state.lead,travels=game.state.team.includes(id),label=name(id);
      if(it.id==="opening-pennant")return [{title:"Opening beat",text:id===lead?label+" is your trail lead. Opening with this pennant adds one beat.":name(lead)+" leads your party. To gain the opening beat, "+label+" must enter first wearing the pennant."}];
      if(it.id==="last-stitch")return [{title:"At current health",text:p.hp>1?"With "+p.hp+" HP, "+label+" can take a knockout hit and stay at 1 HP once.":"At "+p.hp+" HP, "+label+" needs to recover above 1 HP before the stitch can save it."}];
      if(it.id==="relay-bell")return [{title:"Plan the switch",text:travels?"Switch directly to "+label+" for an extra beat when the meter has room.":label+" is in camp reserve. Bring it in your traveling party to switch it into a battle."}];
      if(it.id==="mender-wrap"){
        const guard=kin(id).skills.find(skill=>skill.kind==="guard"&&!skill.trained);
        if(!guard)return [{title:"Guard practice",text:label+" has no ordinary guard skill to trigger this wrap."}];
        const hurt=game.team().filter(k=>k.id!==id&&k.hp>0&&k.hp<k.maxHp).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
        const prefix="With "+label+" active, "+guard.name;
        return [{title:"If you guarded now",text:hurt?prefix+" would restore "+Math.min(hurt.maxHp-hurt.hp,Math.ceil(hurt.maxHp/5))+" HP to "+name(hurt.id)+".":prefix+" needs an injured, standing teammate on the bench to trigger the wrap."}];
      }
      if(game.state.battle)return [{title:"Local matchup preview",text:"Return after the encounter to compare this fitting against local wild kin."}];
      const foes=game.pools[game.state.region],preview=target=>game.trailFittingPreview(id,it.id,target);
      const sample=localFoe(foe)?foe:foes.find(target=>preview(target))||foes[0];
      if(!sample)return [];
      const f=preview(sample),rival=game.species[sample].name;
      const title="Against "+rival;
      const text=f?f.skill+" · "+f.before+" → "+f.after+" damage against wild level "+f.level+" "+rival+". "+f.condition:
        "No ordinary strike from "+label+" gains damage from "+it.name+" against this rival.";
      return [{title,text},...(foes.length>1?[group("Other local rivals",foes.filter(k=>k!==sample).map(k=>btn("foe",game.species[k].name,k,"",{image:image(k,false)})),2)]:[])];
    }
    function ticket(s,it,id,origin){
      return {item:it?.id||null,id,from:it?.holder||null,before:s.gear[id]||null,origin:origin||"home",foe:null};
    }
    function changed(s,t){
      return !t||!member(t.id)||(s.gear[t.id]||null)!==t.before||t.item&&(item(s,t.item)?.holder||null)!==t.from;
    }
    function preview(s){
      if(game.trailSaveIsCurrent?.()===false)return {title:"A newer trail save is ready",subtitle:"Reload your saved campaign to see the current holders.",sections:[group("Field case",[btn("reload","Load the latest trail save",null,"Reopen your field fittings.",{tone:"primary"})])]};
      if(changed(s,pending))return {title:"Your fitting case changed",subtitle:"Review the latest holders before choosing a fitting.",sections:[group("Field case",[link("See current holders","home")])]};
      const t=pending,id=t.id,it=item(s,t.item||t.before),removing=!t.item,same=!removing&&t.before===t.item;
      const sections=[],rows=[];
      if(removing)rows.push({label:name(id),detail:it.name+" → No fitting",image:image(id)});
      else{
        rows.push({label:name(id),detail:held(s,id)+(same?" stays equipped":" → "+it.name),image:image(id)});
        if(t.from&&t.from!==id)rows.push({label:name(t.from),detail:it.name+" → No fitting",image:image(t.from)});
        if(t.before&&!same)rows.push({label:item(s,t.before).name,detail:"Returns to your case.",image:art(t.before)});
      }
      const actionable=it.claimed&&!s.inBattle&&!same;
      const controls=actionable?[btn("apply",removing?"Return it to the case":"Give "+it.name+" to "+name(id),null,removing?name(id)+" will have no fitting.":"Equip for the next encounter.",{tone:"primary",key:"E"})]:[];
      if(!it.claimed&&groupFor(s,it).available)controls.push(claimRow(s,groupFor(s,it)));
      if(!it.claimed&&!s.atCamp&&groupFor(s,it).eligible&&!s.inBattle)controls.push(campWalk());
      controls.push(link("Back to "+(t.origin.startsWith("kin:")?name(id):it.name),t.origin));
      if(!actionable&&!it.claimed)sections.push({text:groupFor(s,it).reason||"Collect this case at camp first."});
      if(s.inBattle)sections.push({text:"You can plan a change now and equip it after the battle."});
      sections.push(group(actionable?"What will change":same?"Current holder":"Loadout",rows),group("Fitting case",controls),{title:it.name,text:it.trigger+" "+it.effect});
      if(!removing)sections.push(...tactical(it,id,t.foe));
      return {title:removing?"Remove "+it.name:it.name+" · "+name(id),kicker:"FIELD FITTINGS   /   "+position(id).toUpperCase(),sections};
    }

    function model(value){
      const s=stock(),[view,id,page]=String(value||"home").split(":");
      if(view==="kin"&&member(id))return who(s,id);
      if(view==="item"&&item(s,id))return detail(s,item(s,id),Number(page));
      if(view==="preview"&&pending)return preview(s);
      return home(s);
    }
    function act(action,value,current){
      if(typeof action!=="string"||!action.startsWith("kit-"))return false;
      const s=stock();
      if(action==="kit-view"){show(value);return true;}
      if(action==="kit-reload"){if(game.trailSaveIsCurrent?.()===false)window.location.reload();return true;}
      if(action==="kit-claim"){
        const res=game.claimFittings(value);if(res.message)notify(res.message);render();return true;
      }
      if(action==="kit-search"||action==="kit-clear"){
        if(!item(s,value))return true;
        const q=action==="kit-clear"?"":window.prompt("Search your companions by name, affinity or reserve status",searchItem===value?query:"");
        if(q!==null){searchItem=value;query=q.trim().slice(0,80);show("item:"+value,"replace");}
        return true;
      }
      if(action==="kit-try"){
        const [piece,id]=String(value).split("|"),it=item(s,piece);
        if(it&&member(id)){pending=ticket(s,it,id,current);show("preview");}
        return true;
      }
      if(action==="kit-remove"){
        if(member(value)&&s.gear[value]&&!s.inBattle){pending=ticket(s,null,value,current);show("preview");}
        return true;
      }
      if(action==="kit-foe"){
        if(current==="preview"&&pending&&localFoe(value)){pending.foe=value;render();}
        return true;
      }
      if(action==="kit-apply"&&current==="preview"&&pending){
        const t=pending;
        if(game.trailSaveIsCurrent?.()===false){notify("The campaign save changed. Load the latest trail save to continue.");render();return true;}
        if(changed(s,t)){notify("The fitting holders changed. Review the current case.");render();return true;}
        if(s.inBattle||t.item&&!item(s,t.item)?.claimed||t.before===t.item)return true;
        const res=game.equipFitting(t.id,t.item,t.from);
        if(res.message)notify(res.message);
        if(res.ok){pending=null;show("kin:"+t.id,"replace");}else render();
      }
      return true;
    }
    function key(event,current){
      const [view,id]=String(current||"").split(":");
      if(event.key==="/"&&view==="item"&&item(stock(),id)?.claimed){event.preventDefault?.();return act("kit-search",id,current);}
      if(event.key.toLowerCase()==="e"&&!event.repeat&&view==="preview")return act("kit-apply",null,current);
      return false;
    }
    return {model,act,key};
  }
  window.WilderKitBench=Object.freeze({create});
})();
