// The Lantern Cup desk shows the public registration and keeps each new field selection separate.
(() => {
  "use strict";
  function create({species,sim,rules=window.WilderCupRules.create({species,game:{species},sim}),row,image,read,write,show,render,notify,start}) {
    const catalog=Object.values(species).filter(k=>!k.bonus).sort((a,b)=>a.name.localeCompare(b.name));
    const types=Object.keys(window.WilderKinDex.types),gear=window.WilderSparringGear;
    const search={text:"",affinity:"All",page:0},pageSize=8;
    const name=id=>species[id]?.name||id;
    const entry=()=>read()?.series;
    const fresh=()=>({captain:rules.captains[0].id,roster:rules.defaultRoster.slice(),gear:{},locked:false,picks:[],rounds:[],match:null});
    const current=()=>entry()||fresh();
    const coach=e=>rules.captains.find(c=>c.id===e.captain)||rules.captains[0];
    const score=e=>rules.score(e.rounds);
    const writable=e=>!e.locked&&!e.match&&!e.rounds.length;
    const active=e=>e.locked&&!e.match&&!score(e).done;
    const piece=id=>gear?.byId(id)?.name||"";
    const group=(title,rows,columns=1)=>({title,rows,columns});
    const button=(id,label,value,detail="",opts={})=>row("cup-desk-"+id,label,value,detail,opts);
    const visit=(view,label,detail="",opts={})=>button("open",label,view,detail,opts);
    const hall=(view,label,detail="",opts={})=>row("spar-view",label,view,detail,opts);
    const imageOf=id=>image?image(id,false):window.WilderKinDex.spriteUrl(id);
    const portrait=c=>({src:"ui/cup-"+c.id+".png",caption:c.title});
    const banner={src:"ui/lantern-cup.png",landscape:true,height:148};
    const names=ids=>ids.map(name).join(" · ");
    const fieldOrder=i=>i===0?"Lead":"Reserve "+i;
    const pass=id=>window.WilderFamilyTechniques?.forKin(id);
    const passRule="Herons and gliders share one pass per team each bout. It costs 1 beat.";
    const uniform=(k,kit)=>[k.types.join(" / "),pass(k.id)?.name,piece(kit?.[k.id])].filter(Boolean).join(" · ");
    function passProfile(id){
      const move=pass(id);
      return move?[{title:move.name,text:move.summary+" "+passRule}]:[];
    }
    const eligible=id=>typeof id==="string"&&Object.hasOwn(species,id)&&!species[id].bonus;
    const notes=e=>e.rounds.length&&window.WilderCupNotebook?window.WilderCupNotebook.sections(e,species,sim):[];
    const matches=e=>e.rounds.map((r,i)=>{
      const title="Bout "+(i+1)+" · "+(r.winner===0?"Win":r.winner===1?"Loss":"Draw");
      return r.conceded?{label:title,detail:names(r.right)+" · Conceded"}:hall("cup:replay:"+i,title,names(r.right));
    });
    const recordLine=e=>{const p=score(e);return "You "+p.home+"  ·  "+coach(e).name+" "+p.away;};
    function desk() {
      const e=entry();
      if(!e || !e.locked){
        const draft=e||fresh(),c=coach(draft);
        const cleared=Object.keys(read()?.cabinet||{}).length;
        return {title:"Lantern Cup",kicker:"REGISTER SIX   /   FIELD THREE",art:banner,
          subtitle:"Bring six level-20 loaners. For each bout, choose a lead and two reserves. The first captain to two points wins the series.",
          sections:[group("Match desk",[
            button("quick",e?"Start with this six":"Play the opening bout",null,names(draft.roster.slice(0,3))+" against "+c.name,{tone:"primary"}),
            visit("cup:register",e?"Edit registration":"Register your six",names(draft.roster)),
            visit("cup:captains","Choose a captain",c.name),visit("cup:scout","Scout "+c.name,"Public registered team"),
            hall("cup:cabinet","Cup cabinet",cleared+" / "+rules.captains.length+" captains cleared")]),
            {title:"Series rules",text:"You open the first and third bouts. The captain opens the second. A win earns one point and a draw earns each side half a point. The series ends at two points or after the third bout."}]};
      }
      const result=score(e),c=coach(e),done=result.done;
      const next=e.rounds.length+1;
      const actions=e.match?[hall("cup:match","Resume bout "+next,names(e.match.setup?.left||e.picks),{tone:"primary"})]:
        done?[button("new","Register another team",null,"Start a fresh series"),hall("cup:cabinet","Open Cup cabinet","Winning registrations",{tone:"primary"})]:
        [visit("cup:pick","Choose three for bout "+next,(rules.first(e.rounds.length)===0?"Your team opens.":c.name+" opens."),{tone:"primary"})];
      if(!done)actions.push(visit("cup:scout","Scout "+c.name,"Inspect the captain’s public roster and committed lineup."));
      if(notes(e).length)actions.push(visit("cup:notes","Read last bout’s notes"));
      return {title:done?(result.winner===0?"Lantern Cup won":result.winner===1?"Series complete":"Series drawn"):"Lantern Cup",
        kicker:recordLine(e),art:portrait(c),sections:[group(done?"Series result":"Match desk",actions),
          ...(e.rounds.length?[group("Bout results",matches(e))]:[])]};
    }
    function hallRegistration(e) {
      const hall=read()?.hallSetup;
      if(!Array.isArray(hall?.left)||hall.left.length!==3||new Set(hall.left).size!==3||![...hall.left].every(eligible))return null;
      const roster=[...new Set([...hall.left,...e.roster,...rules.defaultRoster])].slice(0,6);
      const items={...e.gear};
      for(const id of hall.left){delete items[id];if(hall.gear?.left?.[id])items[id]=hall.gear.left[id];}
      const kit=gear.normalize({left:items},roster,[]).left;
      return rules.register(roster,kit);
    }
    function registration(e) {
      if(!writable(e))return desk();
      const c=coach(e),valid=rules.register(e.roster,e.gear);
      return {title:"Register your six",kicker:"LANTERN CUP   /   LEVEL 20",sections:[
        group("Series entry",[button("lock","Register and choose three",null,"Lock these six and their gear for this series.",{tone:"primary",disabled:!valid}),
          visit("cup:captains","Choose a captain",c.name),
          ...(hallRegistration(e)?[button("hall","Bring my Hall trio",null,names(read().hallSetup.left)+" and their equipment")]:[])],2),
        group("Registered loaners",Array.from({length:6},(_,i)=>{
          const k=species[e.roster[i]];
          return k?visit("cup:member:"+i,k.name,uniform(k,e.gear),{image:imageOf(k.id)}):visit("cup:roster:"+i,"Choose loaner "+(i+1));
        }),2),group("Match desk",[visit("cup:scout","Inspect "+c.name+"’s six"),visit("cup:desk","Back to the Cup")])]};
    }
    function captains(e) {
      return {title:"Choose your captain",kicker:"LANTERN CUP",sections:[group("Opponents",rules.captains.map(c=>
        visit("cup:captain:"+c.id,c.name,c.title,{image:portrait(c).src,badge:c.id===e.captain?"Selected":read()?.cabinet?.[c.id]?"Cleared":""})))]};
    }
    function captain(e,id) {
      const c=rules.captains.find(c=>c.id===id);
      if(!c)return captains(e);
      return {title:c.name,kicker:"LANTERN CUP CAPTAIN",art:portrait(c),sections:[{title:"Game plan",text:c.plan},
        group("Series entry",[button("captain","Face "+c.name,c.id,"Review your six before registration locks.",{tone:"primary",disabled:!writable(e)}),visit("cup:captains","Other captains")]),
        group("Public six",rosterRows(c.roster,c.gear),2)]};
    }
    function rosterRows(ids,kit) {
      return ids.map(id=>({label:name(id),image:imageOf(id),detail:uniform(species[id],kit)}));
    }
    function member(e,i) {
      if(!writable(e))return desk();
      const id=e.roster[i],k=species[id];if(!k)return picker(e,i);
      return {title:k.name,kicker:"CUP REGISTRATION   /   SLOT "+(i+1),subtitle:uniform(k,e.gear),art:{src:imageOf(id),height:120},
        sections:[group("Loaner",[visit("cup:roster:"+i,"Choose another species","Browse all "+catalog.length+" loaners",{tone:"primary"}),
          visit("cup:gear:"+i,"Equipment",piece(e.gear[id])||"Empty slot"),visit("cup:register","Back to registration")]),...passProfile(id)]};
    }
    function entries() {
      const text=search.text.trim().toLowerCase();
      return catalog.filter(k=>(search.affinity==="All"||k.types.includes(search.affinity))&&(!text||k.name.toLowerCase().includes(text)||k.id.includes(text)||pass(k.id)?.name.toLowerCase().includes(text)));
    }
    function picker(e,i) {
      if(!writable(e))return desk();
      const matches=entries(),total=Math.max(1,Math.ceil(matches.length/pageSize));
      search.page=Math.max(0,Math.min(search.page,total-1));
      const list=matches.slice(search.page*pageSize,(search.page+1)*pageSize);
      return {title:"Choose a Cup loaner",kicker:"REGISTRATION   /   SLOT "+(i+1),sections:[
        group("Find a species",[visit("cup:search:"+i,search.text?"Search · "+search.text:"Search names or passes"),
          visit("cup:affinity:"+i,"Affinity · "+search.affinity)],2),
        group(matches.length+" matching kin",list.length?list.map(k=>visit("cup:candidate:"+i+":"+k.id,k.name,uniform(k,e.gear),
          {image:imageOf(k.id),badge:e.roster.includes(k.id)?"Registered":""})):[{label:"No matching kin",detail:"Change the name or affinity."}],2),
        ...(total>1?[group("Page "+(search.page+1)+" of "+total,[button("page","Previous",-1,"",{disabled:!search.page}),
          button("page","Next",1,"",{disabled:search.page===total-1})],2)]:[]),group("",[visit("cup:register","Back to registration")])]};
    }
    function candidate(e,i,id) {
      if(!writable(e)||!eligible(id))return registration(e);
      const k=species[id],existing=e.roster.indexOf(id),current=e.roster[i];
      const detail=existing>=0&&existing!==i?"Exchanges slots with "+name(current)+".":current&&current!==id?"Replaces "+name(current)+".":"";
      return {title:k.name,kicker:"CUP LOANER   /   LEVEL 20",subtitle:uniform(k,e.gear)+" · "+sim.maxHp(id)+" HP",art:{src:imageOf(id),height:128},
        sections:[group("Registration",[button("choose",existing===i?"Keep "+k.name:"Choose "+k.name,i+":"+id,detail,{tone:"primary"}),
          visit("cup:roster:"+i,"Back to matches")]),...passProfile(id),
          group("Skills",k.skills.map(s=>({label:s.name,detail:s.kind==="attack"?s.type+" · "+s.power+" power":s.kind==="guard"?"Strike and brace":"Recover health once"})))]};
    }
    function gearPage(e,i) {
      if(!writable(e)||!eligible(e.roster[i]))return registration(e);
      const id=e.roster[i],held=e.gear[id];
      return {title:"Equip "+name(id),kicker:"CUP REGISTRATION",subtitle:"One copy of each piece across your six.",sections:[
        group("Equipment",gear.items.map(it=>{
          const holder=e.roster.find(k=>e.gear[k]===it.id);
          return button("gear",it.name,i+":"+it.id,it.role+(holder&&holder!==id?" · Move from "+name(holder):""),{image:"art/gear/"+it.id+".png",badge:held===it.id?"Equipped":""});
        }),2),group("",[...(held?[button("gear","Remove "+piece(held),i+":none")]:[]),visit("cup:register","Back to registration")])]};
    }
    function pick(e) {
      if(!active(e))return desk();
      const c=coach(e),picked=e.picks,n=e.rounds.length+1;
      const commands=[button("start","Start bout "+n,null,picked.length===3?names(picked):(3-picked.length)+" more to choose",{tone:"primary",disabled:picked.length!==3}),
        visit("cup:scout","Reveal captain’s three","The captain commits before seeing your picks.")];
      if(notes(e).length)commands.push(visit("cup:notes","Read last bout’s notes"));
      const last=e.rounds.at(-1);
      if(last)commands.push(button("repeat","Recall last three",null,names(last.left)));
      else commands.push(button("repeat","Use first three",null,names(e.roster.slice(0,3))));
      const selected=picked.map((id,i)=>button("remove",name(id),id,"Tap to remove",{image:imageOf(id),badge:fieldOrder(i)}));
      const shortName=c.name.split(" ")[0];
      const intel=last?{title:"What the captain saw",text:"You led with "+name(last.left[0])+" against "+names(last.right)+". "+
        (last.winner===1?"After winning, "+shortName+" keeps the lead and changes a reserve.":last.winner===0?"After losing, "+shortName+" changes leads and brings a new face.":"After a draw, "+shortName+" changes the lineup.")}:null;
      return {title:"Choose your three",kicker:"BOUT "+n+"   /   "+recordLine(e),subtitle:c.name+" registered "+names(c.roster)+".",
        sections:[group("Match desk",commands,2),...(intel?[intel]:[]),
          ...(selected.length?[group("Battle order",selected,3)]:[]),
          group("Select in battle order",e.roster.map(id=>button("add",name(id),id,uniform(species[id],e.gear),
            {image:imageOf(id),badge:picked.includes(id)?fieldOrder(picked.indexOf(id)):"",disabled:picked.includes(id)||picked.length>=3})),2),
          ...(picked.length>1?[group("Change lead",picked.slice(1).map(id=>button("lead","Lead with "+name(id),id)),2)]:[])]};
    }
    function scout(e) {
      const c=coach(e),canReveal=!e.match&&!score(e).done&&e.roster.length===6;
      const report=canReveal?rules.scout(c.id,e.roster,e.rounds,e.gear):null;
      const sections=[{title:"Captain’s plan",text:c.plan},group("Public registration",rosterRows(c.roster,c.gear),3)];
      const passIds=c.roster.filter(id=>pass(id));
      if(passIds.length)sections.push({title:"Captain’s family pass",text:[...new Set(passIds.map(id=>pass(id)))].map(move=>
        names(passIds.filter(id=>pass(id).id===move.id))+" can use "+move.name+". "+move.summary).join(" ")+" "+passRule});
      if(report){
        sections.unshift(group("Committed for bout "+(e.rounds.length+1),report.team.map((id,i)=>({
          label:name(id),detail:uniform(species[id],report.gear),image:imageOf(id),badge:fieldOrder(i)})),3));
        sections.push({title:"Why these three",text:report.reason+" "+report.counter});
        if(report.coverage.length||report.weaknesses.length)sections.push({title:"Matchups",text:[
          report.coverage.length?"Strong into "+report.coverage.join(", ")+".":"",
          report.weaknesses.length?"Shared weaknesses: "+report.weaknesses.join(", ")+".":""
        ].filter(Boolean).join(" ")});
        sections.push({title:"On the bench",text:names(report.bench)});
        sections.push(group("Committed duets",report.duets.map(d=>({label:d.name+" · "+d.cost+" beats",detail:names(d.ids)+" · "+d.label}))));
      }
      if(e.rounds.length)sections.push(group("Prior opposing trios",e.rounds.map((r,i)=>({label:"Bout "+(i+1),detail:names(r.right)}))));
      sections.push(group("Match desk",[
        ...(notes(e).length?[visit("cup:notes","Read last bout’s notes")]:[]),
        visit(e.locked?"cup:pick":"cup:register",e.locked?"Back to the team sheet":"Back to registration")]));
      return {title:"Scout "+c.name,kicker:"LANTERN CUP",art:portrait(c),sections};
    }
    function model(value) {
      const e=current(),[,view="desk",index="",id=""]=String(value||"cup").split(":"),i=Number(index);
      if(view==="desk"||view==="result")return desk();
      if(view==="register")return registration(e);
      if(view==="captains")return captains(e);
      if(view==="captain")return captain(e,index);
      if(view==="pick")return pick(e);
      if(view==="scout")return scout(e);
      if(view==="notes")return {title:"Last bout’s notes",kicker:"LANTERN CUP",sections:[...notes(e),group("Match desk",[visit(e.match||score(e).done?"cup:desk":"cup:pick","Back to the Cup")])]};
      if(!writable(e)||!Number.isInteger(i)||i<0||i>5)return desk();
      if(view==="member")return member(e,i);
      if(view==="roster")return picker(e,i);
      if(view==="candidate")return candidate(e,i,id);
      if(view==="gear")return gearPage(e,i);
      if(view==="affinity")return {title:"Filter by affinity",kicker:"CUP LOANERS",sections:[group("Either affinity",["All",...types].map(t=>button("filter",t,i+":"+t,"",{badge:t===search.affinity?"Selected":""})),2)]};
      if(view==="search")return {title:"Find a Cup loaner",kicker:"SLOT "+(i+1),subtitle:search.text||"Enter a species or pass name",sections:[
        group("Search",[visit("cup:roster:"+i,"Show "+entries().length+" matches","",{tone:"primary"}),button("key","Delete","delete"),button("key","Clear","clear")],2),
        {grid:{cols:6,cells:[..."ABCDEFGHIJKLMNOPQRSTUVWXYZ-"].map(c=>button("key",c,c))}}]};
      return null;
    }
    function editKey(key) {
      if(key==="delete")search.text=search.text.slice(0,-1);
      else if(key==="clear")search.text="";
      else if(/^[a-z-]$/i.test(key)&&search.text.length<40)search.text+=key.toLowerCase();
      search.page=0;render();
    }
    function key(event,value) {
      const [,view,i]=String(value).split(":");
      if(view!=="search"||!writable(current())||event.altKey||event.metaKey||event.ctrlKey)return false;
      if(event.key==="Enter")show("cup:roster:"+i);
      else if(event.key==="Backspace")editKey("delete");
      else if(/^[a-z-]$/i.test(event.key))editKey(event.key);
      else return false;
      return true;
    }
    function act(id,value) {
      if(typeof id!=="string"||!id.startsWith("cup-desk-"))return false;
      const cmd=id.slice(9),e=current(),str=String(value??""),[slot,target]=str.split(":"),i=Number(slot);
      if(cmd==="open"){show(str);return true;}
      if(cmd==="new"&&entry()&&score(e).done){write(fresh());show("cup:register");return true;}
      if(["add","remove","lead","repeat","start"].includes(cmd)){
        if(!active(e))return true;
        const picks=e.picks.slice();
        if(cmd==="start"){if(picks.length===3)start(picks);return true;}
        if(cmd==="repeat"){write({...e,picks:(e.rounds.at(-1)?.left||e.roster.slice(0,3)).slice()});render();return true;}
        if(cmd==="add"&&e.roster.includes(str)&&!picks.includes(str)&&picks.length<3)picks.push(str);
        if(cmd==="remove"&&picks.includes(str))picks.splice(picks.indexOf(str),1);
        if(cmd==="lead"&&picks.includes(str))picks.unshift(...picks.splice(picks.indexOf(str),1));
        write({...e,picks});render();return true;
      }
      if(!writable(e))return true;
      if(cmd==="hall"){
        const sheet=hallRegistration(e);if(sheet){write({...e,...sheet});render();}return true;
      }
      if(cmd==="captain"&&rules.captains.some(c=>c.id===str)){write({...e,captain:str});show("cup:register");return true;}
      if(cmd==="quick"||cmd==="lock"){
        const sheet=rules.register(e.roster,e.gear);
        if(!sheet){notify("Register six distinct loaners and a legal kit first.");return true;}
        const picks=cmd==="quick"?sheet.roster.slice(0,3):[];
        write({...e,...sheet,locked:true,picks});
        if(cmd==="quick")start(picks);else show("cup:pick");
        return true;
      }
      if(cmd==="page"){search.page+=Math.sign(Number(value))||0;render();return true;}
      if(cmd==="key"){editKey(str);return true;}
      if(!Number.isInteger(i)||i<0||i>5)return true;
      if(cmd==="filter"&&["All",...types].includes(target)){search.affinity=target;search.page=0;show("cup:roster:"+i);}
      if(cmd==="choose"&&eligible(target)){
        const roster=e.roster.slice(),at=roster.indexOf(target);
        if(i>roster.length)return true;
        if(at>=0&&at!==i)roster[at]=roster[i];
        roster[i]=target;
        const held=Object.fromEntries(roster.filter(id=>e.gear[id]).map(id=>[id,e.gear[id]]));
        write({...e,roster,gear:held});show("cup:register");
      }
      if(cmd==="gear"&&e.roster[i]&&(target==="none"||gear?.byId(target))){
        const kit={...e.gear};
        for(const id of e.roster)if(id===e.roster[i]||kit[id]===target)delete kit[id];
        if(target!=="none")kit[e.roster[i]]=target;
        write({...e,gear:kit});show("cup:register");
      }
      return true;
    }
    return {model,act,key};
  }
  window.WilderCupDesk={create};
})();
