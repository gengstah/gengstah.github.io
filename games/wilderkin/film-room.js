// The Film Room practices a recorded position locally. Bellpost owns the original ledger and its turn links.
(() => {
  "use strict";
  const front=side=>side.team[side.active];
  const group=(title,rows,columns=1)=>({title,rows,columns});
  const standing=side=>side.team.filter(p=>p.hp>0).length;
  const hp=side=>side.team.reduce((sum,p)=>sum+p.hp,0);
  const tally=s=>standing(s)+" standing · "+hp(s)+" HP";
  const gearOf=(ids,kit)=>Object.fromEntries(ids.filter(id=>kit[id]).map(id=>[id,kit[id]]));
  const art={src:"ui/film-room.png",landscape:true,height:155};
  function create({game,row,image,go,render,notify,practice,returnToFilm,openFeatured,openLetter,latestHallFilm,openHallFilm,shareSource,active=()=>true}){
    const species=game.species,sim=window.WilderSparringBattle.create({game});
    const name=id=>species[id].name;
    const picture=id=>image(id,false);
    const button=(id,label,value=null,detail="",extra={})=>row("film-"+id,label,value,detail,extra);
    const backFilm=()=>button("return","Return to original film",null,"Reopen the decision you came from.");
    const show=(v,mode="push")=>go("film-room",v,mode);
    const piece=id=>window.WilderSparringGear?.byId(id);
    const profile=p=>({species:p.id,name:name(p.id),src:picture(p.id),hp:p.hp,maxHp:p.maxHp,level:p.level,types:species[p.id].types,
      ...(p.gear?{gear:{id:p.gear,name:piece(p.gear)?.name,spent:!!p.spent}}:{})});
    const snapshot=(p,seat)=>{
      const strip=i=>({label:i===seat?"You":"Coach",active:p.sides[i].active,beats:p.sides[i].beats,
        team:p.sides[i].team.map(k=>({id:k.id,...profile(k)}))});
      return {kind:"battle",background:"ui/sparring-hall.png",ally:profile(front(p.sides[seat])),foe:profile(front(p.sides[1-seat])),
        lineups:{left:strip(seat),right:strip(1-seat)}};
    };
    let input=null,book=null,seat=0,index=0,returnIndex=0,order=[],slot=0,pending=false,loading=false,restore;
    let revision=null,request=null,problem="";
    const shortcuts=new Map();
    function initialize(){
      if(restore)return restore;
      loading=true;
      restore=Promise.resolve(practice.resume()).then(res=>{
        if(!res?.ok)problem=res?.message||"The saved rehearsal could not be opened.";
      }).catch(()=>{problem="The saved rehearsal could not be opened.";}).finally(()=>{
        loading=false;if(active())render();
      });
      return restore;
    }
    async function recover(){
      const res=await practice.resume();
      if(!active())return;
      request=null;
      const latest=res?.record;
      if(latest){
        const same=input?.hash===latest.sourceHash;currentSource(latest);
        notify(same?"Another tab updated this rehearsal. Its latest turn is open.":"Another tab started a rehearsal of a different film. Its saved practice is available at the desk.");
        show(same?"play":"desk","replace");
      }else{
        notify(res?.message||"The saved rehearsal changed. Choose a film to continue.");
        show("desk","replace");
      }
    }
    const mine=()=>practice.get();
    const seatName=(i,source=book?.record)=>source?.kind==="hall"&&source.labels?.[i]?source.labels[i]:i===0?"Host":"Guest";
    function shareRows(){
      return shareSource&&book?.record.kind==="hall"?[button("share","Share original Hall film",null,"Copy a link to the recorded match.")]:[];
    }
    function bind(hash,publicHash,rosters){
      if(input?.hash!==hash){book=practice.review(hash);if(!book?.record?.teams?.[1]){input=null;book=null;return false;}}
      input={hash,publicHash:publicHash||hash,rosters:rosters||book.record.teams};
      return true;
    }
    function currentSource(run){
      if(!run||!bind(run.sourceHash,run.publicHash,run.rosters))return false;
      seat=run.seat;index=run.pivot;returnIndex=run.returnIndex;order=run.teams[seat].ids.slice();return true;
    }
    function open(record,at,context={}){
      initialize();
      if(!record?.hash||!bind(record.hash,context.publicHash,context.rosters)){notify("Choose an accepted match with two trios.");return false;}
      const n=book.events.length;
      index=Number.isInteger(at)&&at>=0?Math.min(at,Math.max(0,n-1)):
        !n?0:book.record.status==="active"?n:n-1;
      returnIndex=Math.min(index,Math.max(0,n-1));seat=book.events[index]?.before.turn??book.final.turn;
      order=[];request=null;problem="";show("source");return true;
    }
    function originalOutcome(){
      if(book.record.status!=="done")return "Film still in progress";
      const winner=book.record.winner;
      if(winner==="draw")return "Draw";
      return seatName(winner)+" won"+([0,1].includes(book.record.resigned)?" by resignation":"");
    }
    function entry(){
      const run=mine();
      return {title:"Film Room",kicker:"THE SPARRING HALL",art,subtitle:"Take either side of a recorded match. Choose a move and play out the rest against a coach.",
        sections:[group("At the projector",[
          ...(run?[button("resume",run.status==="done"?"Review your rehearsal":"Resume your rehearsal",null,
            seatName(run.seat,run.source)+" · "+run.moves.length+" practice decisions",{tone:"primary"})]:[]),
          button("featured","Rehearse Kilnbeak’s last stand",null,"Decision 8 · 22 HP. Finish Sprigkit or recover with Backdraft?",{tone:run?undefined:"primary"}),
          ...(latestHallFilm?.()?[button("hall","Rehearse your last Hall match",null,"Open the original solo battle film and choose a decision.")]:[]),
          button("letter","Open a film link",null,"Paste a Hall recording or a friend’s Bellpost battle.")]),
          ...(loading?[{text:"Opening the saved rehearsal…"}]:problem?[{text:problem}]:[])]};
    }
    const playableFrontier=()=>book.final.phase!=="done";
    function atPoint(i=index){return book.events[i]?.before||book.final;}
    const nextSeat=(i=seat)=>{
      let best=null;
      for(let n=0;n<=book.events.length;n++){
        if(n===book.events.length&&!playableFrontier())continue;
        if(atPoint(n).turn===i&&(best===null||Math.abs(n-index)<Math.abs(best-index)))best=n;
      }
      return best;
    };
    function recorded(e){
      return e?name(front(e.before.sides[e.before.turn]).id)+" used "+e.move.label+". "+e.move.detail:"The film ends here. Choose the next move in practice.";
    }
    function sourcePage(){
      const p=atPoint(),e=book.events[index],origin=book.record,run=mine();
      const exact=run?.sourceHash===input.hash&&run.pivot===index&&run.returnIndex===returnIndex&&run.seat===seat&&!run.loadout;
      return {...snapshot(p,seat),title:e?"Rehearse this decision":"Play beyond the film",
        kicker:"FILM ROOM   /   "+(e?"DECISION "+(index+1)+" OF "+book.events.length:"END OF RECORDING"),
        subtitle:seatName(seat)+"’s "+name(front(p.sides[seat]).id)+" faces "+name(front(p.sides[1-seat]).id)+".",
        log:[e?seatName(e.before.turn)+" on film · "+e.move.label:originalOutcome()],
        sections:[group("Your rehearsal",[
          button(exact?"resume":"take",exact?(run.status==="done"?"Review this rehearsal":"Resume this rehearsal"):"Play as "+seatName(seat),null,
            loading?"Opening saved rehearsals…":e?"Recorded move · "+e.move.label:"Continue from this position.",{tone:"primary",disabled:loading}),
          button("decisions","Choose another seat or decision",null,"Inspect the original moves before taking a turn."),
          button("redraft","Redraft the opening",null,input.rosters[seat].ids.length===4?"Choose three of the registered four with their gear.":"Choose a different lead and reserve order from the original trio.")]),
          {title:"On the original film",text:recorded(e)+" "+(origin.status==="done"?originalOutcome()+".":"")},
          group("Original match",[button("source-crew","Inspect the original trios"),backFilm(),...shareRows(),button("desk","Film Room desk")],2)]};
    }
    function decisions(page=0){
      const picks=book.events.map((e,n)=>({n,e})).filter(({e})=>e.before.turn===seat);
      if(playableFrontier()&&book.final.turn===seat)picks.push({n:book.events.length});
      const pages=Math.max(1,Math.ceil(picks.length/6));page=Math.max(0,Math.min(pages-1,page));
      return {title:"Choose a decision",kicker:"FILM ROOM   /   ORIGINAL FILM",subtitle:"You’ll control the chosen side. The coach plays the other trio.",
        sections:[group("Choose your seat",[0,1].map(s=>button("seat",seatName(s),s,book.record.teams[s].ids.map(name).join(" · "),
          {badge:s===seat?"Selected":"",image:picture(book.record.teams[s].ids[0])})),2),
          group(seatName(seat)+"’s decisions · "+(page+1)+" / "+pages,picks.slice(page*6,page*6+6).map(({n,e})=>button("decision",e?e.move.label:"After the last recorded move",n,
            e?name(front(e.before.sides[seat]).id)+" · "+e.move.detail:"Continue from the film’s final position.",{badge:e?"#"+(n+1):"Frontier"}))),
          group("Film controls",[
            ...(page?[button("list","Previous six",page-1)]:[]),...(page+1<pages?[button("list","Next six",page+1)]:[]),
            button("source","Back to the decision"),backFilm()],2)]};
    }
    function roster(){
      const pool=input.rosters[seat],original=book.record.teams[seat];
      return {title:"Redraft "+seatName(seat)+"’s opening",kicker:"FILM ROOM   /   OPENING REHEARSAL",
        subtitle:"Keep the original opponent and opening seat. "+seatName(book.record.first)+" moves first. Each kin keeps its published gear.",
        sections:[group("Your battle order",order.map((id,i)=>button("slot",name(id),i,species[id].types.join(" / ")+" · "+(piece(pool.gear[id])?.name||"No gear"),
          {image:picture(id),badge:i?"Reserve "+i:"Lead"}))),
          ...(pool.ids.length===4?[{title:"Sitting out",text:pool.ids.filter(id=>!order.includes(id)).map(name).join(" · ")+" · select a slot above to bring this kin in."}]:[]),
          group("At the opening bell",[button("open-play","Play this opening",null,order.map(name).join(" → "),{tone:"primary"}),
            button("redraft-seat","Redraft "+seatName(1-seat)+"’s side",1-seat),button("source","Back to the decision")]),
          {title:"Recorded "+seatName(seat)+" lineup",text:original.ids.map(name).join(" → ")}]};
    }
    function candidates(){
      const pool=input.rosters[seat],old=order[slot];
      return {title:slot?"Choose reserve "+slot:"Choose your opening lead",kicker:"FILM ROOM   /   "+seatName(seat).toUpperCase(),
        sections:[group("Registered kin",pool.ids.map(id=>button("put",name(id),id,id===old?"Holds this slot.":order.includes(id)?
          "Trade places with "+name(old)+".":name(old)+" will sit out.",{image:picture(id),badge:piece(pool.gear[id])?.name,disabled:id===old}))),
          group("Your order",[button("roster","Back to the lineup")])]};
    }
    const roleNames={signature:"Signature moves","ember-art":"Ember techniques",duet:"Duets",swap:"Switch kin"};
    function moveRow(move,key){
      const extra={disabled:!move.available,tone:move.available?"primary":undefined};
      if(key){extra.key=key;if(move.available)shortcuts.set(key.toLowerCase(),move.id);}
      return button("move",move.label,move.id,move.reason||move.detail,extra);
    }
    function crewPage(p,side,historical){
      return {title:historical?"Trios on the original film":"Trios in rehearsal",kicker:"FILM ROOM   /   ACTION "+(p.ply+1),sections:[
        group("At the ring",[historical?button("source","Return to the original decision"):button("resume","Return to rehearsal")]),...[side,1-side].map(i=>group(historical?seatName(i)+"’s trio":i===side?"Your trio":"Coach’s trio",p.sides[i].team.map((k,j)=>({
          label:name(k.id),badge:k.hp===0?"Down":j===p.sides[i].active?"Lead":"Reserve",image:picture(k.id),
          detail:k.hp+"/"+k.maxHp+" HP · "+(piece(k.gear)?.name||"No gear")+(k.spent?" (spent)":"")+(k.exposed?" · exposed":"")+(k.emberArtSpent?" · Ember technique used":"")
        }))))]};
    }
    function runPage(run,view){
      const p=run.pos,side=run.seat;
      if(p.phase==="done")return finish(run);
      const opts=sim.options(p),lead=front(p.sides[side]),last=run.events.at(-1);
      if(view==="crew")return crewPage(p,side,false);
      if(view==="partners"&&p.phase==="move")return {title:"Team moves",kicker:"REHEARSAL   /   "+name(lead.id).toUpperCase(),subtitle:p.sides[side].beats+" / 3 beats",sections:[
        group("At the ring",[button("resume","Return to your moves")]),
        ...Object.entries(roleNames).flatMap(([kind,label])=>{
          const moves=opts.filter(o=>o.kind===kind);return moves.length?[group(label,moves.map(o=>moveRow(o)))]:[];
        })]};
      const orig=book.events[run.pivot],opening=run.loadout&&run.pivot===0;
      const start=opening?"Redrafted opening · "+run.teams[side].ids.map(name).join(" → "):orig?"On film · "+orig.move.label:"Beyond the recorded film";
      const controls=p.phase==="replace"?group("Choose a free replacement",opts.map((o,i)=>moveRow(o,String.fromCharCode(65+i)))):
        group("Your move",[
          ...opts.filter(o=>["attack","guard","heal"].includes(o.kind)).map((o,i)=>moveRow(o,String(i+1))),
          ...opts.filter(o=>o.id==="vent:backdraft").map(o=>moveRow(o)),
          button("partners","Team moves",null,"Switch, duet and companion techniques · "+p.sides[side].beats+"/3 beats",{key:"D"})],2);
      const log=run.events.slice(-2).map(e=>(e.before.turn===side?"You":"Coach")+" · "+name(front(e.before.sides[e.before.turn]).id)+" · "+e.move.label+" · "+e.move.detail);
      return {...snapshot(p,side),title:p.phase==="replace"?"Choose your next kin":"Your rehearsal turn",
        kicker:"FILM ROOM   /   "+seatName(side).toUpperCase()+"   /   ACTION "+(p.ply+1),
        subtitle:start,log:last?log:[start],sections:[controls,group("Rehearsal desk",[
          button("crew","Inspect both trios"),button("compare","Compare with the film"),button("retry","Retry this rehearsal"),
          backFilm(),...shareRows()],2)]};
    }
    function compare(run,finished){
      const a=run.seat,orig=book.final,p=run.pos;
      const outcome=p.phase==="done"?p.winner==="draw"?"Draw":p.winner===a?"You won":"Coach won":"Still in play";
      const grade=pos=>tally(pos.sides[a])+" for "+seatName(a)+" · "+tally(pos.sides[1-a])+" for "+seatName(1-a);
      const first=run.events[0],original=book.events[run.pivot];
      const rows=[{label:"Original · "+originalOutcome(),detail:grade(orig)},
        {label:"Rehearsal · "+outcome,detail:grade(p)}];
      if(first&&original)rows.push({label:"First decision from the fork",detail:"Film · "+original.move.label+". Rehearsal · "+first.move.label+"."});
      return {title:finished?"Rehearsal result":"Film comparison",kicker:"FILM ROOM   /   "+seatName(a).toUpperCase(),
        subtitle:(run.loadout?"Opening lineup · "+run.teams[a].ids.map(name).join(" → "):"Rehearsed from decision "+(run.pivot+1))+
          ". "+(book.record.status==="done"?"Original film ends after "+book.record.moves.length+" decisions.":"Original film stops with the official match still in progress."),
        sections:[group("Original and rehearsal",rows),
          group("Projection room",[
            ...(!finished?[button("resume","Continue rehearsal",null,"Take the next turn.",{tone:"primary"})]:[]),
            button("retry","Retry from the same position"),button("other","Rehearse another decision"),button("redraft","Redraft the opening"),
            backFilm(),...shareRows()],2)]};
    }
    function finish(run){return compare(run,true);}
    function replacePage(){
      return {title:"Replace your active rehearsal?",kicker:"FILM ROOM   /   LOCAL SAVE",
        subtitle:"Starting here will replace the rehearsal saved on this device. The original match and its film stay available.",
        sections:[group("Your rehearsal",[button("confirm","Start this rehearsal",null,"Replace the saved practice run.",{tone:"primary"}),button("resume","Keep playing the saved rehearsal"),button("cancel","Back to my selection")])]};
    }
    function model(value){
      initialize();shortcuts.clear();const [part,num]=String(value||"desk").split("|"),run=mine();
      revision=run?.revision??null;
      if(part==="desk")return entry();
      if(["play","partners","crew","compare"].includes(part)&&run&&currentSource(run))return part==="compare"?compare(run,false):runPage(run,part);
      if(part==="replace"&&request)return replacePage();
      if(!input||!book)return entry();
      if(part==="source-crew")return crewPage(atPoint(),seat,true);
      if(part==="decisions")return decisions(Number(num)||0);
      if(part==="redraft"&&order.length===3)return roster();
      if(part==="candidates"&&order.length===3)return candidates();
      return sourcePage();
    }
    async function launch(force=false){
      if(!request||pending)return;
      const run=mine(),choice=request;
      if(run?.status==="active"&&!force){show("replace");return;}
      pending=true;
      try{
        const res=await practice.start({...choice,replace:!!run,expectedRevision:revision});
        if(res.code==="changed"){await recover();return;}
        if(!active())return;
        if(!res.ok){notify(res.message);return;}
        currentSource(res.record);request=null;show("play","replace");
      }catch{if(active())notify("The rehearsal could not be opened.");}
      finally{pending=false;if(active())render();}
    }
    function prepare(redraft){
      request={sourceHash:input.hash,publicHash:input.publicHash,seat,pivot:redraft?0:index,returnIndex,
        ...(redraft?{loadout:{ids:order.slice(),gear:gearOf(order,input.rosters[seat].gear)}}:{})};
      void launch();
    }
    function act(action,value,current){
      if(action==="spar-view"&&value==="equipment"){
        if(current==="source"&&input)show("source-crew");
        else if(mine())show("crew");
        return true;
      }
      if(typeof action!=="string"||!action.startsWith("film-"))return false;
      const id=action.slice(5);
      if(pending)return true;
      if(id==="featured"){openFeatured?.();return true;}
      if(id==="letter"){openLetter?.();return true;}
      if(id==="hall"){openHallFilm?.();return true;}
      if(id==="share"){if(book?.record.kind==="hall"&&input?.publicHash)shareSource?.(input.publicHash);return true;}
      if(id==="desk"){show("desk");return true;}
      if(id==="resume"){if(currentSource(mine()))show("play","replace");return true;}
      if(id==="return"){if(input)returnToFilm?.(input.hash,input.publicHash,returnIndex);return true;}
      if(!input)return true;
      if(id==="source"||id==="source-crew"){show(id);return true;}
      if(id==="decisions"||id==="list"||id==="seat"||id==="other"){
        let page=Number(value)||0;
        if(id==="seat"&&[0,1].includes(Number(value)))seat=Number(value);
        if(id==="decisions"||id==="other"){
          const cursor=nextSeat();page=Math.floor(book.events.slice(0,cursor??0).filter(e=>e.before.turn===seat).length/6);
        }else if(id==="seat")page=0;
        show("decisions|"+Math.max(0,page));return true;
      }
      if(id==="decision"){
        const n=Number(value);if(Number.isInteger(n)&&n>=0&&n<=book.events.length&&(n<book.events.length||playableFrontier())&&atPoint(n).turn===seat){
          index=n;show("source");}return true;
      }
      if(id==="redraft"||id==="redraft-seat"){
        if(id==="redraft-seat"&&[0,1].includes(Number(value)))seat=Number(value);
        order=book.record.teams[seat].ids.slice();slot=0;show("redraft");return true;
      }
      if(id==="slot"){if(Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<3){slot=Number(value);show("candidates");}return true;}
      if(id==="put"){
        if(input.rosters[seat].ids.includes(value)){
          const prev=order.indexOf(value);if(prev>=0)order[prev]=order[slot];order[slot]=value;show("redraft","replace");
        }return true;
      }
      if(id==="roster"){show("redraft");return true;}
      if(id==="take"||id==="open-play"){if(loading)return true;prepare(id==="open-play");return true;}
      if(id==="confirm"){void launch(true);return true;}
      if(id==="cancel"){const wasOpening=!!request?.loadout;request=null;show(wasOpening?"redraft":"source","replace");return true;}
      if(id==="partners"||id==="crew"||id==="compare"){show(id);return true;}
      if(id==="move"||id==="retry"){
        const res=id==="move"?practice.play(value,revision):practice.retry(revision);
        if(res.code==="changed"){
          pending=true;
          void recover().finally(()=>{pending=false;if(active())render();});return true;
        }
        if(!res.ok)notify(res.message);else currentSource(res.record);
        show("play","replace");return true;
      }
      return true;
    }
    function key(e,current){
      if(e.repeat||pending)return false;
      const k=e.key.toLowerCase(),move=shortcuts.get(k);
      if(move){act("film-move",move,current);return true;}
      if(k==="d"&&current==="play"&&mine()?.pos.phase==="move"){act("film-partners");return true;}
      return false;
    }
    return {open,model,act,key,ready:initialize};
  }
  window.WilderFilmRoom={create};
})();
