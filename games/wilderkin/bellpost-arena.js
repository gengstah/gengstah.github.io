// A Bellpost match is the same level-20 duel on both devices. The viewer's seat only changes the controls and the camera.
(() => {
  "use strict";
  function create({game,row,image,rehearse=false}){
    const species=game.species,sim=window.WilderSparringBattle.create({species});
    const name=id=>species[id].name,front=side=>side.team[side.active];
    const group=(title,rows,columns=1)=>({title,rows,columns});
    const button=(id,label,value,detail="",extra={})=>row("post-"+id,label,value,detail,extra);
    const back=()=>button("battle","Back to the battle");
    const order=r=>r.seat===1?[1,0]:[0,1];
    const sideName=(r,i)=>r.labels?.[i]||(r.seat===0||r.seat===1?r.seat===i?"You":"Friend":i===0?"Host":"Guest");
    const possessive=(r,i)=>r.seat===i?"Your":sideName(r,i)+"’s";
    const done=r=>r.status==="done"||r.pos.phase==="done";
    const resigned=r=>r.resigned===0||r.resigned===1||r.resigned===true;
    const item=id=>window.WilderSparringGear?.byId(id);
    const parts={strike:"strike",guard:"guard",care:"recovery",switch:"switch"};
    let cached=null;

    function tape(r){
      const token=JSON.stringify([r.protocol,r.teams,r.first,r.moves]);
      if(cached?.token===token)return cached.events;
      const [a,b]=r.teams;
      let pos=sim.start(a.ids,b.ids,r.first,{left:a.gear||{},right:b.gear||{}},r.protocol);
      const events=[];
      for(const id of r.moves){
        const move=sim.forecast(pos,id),after=move?.available?sim.apply(pos,id):null;
        if(!after)break;
        events.push({before:pos,move,after});pos=after;
      }
      cached={token,events};return events;
    }
    function profile(p){
      const held=item(p.gear);
      return {name:name(p.id),species:p.id,src:image(p.id),hp:p.hp,maxHp:p.maxHp,level:p.level,types:species[p.id].types,
        gear:held?{id:held.id,name:held.name,spent:p.spent}:null};
    }
    function snapshot(r,pos){
      const [left,right]=order(r);
      const strip=i=>({label:sideName(r,i),active:pos.sides[i].active,beats:pos.sides[i].beats,
        team:pos.sides[i].team.map(p=>({id:p.id,...profile(p)}))});
      return {kind:"battle",background:"ui/sparring-hall.png",ally:profile(front(pos.sides[left])),foe:profile(front(pos.sides[right])),
        lineups:{left:strip(left),right:strip(right)}};
    }
    function changeRows(r,e){
      const rows=[];
      for(const i of order(r)){
        const before=e.before.sides[i],after=e.after.sides[i],side=sideName(r,i);
        for(const [j,p] of after.team.entries()){
          const delta=p.hp-before.team[j].hp;
          if(p.emberArtSpent&&!before.team[j].emberArtSpent&&species[p.id].emberArt)rows.push({label:name(p.id)+" spent "+species[p.id].emberArt.name,detail:side+" · its technique is used for this match."});
          if(delta)rows.push({label:name(p.id)+" "+(delta>0?"+":"−")+Math.abs(delta)+" HP",
            detail:side+" · "+before.team[j].hp+" → "+p.hp+" / "+p.maxHp+" HP"+(p.hp===0?" · knocked out":""),image:image(p.id)});
        }
        if(before.active!==after.active)rows.push({label:name(front(after).id)+" took the lead",detail:side+" · replaced "+name(front(before).id)});
        if(before.beats!==after.beats)rows.push({label:side+" · "+after.beats+"/3 beats",detail:before.beats+" → "+after.beats+" beats"});
      }
      return rows;
    }
    function eventLabel(r,e){
      return possessive(r,e.before.turn)+" "+name(front(e.before.sides[e.before.turn]).id)+" · "+e.move.label;
    }
    function latest(r,e){
      if(!e)return [];
      const hit=changeRows(r,e).filter(x=>x.label.endsWith(" HP")).map(x=>x.label);
      return [eventLabel(r,e)+(hit.length?" · "+hit.join(", "):"")];
    }
    function result(r){
      if(r.winner==="draw")return "Match drawn";
      if(r.seat===r.winner)return "You won";
      return sideName(r,r.winner)+" won";
    }
    function verdict(r) {
      if(resigned(r))return (r.seat===1-r.winner?"You resigned.":sideName(r,1-r.winner)+" resigned.");
      if(r.winner==="draw")return "Both trios finished level on standing kin and remaining HP percentage.";
      const survivors=r.pos.sides.map(s=>s.team.filter(p=>p.hp>0).length);
      if(Math.min(...survivors)===0)return sideName(r,r.winner)+" finished with "+survivors[r.winner]+" standing.";
      return "Action limit reached. "+(survivors[0]===survivors[1]?"Remaining team HP percentages decided the match.":"Standing kin decided the match.");
    }
    function crew(r,pos){
      return order(r).map(i=>{
        const s=pos.sides[i],status=[s.beats+"/3 beats"];
        if(s.lastPart)status.push("last part was "+(parts[s.lastPart]||s.lastPart));
        if(s.cover<1)status.push(s.cover===.25?"quarter incoming damage":"half incoming damage");
        if(s.pinned)status.push("switch pinned");
        if(s.thornRead)status.push("Thorn Read set");
        if(s.familyPassUsed)status.push("family pass spent");
        return group(sideName(r,i)+" · "+status.join(" · "),s.team.map((p,j)=>{
          const gear=item(p.gear),sig=window.WilderSparringSignatures?.byId(p.id);
          const detail=[p.hp+"/"+p.maxHp+" HP",species[p.id].types.join(" / ")];
          const art=r.protocol===1?null:species[p.id].emberArt;
          if(art)detail.push(art.name+" · "+(p.emberArtSpent?"used":"ready"));
          if(p.exposed)detail.push("exposed");
          if(!p.recovery)detail.push("recovery spent");
          if(sig)detail.push(sig.name+" "+(window.WilderSparringSignatures.used(s,p.id)?"used":"ready"));
          if(gear)detail.push(gear.name+" · "+(p.spent?"used":gear.trigger+" "+gear.effect));
          return {label:name(p.id),badge:p.hp===0?"DOWN":j===s.active?"LEAD":"RESERVE",detail:detail.join(" · "),image:image(p.id)};
        }));
      });
    }
    function moveRow(o){
      return button("move",o.label,o.id,o.available?o.detail:o.reason||o.detail,{disabled:!o.available,
        ...(o.cost?{badge:o.cost+" beat"+(o.cost===1?"":"s")}:{})});
    }
    function model(r,panel=""){
      const p=r.pos,events=tape(r),isDone=done(r),mine=!isDone&&r.seat===p.turn,lead=name(front(p.sides[p.turn]).id);
      const page={...snapshot(r,p),title:isDone?result(r):mine?p.phase==="replace"?"Choose your next lead":"Your turn":possessive(r,p.turn)+" turn",
        kicker:(r.kind==="hall"?"HALL FILM":"BELLPOST")+"   /   ACTION "+Math.min(isDone?p.ply:p.ply+1,p.limit)+" OF "+p.limit,log:latest(r,events.at(-1)),sections:[]};
      if(isDone)page.subtitle=verdict(r);
      else if(!mine)page.subtitle=possessive(r,p.turn)+" "+lead+(p.phase==="replace"?" needs a replacement.":" has the next move.");
      if(panel==="crew")return {title:"Meet the trios",kicker:(r.kind==="hall"?"HALL FILM":"BELLPOST")+"   /   EQUIPMENT",sections:[group("Battle floor",[back()]),...crew(r,p)]};
      if(mine){
        const opts=sim.options(p);
        if(p.phase==="replace")page.sections.push(group("Free replacement · you act again",
          opts.map((o,i)=>({...moveRow(o),key:String.fromCharCode(65+i)})),2));
        else if(panel==="partners"){
          const sections=[group("Battle floor",[back()])],art=species[front(p.sides[p.turn]).id].emberArt;
          const tech=opts.filter(o=>o.kind==="ember-art");
          if(r.protocol!==1&&art&&tech.length)sections.push(group(art.name+" · once per kin",tech.map(o=>({...moveRow(o),detail:window.WilderEmberPartners?.forecastDetail(sim,p,o)||o.reason||o.detail}))));
          for(const [kind,title] of [["signature","Signature"],["duet","Duets"],["swap","Switch kin"]]){
            const moves=opts.filter(o=>o.kind===kind);if(moves.length)sections.push(group(title,moves.map(moveRow),2));
          }
          return {title:"Team moves",kicker:"BELLPOST   /   "+lead.toUpperCase(),subtitle:p.sides[p.turn].beats+"/3 beats",sections};
        }else{
          const skills=opts.filter(o=>["attack","guard","heal"].includes(o.kind)).map((o,i)=>({...moveRow(o),key:String(i+1)}));
          const special=opts.find(o=>o.kind==="signature"),sig=special&&window.WilderSparringSignatures.byId(special.signatureId);
          const art=r.protocol===1?null:species[front(p.sides[p.turn]).id].emberArt;
          const panelLabel=art?art.name+" & team moves":sig?sig.name+" & team moves":"Team moves";
          skills.push(button("panel",panelLabel,"partners","Switch kin or call a duet · "+p.sides[p.turn].beats+"/3 beats",{key:"D"}));
          page.sections.push(group("Choose a move",skills,2));
        }
      }
      const desk=[button("panel","Inspect trios","crew","Health, beats and equipment")];
      if(events.length||isDone)desk.unshift(button("film","Battle film",events.length-1,events.length+" recorded decisions"));
      if(rehearse)desk.push(button("rehearse","Practice this match",null,"Take either team into a private rematch against the coach."));
      page.sections.push(group("At the ring",desk,2));return page;
    }
    function review(r,index,panel=""){
      const events=tape(r),last=events.length-1;
      if(!events.length)return {title:"Battle film",kicker:"BELLPOST",subtitle:done(r)?result(r)+". "+verdict(r):"The opening move is still to come.",
        sections:[group("At the ring",[...(rehearse?[button("rehearse","Try the opening",0)]:[]),back()])]};
      const num=Number(index),at=index===null||index===undefined||!Number.isInteger(num)||num<0?last:Math.min(num,last),e=events[at];
      if(panel==="crew")return {title:"Trios on film",kicker:(r.kind==="hall"?"HALL FILM":"BELLPOST")+"   /   DECISION "+(at+1),
        sections:[group("Film controls",[button("film-step","Return to this decision",at)]),...crew(r,e.after)]};
      const replace=e.move.kind==="replace",sections=[],nav=[];
      if(at>0)nav.push(button("film-step","Previous",at-1));
      if(at<last)nav.push(button("film-step","Next",at+1));
      nav.push(back());sections.push(group("Film controls",nav,nav.length));
      if(rehearse)sections.push(group("Film Room",[button("rehearse","Try this decision",at,"Take control before "+e.move.label+" and play out your own ending.",{tone:"primary"})]));
      const changes=changeRows(r,e);
      sections.push({title:eventLabel(r,e),text:e.move.detail});
      if(changes.length)sections.push(group("What changed",changes,2));
      if(done(r)&&at===last)sections.push({title:result(r),text:verdict(r)});
      const first=Math.floor(at/6)*6,near=events.slice(first,first+6).map((entry,j)=>button("film-step",entry.move.label,first+j,
        sideName(r,entry.before.turn)+" · "+name(front(entry.before.sides[entry.before.turn]).id),{badge:first+j===at?"HERE":String(first+j+1)}));
      if(first>0)near.unshift(button("film-step","Earlier decisions",first-1));
      if(first+6<=last)near.push(button("film-step","Later decisions",first+6));
      sections.push(group("Decisions "+(first+1)+"–"+Math.min(first+6,events.length),near,2));
      return {...snapshot(r,e.after),title:"Battle film",kicker:"DECISION "+(at+1)+" OF "+events.length,
        subtitle:replace?"Free replacement before action "+(e.before.ply+1):"Action "+(e.before.ply+1)+" · "+eventLabel(r,e),sections};
    }
    return {model,review};
  }
  // A completed public Scout Table match. The guest's eighth decision starts at 22 HP.
  const featured={index:7,publicHash:"#scout-bout1="+
    "3b4c8f910c03d2e92d0ced0b.e82fb3acf96ef00de47af39880b04b712fa1a14e413a7e74e3c644e906bd5772."+
    "9b097cc6944894c0e48003ba.cindlet,dewfin,gustlance~mender-wrap,kilnbeak~prism-lens."+
    "cindlet,dewfin~last-stitch,mossbell,sprigkit~opening-pennant.5dc1bc0b3868c338a742f7f7f0d0b901."+
    "7b0296555e9984484453c96b0fd2e36406d5f7b2369426b5803713c6d2485970.320.0f7096cfaa1417a7b74697610f66db72."+
    "321.328230b1c8c34257f4a37e18f4a9dc14!BCKABCBJNANBBBBBBBBMAJAAAMAAAAA!x"};
  window.WilderBellpostArena={create,featured};
})();
