// Iona remembers the first campaign performance of each of her three bell parts.
(() => {
  "use strict";
  const parts=[
    {id:"first",name:"The departure bell",task:"Play a duet, then bring in a third companion with its own skill on the next turn."},
    {id:"guard",name:"The storm bell",task:"Send the third kin in with a guarding skill. Weather a charged hit and stay standing."},
    {id:"warden",name:"The home bell",task:"Finish a trio during a Warden trial, then win the trial."}
  ];
  const members=n=>[n.source,n.partner,n.third];
  const guarded=n=>n.role==="guard"&&n.charged&&n.damageTaken>0&&n.hpAfter>0;
  function proof(raw,{species,regions,party}){
    if(!raw||!Number.isInteger(raw.region)||!regions[raw.region]||!["wild","expedition","warden"].includes(raw.kind)||
      raw.kind==="warden"&&!regions[raw.region].warden||typeof raw.foe!=="string"||!Object.hasOwn(species,raw.foe)||!Number.isSafeInteger(raw.turn)||raw.turn<2||raw.turn>1000000)return null;
    const group=members(raw);
    if(new Set(group).size!==3||!group.every(id=>typeof id==="string"&&Object.hasOwn(species,id)&&party.some(k=>k.id===id)))return null;
    const move=species[raw.third].skills.find(s=>s.id===raw.skill&&s.kind===raw.role);
    if(!move||!["attack","guard","heal"].includes(move.kind)||typeof raw.charged!=="boolean"||
      ![raw.damageTaken,raw.hpAfter].every(v=>Number.isSafeInteger(v)&&v>=0&&v<=10000))return null;
    const {source,partner,third,skill,role,foe,region,kind,turn,charged,damageTaken,hpAfter}=raw;
    return {source,partner,third,skill,role,foe,region,kind,turn,charged,damageTaken,hpAfter};
  }
  function restore(raw,ctx){
    const book={};
    for(const p of parts){
      const n=proof(raw?.[p.id],ctx);
      if(n&&(p.id!=="guard"||guarded(n))&&(p.id!=="warden"||n.kind==="warden"))book[p.id]=n;
    }
    return book;
  }
  function record(state,n){
    const book=state.thirdBeat||={};
    if(!book.first)book.first={...n};
    if(!book.guard&&guarded(n))book.guard={...n};
  }
  function win(state,n){
    if(!n||n.kind!=="warden")return;
    const book=state.thirdBeat||={};
    if(!book.warden)book.warden={...n};
  }
  function describe(g,n){
    const [a,b,c]=members(n).map(id=>g.kin(id,{owned:true}).name),move=g.species[n.third].skills.find(s=>s.id===n.skill);
    const place=g.regions[n.region],foe=g.species[n.foe].name;
    return a+" and "+b+" handed off to "+c+". "+move.name+" against "+foe+", turn "+n.turn+" in "+place.name+".";
  }
  // Three registers keep the lead, duet partner and incoming kin audible even
  // when they share an affinity. The winning Warden trio signs the bell call.
  function song(g){
    const book=g.state.thirdBeat;
    if(!parts.every(p=>book?.[p.id]))return null;
    const notes=["C","D","E","G","A"],offsets=[0,2,4,7,9];
    const scale={Grove:0,Ember:2,Tide:1,Vane:3,Loam:0,Gloam:1,Rime:4,Arc:3,Alloy:2,Chime:4,Neutral:1};
    return members(book.warden).map((id,i)=>{
      const kin=g.kin(id,{owned:true}),degree=scale[kin.type]??0,octave=i+3;
      return {id,name:kin.name,note:notes[degree]+octave,hz:440*2**((12*(octave+1)+offsets[degree]-69)/12)};
    });
  }
  function receipt(g,n,row){
    const book=g.state.thirdBeat||{};
    const marks=parts.filter(p=>{
      const ink=book[p.id];
      return ink&&ink.region===n.region&&ink.kind===n.kind&&ink.foe===n.foe&&ink.turn===n.turn&&
        ink.skill===n.skill&&members(n).every((id,i)=>members(ink)[i]===id);
    });
    return {title:"Three-Bell Landing",text:describe(g,n),rows:[row("nav","Read Iona’s score","third-beat",marks.map(p=>p.name).join(" · "))]};
  }
  function model({game:g,row,image},value){
    const book=g.state.thirdBeat||{},call=song(g),count=parts.filter(p=>book[p.id]).length;
    const actions=g.state.battle?[row("root","Return to your encounter")]:[
      row("open-trios","Choose three companions",null,"Pick a favorite, a duet partner and the next kin to take the lead.",{tone:"primary"}),
      row("walk-kind","Follow local tracks","wild|tracks","Try your opening in a campaign encounter.")];
    if(g.regions[g.state.region].warden&&!g.state.battle)actions.push(row("walk-kind","Visit Warden "+g.regions[g.state.region].warden,"warden|warden",g.regions[g.state.region].lodge));
    const sections=[{rows:actions}];
    if(call)sections.unshift({title:"Your ferry call",text:"Iona tuned three bells for the party that brought the home bell back.",rows:[
      row("ring-trio","Ring the three bells",null,call.map(p=>p.name+" · "+p.note).join(" → "),{tone:"primary"})]});
    if(value==="song"&&call)sections.unshift({title:"The call across the water",text:call.map(p=>p.name+" sounds "+p.note).join(". ")+". The ferryman answers from the far bank."});
    for(const p of parts){
      const n=book[p.id];
      if(!n){sections.push({title:p.name,text:p.task});continue;}
      const witness=p.id==="guard"?" Took "+n.damageTaken+" damage and held on at "+n.hpAfter+" HP.":
        p.id==="warden"?" Warden "+g.regions[n.region].warden+" yielded.":"";
      sections.push({title:p.name,text:describe(g,n)+witness,rows:[row("open-kin",g.kin(n.third,{owned:true}).name+" · "+
        g.species[n.third].skills.find(s=>s.id===n.skill).name,n.third,"",{image:image(n.third,true),badge:"RECORDED"})]});
    }
    return {title:"Three-Bell Landing",kicker:"IONA RILL   /   "+count+" OF 3 BELLS",art:{src:"ui/iona-rill.png",landscape:true,height:142},
      subtitle:count===3?"“Hear that? They know your team on the other bank.”":count?"“There’s your first phrase. Let’s see how it sounds in rough water.”":"“Two bells tell the ferryman to cast off. The third tells him who’s coming home.” Iona holds out her mallet.",
      sections};
  }
  window.WilderThirdBeat=Object.freeze({restore,record,win,receipt,model,song});
})();
