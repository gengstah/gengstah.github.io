// A rental card is an ordered roster. Borrowing copies it into the player's chosen registration.
(() => {
  "use strict";
  const route="rental-counter",pageSize=5;
  const group=(title,rows,columns=1)=>({title,rows,columns});
  function create({game,row,image,go,notify,library,borrowSolo,borrowTable,challengeSolo,tryPair,share,pasteRental}){
    const species=game.species,gear=window.WilderSparringGear;
    const name=id=>species[id].name;
    const button=(action,label,value,detail="",extra={})=>row("hire-"+action,label,value,detail,extra);
    const show=(view=null,mode="push")=>go(route,view,mode);
    const savedKey=id=>"saved:"+encodeURIComponent(id);
    let context=null,current=null,shared=null,invalid=false,shortcuts=new Map();
    const read=raw=>typeof raw==="string"?library.decode(raw):raw&&library.decode(library.encode(raw));
    function reset(card,mode){
      context=null;current=null;shortcuts.clear();
      shared=card?read(card):null;invalid=mode==="invalid"||!!card&&!shared;
    }
    function open(origin,card){
      reset(card);context=origin||null;current=origin?.card?read(origin.card):null;show();
    }
    function importCard(raw){
      const imported=read(raw);
      if(!imported){show("invalid");return false;}
      shared=imported;show("card|shared");return true;
    }
    function defaultKey(){return invalid?"invalid":shared?"shared":current?"current":"featured:0";}
    function describe(card,type,id){
      const example=library.featured().find(f=>f.card.ids.every((kin,i)=>card.ids[i]===kin&&card.gear[kin]===f.card.gear[kin]));
      return {card,type,id,plan:example?.plan,lead:example?.lead};
    }
    function entry(key){
      if(key==="shared"&&shared)return describe(shared,"Shared team");
      if(key==="current"&&current)return describe(current,context.label||"Current registration");
      if(key?.startsWith("featured:")){
        const slot=Number(key.slice(9)),f=Number.isInteger(slot)&&library.featured()[slot];if(f)return {...f,type:"Featured team"};
      }
      if(key?.startsWith("saved:")){
        const stored=library.list().find(s=>savedKey(s.id)===key);if(stored)return describe(stored.card,library.persistent?"Saved on this device":"Saved this session",stored.id);
      }
      return null;
    }
    // View names retain their card identity when the player uses the normal Back control.
    function location(view){
      if(!view)return {area:"card",key:defaultKey()};
      const parts=String(view).split("|");return {area:parts[0],key:parts[1],part:parts[2]};
    }
    function hashFor(view){
      if(context||!view&&!shared)return null;
      const {area,key}=location(view),e=entry(key);
      return ["card","kin","duets"].includes(area)&&e?library.encode(e.card):null;
    }
    const titles={mend:"Recovery",ward:"Cover",relay:"Handoff",lure:"Pin",mark:"Exposure",rush:"Breakthrough"};
    function pairs(ids){
      const notes=window.WilderSparringTeams.scoutDuets(species,ids);let at=0;
      return ids.flatMap((a,i)=>ids.slice(i+1).map(b=>{
        const score=window.WilderDuets.score(species[a].type,species[b].type);
        const note=notes[at++],prefix=name(a)+" + "+name(b)+". ";
        return {a,b,score,label:note.label,detail:note.detail.startsWith(prefix)?note.detail.slice(prefix.length):note.detail};
      }));
    }
    function teamPlan(e){
      if(typeof e.plan==="string"&&e.plan)return e.plan;
      const [a,b]=e.card.ids,duet=pairs([a,b])[0];
      return "Bring "+name(a)+" and "+name(b)+" for "+duet.score.name+". "+duet.detail;
    }
    function browse(key){
      const featured=library.featured().map((e,i)=>({...e,ref:"featured:"+i,source:"Featured"}));
      const saved=library.list().map(e=>({...e,ref:savedKey(e.id),source:"Saved"}));
      const sections=[],page=Math.max(0,Math.min(Number(key)||0,Math.max(0,Math.ceil(saved.length/pageSize)-1)));
      const pick=e=>button("card",e.card.name,e.ref,e.card.ids.map(name).join(" · "),{image:image(e.card.ids[0])});
      if(pasteRental)sections.push(group("From a friend",[button("paste","Open a rental link",null,"Paste a shared team link.")]));
      if(current||shared)sections.push(group("On the counter",[
        ...(current?[pick({card:current,ref:"current"})]:[]),...(shared?[pick({card:shared,ref:"shared"})]:[])]));
      sections.push(group("Featured teams",featured.map(pick)),group("Your saved teams · "+saved.length,saved.length?saved.slice(page*pageSize,(page+1)*pageSize).map(pick):
        [{label:"Your shelf is empty",detail:"Open a team and save a named copy here."}]));
      if(saved.length>pageSize)sections.push(group("Page "+(page+1)+" of "+Math.ceil(saved.length/pageSize),[
        ...(page>0?[button("browse","Previous",page-1)]:[]),...((page+1)*pageSize<saved.length?[button("browse","Next",page+1)]:[])],2));
      if(context?.back)sections.push(group("Registration",[button("back","Back to "+(context.label||"registration"))]));
      return {title:"Browse rental teams",kicker:"RENTAL COUNTER",sections};
    }
    function memberRows(card,key,lead){
      return card.ids.map((id,i)=>button("kin",name(id),key+"|"+id,
        species[id].types.join(" / ")+" · "+(gear.byId(card.gear[id])?.name||"No gear"),
        {image:image(id),badge:id===lead?(i+1)+" · Suggested lead":String(i+1)}));
    }
    function choiceRows(card,key){
      const b=card.ids[1],p=pairs(card.ids.slice(0,2))[0],rows=[];
      if(context?.apply&&key!=="current")rows.push(button("apply","Use these four",key,"Bring this order and gear to "+(context.label||"your registration")+".",{tone:"primary",key:"1"}));
      if(borrowSolo)rows.push(button("solo","Borrow for practice",key,"Use these four against a coach.",{tone:rows.length?undefined:"primary",key:rows.length?"2":"1"}));
      if(challengeSolo)rows.push(button("challenge","Battle against this team",key,"Bring your practice four. The coach picks three from this card."));
      if(borrowTable)rows.push(button("table","Host a Scout Table",key,"Review these four before inviting a friend."));
      if(tryPair)rows.push(button("pair","Try "+p.score.name,key,name(card.ids[0])+" + "+name(b)+" against Nell’s Pincoil."));
      return rows;
    }
    function cardPage(key){
      const e=entry(key);if(!e)return invalidPage();
      const card=e.card,sections=[group("Registered four",memberRows(card,key,e.lead),2)];
      const details=[button("duets","See all six duets",key,"Compare costs and partners before picking three."),
        button("browse","Browse rental teams",0,"Featured teams and your saved shelf.")];
      const keep=[button("save","Save a named copy",key,"Choose a name for this four and its gear."),
        ...(share?[button("share","Share team link",key,"Send an exact copy of this roster.")]:[])];
      if(key.startsWith("saved:"))keep.push(button("forget","Forget this saved card",key));
      if(context?.back)keep.push(button("back","Back to "+(context.label||"registration")));
      const play=group("Play this team",choiceRows(card,key),2);
      if(key==="current")sections.push(group("Your registration",[...keep,details[1]],2),play,group("Team card",[details[0]]));
      else sections.push(play,group("Team card",details,2),group("Your copies",keep,2));
      return {title:card.name,kicker:"RENTAL COUNTER   /   "+e.type,subtitle:teamPlan(e),sections};
    }
    function duetPage(key,e){
      const rows=pairs(e.card.ids).map(({a,b,label,detail})=>({label,detail:name(a)+" + "+name(b)+". "+detail,image:image(b)}));
      return {title:"The six duets",kicker:e.card.name,subtitle:"Pick both partners in your three to use their duet.",sections:[
        group("Pairings",rows),group("Team",[button("card","Return to "+e.card.name,key)])]};
    }
    function kinPage(key,e,id){
      if(!e.card.ids.includes(id))return cardPage(key);
      const k=species[id],held=gear.byId(e.card.gear[id]),signature=window.WilderSparringSignatures?.byId(id);
      const moves=k.skills.filter(s=>!s.trained).map(s=>({label:s.name,detail:s.description||s.type}));
      if(k.emberArt)moves.push({label:k.emberArt.name,detail:k.emberArt.description});
      if(signature)moves.push({label:signature.name,detail:signature.effect});
      const companions=pairs(e.card.ids).filter(p=>p.a===id||p.b===id).map(p=>{
        const partner=p.a===id?p.b:p.a;
        return {label:p.label,detail:name(partner)+" · "+titles[p.score.role]+". "+p.detail,image:image(partner)};
      });
      return {title:k.name,kicker:e.card.name+"   /   SLOT "+(e.card.ids.indexOf(id)+1),subtitle:k.types.join(" / "),sections:[
        group("Equipment",[{label:held?.name||"No gear",detail:held?held.trigger+" "+held.effect:"This kin has an open equipment slot.",image:held?"art/gear/"+held.id+".png":image(id)}]),
        group("Duet partners",companions),group("Individual moves",moves),group("Team",[button("card","Return to "+e.card.name,key)])]};
    }
    function invalidPage(){
      return {title:"Rental card unavailable",kicker:"RENTAL COUNTER",subtitle:"Open the full team link again or choose a team from the counter.",sections:[
        group("Teams",[...(pasteRental?[button("paste","Open a rental link",null,"Paste the full team link.")]:[]),button("browse","Browse rental teams",0,"Featured teams and your saved shelf.",{tone:"primary",key:"1"})])]};
    }
    function forgetPage(key,e){
      return {title:"Forget this card?",kicker:"SAVED RENTAL TEAM",subtitle:e.card.name+" will leave your shelf on this device.",sections:[
        group("Saved copy",[button("card","Keep "+e.card.name,key,"Return to the card.",{tone:"primary"}),button("remove","Forget saved copy",key,"Remove this card from your shelf.",{tone:"danger"})])]};
    }
    function model(view){
      const {area,key,part}=location(view),e=entry(key);let page;
      if(area==="browse")page=browse(key);else if(area==="invalid"||!e)page=invalidPage();
      else if(area==="kin")page=kinPage(key,e,part);else if(area==="duets")page=duetPage(key,e);
      else if(area==="forget"&&key.startsWith("saved:"))page=forgetPage(key,e);else page=cardPage(key);
      shortcuts=new Map(page.sections.flatMap(s=>s.rows||[]).filter(r=>r.key&&!r.disabled).map(r=>[r.key,r]));return page;
    }
    function act(action,value,view){
      if(typeof action!=="string"||!action.startsWith("hire-"))return false;
      const id=action.slice(5);
      if(id==="browse"){show("browse|"+(Math.max(0,Number(value))||0));return true;}
      if(id==="back"){context?.back?.();return true;}
      if(id==="paste"){pasteRental?.();return true;}
      const {area,key:shown}=location(view),key=id==="kin"?String(value).split("|")[0]:value,e=entry(key);
      if(!e){notify("That team is no longer on the counter.");show("browse|0","replace");return true;}
      if(id==="card"){show("card|"+key);return true;}
      if(shown!==key)return true;
      const card=read(e.card);
      if(id==="kin")show("kin|"+value);
      else if(id==="duets")show("duets|"+key);
      else if(id==="apply"&&key!=="current"){
        if(context?.apply?.(card)===false)notify("Your registration changed. Return to its current four before borrowing.");
      }
      else if(id==="solo"||id==="table"||id==="challenge"){
        const transfer={solo:borrowSolo,table:borrowTable,challenge:challengeSolo}[id];
        if(transfer?.(card)===false)notify(id==="table"?"The table changed. Reopen the host registration.":"Practice changed. Reopen your practice registration.");
      }
      else if(id==="pair")tryPair?.(card,()=>show("card|"+key));
      else if(id==="share")share?.(library.encode(card),card.name);
      else if(id==="save"){
        const title=window.prompt?.("Name this rental team",card.name);
        if(typeof title!=="string")return true;
        const saved=library.save({...card,name:title.trim()});
        if(saved.ok){notify(saved.message||"Rental team saved.");show("card|"+savedKey(saved.id),"replace");}else notify(saved.message||"This team could not be saved.");
      }else if(id==="forget"&&key.startsWith("saved:"))show("forget|"+key);
      else if(id==="remove"&&area==="forget"&&key.startsWith("saved:")){
        const result=library.remove(e.id);
        if(result.ok){notify(result.message||"Rental team removed from your shelf.");show("browse|0","replace");}else notify(result.message||"This card could not be removed.");
      }
      return true;
    }
    function key(e,view){const target=!e.repeat&&shortcuts.get(e.key);return target?act(target.id,target.value,view):false;}
    return {open,reset,importCard,hashFor,model,act,key};
  }
  window.WilderRentalCounter={create};
})();
