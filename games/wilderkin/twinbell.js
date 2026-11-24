// The grounds lend field-guide kin at level 20. Draft changes only affect the next bout.
(() => {
  "use strict";
  const group=(title,rows,columns=1)=>({title,rows,columns}),route="twinbell",pageSize=6;
  const slots=["West lead","East lead","First reserve","Second reserve"];
  function create({game,row,image,go,render,notify,library,active}){
    const book=window.WilderTwinMatch,keepers=book.wardens,sim=window.WilderTwinBattle.create({game});
    const desk=book.create({game,library,sim}),kit=window.WilderSparringGear,species=game.species;
    const known=id=>typeof id==="string"&&Object.hasOwn(species,id)&&!species[id].bonus;
    const catalog=Object.values(species).filter(k=>known(k.id)).sort((a,b)=>a.name.localeCompare(b.name));
    const name=id=>species[id].name,kitName=(card,id)=>kit.byId(card.gear[id])?.name||"No gear";
    const button=(id,label,value,detail="",extra={})=>row("grounds-"+id,label,value,detail,extra);
    const view=(label,target,detail="",extra={})=>button("view",label,target,detail,extra);
    const show=(value=null,mode="push")=>go(route,value,mode);
    const reply=(r,success,mode="replace")=>{if(r?.ok)show(success,mode);else{notify(r?.message||"The grounds could not open this choice.");render();}return !!r?.ok;};
    const ring=window.WilderTwinRing.create({game,row,image,go,notify,render,active,read:desk.read,commit:desk.commit,onSetup:()=>show(null),
      onRematch:()=>reply(desk.rematch(),"ring")});
    let query="",replaceBout=null;
    const data=desk.desk;
    function boutTicket(){const r=desk.read();return r&&JSON.stringify([r.id,r.history.length,r.draft,data().crew,data().foe]);}
    function start(force=false){
      if(force&&(!replaceBout||replaceBout!==boutTicket())){replaceBout=null;notify("This bout changed. Review it before starting another.");show(null,"replace");return;}
      const res=desk.start(force);
      if(res.code==="active"){replaceBout=boutTicket();show("replace");return;}
      replaceBout=null;reply(res,"ring","push");
    }
    function receive(card,opposing=false){
      const r=desk.choose(card,opposing);if(!r.ok){notify(r.message);return false;}
      show(null);return true;
    }
    const names=c=>c.ids.map(name).join(" · ");
    const firstPair=c=>name(c.ids[0])+" and "+name(c.ids[1]);
    const fixed=id=>keepers.find(w=>w.id===id);
    function home(){
      const d=data(),w=fixed(d.opponent),earned=Object.keys(d.marks).length;
      const fight=button("start",d.active?"Start a different bout":"Ring the opening bell",null,firstPair(d.crew)+" face "+firstPair(d.foe)+".",{tone:d.active?undefined:"primary",key:d.active?undefined:"1"});
      return {title:"Twinbell Grounds",kicker:"TWO AGAINST TWO",art:{src:"ui/twinbell-grounds.png",landscape:true,height:142},
        subtitle:"Give both leads an order, then ring the bell to resolve the round.",sections:[
          group("At the ring",[...(d.active?[view("Resume your bout","ring","Round "+desk.read().pos.round+" against "+desk.read().right.name+".",{tone:"primary",key:"1"})]:[]),
            fight,...(d.played&&!d.active?[view("Last result","result")]:[])]),
          group("Prepare",[view("Your four · "+d.crew.name,"crew",names(d.crew),{image:image(d.crew.ids[0])}),
            view("Opponent · "+d.foe.name,"keepers",w?w.bell+" · "+w.place:names(d.foe),{image:image(d.foe.ids[0])})],2),
          ...(window.WilderSwitchyard?[group("Series play",[row("nav","Enter the Switchyard Cup","switchyard","Register six, choose four per game, and race Captain Sela to two wins.")])]:[]),
          group("On the bell cord",[view(earned===3?"Full Twinbell cord":earned+" of 3 Warden bells","cord","Defeat each Warden to hang their bell on your cord."),view("Doubles rules","rules")],2),
          ...(!d.persistent?[{text:"This browser is keeping the grounds in this session."}]:[])]};
    }
    function opponents(){
      const d=data();return {title:"Choose a Warden",kicker:"TWINBELL GROUNDS",sections:[...keepers.map(w=>group(w.bell+" · "+w.place,[
        button("keeper",w.name,w.id,w.intro,{image:image(w.ids[0]),badge:d.marks[w.id]?"Won":w.id===d.opponent?"Selected":""}),
        {label:firstPair(w)+" open",detail:"Reserves · "+w.ids.slice(2).map(name).join(" · ")}])),
        group("Visiting teams",[view("Choose a rental rival","shelf:away:0","Face any featured or saved four."),view("Back to the grounds",null)])]};
    }
    function cord(){
      const d=data(),count=Object.keys(d.marks).length;
      return {title:count===3?"The full Twinbell cord":"Your bell cord",kicker:"TWINBELL GROUNDS",subtitle:count===3?
        "All three bells sound together. Each keeper has recorded your winning four.":count+" of 3 bells earned. Win a doubles bout against each keeper.",
        sections:[group("The keepers",keepers.map(w=>{
          const m=d.marks[w.id];return button("keeper",w.bell,w.id,m?w.name+" · "+m.rounds+" rounds · "+names(m.team):w.name+" · "+w.place,{image:image(w.ids[0]),badge:m?"Won":"Open"});
        })),group("Ring",[view("Back to the grounds",null)])]};
    }
    function crew(){
      const c=data().crew;
      return {title:c.name,kicker:"YOUR DOUBLES FOUR",subtitle:"The first two kin open on the field. Healthy reserves enter empty lanes in roster order.",sections:[
        group("Battle order",c.ids.map((id,i)=>view(name(id),"slot:"+i,kitName(c,id),{image:image(id),badge:slots[i]})),2),
        group("Team desk",[view("Choose a whole team","shelf:home:0","Borrow four kin and their gear."),button("save","Save a rental copy",null,"Keep this lineup on the Rental Counter."),
          view("Return to the grounds",null,"See your opening pair.",{tone:"primary"})])]};
    }
    function member(i){
      const c=data().crew,id=c.ids[i];
      return {title:name(id),kicker:slots[i].toUpperCase()+"   /   DOUBLES FOUR",art:{src:image(id)},subtitle:species[id].types.join(" / ")+" · "+kitName(c,id),sections:[
        group("Change this slot",[button("catalog","Choose a different kin",i,"Search all "+catalog.length+" loaners."),view("Choose equipment","gear:"+i,kitName(c,id))]),
        group("Trade places",c.ids.flatMap((x,j)=>i===j?[]:[button("swap","Trade with "+name(x),i+"|"+j,slots[j],{image:image(x)})])),group("Team",[view("Your four","crew")])]};
    }
    function picks(i,rawPage){
      const hits=catalog.filter(k=>[k.name,...k.types,...k.skills.map(s=>s.name)].some(x=>x.toLowerCase().includes(query.toLowerCase())));
      const pages=Math.max(1,Math.ceil(hits.length/pageSize)),p=Math.min(pages-1,Math.max(0,rawPage)),c=data().crew;
      return {title:"Choose "+slots[i].toLowerCase(),kicker:"TWINBELL LOANERS",sections:[
        group("Find a kin",[button("search",query?"Search · "+query:"Search kin, affinity or skill",i),...(query?[button("clear","Clear search",i)]:[])]),
        group(hits.length+" matches",hits.slice(p*pageSize,(p+1)*pageSize).map(k=>button("choose",k.name,i+"|"+k.id,k.types.join(" / "),{image:image(k.id),
          badge:c.ids.includes(k.id)?slots[c.ids.indexOf(k.id)]:"",disabled:k.id===c.ids[i]}))),
        group("Page "+(p+1)+" of "+pages,[...(p?[view("Previous","picks:"+i+":"+(p-1))]:[]),
          ...(p+1<pages?[view("Next","picks:"+i+":"+(p+1))]:[]),view("Back to "+name(c.ids[i]),"slot:"+i)],2)]};
    }
    function gear(i){
      const c=data().crew,id=c.ids[i];
      return {title:name(id)+"’s gear",kicker:"TWINBELL FITTINGS",sections:[group("Equipment",[
        button("fit","No gear",i+"|none","Leave the slot open.",{badge:!c.gear[id]?"Equipped":""}),...kit.items.map(item=>{
          const holder=c.ids.find(k=>c.gear[k]===item.id&&k!==id);
          return button("fit",item.name,i+"|"+item.id,holder?"Held by "+name(holder)+".":item.role,{badge:c.gear[id]===item.id?"Equipped":"",disabled:!!holder,image:"art/gear/"+item.id+".png"});
        })]),group("Team",[view("Your four","crew")])]};
    }
    function material(){
      const trail=[...new Set([game.state.lead,...game.state.team,"sprigkit","cindlet","dewfin","gustlance"].filter(known))].slice(0,4);
      const current={name:"Trail companions",ids:trail,gear:{}};
      return [current,...library.featured().map(f=>f.card),...library.list().map(s=>s.card)];
    }
    function shelf(side,p){
      const pool=material(),pages=Math.max(1,Math.ceil(pool.length/pageSize));
      p=Math.min(pages-1,Math.max(0,p));
      return {title:side==="away"?"Choose a visiting four":"Choose your team",kicker:"TWINBELL TEAM DESK",subtitle:"Field companions join as level-20 loaners. A rental brings its four kin and their gear.",sections:[
        group("Teams",pool.slice(p*pageSize,(p+1)*pageSize).map(c=>button("team",c.name,side+"|"+library.encode(c),names(c),{image:image(c.ids[0])}))),
        group("Page "+(p+1)+" of "+pages,[...(p?[view("Previous","shelf:"+side+":"+(p-1))]:[]),...(p+1<pages?[view("Next","shelf:"+side+":"+(p+1))]:[]),
          view("Back",side==="away"?"keepers":"crew")],2)]};
    }
    function rules(){return {title:"Doubles rules",kicker:"TWINBELL GROUNDS",sections:[
      {title:"Before the bell",text:"Two leads stand in each pair of lanes. Read the opposing orders, then choose a move for each of your leads. You can revise both until you ring."},
      {title:"Who acts first",text:"Switches go first, then cover, then calls, then attacks and duets. Within a step, both West orders go before East. You go first in the same lane on odd rounds. The rival goes first on even rounds."},
      {title:"Targets",text:"Strikes target a lane. If a rival switches first, the incoming kin takes the hit. Cover halves ordinary damage this round. Calling a target lets your partner’s ordinary strike pierce cover and deal 50% more damage."},
      {title:"Use both partners",text:"A cover, call or switch earns a beat, up to three. If the pair has enough beats at the start of the round, West can order their duet. East can still attack, call, or cover. Both kin must be standing when the duet strikes."},
      {title:"Reserves",text:"The next healthy reserve fills an empty lane between rounds. Your order of four decides who enters first."},
      {title:"At the last bell",text:"Defeat all four opponents to win. At round "+sim.limit+", the side with more kin standing wins. Ties go to the larger total share of HP remaining, then to a draw."},
      group("Ring",[...(data().active?[view("Resume your bout","ring")]:[]),view("Back to the grounds",null)])]};}
    function model(value){
      const [v,a,b]=String(value||"desk").split(":"),slot=Number(a);
      if(v==="desk")return home();if(v==="keepers")return opponents();if(v==="cord")return cord();
      if(v==="crew")return crew();if(v==="rules")return rules();if(v==="shelf")return shelf(a==="away"?"away":"home",Number(b)||0);
      if([0,1,2,3].includes(slot)){
        if(v==="slot")return member(slot);if(v==="gear")return gear(slot);if(v==="picks")return picks(slot,Number(b)||0);
      }
      if(v==="replace")return {title:"Ring a new bout?",kicker:"TWINBELL GROUNDS",subtitle:"Starting this opening will end the unfinished bout.",sections:[
        group("At the bell",[button("confirm","Start the new bout",null,firstPair(data().crew)+" face "+firstPair(data().foe)+".",{tone:"primary"}),
          view("Keep playing the current bout","ring")])]};
      return desk.read()?ring.model(value):home();
    }
    const ringRoute=v=>!!v&&!["desk","crew","keepers","cord","rules","slot","shelf","picks","gear","replace"].includes(String(v).split(":")[0]);
    function act(action,value,current){
      if(!action?.startsWith("grounds-"))return ringRoute(current)&&!!desk.read()&&ring.act(action,value,current);
      const cmd=action.slice(8),[i,arg]=String(value??"").split("|"),slot=Number(i);
      if(cmd==="view")show(value);
      else if(cmd==="start"||cmd==="confirm")start(cmd==="confirm");
      else if(cmd==="keeper")reply(desk.choose(value,true),null);
      else if(cmd==="team"){
        const c=library.decode(arg);
        if(c)reply(desk.choose(c,i==="away"),i==="away"?null:"crew");
      }else if(cmd==="save"){
        const c=data().crew,title=window.prompt?.("Name this rental team",c.name);
        if(typeof title==="string")notify(library.save({...c,name:title}).message);render();
      }else if([0,1,2,3].includes(slot)){
        if(cmd==="catalog"){query="";show("picks:"+slot+":0");return true;}
        if(cmd==="search"||cmd==="clear"){
          const next=cmd==="clear"?"":window.prompt?.("Search by kin name, affinity or skill",query);if(typeof next==="string"){query=next.trim().slice(0,64);show("picks:"+slot+":0","replace");}return true;
        }
        const old=data().crew,ids=old.ids.slice(),gear={...old.gear},id=ids[slot];
        if(cmd==="fit"){
          if(arg==="none")delete gear[id];else if(kit.byId(arg)&&!ids.some(k=>k!==id&&gear[k]===arg))gear[id]=arg;else return true;
        }else if(cmd==="swap"||cmd==="choose"){
          const target=cmd==="swap"?ids[Number(arg)]:arg;if(!known(target))return true;
          const other=ids.indexOf(target);
          if(other!==-1)ids[other]=id;else delete gear[id];ids[slot]=target;
        }else return true;
        reply(desk.choose({name:"My Twinbell four",ids,gear}),"crew");
      }
      return true;
    }
    function key(e,current){if(!current&&e.key==="1"&&!e.repeat){if(data().active)show("ring");else start();return true;}return ringRoute(current)&&!!desk.read()&&ring.key(e,current);}
    function linkView(hash){const run=hash==="#twinbell-ring"&&desk.read();return run?(run.pos.phase==="done"?"result":"ring"):null;}
    return {model,act,key,receive,linkView,crew:()=>data().crew,hashFor:v=>ringRoute(v)?"#twinbell-ring":"#twinbell"};
  }
  window.WilderTwinbell=Object.freeze({create});
})();
