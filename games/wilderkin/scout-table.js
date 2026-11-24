// A four-kin registration and sealed three-kin formation for a Bellpost match.
(() => {
  "use strict";
  const draftKey="wilderkin.scout.drafts.v1";
  const seatNames=["Host","Guest"],slots=["Lead","First reserve","Second reserve"];
  const group=(title,rows,columns=1)=>({title,rows,columns});
  const page=(title,kicker,subtitle,sections)=>({title,kicker,subtitle,sections});
  const path=(...parts)=>parts.join("|");
  function create({game,row,image,go,render,notify,openBattle,openFinder,openRentals,openSharedMessage,active=()=>true,rules=window.WilderScoutRules.create({game})}){
    const species=game.species,gear=window.WilderSparringGear,dex=window.WilderKinDex;
    const catalog=Object.values(species).filter(k=>!k.bonus).sort((a,b)=>a.name.localeCompare(b.name));
    const previews=new Map(),drafts=new Map(),unsaved=new Set();
    let problem="",pending=false,revision=0,editorVersion=0,rentalOffer=null,displayed="",search={route:"",query:"",page:0};
    const art={src:"ui/scout-table.png",landscape:true,height:155};
    const show=(next,mode)=>go("scout-table",next,mode);
    const button=(cmd,label,value=null,detail="",extra={})=>row("scout-"+cmd,label,value,detail,extra);
    const home=()=>button("desk","Scout Table desk");
    const known=id=>typeof id==="string"&&Object.hasOwn(species,id)&&!species[id].bonus;
    const name=id=>species[id].name;
    const portrait=id=>image(id,false);
    const sig=id=>window.WilderSparringSignatures?.byId(id);
    const caption=(id,kit={})=>[species[id].types.join(" / "),gear.byId(kit[id])?.name,species[id].emberArt?.name,sig(id)?.name].filter(Boolean).join(" · ");
    const eachKin=(t,order=t.ids)=>order.map((id,i)=>({label:name(id),detail:caption(id,t.gear),image:portrait(id),...(order.length===3?{badge:slots[i]}:{})}));
    const names=ids=>ids.map(name).join(" · ");
    const duets=(ids,candidate)=>window.WilderSparringTeams.scoutDuets(species,ids,candidate);
    function record(id){
      const own=rules.get(id),publicView=previews.get(id);
      if(!own)return publicView||null;
      if(own.archived){
        if(own.stage===4)return {...own,seat:null,archived:false};
        if(publicView?.stage===4)return publicView;
      }
      return own;
    }
    const local=(r)=>r?.seat===0||r?.seat===1;
    function readDrafts(){
      try{const d=JSON.parse(window.localStorage?.getItem(draftKey)||"{}");return d&&typeof d==="object"&&!Array.isArray(d)?d:{};}
      catch{return {};}
    }
    function put(key,value){
      drafts.set(key,value);
      try{
        const all=readDrafts();all[key]=value;window.localStorage.setItem(draftKey,JSON.stringify(all));unsaved.delete(key);
      }catch{unsaved.add(key);}
    }
    function saved(key){return unsaved.has(key)?drafts.get(key):readDrafts()[key]??drafts.get(key);}
    function trail(){
      const ids=game.state.team.filter(known);
      if(ids.includes(game.state.lead))return [game.state.lead,...ids.filter(id=>id!==game.state.lead)];
      return ids;
    }
    function fill(ids,kit={}){
      const all=[...new Set([...ids,...trail(),"charquill","mossbell","kilnbeak","glimmeray"])].filter(known).slice(0,4);
      return {ids:all,gear:gear.normalize({left:kit},all,[]).left};
    }
    function hall(){
      const s=window.WilderSparringTeams.restore(game.state.sparring?.setup,{species});
      return fill(s.left,s.gear?.left);
    }
    function draft(id){
      const raw=saved("roster:"+id),ids=raw?.ids;
      return Array.isArray(ids)&&ids.length===4&&new Set(ids).size===4&&ids.every(known)?
        {ids:ids.slice(),gear:gear.normalize({left:raw.gear},ids,[]).left}:fill(trail());
    }
    const saveDraft=(id,t)=>put("roster:"+id,t);
    function rentalFour(card){
      const ids=card?.ids;
      if(!Array.isArray(ids)||ids.length!==4||new Set(ids).size!==4||![...ids].every(known))return null;
      const fitted=gear.validate({left:card.gear===undefined?{}:card.gear},ids,[]);
      return fitted?{ids:ids.slice(),gear:fitted.left}:null;
    }
    function draftEditor(id){
      const original=draft(id),snapshot=JSON.stringify(original),version=++editorVersion,started=revision,lastHost=saved("last-host")?.id;
      return {original,current:()=>version===editorVersion&&started===revision&&!pending&&mayRegister(id,record(id))&&
          (id!=="new"||saved("last-host")?.id===lastHost)&&JSON.stringify(draft(id))===snapshot,
        leave:(view,slot)=>{
          if(version===editorVersion)editorVersion++;
          const signed=id==="new"&&saved("last-host")?.id;
          if(signed&&signed!==lastHost&&record(signed)){show(path("table",signed),"replace");return;}
          const editable=mayRegister(id,record(id));
          show(editable?path(view,id,...(slot===undefined?[]:[slot])):path("table",id),"replace");
        }};
    }
    function rentalDesk(id){
      if(!openRentals||pending)return;
      const editor=draftEditor(id),t=editor.original;
      openRentals({label:id==="new"?"Host registration":"Visiting registration",card:{name:"My Scout four",ids:t.ids.slice(),gear:{...t.gear}},
        back:()=>editor.leave("draft"),apply(card){
          const incoming=rentalFour(card);
          if(!incoming||!editor.current())return false;
          saveDraft(id,incoming);editor.leave("draft");return true;
        }});
    }
    function borrowRental(card){
      const incoming=rentalFour(card);
      if(!incoming||pending)return false;
      const editor=draftEditor("new"),current=JSON.stringify(editor.original);
      remember("#scout-table");
      if(saved("roster:new")&&current!==saved("last-host")?.roster&&current!==JSON.stringify(fill(trail()))&&current!==JSON.stringify(incoming)){
        rentalOffer={incoming,editor};show(path("rental","new"));
      }else{
        rentalOffer=null;saveDraft("new",incoming);editor.leave("draft");
      }
      return true;
    }
    function rentalReview(){
      return page("Which four will host?","SCOUT TABLE   /   UNSENT REGISTRATION","Your host draft is saved. Choose the four you want to review for a new invitation.",[
        group("Current draft",eachKin(rentalOffer.editor.original),2),group("Rental four",eachKin(rentalOffer.incoming),2),
        group("New host registration",[button("rental-replace","Use the rental four",null,"Replace the unsent draft and review your four.",{tone:"primary"}),
          button("rental-keep","Keep my current draft")])]);
    }
    function pick(r){
      const raw=saved("order:"+r.id),ids=r.rosters[r.seat].ids;
      return Array.isArray(raw)&&raw.length<=3&&new Set(raw).size===raw.length&&raw.every(id=>ids.includes(id))?raw.slice():[];
    }
    function desk(){
      const entries=rules.list(),sections=[];
      if(entries.length)sections.push(group("Your tables",entries.map(r=>button("open",tableName(r),r.id,
        seatNames[r.seat]+" · "+stageCopy(r).short,{image:portrait(r.rosters[r.seat].ids[0])}))));
      sections.push(group("Play with a friend",[
        button("new","Register four kin",null,"Borrow from the full field guide or bring your own team.",{tone:"primary"}),
        button("paste","Open a table link",null,"Paste an invitation, reply, scout report or rental card."),row("nav","Practice with a scout","scout-practice"),
        ...(openRentals?[button("rental-desk","Rental Counter",null,"Borrow a four-kin team or open a saved card.")]:[])]),
        group("Other rings",[row("nav","Bellpost","bellpost"),row("nav","Sparring Hall","sparring")],2));
      return {...page("Scout Table","TWO-PLAYER SPARRING","Register four kin each. Study both rosters, secretly choose a lead and two reserves, then battle with those three.",sections),art,
        ...(rules.persistent===false?{status:"Session only · keep this tab open to retain your seat."}:{})};
    }
    function registration(id){
      const t=draft(id),guest=id!=="new";
      return page(guest?"Register your visiting four":"Register your four","SCOUT TABLE   /   REGISTRATION",
        guest?"The host’s four are sealed. Register yours to send them to the host, then scout their four before picking your three.":"Your invitation hides these kin. Your four and their equipment appear in the scout report after your friend registers.",[
          group("Your registration",t.ids.map((k,i)=>button("slot",name(k),i,caption(k,t.gear),{image:portrait(k)})),2),
          group("Registration",[button("register-check","Review these four",null,names(t.ids),{tone:"primary"})]),
          group("Start from a team",[button("import","Use traveling kin","trail",names(fill(trail()).ids)),
            button("import","Use Hall trio and gear","hall",names(hall().ids)),
            ...(openRentals?[button("rentals","Rental Counter",null,"Save or share your four, or choose another team and its gear.")]:[])]),
          group("",[home()])]);
    }
    function registerCheck(id){
      const t=draft(id);
      return page("Register these four?","SCOUT TABLE   /   CONFIRM",
        id==="new"?"The invitation seals your four and their gear. Your friend sees them after registering and receiving your scout report.":"Your registration reply shows the host all four kin and their gear. Both players will choose their fighting three after scouting.",[
          group("Four registered kin",eachKin(t),2),group("Registration",[
            button("register",id==="new"?"Register and create invitation":"Register and accept invitation",null,"Confirm these four for this table.",{tone:"primary",disabled:pending}),
            button("draft","Change my registration")])]);
    }
    function member(id,i){
      const t=draft(id),k=t.ids[i],piece=gear.byId(t.gear[k]);
      return page(name(k),"SCOUT TABLE   /   REGISTERED SLOT "+(i+1),caption(k,t.gear),[
        group("This slot",[button("catalog","Choose a different kin",null,catalog.length+" free loaners, plus your travelers.",{tone:"primary",image:portrait(k)}),
          ...(openFinder?[button("finder","Find a partner",null,"Choose a teammate, duet role and rival to compare this slot.")]:[]),
          button("gear",piece?piece.name:"Choose equipment",null,piece?piece.effect:"One piece per kin. Each piece can serve one holder."),button("draft","Return to the four")]),
        group("Skills",species[k].skills.filter(s=>!s.trained).map(s=>({label:s.name,detail:s.description||s.type}))),
        ...(species[k].emberArt?[{title:species[k].emberArt.name,text:species[k].emberArt.description}]:[]),
        ...(sig(k)?[{title:sig(k).name,text:sig(k).effect}]:[])]);
    }
    function replaceMember(id,t,slot,next){
      const at=t.ids.indexOf(next);
      if(at>=0)[t.ids[at],t.ids[slot]]=[t.ids[slot],t.ids[at]];
      else{delete t.gear[t.ids[slot]];t.ids[slot]=next;}
      saveDraft(id,t);
    }
    function findPartner(id,slot,fromCatalog=false){
      if(!openFinder||pending)return;
      const editor=draftEditor(id),original=editor.original;
      const query=fromCatalog?search.query:"";
      const seed=window.WilderPartnerSearch?.searchSeed(query)||{query};
      // A human invitation seals the host's four. No opposing roster is public at registration.
      openFinder({anchor:original.ids[slot===0?1:0],slot,team:original.ids.slice(),gear:{...original.gear},foes:[],
        ...seed,label:"Scout Table · slot "+(slot+1),back:()=>editor.leave(fromCatalog?"catalog":"member",slot),
        apply(next){
          const t=draft(id);
          if(!editor.current()){
            notify("This registration has changed. Return to the table to review it.");return false;
          }
          if(!known(next)||t.ids.some((k,i)=>i!==slot&&k===next)){
            notify("Choose a kin outside the other three registered slots.");return false;
          }
          replaceMember(id,t,slot,next);editor.leave("member",slot);return true;
        }});
    }
    function catalogPage(id,i){
      const key=path(id,i),t=draft(id);
      if(search.route!==key)search={route:key,query:"",page:0};
      const q=search.query.trim().toLowerCase(),matches=catalog.filter(k=>[k.name,...k.types,k.emberArt?.name,sig(k.id)?.name,...k.skills.map(m=>m.name)].some(term=>term?.toLowerCase().includes(q)));
      const pages=Math.max(1,Math.ceil(matches.length/8));search.page=Math.max(0,Math.min(pages-1,search.page));
      const choice=k=>button("choose",name(k),k,caption(k,t.gear),{image:portrait(k),badge:t.ids.includes(k)?"IN FOUR":""});
      const finder=openFinder?[button("finder","Find a duet partner for "+name(t.ids[i===0?1:0]),null,
        q?"Use this search in Partner Finder.":"Compare loaners by their duet and matchup.")]:[];
      return page("Choose a kin","SCOUT TABLE   /   SLOT "+(i+1),"Select a kin to register it here. Selecting a member of your four exchanges their places.",[
        group("Find a loaner",[button("search",q?"Search · "+search.query:"Search kin, type or technique",null,"Type a name such as Charquill, or a technique such as Backdraft."),
          ...(matches.length?finder:[]),...(q?[button("clear","Clear search")]:[]),button("member","Back to slot")],2),
        ...(!q?[group("Traveling kin",trail().map(choice),2)]:[]),
        group(matches.length+" matching loaners",matches.length?matches.slice(8*search.page,8*search.page+8).map(k=>choice(k.id)):[{label:"No matching kin",detail:"Try another name, affinity or skill."},...finder],matches.length?2:1),
        ...(pages>1?[group("Page "+(search.page+1)+" of "+pages,[button("page","Previous",-1,"",{disabled:search.page===0}),button("page","Next",1,"",{disabled:search.page===pages-1})],2)]:[])]);
    }
    function gearPage(id,i){
      const t=draft(id),holder=t.ids[i];
      const items=gear.items.map(piece=>{
        const previous=t.ids.find(k=>t.gear[k]===piece.id);
        return button("equip",piece.name,piece.id,[previous&&previous!==holder?"Move from "+name(previous):"",piece.trigger,piece.effect].filter(Boolean).join(" "),
          {badge:previous===holder?"EQUIPPED":"",image:"art/gear/"+piece.id+".png"});
      });
      return page("Equip "+name(holder),"SCOUT TABLE   /   EQUIPMENT","Registered equipment follows its holder into battle if selected.",[
        group("This slot",[button("member","Back to slot"),button("equip","Remove equipment","none","",{disabled:!t.gear[holder]})],2),group("Available equipment",items)]);
    }
    function tableName(r){
      const seen=r.rosters.filter(Boolean).map(t=>name(t.ids[0]));
      return seen.length===2?seen.join(" / "):"Table "+r.id.slice(-6).toUpperCase();
    }
    const myChoice=r=>local(r)&&!r.archived&&((r.stage===1&&r.seat===0)||(r.stage===2&&r.seat===1));
    function stageCopy(r){
      if(r.archived)return {short:"Archived on this device",detail:"This seat has been closed on this device."};
      if(r.stage===0){
        return r.seat===0?{short:"Send the invitation",detail:"Send this link to your friend. Open their registration reply on the device where you made this invitation."}:
          {short:"You’re invited",detail:"Register your own four kin to join. Both players will scout the other roster before selecting three."};
      }
      if(r.stage===4){
        const first=r.battle.first,opening=name(r.picks[first][0]);
        return {short:"Both formations revealed",detail:seatNames[first]+" opens with "+opening+". "+(r.seat===0?
          first===0?"Send the final report now, or play and send your opening move.":"Send the final report or the opening battle link so your friend can take the first turn.":
          "Both formations and the two kin sitting out are public.")};
      }
      if(myChoice(r))return {short:"Choose your three",detail:"Scout all four opposing kin, then privately choose your lead and two ordered reserves."};
      if(r.stage===1)return {short:"Waiting for the host",detail:r.seat===1?"Send your registration reply to the host. They will study your four kin and send back their scout report.":"The host scouts the visiting four and locks a formation."};
      if(r.stage===2)return {short:"Waiting for the guest",detail:r.seat===0?"Send the scout report to your friend. Their reply will unlock both formations.":"The guest scouts the host’s four and locks a formation."};
      return {short:"Return to the host",detail:r.seat===1?"Send this sealed choice to the host. They open it on their original device and send you the final report.":"Open this reply on the host’s original device to reveal both formations."};
    }
    function shareRows(r){
      const label=["invitation","registration reply","scout report","sealed choice","final report"][r.stage];
      return group("Send the "+label,[
        ...(typeof window.navigator?.share==="function"?[button("share","Share "+label,null,"Choose a messaging app.",{tone:"primary"})]:[]),
        button("copy","Copy "+label+" link",null,"Paste it into your conversation.",{tone:"primary"}),
        button("link","Show selectable link")],2);
    }
    function table(r){
      const move=stageCopy(r),canPick=myChoice(r),ready=r.stage===4,sections=[];
      if(r.archived)return page("Table archived","SCOUT TABLE",move.detail,[group("",[home()])]);
      if(ready)sections.push(group("Battle desk",[button("play",local(r)?"Open your battle":"Watch the battle",null,
        local(r)?"Take your seat with the three kin you selected.":"View the latest position known to this browser.",{tone:"primary"}),
        button("report","Read the revealed formations",null,"Both leads, reserves and the two kin left behind.")]));
      else if(canPick)sections.push(group("Your move",[
        button("order","Choose my three",null,"First kin leads. You can revise all three before locking.",{tone:"primary"}),
        button("rival","Scout their four",null,names(r.rosters[1-r.seat].ids))]));
      else if(r.stage===0&&!local(r))sections.push(group("Visiting seat",[button("join","Register my four",null,"Choose your own kin to accept this invitation.",{tone:"primary"})]));
      if(r.stage===2&&r.seat===0)sections.push(group("Your sealed formation",[{label:names(r.picks[0]),detail:"Private to this device until both formations are locked."}]));
      if(r.stage===3&&r.picks[1])sections.push(group("Guest’s locked formation",eachKin(r.rosters[1],r.picks[1]),2));
      if(!canPick&&(local(r)||ready))sections.push(shareRows(r));
      const publicRosters=r.rosters.flatMap((t,seat)=>t?[group((local(r)&&seat===r.seat?"Your":seatNames[seat]+"’s")+" registered four",eachKin(t),2)]:[]);
      sections.push(...publicRosters);
      if(!ready&&!local(r)&&r.stage>0)sections.push(group("Public report",[button("copy","Copy current report"),button("link","Show selectable link")],2));
      sections.push(group("Table options",[home(),...(local(r)?[button("archive-check",ready?"Archive this table":"Withdraw from this table")]:[])],2));
      return page(ready?"Scout report complete":r.stage===0&&!local(r)?"Scout Table invitation":move.short,
        "SCOUT TABLE   /   "+(local(r)?seatNames[r.seat].toUpperCase():"PUBLIC REPORT"),move.detail,sections);
    }
    function rival(r){
      const opposing=r.rosters[1-r.seat];
      return page("Scout their four","SCOUT TABLE   /   OPPOSING ROSTER","Inspect a kin’s skills, equipment and matchups against your four. Any one of these kin could lead.",[
        group("Opponent’s registration",opposing.ids.map(k=>button("inspect",name(k),k,caption(k,opposing.gear),{image:portrait(k)})),2),
        group("Your formation",[button("order","Choose my three",null,"Return to your private order.",{tone:"primary"}),button("table","Back to table")])]);
    }
    function rivalKin(r,id){
      const theirs=r.rosters[1-r.seat],mine=r.rosters[r.seat],k=species[id],piece=gear.byId(theirs.gear[id]);
      const duets=theirs.ids.filter(x=>x!==id).map(x=>{
        const d=window.WilderDuets.score(k.type,species[x].type);
        return {label:d.name,detail:name(x)+" · "+d.cost+" beats · "+d.label,image:portrait(x)};
      });
      const edges=mine.ids.map(x=>{
        const attacks=species[x].skills.filter(s=>s.kind==="attack"&&!s.trained).map(s=>({skill:s,mult:dex.effectiveness(s.type,k.types)}));
        attacks.sort((a,b)=>b.mult-a.mult||b.skill.power-a.skill.power);
        const best=attacks[0];return {label:name(x),detail:best.skill.name+" · ×"+Number(best.mult.toFixed(2))+" affinity into "+k.name,image:portrait(x)};
      });
      const sections=[group("Scouting",[button("rival","All four rivals"),button("order","Choose my three")],2),
        group("Your team’s attacks",edges,2),group("Possible duets",duets),group("Skills",k.skills.filter(s=>!s.trained).map(s=>({label:s.name,detail:s.description||s.type})))];
      if(piece)sections.splice(1,0,{title:piece.name,text:piece.trigger+" "+piece.effect});
      if(k.emberArt)sections.push({title:k.emberArt.name,text:k.emberArt.description});
      if(sig(id))sections.push({title:sig(id).name,text:sig(id).effect});
      return {...page(k.name,"SCOUT TABLE   /   OPPOSING KIN",caption(id,theirs.gear),sections),art:{src:portrait(id)}};
    }
    function order(r){
      const selected=pick(r),t=r.rosters[r.seat],opponent=r.rosters[1-r.seat];
      const rows=selected.length===3?[]:t.ids.filter(k=>!selected.includes(k)).map(k=>{
        const detail=[caption(k,t.gear),...duets(selected,k).map(d=>d.label+" · "+d.detail)].join("\n");
        return button("pick",name(k),k,detail,{image:portrait(k)});
      });
      return page(selected.length<3?"Choose your "+slots[selected.length].toLowerCase():"Review your three","SCOUT TABLE   /   PRIVATE FORMATION",
        "Across the table: "+names(opponent.ids)+"."+(selected.length?" Tap a chosen kin to remove it.":""),[
          ...(selected.length?[group("Your order",selected.map((k,i)=>button("remove",slots[i]+" · "+name(k),k,"",{image:portrait(k)})),selected.length===3?3:2)]:[]),
          ...(selected.length<3?[group(selected.length?"Duets each reserve adds":"Choose the lead",rows,selected.length?1:2)]:
            [group("One stays behind",[{label:name(t.ids.find(k=>!selected.includes(k))),detail:"This kin sits out this battle."}])]),
          group("Formation desk",[...(selected.length===3?[button("lock-check","Review sealed choice",null,names(selected),{tone:"primary"})]:[]),
            button("rival","Scout their four"),button("table","Return to table")])]);
    }
    function lockCheck(r){
      const selected=pick(r);
      if(selected.length!==3)return order(r);
      return page("Lock this formation?","SCOUT TABLE   /   PRIVATE CHOICE",
        "The first kin leads. The other two take the reserve slots in this order. After locking, send the link and keep this browser’s saved seat for the reveal.",[
          group("Your private three",eachKin(r.rosters[r.seat],selected)),group("Your three duets",duets(selected)),group("Formation",[
            button("lock","Lock my three",null,"Seal this order for the match.",{tone:"primary",disabled:pending}),button("order","Change my picks")])]);
    }
    function report(r){
      const sections=r.rosters.flatMap((t,i)=>{
        const ids=r.picks[i],unused=t.ids.find(k=>!ids.includes(k)),owner=r.seat===i?"Your":seatNames[i]+"’s";
        return [group(owner+" formation",[...eachKin(t,ids),{label:name(unused),detail:caption(unused,t.gear),image:portrait(unused),badge:"SITS OUT"}],2),
          group(owner+" three duets",duets(ids))];
      });
      const a=species[r.picks[0][0]],b=species[r.picks[1][0]];
      return page("The revealed formations","SCOUT TABLE   /   FINAL REPORT",
        a.name+" faces "+b.name+". "+seatNames[r.battle.first]+" takes the first turn.",[group("Ring entrance",[
          button("play",local(r)?"Open your battle":"Watch the battle",null,local(r)?"Resume your match on the Bellpost floor.":"View the latest position known to this browser.",{tone:"primary"}),button("table","Back to table")]),...sections,shareRows(r)]);
    }
    function remember(hash){
      if(hash&&window.location?.hash!==hash)try{window.history?.replaceState(null,"",hash);}catch{}
    }
    function absolute(r){
      const loc=window.location;
      return loc.origin+loc.pathname+(loc.search||"")+r.hash;
    }
    const selectable=r=>window.prompt?.("Select and copy this Scout Table link",absolute(r));
    async function share(r,cmd){
      const url=absolute(r);
      if(cmd==="share"&&window.navigator?.share)try{
        await window.navigator.share({title:"Wilderkin · Scout Table",url});return;
      }catch(e){if(e?.name==="AbortError")return;}
      try{
        if(!window.navigator?.clipboard?.writeText){selectable(r);return;}
        await window.navigator.clipboard.writeText(url);notify("Scout Table link copied.");
      }catch{selectable(r);}
    }
    const mayRegister=(id,r)=>id==="new"||r?.stage===0&&!local(r)&&!r.archived;
    function addressFor(value){
      const [,id]=String(value||"desk").split("|");
      return id&&id!=="new"&&record(id)?.hash||"#scout-table";
    }
    function model(value){
      const [view,id,x]=String(value||"desk").split("|"),r=record(id),i=Number(x);
      displayed=String(value||"desk");
      if(view==="error")return page("This letter could not be opened","SCOUT TABLE",problem||"Choose a complete Scout Table link.",[
        group("Return to your table",[...(r?[button("open","Open latest saved table",id)]:[]),button("paste","Open another link"),home()])]);
      if(mayRegister(id,r)){
        if(view==="rental"&&id==="new")return rentalOffer?rentalReview():registration(id);
        if(view==="draft")return registration(id);
        if(view==="register")return registerCheck(id);
        if([0,1,2,3].includes(i)){
          if(view==="member")return member(id,i);
          if(view==="catalog")return catalogPage(id,i);
          if(view==="gear")return gearPage(id,i);
        }
      }
      if(!r)return desk();
      if(view==="table"&&active())remember(r.hash);
      if(view==="archive"&&local(r)&&!r.archived)return page(r.stage===4?"Archive this table?":"Withdraw from this table?","SCOUT TABLE",
        r.stage===4?"Remove this registration from your desk. A final report link still shows both teams.":
          "Close this browser’s seat. Your friend’s existing link still opens, but you can no longer send choices from this table.",[
          group("Table decision",[button("table","Keep my table"),button("archive",r.stage===4?"Archive this table":"Withdraw my seat")])]);
      if(!r.archived&&r.stage===4&&view==="report")return report(r);
      if(myChoice(r)){
        if(view==="order")return order(r);
        if(view==="rival")return rival(r);
        if(view==="inspect"&&r.rosters[1-r.seat].ids.includes(x))return rivalKin(r,x);
        if(view==="lock")return lockCheck(r);
      }
      return table(r);
    }
    async function loadFragment(raw){
      if(raw==="#scout-table")return "desk";
      if(typeof raw!=="string"||!raw.startsWith("#scout-v1="))return null;
      let hash=raw,r=await rules.inspect(hash);
      if(!r&&raw.length<=1200){
        hash=raw.replace(/(?:[.!?,:;\])}>"'`*_’”…。]|%E2%80%99|%E2%80%9D|%E2%80%A6|%E3%80%82)+$/iu,"");
        if(hash!==raw)r=await rules.inspect(hash);
      }
      if(!r){problem=rules.secure===false?"Open Scout Table over HTTPS to verify this letter.":"The link is incomplete or its seal does not match.";return "error";}
      const own=rules.get(r.id);
      if(!own){previews.set(r.id,r);return path("table",r.id);}
      if(own.archived){if(r.stage===4)previews.set(r.id,r);return path("table",r.id);}
      const receipt=await rules.receive(hash);
      if(receipt.ok||receipt.code==="stale")return path("table",r.id);
      problem=receipt.message;return path("error",r.id);
    }
    function transaction(op,returnTo){
      if(pending)return;
      const sequence=++revision,previous=displayed;pending=true;render();
      const current=()=>sequence===revision&&active()&&previous===displayed;
      Promise.resolve().then(op).then(res=>{
        if(!current())return;
        if(!res?.ok){notify(res?.message||"The table could not be updated.");render();return;}
        show(returnTo?returnTo(res.record):path("table",res.record.id),"replace");
      }).catch(()=>{if(current())notify("The table could not be updated. Open its latest letter and try again.");})
        .finally(()=>{pending=false;if(active())render();});
    }
    function paste(){
      const text=window.prompt?.("Paste a Scout Table, Bellpost or rental link, or a message containing one.","");
      if(!text?.trim())return;
      const token=++revision,previous=displayed;
      void (async()=>{
        if(/#(?:scout-bout1|bellpost-v[123]|rental-v1)=/.test(text)&&await openSharedMessage?.(text))return;
        const markdown=text.match(/\]\(\s*<?[^#\s()<>]*(#scout-v1=[^\s)<>]+)>?\s*\)/u);
        const fragment=markdown?.[1]||text.match(/#scout-v1=\S+/u)?.[0]||text.match(/#scout-table(?=$|[\s.,!?;)\]}>])/u)?.[0];
        if(!fragment){if(active()&&token===revision)notify("Choose a Scout Table, Bellpost or rental link.");return;}
        const route=await loadFragment(fragment);
        if(route&&token===revision&&active()&&previous===displayed){if(route==="desk")remember("#scout-table");show(route);}
      })().catch(()=>{if(active()&&token===revision)notify("This letter could not be opened.");});
    }
    function act(action,value,current){
      if(typeof action!=="string"||!action.startsWith("scout-"))return false;
      const cmd=action.slice(6),[view,id,x]=String(current||"desk").split("|"),r=record(id),i=Number(x);
      if(cmd==="desk"){revision++;remember("#scout-table");show("desk");return true;}
      if(cmd==="paste"){paste();return true;}
      if(cmd==="rental-desk"&&view==="desk"){openRentals?.();return true;}
      if(view==="rental"&&id==="new"&&rentalOffer&&(cmd==="rental-keep"||cmd==="rental-replace")){
        const {incoming,editor}=rentalOffer;rentalOffer=null;
        if(cmd==="rental-replace"){
          if(editor.current())saveDraft("new",incoming);
          else notify("Your host draft changed. Review its latest four before borrowing.");
        }
        show(path("draft","new"),"replace");return true;
      }
      if(cmd==="new"){show(path("draft","new"));return true;}
      if(cmd==="open"&&record(value)){show(path("table",value));return true;}
      if(cmd==="join"&&r&&mayRegister(id,r)){show(path("draft",id));return true;}
      if(mayRegister(id,r)&&["draft","register","member","catalog","gear"].includes(view)){
        const t=draft(id),slot=[0,1,2,3].includes(i);
        if(cmd==="draft")show(path("draft",id),"replace");
        else if(cmd==="register-check"&&view==="draft")show(path("register",id));
        else if(cmd==="register"&&view==="register")transaction(async()=>{
          if(id!=="new")return rules.join(r.hash,t);
          const result=await rules.invite(t);
          if(result.ok)put("last-host",{id:result.record.id,roster:JSON.stringify(t)});
          return result;
        });
        else if(cmd==="rentals"&&view==="draft")rentalDesk(id);
        else if(cmd==="import"&&view==="draft"&&["trail","hall"].includes(value)){saveDraft(id,value==="hall"?hall():fill(trail()));render();}
        else if(cmd==="slot"&&view==="draft"&&[0,1,2,3].includes(value))show(path("member",id,value));
        else if(cmd==="finder"&&(view==="member"||view==="catalog")&&slot)findPartner(id,i,view==="catalog");
        else if(slot&&["catalog","gear","member"].includes(cmd))show(path(cmd,id,i));
        else if(cmd==="search"&&view==="catalog"){
          const q=window.prompt?.("Search all "+catalog.length+" loaners by kin, affinity or technique",search.query);
          if(typeof q==="string"){search.query=q.trim().slice(0,48);search.page=0;render();}
        }else if(cmd==="clear"&&view==="catalog"){search.query="";search.page=0;render();}
        else if(cmd==="page"&&view==="catalog"){search.page+=Math.sign(Number(value))||0;render();}
        else if(cmd==="choose"&&view==="catalog"&&slot&&known(value)){
          replaceMember(id,t,i,value);show(path("draft",id),"replace");
        }else if(cmd==="equip"&&view==="gear"&&slot&&(value==="none"||gear.byId(value))){
          for(const k of t.ids)if(k===t.ids[i]||t.gear[k]===value)delete t.gear[k];
          if(value!=="none")t.gear[t.ids[i]]=value;
          saveDraft(id,t);show(path("member",id,i),"replace");
        }
        return true;
      }
      if(!r)return true;
      if(cmd==="copy"||cmd==="share")void share(r,cmd);
      else if(cmd==="link")selectable(r);
      else if(cmd==="table")show(path("table",id),"replace");
      else if(cmd==="play"&&r.stage===4&&!r.archived&&r.battle){if(!openBattle(r))notify("The battle could not be opened. Return to the latest final report.");}
      else if(cmd==="report"&&r.stage===4)show(path("report",id));
      else if(cmd==="archive-check"&&local(r)&&!r.archived)show(path("archive",id));
      else if(cmd==="archive"&&view==="archive"&&local(r)&&!r.archived){
        const result=rules.archive(id);
        if(result.ok){revision++;remember("#scout-table");show("desk","replace");}else notify(result.message);
      }else if(myChoice(r)){
        if(["order","rival"].includes(cmd))show(path(cmd,id));
        else if(cmd==="inspect"&&r.rosters[1-r.seat].ids.includes(value))show(path("inspect",id,value));
        else if(view==="order"&&(cmd==="pick"||cmd==="remove")){
          const selected=pick(r);
          if(cmd==="pick"&&selected.length<3&&!selected.includes(value)&&r.rosters[r.seat].ids.includes(value))selected.push(value);
          if(cmd==="remove"&&selected.includes(value))selected.splice(selected.indexOf(value),1);
          put("order:"+id,selected);render();
        }else if(cmd==="lock-check"&&view==="order"&&pick(r).length===3)show(path("lock",id));
        else if(cmd==="lock"&&view==="lock"&&pick(r).length===3)transaction(()=>rules.lock(id,pick(r)));
      }
      return true;
    }
    return {model,act,loadFragment,borrowRental,addressFor};
  }
  window.WilderScoutTable=Object.freeze({create});
})();
