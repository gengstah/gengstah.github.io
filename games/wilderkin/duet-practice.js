// Three legal exchanges earn the meter. The two choices always start from that same position.
(() => {
  "use strict";
  const key="wilderkin.duet-practice.v1";
  const group=(title,rows,columns=1)=>({title,rows,columns});
  const front=s=>s.team[s.active];
  function create({game,row,image,go,notify,playTone,openFinder,playFilm,backToRental}){
    const sim=window.WilderSparringBattle.create({game}),exercise=window.WilderDuetExercise.create({game,sim});
    const arena=window.WilderBellpostArena.create({game,row,image});
    const name=id=>game.species[id].name;
    const button=(action,label,value,detail,extra)=>row("drill-"+action,label,value,detail,extra);
    function show(view,mode="push"){stage=view;save();go("duet-practice",view,mode);}
    const sheet=pos=>arena.snapshot({seat:0,labels:["Your pair","Practice rival"]},pos);
    let search,lesson,choice,returnToFinder,rentalHash,stage="ready",initialized=false,attempts=new Map(),shortcuts=new Map();
    function set(seed,selected){
      const next=exercise.prepare(seed);
      if(!next)return false;
      lesson=next;choice=["duet","strike"].includes(selected)?selected:null;attempts=new Map();return true;
    }
    function save(){
      const {setup,anchor,partner,foe}=lesson;
      try{window.sessionStorage?.setItem(key,JSON.stringify({setup,anchor,partner,foe,choice,stage,rentalHash}));}catch{}
    }
    function open(selection){
      search??=window.WilderPartnerSearch.create({game,sim});
      const seed=search.exercise({anchor:selection.anchor,foe:selection.foe,team:selection.team,rivals:selection.foes,
        gear:selection.gear,foeGear:selection.foeGear,role:selection.role},selection.partner);
      if(!set(seed,null)){notify("These two kin could not prepare this exercise. Choose another partner.");return false;}
      initialized=true;returnToFinder=selection.returnToFinder;rentalHash=selection.rentalHash;show("ready");return true;
    }
    function initialize(){
      if(initialized)return;
      initialized=true;
      try{
        const saved=JSON.parse(window.sessionStorage?.getItem(key)||"null");
        if(saved&&set(saved,saved.choice)){
          if(typeof saved.rentalHash==="string"&&saved.rentalHash.startsWith("#rental-v1=")&&saved.rentalHash.length<=640)rentalHash=saved.rentalHash;
          stage=/^warmup:[0-2]$/.test(saved.stage)?saved.stage:choice?"result":"ready";return;
        }
      }catch{}
      set({setup:{left:["dewfin","thicketowl","cindlet"],right:["pincoil","coalmoth","glimmeray"],mode:"cpu"},
        anchor:"dewfin",partner:"thicketowl",foe:"pincoil"},null);
    }
    function attempt(kind){
      if(!attempts.has(kind))attempts.set(kind,exercise.tryMove(lesson,kind));
      return attempts.get(kind);
    }
    function eventText(e){
      const actor=name(front(e.before.sides[e.before.turn]).id);
      return actor+" · "+e.move.label+" · "+e.move.detail;
    }
    const back=()=>rentalHash?button("back","Back to the rental team",null,"Inspect all four kin or borrow this crew."):
      button("back","Back to partners",null,"Choose another pairing or return to your lineup.");
    const who=k=>name(k.id)+" "+k.hp+"/"+k.maxHp+" HP";
    function readyPage(){
      const p=lesson.ready,ally=p.sides[0],target=front(p.sides[1]);
      return {...sheet(p),title:lesson.duet+" practice",kicker:"DUET PRACTICE   /   YOUR MOVE",
        subtitle:name(lesson.foe)+" is braced. "+name(lesson.anchor)+" and "+name(lesson.partner)+" have "+ally.beats+" beats.",
        sections:[group("Choose your move",["duet","strike"].map((kind,i)=>{
          const m=i?lesson.strikeMove:lesson.duetMove;
          return button("use",m.label,kind,m.detail,{tone:i?undefined:"primary",key:String(i+1),badge:i?"STRIKE":m.cost+" BEATS"});
        })),group("Before your move",[{label:who(front(ally)),detail:"Lead",image:image(lesson.anchor)},
          {label:who(ally.team[1]),detail:"Duet partner",image:image(lesson.partner)},
          {label:who(target),detail:"Opponent · half cover",image:image(target.id)}],2),
          group("Practice table",[button("warmup","Earn the beats",0,"Play the three opening moves that brought both partners here."),
            button("film","Play from the opening bell","opening","Take your pair into a full battle in the Film Room."),back()])]};
    }
    function warmupPage(step){
      const i=Math.max(0,Math.min(2,Number(step)||0))*2,e=lesson.warmup[i],s=e.before.sides[0];
      const after=e.after.sides[0].beats;
      const explains=["Send your partner out.","Change from switching to guarding.","Switch back to your favorite to use the duet."];
      const instruction=explains[i/2]+" "+(s.beats===after?"Your beat meter is full.":"Your meter rises from "+s.beats+" to "+after+".");
      return {...sheet(e.before),title:"Earn the beats",kicker:"GUIDED OPENING   /   "+(i/2+1)+" OF 3",
        subtitle:instruction,log:i?lesson.warmup.slice(i-2,i).map(eventText):[],sections:[
          group("Your move",[button("warmup-next",e.move.label,i/2,e.move.detail,{key:"1",tone:"primary"})]),
          group("Beat meter",[{label:s.beats+" → "+e.after.sides[0].beats+" / 3 beats",detail:"Your partner duet costs "+lesson.cost+"."}]),
          group("Practice table",[button("ready","Return to the duet"),back()])]};
    }
    function outcome(kind){
      const a=attempt(kind),s=a.pos.sides[0],enemy=a.pos.sides[1];
      const ids=[lesson.anchor,lesson.partner];
      const hp=ids.map(id=>who(s.team.find(k=>k.id===id))).join(" · ");
      const active=front(s);
      return {label:a.move.label+" · "+(kind==="duet"?lesson.cost+" beats":"ordinary strike"),
        detail:hp+". "+name(active.id)+(active.hp?" leads.":" fell.")+" "+who(front(enemy))+". "+s.beats+"/3 beats.",badge:kind===choice?"PLAYED":""};
    }
    function resultPage(){
      const a=attempt(choice),other=choice==="duet"?"strike":"duet",first=a.events[0];
      return {...sheet(a.pos),title:a.move.label,kicker:"DUET PRACTICE   /   AFTER THE REPLY",
        subtitle:first.move.detail,sections:[group("Played exchange",a.events.map(e=>({
          label:name(front(e.before.sides[e.before.turn]).id)+" · "+e.move.label,detail:e.move.detail}))),
          group("From the same position",[outcome(choice),outcome(other)]),
          group("Play on",[button("use","Try "+attempt(other).move.label,other,"Return to the same HP, cover and beat meter.",{tone:"primary",key:"1"}),
            button("film","Continue this battle","continue","Take over at the next decision in the Film Room."),
            button("ready","Return to the duet"),back()])]};
    }
    function model(view){
      initialize();shortcuts.clear();
      if(!lesson)return {title:"Duet practice",sections:[group("Choose a pair",[back()])]};
      const here=view||stage;
      const page=/^warmup:[0-2]$/.test(here)?warmupPage(here.slice(-1)):
        choice&&here==="result"?resultPage():readyPage();
      for(const section of page.sections)for(const r of section.rows||[])if(r.key)shortcuts.set(r.key,r);
      return page;
    }
    function act(action,value){
      if(typeof action!=="string"||!action.startsWith("drill-"))return false;
      const cmd=action.slice(6);
      if(cmd==="back"){
        if(returnToFinder)returnToFinder();
        else if(rentalHash&&backToRental?.(rentalHash))return true;
        else if(lesson)openFinder({anchor:lesson.anchor,slot:1,team:lesson.setup.left,gear:lesson.setup.gear.left,
          foe:lesson.foe,foes:lesson.setup.right,foeGear:lesson.setup.gear.right,role:lesson.role,label:"Duet practice",
          back:()=>show(stage,"replace")},"kin:"+lesson.partner);
        else openFinder();
        return true;
      }
      if(!lesson)return true;
      if(cmd==="use"&&["duet","strike"].includes(value)){
        choice=value;playTone?.(value==="duet"?"reward":"strike");show("result","replace");
      }else if(cmd==="warmup")show("warmup:0");
      else if(cmd==="warmup-next"&&[0,1,2].includes(value)){
        playTone?.("click");show(value<2?"warmup:"+(value+1):"ready","replace");
      }else if(cmd==="ready"){choice=null;show("ready","replace");}
      else if(cmd==="film"){
        const film=exercise.film(lesson,value==="continue"&&choice?attempt(choice):undefined);
        if(film)playFilm(film.tape,value==="opening"?0:film.pivot);
        else notify("This practice film could not be prepared.");
      }
      return true;
    }
    function keydown(e){
      const r=shortcuts.get(e.key);if(!r)return false;
      if(!e.repeat)act(r.id,r.value);return true;
    }
    return {open,model,act,key:keydown};
  }
  window.WilderDuetPractice={create};
})();
